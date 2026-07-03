using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>Configuração de SLA (dias) por etapa do funil de candidaturas.</summary>
[ApiController]
[Route("api/configuracoes/sla-etapas")]
[Authorize]
public sealed class SlaEtapaConfigController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public SlaEtapaConfigController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SlaEtapaConfigItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var configs = await _db.SlaEtapaCandidaturaConfigs.AsNoTracking().ToListAsync(ct);
        var map = configs.ToDictionary(c => c.Etapa);

        var items = SlaEtapaDefaults.Configuraveis.Select(etapa =>
        {
            map.TryGetValue(etapa, out var cfg);
            return new SlaEtapaConfigItemResponse(
                Etapa: etapa.ToString(),
                Label: EtapaLabel(etapa),
                SlaDias: cfg?.SlaDias ?? SlaEtapaDefaults.GetDias(etapa),
                DefaultDias: SlaEtapaDefaults.GetDias(etapa),
                Ativo: cfg?.Ativo ?? false,
                ConfiguradoId: cfg?.Id);
        }).ToList();

        return Ok(items);
    }

    [HttpPut]
    [ProducesResponseType(typeof(IReadOnlyList<SlaEtapaConfigItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] IReadOnlyList<SlaEtapaConfigUpsertItem> items, CancellationToken ct)
    {
        if (!User.HasClaim(PermissionConstants.ClaimType, "sla.etapas.manage"))
            return Forbid();

        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant não identificado.");
        var now = DateTimeOffset.UtcNow;

        foreach (var item in items)
        {
            if (!Enum.TryParse<EtapaMacroCandidatura>(item.Etapa, ignoreCase: false, out var etapa))
                return BadRequest($"Etapa inválida: {item.Etapa}");

            if (!SlaEtapaDefaults.Configuraveis.Contains(etapa))
                return BadRequest($"Etapa não configurável: {item.Etapa}");

            if (item.SlaDias < 1 || item.SlaDias > 365)
                return BadRequest($"SLA inválido para {item.Etapa}: use entre 1 e 365 dias.");

            var existing = await _db.SlaEtapaCandidaturaConfigs
                .FirstOrDefaultAsync(x => x.Etapa == etapa, ct);

            if (existing is null)
            {
                _db.SlaEtapaCandidaturaConfigs.Add(new SlaEtapaCandidaturaConfig
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Etapa = etapa,
                    SlaDias = item.SlaDias,
                    Ativo = item.Ativo,
                    UpdatedAtUtc = now,
                });
            }
            else
            {
                existing.SlaDias = item.SlaDias;
                existing.Ativo = item.Ativo;
                existing.UpdatedAtUtc = now;
            }
        }

        await _db.SaveChangesAsync(ct);
        return await Get(ct);
    }

    private static string EtapaLabel(EtapaMacroCandidatura etapa) => etapa switch
    {
        EtapaMacroCandidatura.Aplicada => "Candidatura recebida",
        EtapaMacroCandidatura.EmTriagem => "Triagem",
        EtapaMacroCandidatura.Entrevista => "Entrevista",
        EtapaMacroCandidatura.EntrevistaTecnica => "Entrevista técnica",
        EtapaMacroCandidatura.Teste => "Teste / avaliação",
        EtapaMacroCandidatura.Proposta => "Proposta",
        _ => etapa.ToString(),
    };
}

public record SlaEtapaConfigItemResponse(
    string Etapa,
    string Label,
    int SlaDias,
    int DefaultDias,
    bool Ativo,
    Guid? ConfiguradoId);

public record SlaEtapaConfigUpsertItem(
    string Etapa,
    int SlaDias,
    bool Ativo);
