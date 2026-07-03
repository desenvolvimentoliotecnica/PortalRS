using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Time;

namespace RhPortal.Api.Controllers;

/// <summary>Dashboard de SLA de vagas e triagem.</summary>
[ApiController]
[Route("api/sla")]
[Authorize]
public sealed class SlaController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SlaVagaOptions _slaOptions;

    public SlaController(AppDbContext db, IOptions<SlaVagaOptions> slaOptions)
    {
        _db = db;
        _slaOptions = slaOptions.Value;
    }

    /// <summary>SLA por vaga: dias úteis em aberto, meta, % consumido, status semafórico.</summary>
    [HttpGet("vagas")]
    public async Task<IActionResult> GetVagas(
        [FromQuery] VagaStatus? status,
        [FromQuery] VagaPrioridade? prioridade,
        [FromQuery] Guid? tipoVagaId,
        CancellationToken ct)
    {
        var query = _db.Vagas
            .AsNoTracking()
            .Where(v => v.Status != VagaStatus.Cancelada && v.Status != VagaStatus.Encerrada);

        if (status.HasValue) query = query.Where(v => v.Status == status.Value);
        if (prioridade.HasValue) query = query.Where(v => v.Prioridade == prioridade.Value);
        if (tipoVagaId.HasValue) query = query.Where(v => v.EixoVagaId == tipoVagaId.Value);

        var vagas = await query
            .Select(v => new
            {
                v.Id,
                v.Titulo,
                v.Status,
                v.Prioridade,
                v.DataAbertura,
                v.CreatedAtUtc,
                v.EixoVagaId,
                TipoNome = v.EixoVaga != null ? v.EixoVaga.Name : null,
                TipoSlaDiasUteis = v.EixoVaga != null ? v.EixoVaga.SlaDiasMetaFechamento : null,
                PermanenciaDisplay = v.EixoVaga != null
                    ? EixoVagaPermanencia.Formatar(
                        v.EixoVaga.PermanenciaNaoAplica,
                        v.EixoVaga.PermanenciaTurnoverDias,
                        v.EixoVaga.PermanenciaTurnoverMeses)
                    : null,
            })
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var result = vagas.Select(v =>
        {
            var inicio = v.DataAbertura ?? v.CreatedAtUtc;
            var diasUteisAberto = DiasUteisBrasil.ContarDiasUteisDecorridos(inicio, now);
            var meta = SlaVagaMetaResolver.GetDiasMetaUteisFromTipo(v.TipoSlaDiasUteis, _slaOptions);
            var pct = meta > 0 ? Math.Round((double)diasUteisAberto / meta * 100, 1) : 0;
            var slaStatus = pct >= 100 ? "atrasada" : pct >= 80 ? "critica" : "no_prazo";

            return new
            {
                v.Id,
                v.Titulo,
                Status = v.Status.ToString(),
                Prioridade = v.Prioridade?.ToString() ?? "Indefinida",
                TipoVagaId = v.EixoVagaId,
                TipoVagaNome = v.TipoNome,
                PermanenciaDisplay = v.PermanenciaDisplay,
                DiasAberto = diasUteisAberto,
                DiasUteisAberto = diasUteisAberto,
                MetaDias = meta,
                MetaDiasUteis = meta,
                PercentualConsumido = pct,
                SlaStatus = slaStatus,
            };
        })
        .OrderByDescending(x => x.PercentualConsumido)
        .ToList();

        var kpis = new
        {
            Total = result.Count,
            NoPrazo = result.Count(x => x.SlaStatus == "no_prazo"),
            Critica = result.Count(x => x.SlaStatus == "critica"),
            Atrasada = result.Count(x => x.SlaStatus == "atrasada"),
        };

        return Ok(new { kpis, vagas = result });
    }
}
