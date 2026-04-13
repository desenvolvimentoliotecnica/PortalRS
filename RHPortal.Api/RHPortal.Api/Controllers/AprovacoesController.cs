using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Agregador de aprovações pendentes para o usuário logado (sino de notificações).
/// </summary>
[ApiController]
[Route("api/aprovacoes")]
public sealed class AprovacoesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _userContext;

    public AprovacoesController(AppDbContext db, ICurrentUserContext userContext)
    {
        _db = db;
        _userContext = userContext;
    }

    /// <summary>
    /// Retorna a contagem total de aprovações pendentes para o usuário logado,
    /// agregando Vagas + Promoções + Desligamentos.
    /// </summary>
    [HttpGet("pendentes/count")]
    [ProducesResponseType(typeof(PendentesCountResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendentesCount(CancellationToken ct)
    {
        var userId = _userContext.UserId;
        if (userId is null || userId == Guid.Empty)
            return Ok(new PendentesCountResponse(0));

        var funcId = _userContext.FuncionarioId;

        List<Guid> userRoleIds = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId.Value)
            .Select(ur => ur.RoleId)
            .ToListAsync(ct);

        var vagas         = await CountPendentesAsync(TipoFluxoAprovacao.RequisicaoPessoal,   userId.Value, funcId, userRoleIds, ct);
        var promocoes     = await CountPendentesAsync(TipoFluxoAprovacao.MovimentacaoPessoal,  userId.Value, funcId, userRoleIds, ct);
        var desligamentos = await CountPendentesAsync(TipoFluxoAprovacao.Desligamento,         userId.Value, funcId, userRoleIds, ct);

        return Ok(new PendentesCountResponse(vagas + promocoes + desligamentos));
    }

    private Task<int> CountPendentesAsync(
        TipoFluxoAprovacao tipo, Guid userId, Guid? funcId, IReadOnlyList<Guid> roleIds, CancellationToken ct) =>
        _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.TipoFluxo == tipo
                && e.Status == StatusAprovacao.Pendente
                && ((funcId.HasValue && e.AprovadorId == funcId.Value)
                    || (e.RoleFilaId.HasValue && roleIds.Contains(e.RoleFilaId.Value))
                    || e.AssumedByUserId == userId))
            .Select(e => e.SolicitacaoId)
            .Distinct()
            .CountAsync(ct);

    public record PendentesCountResponse(int Count);
}
