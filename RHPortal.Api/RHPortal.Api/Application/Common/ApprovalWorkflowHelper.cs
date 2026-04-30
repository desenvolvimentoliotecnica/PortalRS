using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Common;
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
    /// Valida que a solicitação pode ser editada (Rascunho, AjustesNecessarios ou DevolvidaTriagemGestor no fluxo aumento de quadro).
    /// </summary>
    public static void ValidateCanEdit(SolicitacaoStatus status)
    {
        if (status != SolicitacaoStatus.Rascunho
            && status != SolicitacaoStatus.AjustesNecessarios
            && status != SolicitacaoStatus.DevolvidaTriagemGestor)
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
    /// Valida que a solicitação pode ser aprovada (PendenteAprovacao, PendenteAprovacaoRh ou PendenteAprovacaoAumentoHC).
    /// </summary>
    public static void ValidateCanApproveAny(SolicitacaoStatus status)
    {
        if (status != SolicitacaoStatus.PendenteAprovacao
            && status != SolicitacaoStatus.PendenteAprovacaoRh
            && status != SolicitacaoStatus.PendenteAprovacaoAumentoHC)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");
    }

    private async Task<Guid?> ResolveAdminRoleIdAsync(CancellationToken ct)
    {
        var byTipo = await _db.Set<ApplicationRole>()
            .AsNoTracking()
            .Where(r => r.IsActive && r.Tipo == RHPortal.Api.Domain.Enums.RoleTipo.Admin)
            .OrderBy(r => r.Name)
            .Select(r => (Guid?)r.Id)
            .FirstOrDefaultAsync(ct);
        if (byTipo.HasValue) return byTipo;

        return await _db.Set<ApplicationRole>()
            .AsNoTracking()
            .Where(r => r.IsActive && (
                r.Name == "Admin" ||
                r.Name == "Administrador" ||
                r.Name == "Owner"))
            .OrderBy(r => r.Name)
            .Select(r => (Guid?)r.Id)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Resolve o RoleFilaId para etapas de RevisaoRH no fluxo indicado.
    /// Usa o role configurado em EtapaConfigAprovacao; fallback para role Admin.
    /// </summary>
    public async Task<Guid?> ResolveRhRoleIdAsync(TipoFluxoAprovacao tipoFluxo, CancellationToken ct)
    {
        var roleId = await _db.Set<EtapaConfigAprovacao>()
            .AsNoTracking()
            .Where(e => e.Ativo && e.TipoFluxo == tipoFluxo && e.TipoAprovador == TipoAprovador.RevisaoRH)
            .Select(e => (Guid?)e.RoleFilaId)
            .FirstOrDefaultAsync(ct);

        return roleId ?? await ResolveAdminRoleIdAsync(ct);
    }

    /// <summary>
    /// Resolve a cadeia de etapas de aprovação baseada na configuração do fluxo.
    /// Retorna uma lista de (Ordem, Label, AprovadorId, RoleFilaId, AcaoEtapa, MomentoAcao) para criação das SolicitacaoAprovacaoEtapas.
    /// targetFuncionarioId = funcionário sobre quem a ação é (usado para resolver unidade de lotação).
    /// </summary>
    public async Task<IReadOnlyList<(int Ordem, string Label, Guid? AprovadorId, Guid? RoleFilaId, AcaoEtapa AcaoEtapa, MomentoAcao MomentoAcao)>>
        ResolveEtapasAsync(
            Guid solicitanteId,
            Guid? targetFuncionarioId,
            TipoFluxoAprovacao tipoFluxo,
            CancellationToken ct,
            Guid? targetUnidadeLotacaoId = null)
    {
        async Task<Guid?> ResolveConsensoRoleIdAsync() => await ResolveAdminRoleIdAsync(ct);

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
                .Include(f => f.GestorDireto)
                .FirstOrDefaultAsync(f => f.Id == solicitanteId, ct);

            var gestorId = solicitante?.GestorDiretoId;
            var gestorHasUser = gestorId.HasValue
                && solicitante?.GestorDireto?.UserId != null;

            if (gestorId == null || !gestorHasUser)
            {
                // Consenso fallback: gestor not found or has no user account
                var fallbackRoleId = await ResolveConsensoRoleIdAsync();

                if (fallbackRoleId.HasValue)
                    return new[] { (1, "Aprovação (Consenso)", (Guid?)null, fallbackRoleId, AcaoEtapa.Nenhuma, MomentoAcao.AoChegar) };
            }

            return new[]
            {
                (1, "Aprovação", gestorId, (Guid?)null, AcaoEtapa.Nenhuma, MomentoAcao.AoChegar)
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

        // Helper: load a unit with its parent (for unit-based resolution via targetUnidadeLotacaoId)
        async Task<UnidadeLotacao?> LoadUnidadeAsync(Guid id) =>
            await _db.Set<UnidadeLotacao>()
                .AsNoTracking()
                .Include(u => u.Parent)
                .FirstOrDefaultAsync(u => u.Id == id, ct);

        // Helper: walk UnidadeLotacao to root, returning owner + root unit label for diagnostics
        async Task<(Guid? OwnerId, string? RootLabel)> GetRootUnitAsync(Guid? unidadeId)
        {
            if (!unidadeId.HasValue) return (null, null);
            var current = await _db.Set<UnidadeLotacao>()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == unidadeId.Value, ct);
            while (current?.ParentId is not null)
            {
                current = await _db.Set<UnidadeLotacao>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == current.ParentId.Value, ct);
            }
            var label = current != null ? $"{current.Code} – {current.Description}" : null;
            return (current?.OwnerFuncionarioId, label);
        }

        // 4. Pre-fetch active AprovadoresAlternativos for substitution (avoids N+1)
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var alternativosAtivos = await _db.Set<AprovadorAlternativo>()
            .AsNoTracking()
            .Where(a => a.DataInicio <= hoje && (a.DataFim == null || a.DataFim >= hoje))
            .ToDictionaryAsync(a => a.GestorId, a => a.AprovadorId, ct);

        // 5. Resolve each step (internal list carries DiagInfo for consenso label enrichment)
        var internalResult = new List<(int Ordem, string Label, Guid? AprovadorId, Guid? RoleFilaId, AcaoEtapa AcaoEtapa, MomentoAcao MomentoAcao, string? DiagInfo)>();

        foreach (var etapa in configEtapas)
        {
            Guid? aprovadorId = null;
            Guid? roleFilaId = null;
            string? diagInfo = null;

            var funcRef = targetFunc ?? solicitanteFunc;

            switch (etapa.TipoAprovador)
            {
                case TipoAprovador.GestorDireto:
                    aprovadorId = solicitanteFunc?.GestorDiretoId;
                    if (aprovadorId == null)
                        diagInfo = "solicitante sem gestor direto cadastrado";
                    break;

                case TipoAprovador.GestorDoGestor:
                    aprovadorId = solicitanteFunc?.GestorDireto?.GestorDiretoId;
                    if (aprovadorId == null)
                    {
                        if (solicitanteFunc?.GestorDiretoId == null)
                            diagInfo = "solicitante sem gestor direto cadastrado";
                        else
                            diagInfo = $"gestor '{solicitanteFunc.GestorDireto?.Name ?? solicitanteFunc.GestorDiretoId.ToString()}' sem gestor acima";
                    }
                    break;

                case TipoAprovador.ResponsavelUnidade:
                {
                    UnidadeLotacao? unidade = null;
                    if (targetUnidadeLotacaoId.HasValue)
                        unidade = await LoadUnidadeAsync(targetUnidadeLotacaoId.Value);
                    else
                        unidade = funcRef?.UnidadeLotacao;

                    aprovadorId = unidade?.OwnerFuncionarioId;
                    if (aprovadorId == null)
                    {
                        if (unidade == null)
                            diagInfo = "lotação não informada";
                        else
                            diagInfo = $"lotação '{unidade.Code} – {unidade.Description}' sem responsável configurado";
                    }
                    break;
                }

                case TipoAprovador.ResponsavelUnidadePai:
                {
                    UnidadeLotacao? unidade = null;
                    if (targetUnidadeLotacaoId.HasValue)
                        unidade = await LoadUnidadeAsync(targetUnidadeLotacaoId.Value);
                    else
                        unidade = funcRef?.UnidadeLotacao;

                    aprovadorId = unidade?.Parent?.OwnerFuncionarioId;
                    if (aprovadorId == null)
                    {
                        if (unidade == null)
                            diagInfo = "lotação não informada";
                        else if (unidade.ParentId == null)
                            diagInfo = $"lotação '{unidade.Code} – {unidade.Description}' não possui lotação pai";
                        else
                            diagInfo = $"lotação pai '{unidade.Parent?.Code} – {unidade.Parent?.Description}' sem responsável configurado";
                    }
                    break;
                }

                case TipoAprovador.ResponsavelUnidadeRaiz:
                {
                    var unidadeId = targetUnidadeLotacaoId ?? funcRef?.UnidadeLotacaoId;
                    var (rootOwnerId, rootLabel) = await GetRootUnitAsync(unidadeId);
                    aprovadorId = rootOwnerId;
                    if (aprovadorId == null)
                    {
                        if (unidadeId == null)
                            diagInfo = "lotação não informada";
                        else
                            diagInfo = rootLabel != null
                                ? $"Lotação Raiz '{rootLabel}' sem responsável configurado"
                                : "Lotação Raiz da hierarquia sem responsável configurado";
                    }
                    break;
                }

                case TipoAprovador.FuncionarioFixo:
                    aprovadorId = etapa.FuncionarioFixoId;
                    if (aprovadorId == null)
                        diagInfo = "funcionário fixo não configurado na etapa";
                    break;

                case TipoAprovador.FilaDePerfil:
                case TipoAprovador.RevisaoRH:
                    aprovadorId = null;
                    roleFilaId = etapa.RoleFilaId;
                    break;

                case TipoAprovador.CriarVagaRascunho:
                case TipoAprovador.EnviarIntegracao:
                    // Processo automático — sem aprovador, sem fila. AcaoEtapa forçada abaixo.
                    break;
            }

            // Força AcaoEtapa/MomentoAcao para steps de processo automático
            // (derivado do TipoAprovador, independente do que está salvo na config)
            var acaoEtapaEfetiva = etapa.TipoAprovador switch
            {
                TipoAprovador.CriarVagaRascunho => AcaoEtapa.CriarVagaRascunho,
                TipoAprovador.EnviarIntegracao  => AcaoEtapa.EnviarIntegracao,
                _                               => etapa.AcaoEtapa,
            };
            var momentoAcaoEfetivo = etapa.TipoAprovador switch
            {
                TipoAprovador.CriarVagaRascunho => MomentoAcao.AoChegar,
                TipoAprovador.EnviarIntegracao  => MomentoAcao.AoChegar,
                _                               => etapa.MomentoAcao,
            };

            // Substitui pelo aprovador alternativo ativo, se existir
            if (aprovadorId.HasValue && alternativosAtivos.TryGetValue(aprovadorId.Value, out var substitutoId))
                aprovadorId = substitutoId;

            internalResult.Add((etapa.Ordem, etapa.Label, aprovadorId, roleFilaId, acaoEtapaEfetiva, momentoAcaoEfetivo, diagInfo));
        }

        // 6. Consenso fallback: detect unresolvable steps and convert to Admin queue
        Guid? adminRoleId = null;
        for (int i = 0; i < internalResult.Count; i++)
        {
            var (ordem, label, aprovId, roleId, acao, momento, diagInfo) = internalResult[i];

            // FilaDePerfil/RevisaoRH steps already have roleId — skip
            if (roleId.HasValue)
                continue;

            // Apenas etapas automáticas de processo ignoram consenso (evita pular consenso se AcaoEtapa vier errado no banco).
            if (aprovId == null && (acao == AcaoEtapa.CriarVagaRascunho || acao == AcaoEtapa.EnviarIntegracao))
                continue;

            bool needsConsenso = false;
            string? userDiag = null;

            if (aprovId == null)
            {
                // Both null — completely unresolvable (e.g. no GestorDireto configured)
                needsConsenso = true;
            }
            else
            {
                // Approver resolved but check if they can actually log in
                var aprovadorInfo = await _db.Set<Funcionario>()
                    .AsNoTracking()
                    .Where(f => f.Id == aprovId.Value)
                    .Select(f => new { f.Name, HasUser = f.UserId != null })
                    .FirstOrDefaultAsync(ct);

                if (aprovadorInfo == null || !aprovadorInfo.HasUser)
                {
                    needsConsenso = true;
                    userDiag = $"aprovador '{aprovadorInfo?.Name ?? aprovId.ToString()}' sem conta de acesso ao sistema";
                }
            }

            if (needsConsenso)
            {
                // Lazy-load Admin role ID (one query for the entire batch)
                adminRoleId ??= await ResolveConsensoRoleIdAsync();

                var reason = diagInfo ?? userDiag ?? "aprovador não resolvido";

                if (adminRoleId.HasValue)
                {
                    internalResult[i] = (ordem, $"{label} (Consenso: {reason})", null, adminRoleId, acao, momento, null);
                }
                else
                {
                    // No fallback queue — clear approver so the step isn't stuck with someone who can't log in
                    var (o, lbl, _, r, ac, mo, _) = internalResult[i];
                    internalResult[i] = (o, $"{lbl} (Sem aprovador: {reason})", null, r, ac, mo, null);
                }
            }
        }

        return internalResult
            .Select(r => (r.Ordem, r.Label, r.AprovadorId, r.RoleFilaId, r.AcaoEtapa, r.MomentoAcao))
            .ToArray();
    }

    /// <summary>
    /// Mapeia entidades de etapa persistidas para DTO de API (único ponto: resolve nome do perfil de fila).
    /// </summary>
    public async Task<IReadOnlyList<EtapaAprovacaoResponse>> MapEtapasToAprovacaoResponsesAsync(
        IReadOnlyList<SolicitacaoAprovacaoEtapa> etapas,
        CancellationToken ct)
    {
        if (etapas.Count == 0)
            return Array.Empty<EtapaAprovacaoResponse>();

        var roleIds = etapas.Where(e => e.RoleFilaId.HasValue).Select(e => e.RoleFilaId!.Value).Distinct().ToList();
        Dictionary<Guid, string> roleNames = new();
        if (roleIds.Count > 0)
        {
            roleNames = await _db.Set<ApplicationRole>()
                .AsNoTracking()
                .Where(r => roleIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, r => r.Name ?? string.Empty, ct);
        }

        static string StatusLabel(StatusAprovacao s) => s switch
        {
            StatusAprovacao.Aprovado => "Aprovado",
            StatusAprovacao.Rejeitado => "Reprovado",
            StatusAprovacao.Cancelado => "Cancelado",
            _ => "Pendente",
        };

        return etapas.Select(e =>
        {
            string? roleFilaNome = null;
            if (e.RoleFilaId.HasValue && roleNames.TryGetValue(e.RoleFilaId.Value, out var nm) && !string.IsNullOrWhiteSpace(nm))
                roleFilaNome = nm;

            return new EtapaAprovacaoResponse(
                e.Ordem,
                e.Label,
                e.AprovadorId,
                e.Aprovador?.Name,
                e.RoleFilaId,
                roleFilaNome,
                StatusLabel(e.Status),
                e.DataUtc,
                e.Observacao);
        }).ToList();
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

        // Etapa foi atribuída explicitamente a este funcionário (diretamente ou via assunção de fila).
        // AprovadorId é a prova de assignment — tem prioridade sobre qualquer outra verificação.
        if (etapa.AprovadorId.HasValue && userContext.FuncionarioId.HasValue
            && etapa.AprovadorId == userContext.FuncionarioId)
            return true;

        // Assumida por usuário sem FuncionarioId (ex: admin sem cadastro de funcionário)
        if (etapa.AssumedByUserId.HasValue)
            return etapa.AssumedByUserId == userContext.UserId;

        // Fila de role ainda não assumida — qualquer membro do role pode aprovar
        if (etapa.RoleFilaId.HasValue)
        {
            var userId = userContext.UserId;
            if (!userId.HasValue) return false;
            return await _db.Set<ApplicationUserRole>()
                .AnyAsync(ur => ur.RoleId == etapa.RoleFilaId.Value && ur.UserId == userId.Value, ct);
        }

        return false;
    }

    /// <summary>
    /// Verifica se o usuário atual pode ASSUMIR uma etapa de fila de grupo (role queue).
    /// Diferente de <see cref="CanApproveStepAsync"/>, NÃO concede bypass para Admin —
    /// Admin só pode assumir etapas stuck/unresolvable, nunca filas de grupos aos quais não pertence.
    /// </summary>
    public async Task<bool> CanAssumeRoleQueueAsync(
        SolicitacaoAprovacaoEtapa etapa,
        ICurrentUserContext userContext,
        CancellationToken ct)
    {
        if (!etapa.RoleFilaId.HasValue) return false;
        var userId = userContext.UserId;
        if (!userId.HasValue) return false;
        return await _db.Set<ApplicationUserRole>()
            .AnyAsync(ur => ur.RoleId == etapa.RoleFilaId.Value && ur.UserId == userId.Value, ct);
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

    /// <summary>
    /// Snapshot da etapa pendente de uma solicitação, usado para exibição em listas.
    /// PendenteCom = nome do aprovador individual, ou nome da fila/role, conforme o caso.
    /// CanAssume = true quando a etapa é uma fila de role E o usuário atual pertence a esse role.
    /// CanApprove = true quando o usuário atual pode aprovar (inclui: assumido por ele, aprovador fixo, fila com seu role, ou admin).
    /// </summary>
    public sealed record EtapaPendenteInfo(string? Label, string? PendenteCom, bool IsQueue, Guid? AprovadorId, Guid? AssumedByUserId = null, bool CanAssume = false, bool CanApprove = false);

    /// <summary>
    /// Busca em uma única query a etapa pendente (menor Ordem com Status=Pendente)
    /// para cada SolicitacaoId da lista, dentro de um TipoFluxo.
    /// Retorna apenas as chaves que têm etapa pendente; ausência = sem etapa pendente.
    /// </summary>
    public async Task<Dictionary<Guid, EtapaPendenteInfo>> GetEtapasPendentesAsync(
        IReadOnlyList<Guid> solicitacaoIds,
        TipoFluxoAprovacao tipoFluxo,
        CancellationToken ct,
        Guid? currentUserId = null)
    {
        if (solicitacaoIds.Count == 0)
            return new Dictionary<Guid, EtapaPendenteInfo>();

        var etapas = await _db.Set<SolicitacaoAprovacaoEtapa>()
            .AsNoTracking()
            .Where(e =>
                solicitacaoIds.Contains(e.SolicitacaoId) &&
                e.TipoFluxo == tipoFluxo &&
                e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);

        // Role names for queue steps
        var roleIds = etapas
            .Where(e => e.RoleFilaId.HasValue)
            .Select(e => e.RoleFilaId!.Value)
            .Distinct()
            .ToList();

        var roleNames = new Dictionary<Guid, string?>();
        if (roleIds.Count > 0)
        {
            roleNames = await _db.Set<ApplicationRole>()
                .AsNoTracking()
                .Where(r => roleIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, r => (string?)r.Name, ct);
        }

        // Default consensus queue display name for legacy rows where RoleFilaId was not persisted.
        var consensoRoleName = await _db.Set<ApplicationRole>()
            .AsNoTracking()
            .Where(r => r.IsActive && r.Tipo == RHPortal.Api.Domain.Enums.RoleTipo.Admin)
            .OrderBy(r => r.Name)
            .Select(r => (string?)r.Name)
            .FirstOrDefaultAsync(ct);

        // For direct (non-queue) approvers: look up ApplicationUser by FuncionarioId
        // This is more reliable than relying on navigation property Include
        var directAprovadorIds = etapas
            .Where(e => e.AprovadorId.HasValue)
            .Select(e => e.AprovadorId!.Value)
            .Distinct()
            .ToList();

        // FuncionarioId → (DisplayName, IsActive)
        var aprovadorUserMap = new Dictionary<Guid, (string? Name, bool IsActive)>();
        if (directAprovadorIds.Count > 0)
        {
            var userRows = await _db.Set<ApplicationUser>()
                .AsNoTracking()
                .Where(u => u.FuncionarioId.HasValue && directAprovadorIds.Contains(u.FuncionarioId!.Value))
                .Select(u => new
                {
                    FuncId = u.FuncionarioId!.Value,
                    Name = u.FullName != "" ? u.FullName : u.UserName,
                    u.IsActive,
                })
                .ToListAsync(ct);

            foreach (var row in userRows)
                aprovadorUserMap[row.FuncId] = (row.Name, row.IsActive);
        }

        // Roles do usuário atual — usados para calcular CanAssume e CanApprove
        var userRoleIds = new HashSet<Guid>();
        bool currentUserIsAdmin = false;
        Guid? currentUserFuncionarioId = null;
        if (currentUserId.HasValue)
        {
            var userRoles = await _db.Set<ApplicationUserRole>()
                .AsNoTracking()
                .Where(ur => ur.UserId == currentUserId.Value)
                .Select(ur => ur.RoleId)
                .ToListAsync(ct);
            foreach (var rid in userRoles) userRoleIds.Add(rid);

            currentUserIsAdmin = await _db.Set<ApplicationUserRole>()
                .AsNoTracking()
                .Join(_db.Set<ApplicationRole>().AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => new { ur, r })
                .AnyAsync(x =>
                    x.ur.UserId == currentUserId.Value &&
                    x.r.IsActive &&
                    x.r.Tipo == RHPortal.Api.Domain.Enums.RoleTipo.Admin, ct);

            currentUserFuncionarioId = await _db.Set<ApplicationUser>()
                .AsNoTracking()
                .Where(u => u.Id == currentUserId.Value)
                .Select(u => u.FuncionarioId)
                .FirstOrDefaultAsync(ct);
        }

        var result = new Dictionary<Guid, EtapaPendenteInfo>();
        foreach (var group in etapas.GroupBy(e => e.SolicitacaoId))
        {
            var etapa = group.OrderBy(e => e.Ordem).First();
            string? pendenteCom;
            bool isQueue;

            if (etapa.AprovadorId.HasValue && !etapa.RoleFilaId.HasValue)
            {
                // Stuck step claimed by admin without Funcionario link — AssumedByUserId takes priority
                if (etapa.AssumedByUserId.HasValue)
                {
                    var u = await _db.Set<ApplicationUser>()
                        .AsNoTracking()
                        .IgnoreQueryFilters()
                        .Where(x => x.Id == etapa.AssumedByUserId.Value)
                        .Select(x => new { Name = (x.FullName != null && x.FullName != "") ? x.FullName : x.UserName, x.IsActive })
                        .FirstOrDefaultAsync(ct);
                    pendenteCom = u?.Name;
                    isQueue = false; // claimed — show Aprovar, not Assumir
                }
                else
                {
                    // Direct approver: show name only when they have an active account
                    var hasActiveAccount = aprovadorUserMap.TryGetValue(etapa.AprovadorId.Value, out var info)
                        && info.IsActive;
                    pendenteCom = hasActiveAccount ? info.Name : null;
                    isQueue = !hasActiveAccount;
                }
            }
            else if (etapa.RoleFilaId.HasValue)
            {
                if (etapa.AssumedByUserId.HasValue)
                {
                    // Role-queue step assumed by a user without FuncionarioId (e.g. ADMIN account)
                    var u = await _db.Set<ApplicationUser>()
                        .AsNoTracking()
                        .IgnoreQueryFilters()
                        .Where(x => x.Id == etapa.AssumedByUserId.Value)
                        .Select(x => new { Name = (x.FullName != null && x.FullName != "") ? x.FullName : x.UserName })
                        .FirstOrDefaultAsync(ct);
                    pendenteCom = u?.Name;
                    isQueue = false; // claimed — show Aprovar, not Assumir
                }
                else if (etapa.AprovadorId.HasValue)
                {
                    // Role-queue step claimed by a user with FuncionarioId — show their name
                    var hasActiveAccount = aprovadorUserMap.TryGetValue(etapa.AprovadorId.Value, out var info) && info.IsActive;
                    pendenteCom = hasActiveAccount ? info.Name : null;
                    isQueue = false; // claimed
                }
                else
                {
                    // Unclaimed role queue — show role name
                    pendenteCom = roleNames.TryGetValue(etapa.RoleFilaId.Value, out var rn) ? rn : null;
                    isQueue = true;
                }
            }
            else
            {
                // Both null: either waiting for someone to assume (consenso) OR already assumed by a user directly
                if (etapa.AssumedByUserId.HasValue)
                {
                    // Already claimed by a user without Funcionario link.
                    // IgnoreQueryFilters: Owner/Admin may belong to a different tenant.
                    var u = await _db.Set<ApplicationUser>()
                        .AsNoTracking()
                        .IgnoreQueryFilters()
                        .Where(x => x.Id == etapa.AssumedByUserId.Value)
                        .Select(x => new { Name = (x.FullName != null && x.FullName != "") ? x.FullName : x.UserName, x.IsActive })
                        .FirstOrDefaultAsync(ct);
                    pendenteCom = u?.Name;
                    isQueue = false; // claimed — button disappears
                }
                else
                {
                    pendenteCom = consensoRoleName ?? "ADMINISTRADOR";
                    isQueue = true; // not yet claimed
                }
            }

            // CanAssume: apenas fila de role ainda não assumida E usuário pertence ao role
            var canAssume = isQueue
                && (
                    (etapa.RoleFilaId.HasValue && userRoleIds.Contains(etapa.RoleFilaId.Value))
                    || (!etapa.RoleFilaId.HasValue && currentUserIsAdmin)
                );

            // CanApprove: usuário pode aprovar a etapa (admin, aprovador fixo, assumiu via fila, ou membro do role não-assumido)
            var canApprove = currentUserId.HasValue && (
                currentUserIsAdmin
                || (etapa.AprovadorId.HasValue && currentUserFuncionarioId.HasValue && etapa.AprovadorId == currentUserFuncionarioId)
                || (etapa.AssumedByUserId.HasValue && etapa.AssumedByUserId == currentUserId)
                || canAssume
            );

            result[group.Key] = new EtapaPendenteInfo(etapa.Label, pendenteCom, isQueue, etapa.AprovadorId, etapa.AssumedByUserId, canAssume, canApprove);
        }

        return result;
    }
}
