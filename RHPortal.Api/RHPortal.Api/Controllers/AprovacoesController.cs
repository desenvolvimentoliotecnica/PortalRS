using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        var userId = _userContext.FuncionarioId;
        if (userId == Guid.Empty)
            return Ok(new PendentesCountResponse(0));

        var vagas = await _db.SolicitacoesVaga
            .Where(s => s.Status == SolicitacaoVagaStatus.PendenteAprovacao
                && ((s.Aprovador1Id == userId && s.Aprovador1Status == StatusAprovacao.Pendente)
                    || (s.Aprovador2Habilitado && s.Aprovador2Id == userId && s.Aprovador2Status == StatusAprovacao.Pendente)))
            .CountAsync(ct);

        var promocoes = await _db.SolicitacoesPromocao
            .Where(s => s.Status == SolicitacaoStatus.PendenteAprovacao
                && ((s.Aprovador1Id == userId && s.Aprovador1Status == StatusAprovacao.Pendente)
                    || (s.Aprovador2Habilitado && s.Aprovador2Id == userId && s.Aprovador2Status == StatusAprovacao.Pendente)))
            .CountAsync(ct);

        var desligamentos = await _db.SolicitacoesDesligamento
            .Where(s => s.Status == SolicitacaoStatus.PendenteAprovacao
                && ((s.Aprovador1Id == userId && s.Aprovador1Status == StatusAprovacao.Pendente)
                    || (s.Aprovador2Habilitado && s.Aprovador2Id == userId && s.Aprovador2Status == StatusAprovacao.Pendente)))
            .CountAsync(ct);

        return Ok(new PendentesCountResponse(vagas + promocoes + desligamentos));
    }

    public record PendentesCountResponse(int Count);
}
