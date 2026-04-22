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
    /// Exclui solicitações criadas pelo próprio usuário (mesmo comportamento da tela de pendências).
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

        // Base: etapas pendentes onde o usuário pode agir — espelha exatamente isMyRow() do frontend:
        //   1. Atribuída diretamente a este funcionário (direta ou assumida via FuncionarioId)
        //   2. Fila de role não-assumida onde o usuário pertence ao role
        //   3. Assumida por este usuário via UserId (admin sem Funcionario vinculado)
        var etapasBase = _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .Where(e => e.Status == StatusAprovacao.Pendente
                && ((funcId.HasValue && e.AprovadorId == funcId.Value)
                    || (e.RoleFilaId.HasValue && userRoleIds.Contains(e.RoleFilaId.Value)
                        && e.AprovadorId == null && e.AssumedByUserId == null)
                    || e.AssumedByUserId == userId.Value));

        // Vagas: mesmos statuses que a tela busca (1,5,9,10) e exclui onde usuário é solicitante
        var vagasAtivasIds = await _db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.Status == SolicitacaoVagaStatus.PendenteAprovacao
                || s.Status == SolicitacaoVagaStatus.PendenteAprovacaoRh
                || s.Status == SolicitacaoVagaStatus.AguardandoDecisaoRH
                || s.Status == SolicitacaoVagaStatus.PendenteAprovacaoAumentoHC)
            .Where(s => !funcId.HasValue || s.SolicitanteId != funcId.Value)
            .Select(s => new { s.Id, s.Status })
            .ToListAsync(ct);

        var idsRequisicao = vagasAtivasIds
            .Where(s => s.Status != SolicitacaoVagaStatus.PendenteAprovacaoAumentoHC)
            .Select(s => s.Id).ToList();
        var idsHC = vagasAtivasIds
            .Where(s => s.Status == SolicitacaoVagaStatus.PendenteAprovacaoAumentoHC)
            .Select(s => s.Id).ToList();

        var vagasRequisicao = await etapasBase
            .Where(e => e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                && idsRequisicao.Contains(e.SolicitacaoId))
            .Select(e => e.SolicitacaoId).Distinct().CountAsync(ct);

        var vagasHC = idsHC.Count > 0
            ? await etapasBase
                .Where(e => e.TipoFluxo == TipoFluxoAprovacao.AumentoHeadcount
                    && idsHC.Contains(e.SolicitacaoId))
                .Select(e => e.SolicitacaoId).Distinct().CountAsync(ct)
            : 0;

        var vagas = vagasRequisicao + vagasHC;

        // Promoções: statuses 1 e 6 (PendenteAprovacao e PendenteAprovacaoRh)
        var promocoesAtivas = _db.SolicitacoesPromocao.AsNoTracking()
            .Where(s => s.Status == SolicitacaoStatus.PendenteAprovacao
                || s.Status == SolicitacaoStatus.PendenteAprovacaoRh)
            .Where(s => !funcId.HasValue || s.SolicitanteId != funcId.Value)
            .Select(s => s.Id);
        var promocoes = await etapasBase
            .Where(e => e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal
                && promocoesAtivas.Contains(e.SolicitacaoId))
            .Select(e => e.SolicitacaoId).Distinct().CountAsync(ct);

        // Desligamentos: statuses 1 e 6
        var desligamentosAtivos = _db.SolicitacoesDesligamento.AsNoTracking()
            .Where(s => s.Status == SolicitacaoStatus.PendenteAprovacao
                || s.Status == SolicitacaoStatus.PendenteAprovacaoRh)
            .Where(s => !funcId.HasValue || s.SolicitanteId != funcId.Value)
            .Select(s => s.Id);
        var desligamentos = await etapasBase
            .Where(e => e.TipoFluxo == TipoFluxoAprovacao.Desligamento
                && desligamentosAtivos.Contains(e.SolicitacaoId))
            .Select(e => e.SolicitacaoId).Distinct().CountAsync(ct);

        return Ok(new PendentesCountResponse(vagas + promocoes + desligamentos));
    }

    public record PendentesCountResponse(int Count);
}
