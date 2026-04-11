using Microsoft.AspNetCore.Identity;
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
    /// Valida que a solicitação pode ser aprovada (PendenteAprovacao ou PendenteAprovacaoRh).
    /// </summary>
    public static void ValidateCanApproveAny(SolicitacaoStatus status)
    {
        if (status != SolicitacaoStatus.PendenteAprovacao && status != SolicitacaoStatus.PendenteAprovacaoRh)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");
    }

    /// <summary>
    /// Resolve a cadeia de etapas de aprovação baseada na configuração do fluxo.
    /// Retorna uma lista de (Ordem, Label, AprovadorId, RoleFilaId) para criação das SolicitacaoAprovacaoEtapas.
    /// targetFuncionarioId = funcionário sobre quem a ação é (usado para resolver unidade de lotação).
    /// </summary>
    public async Task<IReadOnlyList<(int Ordem, string Label, Guid? AprovadorId, Guid? RoleFilaId)>>
        ResolveEtapasAsync(
            Guid solicitanteId,
            Guid? targetFuncionarioId,
            TipoFluxoAprovacao tipoFluxo,
            CancellationToken ct)
    {
        // 1. Load config
        var configEtapas = await _db.Set<EtapaConfigAprovacao>()
            .AsNoTracking()
            .Where(e => e.Ativo && e.TipoFluxo == tipoFluxo)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        // 2. Fallback if no config: GestorDireto single step
        if (configEtapas.Count == 0)
        {
            var solicitante = await _db.Set<Funcionario>()
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == solicitanteId, ct);
            return new[]
            {
                (1, "Aprovação", solicitante?.GestorDiretoId, (Guid?)null)
            };
        }

        // 3. Load data needed for resolution
        var targetFunc = targetFuncionarioId.HasValue
            ? await _db.Set<Funcionario>()
                .AsNoTracking()
                .Include(f => f.GestorDireto)
                .Include(f => f.UnidadeLotacao)
                    .ThenInclude(u => u != null ? u.Parent : null)
                .FirstOrDefaultAsync(f => f.Id == targetFuncionarioId.Value, ct)
            : null;

        var solicitanteFunc = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Include(f => f.GestorDireto)
            .FirstOrDefaultAsync(f => f.Id == solicitanteId, ct);

        // Helper: walk UnidadeLotacao to root
        async Task<Guid?> GetRootOwnerAsync(Guid? unidadeId)
        {
            if (!unidadeId.HasValue) return null;
            var current = await _db.Set<UnidadeLotacao>()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == unidadeId.Value, ct);
            while (current?.ParentId is not null)
            {
                current = await _db.Set<UnidadeLotacao>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == current.ParentId.Value, ct);
            }
            return current?.OwnerFuncionarioId;
        }

        // 4. Resolve each step
        var result = new List<(int Ordem, string Label, Guid? AprovadorId, Guid? RoleFilaId)>();

        foreach (var etapa in configEtapas)
        {
            Guid? aprovadorId = null;
            Guid? roleFilaId = null;

            switch (etapa.TipoAprovador)
            {
                case TipoAprovador.GestorDireto:
                    aprovadorId = solicitanteFunc?.GestorDiretoId;
                    break;

                case TipoAprovador.GestorDoGestor:
                    aprovadorId = solicitanteFunc?.GestorDireto?.GestorDiretoId;
                    break;

                case TipoAprovador.ResponsavelUnidade:
                    aprovadorId = (targetFunc ?? solicitanteFunc)?.UnidadeLotacao?.OwnerFuncionarioId;
                    break;

                case TipoAprovador.ResponsavelUnidadePai:
                    aprovadorId = (targetFunc ?? solicitanteFunc)?.UnidadeLotacao?.Parent?.OwnerFuncionarioId;
                    break;

                case TipoAprovador.ResponsavelUnidadeRaiz:
                    var unidadeId = (targetFunc ?? solicitanteFunc)?.UnidadeLotacaoId;
                    aprovadorId = await GetRootOwnerAsync(unidadeId);
                    break;

                case TipoAprovador.FuncionarioFixo:
                    aprovadorId = etapa.FuncionarioFixoId;
                    break;

                case TipoAprovador.FilaDePerfil:
                    aprovadorId = null;
                    roleFilaId = etapa.RoleFilaId;
                    break;
            }

            result.Add((etapa.Ordem, etapa.Label, aprovadorId, roleFilaId));
        }

        return result;
    }

    /// <summary>
    /// Verifica se o usuário atual pode aprovar a etapa fornecida.
    /// Admins sempre podem. Fila de perfil: qualquer usuário do role. Fixo: apenas o aprovador designado.
    /// </summary>
    public async Task<bool> CanApproveStepAsync(
        SolicitacaoAprovacaoEtapa etapa,
        ICurrentUserContext userContext,
        CancellationToken ct)
    {
        if (userContext.IsAdmin) return true;

        if (etapa.RoleFilaId.HasValue)
        {
            var userId = userContext.UserId;
            if (!userId.HasValue) return false;
            return await _db.Set<ApplicationUserRole>()
                .AnyAsync(ur => ur.RoleId == etapa.RoleFilaId.Value && ur.UserId == userId.Value, ct);
        }

        return etapa.AprovadorId.HasValue && etapa.AprovadorId == userContext.FuncionarioId;
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
