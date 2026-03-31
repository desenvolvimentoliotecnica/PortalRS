using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Common;

/// <summary>
/// Helper compartilhado para lógica de aprovação usada por todas as solicitações RH.
/// Resolve aprovadores a partir da cadeia de GestorDireto e envia notificações.
/// </summary>
public sealed class ApprovalWorkflowHelper
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly NotificationPublisher _notifications;

    public ApprovalWorkflowHelper(
        AppDbContext db,
        ITenantContext tenantContext,
        NotificationPublisher notifications)
    {
        _db = db;
        _tenantContext = tenantContext;
        _notifications = notifications;
    }

    /// <summary>
    /// Resultado da resolução de aprovadores.
    /// </summary>
    public sealed record ApproverResolution(
        Guid? Aprovador1Id,
        Guid? Aprovador2Id,
        bool Aprovador2Habilitado
    );

    /// <summary>
    /// Resolve aprovadores a partir da cadeia de GestorDireto do solicitante.
    /// Aprovador1 = GestorDireto do solicitante.
    /// Aprovador2 = GestorDireto do GestorDireto (se habilitado).
    /// </summary>
    public async Task<ApproverResolution> ResolveApproversAsync(
        Guid solicitanteId, bool aprovador2Habilitado, CancellationToken ct)
    {
        var solicitante = await _db.Set<Funcionario>()
            .Include(f => f.GestorDireto)
            .FirstOrDefaultAsync(f => f.Id == solicitanteId, ct);

        if (solicitante?.GestorDiretoId == null)
            throw new InvalidOperationException(
                "Não foi possível determinar um aprovador. Verifique se o solicitante possui um gestor direto cadastrado.");

        Guid? aprovador2Id = null;
        if (aprovador2Habilitado && solicitante.GestorDireto?.GestorDiretoId != null)
            aprovador2Id = solicitante.GestorDireto.GestorDiretoId;

        return new ApproverResolution(
            solicitante.GestorDiretoId,
            aprovador2Id,
            aprovador2Habilitado
        );
    }

    /// <summary>
    /// Valida que a solicitação pode ser editada (Rascunho ou AjustesNecessarios).
    /// </summary>
    public static void ValidateCanEdit(SolicitacaoStatus status)
    {
        if (status != SolicitacaoStatus.Rascunho && status != SolicitacaoStatus.AjustesNecessarios)
            throw new InvalidOperationException("Solicitação não pode ser editada no status atual.");
    }

    /// <summary>
    /// Valida que a solicitação está pendente de aprovação.
    /// </summary>
    public static void ValidateCanApprove(SolicitacaoStatus status)
    {
        if (status != SolicitacaoStatus.PendenteAprovacao)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");
    }

    /// <summary>
    /// Valida que apenas rascunhos podem ser excluídos.
    /// </summary>
    public static void ValidateCanDelete(SolicitacaoStatus status)
    {
        if (status != SolicitacaoStatus.Rascunho)
            throw new InvalidOperationException("Só é possível excluir solicitações em rascunho.");
    }

    /// <summary>
    /// Notifica um funcionário via seu UserId.
    /// </summary>
    public async Task NotifyByFuncionarioIdAsync(
        Guid funcionarioId, string titulo, string mensagem, string? link, CancellationToken ct, string tipo = "info")
    {
        var userId = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

        if (userId.HasValue)
        {
            await _notifications.PublishToUsersAsync(
                _tenantContext.TenantId,
                [userId.Value],
                titulo,
                mensagem,
                link,
                tipo,
                ct);
        }
    }

    /// <summary>
    /// Resolve FuncionarioId do usuário autenticado. Cria Funcionario se necessário.
    /// </summary>
    public async Task<Guid> ResolveSolicitanteIdAsync(Guid? funcionarioId, CancellationToken ct)
    {
        if (funcionarioId.HasValue && funcionarioId.Value != Guid.Empty)
        {
            var exists = await _db.Set<Funcionario>()
                .AsNoTracking()
                .AnyAsync(f => f.Id == funcionarioId.Value, ct);
            if (exists) return funcionarioId.Value;
        }

        throw new InvalidOperationException("Funcionário solicitante não encontrado. Verifique se o usuário possui um cadastro de funcionário vinculado.");
    }
}
