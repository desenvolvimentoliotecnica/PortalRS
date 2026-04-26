using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint dedicado pro worker TOTVS RM (<c>PortalFuncionarioSyncService</c>).
///
/// Padrão:
///   - Recebe array com códigos crus do RM (CHAPA + CODSECAO + CODCARGO + CODFILIAL + IDHIERARQUIADESTINO).
///   - Filtra ativos (<c>CodSituacao IN ('A','F','P')</c>) — desligados não viram Funcionario.
///   - Resolve FKs internamente via lookup tables em memória (uma query por entidade-mestre).
///   - Upsert idempotente por <c>(TenantId, MatriculaRm)</c>.
///
/// Diferente do <c>FuncionariosController.Create</c> que requer dados já resolvidos.
/// </summary>
[ApiController]
[Route("api/funcionarios/sync-rm")]
public sealed class FuncionariosSyncRmController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public FuncionariosSyncRmController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpPost("bulk")]
    [ProducesResponseType(typeof(FuncionarioSyncRmBulkResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FuncionarioSyncRmBulkResponse>> BulkSync(
        [FromBody] FuncionarioSyncRmBulkRequest request,
        CancellationToken ct)
    {
        var warnings = new List<string>();
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new FuncionarioSyncRmBulkResponse(0, 0, 0, 0, 0, warnings));

        var tenantId = _tenantContext.TenantId;
        var total = request.Items.Count;

        // Filtra ativos (A=Ativo, F=Férias, P=Pré-Admissão). Outros são desligados/legados.
        var ativos = request.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.Chapa) &&
                        !string.IsNullOrWhiteSpace(i.Nome) &&
                        new[] { "A", "F", "P" }.Contains((i.CodSituacao ?? "").Trim().ToUpperInvariant()))
            .ToList();
        var skippedInactive = total - ativos.Count;

        // ─── Lookups carregados uma vez por sync ─────────────────────────────
        var ccByCode = await _db.CentrosCusto.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        var jobByCode = await _db.JobPositions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        var unitByCode = await _db.Units.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        var hierarquiaByIdRm = await _db.Hierarquias.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.IdHierarquiaRm, x => x.Id, ct);

        // Pessoas — lookup por CPF (mais estável que email pra match com CPF do PFUNC/PPESSOA)
        var pessoaByCpf = await _db.Pessoas.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Cpf != null)
            .ToDictionaryAsync(x => x.Cpf!, x => x.Id, ct);

        // Funcionários existentes por MatriculaRm
        var chapas = ativos.Select(i => i.Chapa.Trim()).Distinct().ToList();
        var funcByMatricula = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null && chapas.Contains(f.MatriculaRm))
            .ToDictionaryAsync(f => f.MatriculaRm!, f => f, ct);

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;
        var skipped = 0;

        foreach (var item in ativos)
        {
            var chapa = item.Chapa.Trim();
            Guid? centroCustoId = null;
            if (!string.IsNullOrWhiteSpace(item.CodSecao) && ccByCode.TryGetValue(item.CodSecao.Trim(), out var ccId))
                centroCustoId = ccId;

            Guid? jobPositionId = null;
            if (!string.IsNullOrWhiteSpace(item.CodCargo) && jobByCode.TryGetValue(item.CodCargo.Trim(), out var jpId))
                jobPositionId = jpId;

            Guid? unitId = null;
            if (item.CodFilial.HasValue)
            {
                var codePadded = item.CodFilial.Value.ToString().PadLeft(2, '0');
                if (unitByCode.TryGetValue(codePadded, out var uId))
                    unitId = uId;
            }

            Guid? hierarquiaId = null;
            if (item.IdHierarquiaDestinoRm.HasValue && hierarquiaByIdRm.TryGetValue(item.IdHierarquiaDestinoRm.Value, out var hId))
                hierarquiaId = hId;

            Guid? pessoaId = null;
            if (!string.IsNullOrWhiteSpace(item.Cpf) && pessoaByCpf.TryGetValue(item.Cpf.Trim(), out var pId))
                pessoaId = pId;

            if (funcByMatricula.TryGetValue(chapa, out var existing))
            {
                existing.Name = item.Nome.Length > 160 ? item.Nome.Substring(0, 160) : item.Nome;
                existing.Email = string.IsNullOrWhiteSpace(item.Email) ? null
                    : (item.Email.Length > 180 ? item.Email.Substring(0, 180) : item.Email);
                existing.Phone = string.IsNullOrWhiteSpace(item.Telefone) ? null
                    : (item.Telefone.Length > 40 ? item.Telefone.Substring(0, 40) : item.Telefone);
                existing.Status = FuncionarioStatus.Active;
                existing.PessoaId = pessoaId ?? existing.PessoaId;
                existing.CentroCustoId = centroCustoId ?? existing.CentroCustoId;
                existing.JobPositionId = jobPositionId ?? existing.JobPositionId;
                existing.UnitId = unitId ?? existing.UnitId;
                existing.HierarquiaId = hierarquiaId ?? existing.HierarquiaId;
                existing.UpdatedAtUtc = now;
                updated++;
            }
            else
            {
                _db.Funcionarios.Add(new Funcionario
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    MatriculaRm = chapa,
                    Name = item.Nome.Length > 160 ? item.Nome.Substring(0, 160) : item.Nome,
                    Email = string.IsNullOrWhiteSpace(item.Email) ? null
                        : (item.Email.Length > 180 ? item.Email.Substring(0, 180) : item.Email),
                    Phone = string.IsNullOrWhiteSpace(item.Telefone) ? null
                        : (item.Telefone.Length > 40 ? item.Telefone.Substring(0, 40) : item.Telefone),
                    Status = FuncionarioStatus.Active,
                    PessoaId = pessoaId,
                    CentroCustoId = centroCustoId,
                    JobPositionId = jobPositionId,
                    UnitId = unitId,
                    HierarquiaId = hierarquiaId,
                    Headcount = 1,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                created++;
            }
        }

        // Salva em chunks pra não sobrecarregar a transação (637 rows é OK, mas defensivo)
        await _db.SaveChangesAsync(ct);

        return Ok(new FuncionarioSyncRmBulkResponse(created, updated, skipped, skippedInactive, total, warnings));
    }
}
