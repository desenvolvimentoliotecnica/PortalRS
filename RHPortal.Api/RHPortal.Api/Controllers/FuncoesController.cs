using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Funções (PFUNCAO no TOTVS RM) — descrição específica do cargo do funcionário
/// (ex.: "COORD. TI E PRIVACIDADE DE DADOS"), mais granular que JobPosition (Cargo).
/// View derivada: agrupa funcionários por (CodFuncaoRm, FuncaoNomeRm) com headcount.
/// </summary>
[ApiController]
[Route("api/funcoes")]
[Authorize]
public sealed class FuncoesController : ControllerBase
{
    private readonly AppDbContext _db;
    public FuncoesController(AppDbContext db) { _db = db; }

    /// <summary>
    /// Lista funções únicas com quantidade de funcionários ativos e total.
    /// Opcionalmente restringe aos colaboradores do <paramref name="centroCustoId"/> (requisição de pessoal / seção).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<FuncaoListItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<FuncaoListItem>>> List(
        [FromQuery] string? q,
        [FromQuery] Guid? centroCustoId,
        CancellationToken ct)
    {
        var baseQuery = _db.Funcionarios.AsNoTracking()
            .Where(f => f.CodFuncaoRm != null);

        if (centroCustoId.HasValue && centroCustoId.Value != Guid.Empty)
            baseQuery = baseQuery.Where(f => f.CentroCustoId == centroCustoId.Value);

        var grouped = await baseQuery
            .GroupBy(f => new { f.CodFuncaoRm, f.FuncaoNomeRm })
            .Select(g => new FuncaoListItem(
                g.Key.CodFuncaoRm!,
                g.Key.FuncaoNomeRm,
                g.Count(),
                g.Count(x => x.Status == FuncionarioStatus.Active),
                g.Count(x => x.Status != FuncionarioStatus.Active)))
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim().ToLowerInvariant();
            grouped = grouped.Where(x =>
                (x.Codigo ?? "").ToLowerInvariant().Contains(needle) ||
                (x.Nome ?? "").ToLowerInvariant().Contains(needle))
                .ToList();
        }

        return Ok(grouped.OrderByDescending(x => x.TotalAtivos).ThenBy(x => x.Nome).ToList());
    }
}

public sealed record FuncaoListItem(
    string Codigo,
    string? Nome,
    int Total,
    int TotalAtivos,
    int TotalInativos);
