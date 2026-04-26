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

        // 2026-04-26: aceita TODOS funcionários (ativos + desligados/inativos).
        // Status é mapeado: A,F,P → Active(1); demais (D=Desligado, I=Inativo, etc.) → Inactive(2).
        // Permite vincular Desligamento.FuncionarioId mesmo dos que já saíram, e
        // viabiliza histórico/auditoria. Tela de Funcionários filtra Active por default.
        var ativos = request.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.Chapa) && !string.IsNullOrWhiteSpace(i.Nome))
            .ToList();
        var skippedInactive = total - ativos.Count;

        FuncionarioStatus MapStatus(string? codSit)
        {
            var s = (codSit ?? "").Trim().ToUpperInvariant();
            return new[] { "A", "F", "P" }.Contains(s) ? FuncionarioStatus.Active : FuncionarioStatus.Inactive;
        }

        // Mapa de descrições TOTVS RM (Liotécnica usa A,D,F,P,I,Z,W,M).
        string? MapSituacaoDescricao(string? codSit) => (codSit ?? "").Trim().ToUpperInvariant() switch
        {
            "A" => "Ativo",
            "F" => "Férias",
            "P" => "Pré-admissão",
            "D" => "Demitido",
            "I" => "Inativo",
            "T" => "Transferido",
            "R" => "Aposentado",
            "B" => "Beneficiário",
            "S" => "Substituição",
            "Z" => "Outros (Z)",
            "W" => "Outros (W)",
            "M" => "Outros (M)",
            "" => null,
            null => null,
            _ => $"Código {codSit?.Trim()}",
        };

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

        // Funcionários existentes por MatriculaRm — usa GroupBy safe pra ignorar duplicatas históricas.
        var chapas = ativos.Select(i => i.Chapa.Trim()).Distinct().ToList();
        var funcByMatriculaRaw = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null && chapas.Contains(f.MatriculaRm))
            .ToListAsync(ct);
        var funcByMatricula = funcByMatriculaRaw
            .GroupBy(f => f.MatriculaRm!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First());

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
                existing.Status = MapStatus(item.CodSituacao);
                existing.CodSituacaoRm = item.CodSituacao?.Trim().ToUpperInvariant();
                existing.SituacaoRmDescricao = MapSituacaoDescricao(item.CodSituacao);
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
                    Status = MapStatus(item.CodSituacao),
                    CodSituacaoRm = item.CodSituacao?.Trim().ToUpperInvariant(),
                    SituacaoRmDescricao = MapSituacaoDescricao(item.CodSituacao),
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
