using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

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
    private readonly ICurrentUserContext _currentUser;

    public FuncoesController(AppDbContext db, ICurrentUserContext currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Lista funções únicas com quantidade de funcionários ativos e total.
    /// Opcionalmente restringe aos colaboradores do <paramref name="centroCustoId"/> (legado / outros fluxos).
    /// Para requisição de pessoal, use <paramref name="gestorFuncionarioId"/>: agrupa apenas colaboradores ativos
    /// cujo <c>GestorDiretoId</c> é o gestor informado (funções já presentes no headcount da equipe).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<FuncaoListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<List<FuncaoListItem>>> List(
        [FromQuery] string? q,
        [FromQuery] Guid? centroCustoId,
        [FromQuery] Guid? gestorFuncionarioId,
        CancellationToken ct)
    {
        var baseQuery = _db.Funcionarios.AsNoTracking()
            .Where(f => f.CodFuncaoRm != null);

        if (gestorFuncionarioId.HasValue && gestorFuncionarioId.Value != Guid.Empty)
        {
            var podeVerEquipe =
                _currentUser.IsAdmin
                || _currentUser.IsRH
                || (_currentUser.FuncionarioId.HasValue
                    && _currentUser.FuncionarioId.Value == gestorFuncionarioId.Value);
            if (!podeVerEquipe)
                return Forbid();

            baseQuery = baseQuery.Where(f =>
                f.GestorDiretoId == gestorFuncionarioId.Value
                && f.Status == FuncionarioStatus.Active);
        }
        else if (centroCustoId.HasValue && centroCustoId.Value != Guid.Empty)
        {
            baseQuery = baseQuery.Where(f => f.CentroCustoId == centroCustoId.Value);
        }

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
