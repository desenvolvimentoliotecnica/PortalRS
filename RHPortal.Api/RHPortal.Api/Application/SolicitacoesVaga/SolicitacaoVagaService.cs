using RhPortal.Api.Application.Common;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Application.PublicApproval;
using RhPortal.Api.Application.SolicitacoesDesligamento;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.WorkflowRH;
using RhPortal.Api.Contracts.SolicitacoesVaga;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public interface ISolicitacaoVagaService
{
    Task<IReadOnlyList<SolicitacaoVagaGridRow>> ListAsync(SolicitacaoVagaListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse> CreateAsync(SolicitacaoVagaCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> UpdateAsync(Guid id, SolicitacaoVagaUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> IniciarTriagemAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> DevolverTriagemAoGestorAsync(Guid id, string observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> EncaminharTriagemParaAprovacoesAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> TriagemReprovarAsync(Guid id, string motivo, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
        Task<SolicitacaoVagaResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> CancelAsync(Guid id, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> AssumirAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse> CopyAsync(Guid sourceId, Guid? solicitanteId, CancellationToken ct);

    /// <summary>
    /// RH/Admin efetiva a requisição aprovada: tenta criar a requisição no RM (<see cref="ISolicitacaoVagaRmIntegracaoService"/>).
    /// Em caso de sucesso fica em <see cref="SolicitacaoStatus.EmIntegracao"/>; falhas geram estado de reprocessamento e histórico.
    /// Confirmação adicional pode chegar pelo webhook POST /api/integracao-totvs/9/{id}/resultado.
    /// </summary>
    Task<SolicitacaoVagaResponse?> EfetivarAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Propaga reprovação a partir do desligamento vinculado. Não valida permissões do usuário.
    /// Idempotente: ignora se a vaga já está em estado terminal.
    /// </summary>
    Task ReprovarEmCascataAsync(Guid id, string? observacao, CancellationToken ct);

    /// <summary>
    /// Propaga cancelamento a partir do desligamento vinculado. Não valida permissões do usuário.
    /// Idempotente: ignora se a vaga já está em estado terminal.
    /// </summary>
    Task CancelarEmCascataAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Amarra manualmente um candidato contratado a esta solicitação de vaga.
    /// Usado quando a contratação acontece fora do fluxo de pré-admissão (ou para corrigir vínculo).
    /// </summary>
    Task<SolicitacaoVagaResponse?> VincularCandidatoContratadoAsync(Guid id, Guid candidatoId, CancellationToken ct);

    Task<SolicitacaoVagaResponse?> IniciarProcessoSeletivoAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> SuspenderSelecaoAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> RetomarSelecaoAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> EncerrarSemContratacaoAsync(Guid id, string observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> MarcarContratacaoConcluidaAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> AssignAnalistaRhAsync(Guid id, Guid? analistaRhResponsavelUserId, CancellationToken ct);
    Task<int> BulkAssignAnalistaRhAsync(IReadOnlyList<Guid> solicitacaoIds, Guid? analistaRhResponsavelUserId, CancellationToken ct);
    Task<IReadOnlyList<SolicitacaoVagaIndicacaoDto>> ListIndicacoesAsync(Guid solicitacaoId, CancellationToken ct);
    Task<SolicitacaoVagaIndicacaoDto?> AddIndicacaoAsync(Guid solicitacaoId, SolicitacaoVagaIndicacaoCreateRequest request, CancellationToken ct);
    Task<bool> RemoveIndicacaoAsync(Guid solicitacaoId, Guid indicacaoId, CancellationToken ct);
}

public sealed class SolicitacaoVagaService : ISolicitacaoVagaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IVagaService _vagaService;
    private readonly ICurrentUserContext _currentUser;
    private readonly IPessoaService _pessoaService;
    private readonly NotificationPublisher _notifications;
    private readonly ApprovalWorkflowHelper _workflow;
    private readonly IEmailQueueService _emailQueue;
    private readonly IMagicLinkService _magicLink;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IServiceProvider _serviceProvider;
    private readonly StatusHistoricoService _statusHistorico;
    private readonly ISolicitacaoVagaRmIntegracaoService _solicitacaoVagaRmIntegracao;
    private readonly ISolicitacaoVagaRecrutadorNotifier _recruiterNotifier;

    public SolicitacaoVagaService(
        AppDbContext db,
        ITenantContext tenantContext,
        IVagaService vagaService,
        ICurrentUserContext currentUser,
        IPessoaService pessoaService,
        NotificationPublisher notifications,
        ApprovalWorkflowHelper workflow,
        IEmailQueueService emailQueue,
        IMagicLinkService magicLink,
        IHttpContextAccessor httpContextAccessor,
        IServiceProvider serviceProvider,
        StatusHistoricoService statusHistorico,
        ISolicitacaoVagaRmIntegracaoService solicitacaoVagaRmIntegracao,
        ISolicitacaoVagaRecrutadorNotifier recruiterNotifier)
    {
        _db = db;
        _tenantContext = tenantContext;
        _vagaService = vagaService;
        _currentUser = currentUser;
        _pessoaService = pessoaService;
        _notifications = notifications;
        _workflow = workflow;
        _emailQueue = emailQueue;
        _magicLink = magicLink;
        _httpContextAccessor = httpContextAccessor;
        _serviceProvider = serviceProvider;
        _statusHistorico = statusHistorico;
        _solicitacaoVagaRmIntegracao = solicitacaoVagaRmIntegracao;
        _recruiterNotifier = recruiterNotifier;
    }

    /// <summary>Vaga nova nominal ou aumento de quadro dedicado — mesmo conjunto de decisão de headcount do gestor na submissão.</summary>
    private static bool IsFluxoComDecisaoHeadcountGestor(TipoSolicitacaoVaga t) =>
        t is TipoSolicitacaoVaga.VagaNova or TipoSolicitacaoVaga.AumentoQuadro;

    private static bool IsAnalistaRhRoleName(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName)
        && roleName.Contains("analista", StringComparison.OrdinalIgnoreCase)
        && roleName.Contains("rh", StringComparison.OrdinalIgnoreCase);

    private static bool IsEspecialistaRhRoleName(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName)
        && roleName.Contains("especialista", StringComparison.OrdinalIgnoreCase)
        && roleName.Contains("rh", StringComparison.OrdinalIgnoreCase);

    private static bool PermiteDistribuicaoAnalistaRh(SolicitacaoStatus status) =>
        status is SolicitacaoStatus.PendenteAprovacaoRh
            or SolicitacaoStatus.Aprovada
            or SolicitacaoStatus.Concluida
            or SolicitacaoStatus.EmIntegracao
            or SolicitacaoStatus.PendenteTriagem
            or SolicitacaoStatus.EmTriagem
            or SolicitacaoStatus.DevolvidaTriagemGestor
            or SolicitacaoStatus.PendenteIntegracaoRm
            or SolicitacaoStatus.ErroIntegracaoRm
            or SolicitacaoStatus.AguardandoReprocessamentoRm;

    private async Task<IReadOnlyList<string>> GetCurrentUserRoleNamesAsync(CancellationToken ct)
    {
        if (!_currentUser.UserId.HasValue)
            return Array.Empty<string>();

        return await _db.Set<ApplicationUserRole>()
            .AsNoTracking()
            .Where(ur => ur.UserId == _currentUser.UserId.Value)
            .Join(_db.Set<ApplicationRole>().AsNoTracking(),
                ur => ur.RoleId,
                role => role.Id,
                (_, role) => role.Name ?? string.Empty)
            .Distinct()
            .ToListAsync(ct);
    }

    private async Task<bool> CurrentUserEhEspecialistaRhAsync(CancellationToken ct)
    {
        if (_currentUser.IsAdmin || _currentUser.IsOwner)
            return true;

        var roleNames = await GetCurrentUserRoleNamesAsync(ct);
        return roleNames.Any(IsEspecialistaRhRoleName);
    }

    private async Task<bool> CurrentUserEhAnalistaRhAsync(CancellationToken ct)
    {
        var roleNames = await GetCurrentUserRoleNamesAsync(ct);
        return roleNames.Any(IsAnalistaRhRoleName);
    }

    private async Task EnsureCurrentUserPodeDistribuirAnalistaRhAsync(CancellationToken ct)
    {
        if (await CurrentUserEhEspecialistaRhAsync(ct))
            return;

        throw new UnauthorizedAccessException("Somente Especialista de RH pode distribuir solicitações para Analistas de RH.");
    }

    private async Task ValidarAnalistaRhAlvoAsync(Guid? userId, CancellationToken ct)
    {
        if (!userId.HasValue)
            return;

        var roleNames = await _db.Set<ApplicationUserRole>()
            .AsNoTracking()
            .Where(ur => ur.UserId == userId.Value)
            .Join(_db.Set<ApplicationRole>().AsNoTracking(),
                ur => ur.RoleId,
                role => role.Id,
                (_, role) => role.Name ?? string.Empty)
            .Distinct()
            .ToListAsync(ct);

        var userAtivo = await _db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId.Value && u.IsActive, ct);

        if (!userAtivo)
            throw new InvalidOperationException("O usuário selecionado não foi encontrado ou está inativo.");

        if (!roleNames.Any(IsAnalistaRhRoleName))
            throw new InvalidOperationException("O usuário selecionado não possui perfil de Analista de RH.");
    }

    private async Task<string?> ResolveUserDisplayNameAsync(Guid userId, CancellationToken ct)
    {
        return await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.FullName ?? u.Email)
            .FirstOrDefaultAsync(ct);
    }

    private async Task SyncAnalistaRhNaVagaAsync(SolicitacaoVaga entity, CancellationToken ct)
    {
        if (!entity.VagaId.HasValue)
            return;

        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
        if (vaga is null)
            return;

        vaga.RecrutadorResponsavelUserId = entity.AnalistaRhResponsavelUserId;
        if (entity.AnalistaRhResponsavelUserId.HasValue)
        {
            var nome = await ResolveUserDisplayNameAsync(entity.AnalistaRhResponsavelUserId.Value, ct);
            if (!string.IsNullOrWhiteSpace(nome))
                vaga.RecrutadorResponsavel = nome.Length > 120 ? nome[..120] : nome;
        }
    }

    public async Task<IReadOnlyList<SolicitacaoVagaGridRow>> ListAsync(
        SolicitacaoVagaListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesVaga.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.CentroCusto)
            .AsQueryable();

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);
        else if (!_currentUser.IsAdmin)
        {
            var currentUserEhAnalistaRh = await CurrentUserEhAnalistaRhAsync(ct);
            var listaAmplaRh =
                (!currentUserEhAnalistaRh
                 && (_currentUser.IsRH
                 || _currentUser.HasPermission("*")
                 || _currentUser.HasPermission("rh.contratacoes.view")
                 || _currentUser.HasPermission("rh.contratacoes.triagem")
                 || _currentUser.HasPermission("rh.contratacoes.selecao")))
                && query.ApenasMeus != true;

            if (listaAmplaRh)
            {
                // Operador RH com permissão explícita — vê todas as solicitações do tenant (filtros query abaixo).
            }
            else
            {
            // Non-admin sees: own requests OR requests with a pending approval step assigned to them
            // (either directly via AprovadorId or via FilaDePerfil role queue)
            var userRoleIds = _currentUser.UserId.HasValue
                ? await _db.Set<ApplicationUserRole>().AsNoTracking()
                    .Where(ur => ur.UserId == _currentUser.UserId.Value)
                    .Select(ur => ur.RoleId)
                    .ToListAsync(ct)
                : new List<Guid>();

            // IDs of solicitações where the current user is the pending approver
            var solicitacaoIdsComEtapaPendente = await _db.SolicitacoesAprovacaoEtapa
                .AsNoTracking()
                .Where(e => e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                    && e.Status == StatusAprovacao.Pendente
                    && (
                        (e.AprovadorId.HasValue && e.AprovadorId == currentFuncionarioId)
                        || (e.RoleFilaId.HasValue && userRoleIds.Contains(e.RoleFilaId.Value))
                        || (e.AssumedByUserId.HasValue && e.AssumedByUserId == _currentUser.UserId)
                    ))
                .Select(e => e.SolicitacaoId)
                .Distinct()
                .ToListAsync(ct);

            // Also apply VagasDataScope for "own" items
            // 31.2: CentroCusto absorveu Area — o escopo ByArea agora é por CentroCusto.
            if (_currentUser.VagasDataScope == VagasDataScope.ByArea && _currentUser.CentroCustoId.HasValue)
                q = q.Where(s => s.CentroCustoId == _currentUser.CentroCustoId.Value
                    || solicitacaoIdsComEtapaPendente.Contains(s.Id)
                    || (_currentUser.UserId.HasValue && s.AnalistaRhResponsavelUserId == _currentUser.UserId.Value));
            else if (_currentUser.VagasDataScope == VagasDataScope.ByRecrutador && currentFuncionarioId.HasValue)
                q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value
                    || solicitacaoIdsComEtapaPendente.Contains(s.Id)
                    || (_currentUser.UserId.HasValue && s.AnalistaRhResponsavelUserId == _currentUser.UserId.Value));
            else
                q = q.Where(s => (currentFuncionarioId.HasValue && s.SolicitanteId == currentFuncionarioId.Value)
                    || solicitacaoIdsComEtapaPendente.Contains(s.Id)
                    || (_currentUser.UserId.HasValue && s.AnalistaRhResponsavelUserId == _currentUser.UserId.Value));
            }
        }

        if (query.Statuses is { Length: > 0 })
            q = q.Where(s => query.Statuses.Contains(s.Status));
        else if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

        if (query.VagaId.HasValue)
            q = q.Where(s => s.VagaId == query.VagaId.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(s => s.Titulo.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        var rawRows = await q
            .Include(s => s.Aprovador)
            .Select(s => new
            {
                s.Id, s.Titulo, s.Urgencia, s.Status,
                s.SolicitanteId,
                SolicitanteNome = s.Solicitante != null ? s.Solicitante.Name : (string?)null,
                AprovadorId = s.AprovadorId,
                AprovadorNome = s.Aprovador != null ? s.Aprovador.Name : (string?)null,
                AnalistaRhResponsavelUserId = s.AnalistaRhResponsavelUserId,
                AnalistaRhResponsavelNome = s.AnalistaRhResponsavelUser != null
                    ? (s.AnalistaRhResponsavelUser.FullName ?? s.AnalistaRhResponsavelUser.Email)
                    : null,
                CentroCustoNome = s.CentroCusto != null ? s.CentroCusto.Description : (string?)null,
                s.QtdPosicoes, s.TipoSolicitacao, s.IsConfidencial, s.SubstituidoNome, s.CreatedAtUtc,
                s.RmCodStatus, s.RmUltimaStatusDescricaoRm, s.RmStatusSyncUltimaMensagem,
                s.RmUltimaSincronizacaoUtc,
            }).ToListAsync(ct);

        var ids = rawRows.Select(r => r.Id).ToList();
        var etapasPendentes = await _workflow.GetEtapasPendentesAsync(
            ids, TipoFluxoAprovacao.RequisicaoPessoal, ct, currentUserId: _currentUser.UserId);

        // Para itens em PendenteAprovacaoAumentoHC, o fluxo ativo é AumentoHeadcount — sobrescrever
        var idsHC = rawRows
            .Where(r => r.Status == SolicitacaoStatus.PendenteAprovacaoAumentoHC)
            .Select(r => r.Id).ToList();
        if (idsHC.Count > 0)
        {
            var etapasHC = await _workflow.GetEtapasPendentesAsync(
                idsHC, TipoFluxoAprovacao.AumentoHeadcount, ct, currentUserId: _currentUser.UserId);
            foreach (var (k, v) in etapasHC)
                etapasPendentes[k] = v;
        }

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            return new SolicitacaoVagaGridRow(
                r.Id, r.Titulo, r.Urgencia, r.Status, r.SolicitanteId, r.SolicitanteNome,
                r.AprovadorId, r.AprovadorNome, r.AnalistaRhResponsavelUserId, r.AnalistaRhResponsavelNome,
                r.CentroCustoNome, r.QtdPosicoes,
                r.TipoSolicitacao, r.IsConfidencial, r.SubstituidoNome, r.CreatedAtUtc,
                r.RmCodStatus, r.RmUltimaStatusDescricaoRm, r.RmStatusSyncUltimaMensagem,
                r.RmUltimaSincronizacaoUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId, ep?.AssumedByUserId,
                ep?.CanAssume ?? false);
        }).ToList();
    }

    public async Task<SolicitacaoVagaResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesVaga.AsNoTracking()
            .Include(x => x.Solicitante)
                .ThenInclude(f => f!.GestorDireto)
            .Include(x => x.Aprovador)
            .Include(x => x.AnalistaRhResponsavelUser)
            .Include(x => x.JobPosition)
            .Include(x => x.Unit)
            .Include(x => x.Empresa)
            .Include(x => x.CentroCusto)
            .Include(x => x.UnidadeLotacao)
            .Include(x => x.Turno)
                .ThenInclude(t => t!.UnidadeLotacao)
            .Include(x => x.DecisaoRHRevisadoPor)
            .Include(x => x.CandidatoContratado)
            .Include(x => x.Motivo)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

        if (!await CanUsuarioVerSolicitacaoVagaAsync(s.SolicitanteId, s.CentroCustoId, s.Id, ct))
            return null;

        // Fetch all etapas for workflow timeline
        var etapas = await _db.SolicitacoesAprovacaoEtapa
            .AsNoTracking()
            .Include(e => e.Aprovador)
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        // Resolve role names for fila steps
        var roleIds = etapas.Where(e => e.RoleFilaId.HasValue).Select(e => e.RoleFilaId!.Value).Distinct().ToList();
        var roleNames = new Dictionary<Guid, string?>();
        if (roleIds.Count > 0)
        {
            roleNames = await _db.Set<ApplicationRole>()
                .AsNoTracking()
                .Where(r => roleIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, r => (string?)r.Name, ct);
        }

        // Resolve names for admin users who assumed steps without a Funcionario link
        var assumedUserIds = etapas.Where(e => e.AssumedByUserId.HasValue).Select(e => e.AssumedByUserId!.Value).Distinct().ToList();
        var assumedUserNames = new Dictionary<Guid, string?>();
        if (assumedUserIds.Count > 0)
        {
            var rows = await _db.Set<ApplicationUser>()
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(u => assumedUserIds.Contains(u.Id))
                .Select(u => new { u.Id, Name = (u.FullName != null && u.FullName != "") ? u.FullName : u.UserName })
                .ToListAsync(ct);
            foreach (var r in rows)
                assumedUserNames[r.Id] = r.Name;
        }

        var etapasFluxo = etapas.Select(e =>
        {
            string? aprovadorNome = e.AssumedByUserId.HasValue && assumedUserNames.TryGetValue(e.AssumedByUserId.Value, out var adminName)
                ? adminName
                : e.Aprovador?.Name;
            // Consenso: fila Admin com gestor sem conta — mostrar o gestor (label ou cadastro), não só o role.
            if (string.IsNullOrEmpty(aprovadorNome) && e.RoleFilaId.HasValue)
            {
                aprovadorNome = ApprovalWorkflowHelper.TryExtractConsensoIntendedAprovadorNome(e.Label)
                    ?? s.Solicitante?.GestorDireto?.Name;
            }

            return new EtapaFluxoInfo(
                e.Ordem,
                e.Label,
                aprovadorNome,
                e.RoleFilaId.HasValue && roleNames.TryGetValue(e.RoleFilaId.Value, out var rn) ? rn : null,
                e.Status,
                e.DataUtc,
                e.Observacao
            );
        }).ToList();

        return MapToResponse(s, etapasFluxo);
    }

    public async Task<SolicitacaoVagaResponse> CreateAsync(
        SolicitacaoVagaCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        // Sprint P1: ReadOnly guard
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await ResolveSolicitanteIdAsync(solicitanteId, ct);

        // Sprint P2: Hierarchy-level permission check
        if (request.JobPositionId.HasValue && !_currentUser.IsAdmin)
        {
            var cargo = await _db.Set<JobPosition>().AsNoTracking()
                .FirstOrDefaultAsync(j => j.Id == request.JobPositionId.Value, ct);
            if (cargo?.NivelHierarquicoId != null)
            {
                var userId = _currentUser.UserId;
                var userRoleIds = userId.HasValue
                    ? await _db.Set<ApplicationUserRole>().AsNoTracking()
                        .Where(ur => ur.UserId == userId.Value)
                        .Select(ur => ur.RoleId)
                        .ToListAsync(ct)
                    : new List<Guid>();

                var temPermissao = await _db.PermissoesNivelVaga.AsNoTracking()
                    .AnyAsync(p => p.NivelHierarquicoId == cargo.NivelHierarquicoId.Value
                                   && userRoleIds.Contains(p.RoleId), ct);

                // Se não houver NENHUMA PermissaoNivelVaga cadastrada, ignora a regra (sem restrição configurada)
                var existeAlgumaPermissao = await _db.PermissoesNivelVaga.AsNoTracking()
                    .AnyAsync(p => p.NivelHierarquicoId == cargo.NivelHierarquicoId.Value, ct);

                if (existeAlgumaPermissao && !temPermissao)
                    throw new InvalidOperationException("Seu perfil não tem permissão para abrir vagas para este nível hierárquico.");
            }
        }

        // Resolve substituído name if applicable
        string? substituidoNome = null;
        if (request.TipoSolicitacao == TipoSolicitacaoVaga.Substituicao && request.SubstituidoFuncionarioId.HasValue)
        {
            var func = await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == request.SubstituidoFuncionarioId.Value, ct);
            substituidoNome = func?.Name;
        }

        // Resolve motivo parametrizável (novo) ou legacy (enum). Preenche ambos os campos para garantir
        // compatibilidade com clientes antigos e consistência de leitura nos helpers IsMotivoDesligamento.
        var (motivoId, motivoEnum, motivoConfig) = await ResolveMotivoAsync(
            request.MotivoRequisicaoId, request.MotivoRequisicao, ct);

        var ehDesligamento = motivoConfig is not null
            ? motivoConfig.EfeitoHeadcount is EfeitoHeadcount.Diminui or EfeitoHeadcount.Ambos
            : IsMotivoDesligamentoLegacy(motivoEnum);

        var entity = new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            AprovadorId = request.AprovadorId,
            JobPositionId = request.JobPositionId,
            UnitId = request.UnitId,
            Titulo = request.Titulo,
            CodFuncaoRm = request.CodFuncaoRm,
            FuncaoNomeRm = request.FuncaoNomeRm,
            Justificativa = request.Justificativa,
            QtdPosicoes = Math.Max(request.QtdPosicoes, 1),
            Urgencia = request.Urgencia,
            Status = SolicitacaoStatus.Rascunho,
            // Sprint 1
            TipoSolicitacao = request.TipoSolicitacao,
            IsConfidencial = request.IsConfidencial,
            SubstituidoFuncionarioId = request.SubstituidoFuncionarioId,
            SubstituidoNome = substituidoNome,
            // A.RH.013
            TipoContrato = request.TipoContrato,
            PrazoDias = request.PrazoDias,
            MotivoRequisicao = motivoEnum,
            MotivoRequisicaoId = motivoId,
            Motivo = motivoConfig, // só para permitir que IsMotivoDesligamento/ResolverTipoDesligamento leiam o efeito sem ir no DB
            CnhObrigatoria = request.CnhObrigatoria,
            DisponibilidadeViagens = request.DisponibilidadeViagens,
            EmpresaId = request.EmpresaId,
            CentroCustoId = request.CentroCustoId,
            UnidadeLotacaoId = request.UnidadeLotacaoId,
            // Vaga pré-vinculada quando criada a partir do painel de vagas
            VagaId = request.VagaId,
            // Dados desligamento (populados somente quando o motivo reduz/substitui headcount)
            DataDesligamento = ehDesligamento ? request.DataDesligamento : null,
            TipoAvisoPrevioDesligamento = ehDesligamento ? request.TipoAvisoPrevioDesligamento : null,
            DiasAvisoPrevioDesligamento = ehDesligamento ? request.DiasAvisoPrevioDesligamento : null,
            PossuiEstabilidadeDesligamento = ehDesligamento ? request.PossuiEstabilidadeDesligamento : null,
            MotivoDesligamentoTexto = ehDesligamento ? request.MotivoDesligamentoTexto : null,
            // Decisão de headcount escolhida pelo gestor na criação
            DecisaoRH = request.DecisaoRH,
            DecisaoRHPrazoMeses = request.DecisaoRHPrazoMeses,
            DecisaoRHPrazoDataAlvo = request.DecisaoRHPrazoDataAlvo,
            FaixaSalarialMin = request.FaixaSalarialMin,
            FaixaSalarialMax = request.FaixaSalarialMax,
            RequisitosDetalhadosJson = string.IsNullOrWhiteSpace(request.RequisitosDetalhadosJson)
                ? null
                : request.RequisitosDetalhadosJson.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        await AplicarTurnoOuEscalaLegadaAsync(entity, request.TurnoId, request.EscalaTrabalho, ct);

        ValidarFaixaSalarialProposta(entity.FaixaSalarialMin, entity.FaixaSalarialMax);
        ValidarCamposDesligamento(entity);

        _db.SolicitacoesVaga.Add(entity);

        // Gera a SolicitacaoDesligamento em rascunho já na criação da vaga, quando o motivo for de desligamento.
        // Ambas ficam vinculadas e visíveis imediatamente; o fluxo de cascata cuida de sync em cancel/reject.
        await CriarDesligamentoVinculadoAsync(entity, ct);

        await _db.SaveChangesAsync(ct);

        // Auto-submit: vaga (e desligamento vinculado, se houver) vão direto para PendenteAprovacao.
        await SubmitAsync(entity.Id, ct);
        if (entity.DesligamentoVinculadoId.HasValue)
        {
            var desligamentoService = _serviceProvider.GetRequiredService<ISolicitacaoDesligamentoService>();
            try { await desligamentoService.SubmitAsync(entity.DesligamentoVinculadoId.Value, ct); }
            catch { /* best-effort — se falhar a submissão do desligamento, a vaga ainda segue */ }
        }

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    /// <summary>
    /// Checa se o motivo da solicitação implica desligamento (Diminui ou Ambos no efeito de headcount).
    /// Prioriza o motivo parametrizável (<see cref="SolicitacaoVaga.Motivo"/>). Fallback para o enum legado
    /// enquanto existirem linhas antigas que ainda não foram backfilled.
    /// </summary>
    private static bool IsMotivoDesligamento(SolicitacaoVaga s)
    {
        if (s.Motivo is not null)
            return s.Motivo.EfeitoHeadcount is EfeitoHeadcount.Diminui or EfeitoHeadcount.Ambos;
        return s.MotivoRequisicao is MotivoRequisicaoVaga.PedidoDemissao
            or MotivoRequisicaoVaga.DesligamentoSemJustaCausa;
    }

    private static bool IsMotivoDesligamentoLegacy(MotivoRequisicaoVaga? m) =>
        m is MotivoRequisicaoVaga.PedidoDemissao or MotivoRequisicaoVaga.DesligamentoSemJustaCausa;

    /// <summary>
    /// Resolve o motivo da requisição aceitando tanto o novo FK (<paramref name="motivoId"/>) quanto o
    /// enum legado (<paramref name="enumLegacy"/>). Retorna a configuração carregada (quando existir)
    /// e os dois valores normalizados para gravação.
    /// </summary>
    private async Task<(Guid? MotivoId, MotivoRequisicaoVaga? EnumLegacy, MotivoRequisicaoVagaConfig? Config)>
        ResolveMotivoAsync(Guid? motivoId, MotivoRequisicaoVaga? enumLegacy, CancellationToken ct)
    {
        // Caminho preferencial: cliente novo envia Id direto.
        if (motivoId.HasValue)
        {
            var cfg = await _db.MotivosRequisicaoVagaConfig
                .FirstOrDefaultAsync(x => x.Id == motivoId.Value, ct);
            if (cfg is null)
                throw new InvalidOperationException("Motivo de requisição não encontrado.");

            var derivedEnum = cfg.Codigo switch
            {
                MotivoRequisicaoVagaSeeder.CodAtenderDemanda             => MotivoRequisicaoVaga.AtenderDemanda,
                MotivoRequisicaoVagaSeeder.CodPedidoDemissao             => MotivoRequisicaoVaga.PedidoDemissao,
                MotivoRequisicaoVagaSeeder.CodDesligamentoSemJustaCausa  => MotivoRequisicaoVaga.DesligamentoSemJustaCausa,
                MotivoRequisicaoVagaSeeder.CodCotaAprendiz               => MotivoRequisicaoVaga.CotaAprendiz,
                MotivoRequisicaoVagaSeeder.CodTerminoContrato            => MotivoRequisicaoVaga.TerminoContrato,
                MotivoRequisicaoVagaSeeder.CodExpansaoBase               => MotivoRequisicaoVaga.ExpansaoBase,
                MotivoRequisicaoVagaSeeder.CodNovaUnidade                => MotivoRequisicaoVaga.NovaUnidade,
                MotivoRequisicaoVagaSeeder.CodMovimentacao               => MotivoRequisicaoVaga.Movimentacao,
                MotivoRequisicaoVagaSeeder.CodAfastamento                => MotivoRequisicaoVaga.Afastamento,
                _                                                         => (MotivoRequisicaoVaga?)null, // motivo custom criado pelo tenant
            };

            return (cfg.Id, derivedEnum, cfg);
        }

        // Cliente antigo: enum legado. Tenta encontrar o motivo seed correspondente para popular o FK.
        if (enumLegacy.HasValue)
        {
            var codigo = enumLegacy.Value switch
            {
                MotivoRequisicaoVaga.AtenderDemanda             => MotivoRequisicaoVagaSeeder.CodAtenderDemanda,
                MotivoRequisicaoVaga.PedidoDemissao             => MotivoRequisicaoVagaSeeder.CodPedidoDemissao,
                MotivoRequisicaoVaga.DesligamentoSemJustaCausa  => MotivoRequisicaoVagaSeeder.CodDesligamentoSemJustaCausa,
                MotivoRequisicaoVaga.CotaAprendiz               => MotivoRequisicaoVagaSeeder.CodCotaAprendiz,
                MotivoRequisicaoVaga.TerminoContrato            => MotivoRequisicaoVagaSeeder.CodTerminoContrato,
                MotivoRequisicaoVaga.ExpansaoBase               => MotivoRequisicaoVagaSeeder.CodExpansaoBase,
                MotivoRequisicaoVaga.NovaUnidade                => MotivoRequisicaoVagaSeeder.CodNovaUnidade,
                MotivoRequisicaoVaga.Movimentacao               => MotivoRequisicaoVagaSeeder.CodMovimentacao,
                MotivoRequisicaoVaga.Afastamento                => MotivoRequisicaoVagaSeeder.CodAfastamento,
                _ => null,
            };

            var cfg = codigo is null ? null : await _db.MotivosRequisicaoVagaConfig
                .FirstOrDefaultAsync(x => x.Codigo == codigo, ct);

            return (cfg?.Id, enumLegacy, cfg);
        }

        return (null, null, null);
    }

    /// <summary>Resolve o TipoDesligamento a partir do motivo (pelo código canônico do seed).</summary>
    private static TipoDesligamento ResolverTipoDesligamento(SolicitacaoVaga s)
    {
        if (s.Motivo is not null)
        {
            return string.Equals(s.Motivo.Codigo, MotivoRequisicaoVagaSeeder.CodPedidoDemissao, StringComparison.OrdinalIgnoreCase)
                ? TipoDesligamento.PedidoDemissao
                : TipoDesligamento.SemJustaCausa;
        }
        return s.MotivoRequisicao == MotivoRequisicaoVaga.PedidoDemissao
            ? TipoDesligamento.PedidoDemissao
            : TipoDesligamento.SemJustaCausa;
    }

    private static void ValidarCamposDesligamento(SolicitacaoVaga s)
    {
        if (!IsMotivoDesligamento(s)) return;
        if (!s.SubstituidoFuncionarioId.HasValue)
            throw new InvalidOperationException("Informe o funcionário que será desligado.");
        if (!s.DataDesligamento.HasValue)
            throw new InvalidOperationException("Informe a data de desligamento.");
    }

    private async Task AplicarTurnoOuEscalaLegadaAsync(
        SolicitacaoVaga entity, Guid? turnoId, string? escalaTrabalhoRequest, CancellationToken ct)
    {
        if (turnoId.HasValue)
        {
            var turno = await ResolverEValidarTurnoAsync(turnoId, entity.UnidadeLotacaoId, ct);
            entity.TurnoId = turno!.Id;
            entity.EscalaTrabalho = SnapshotEscalaFromTurno(turno);
            return;
        }

        entity.TurnoId = null;
        entity.EscalaTrabalho = escalaTrabalhoRequest;
    }

    private async Task<Turno?> ResolverEValidarTurnoAsync(Guid? turnoId, Guid? unidadeLotacaoId, CancellationToken ct)
    {
        if (!turnoId.HasValue)
            return null;

        var t = await _db.Turnos.AsNoTracking()
            .Include(x => x.UnidadeLotacao)
            .FirstOrDefaultAsync(x => x.Id == turnoId.Value, ct);

        if (t is null)
            throw new InvalidOperationException("Turno não encontrado.");

        if (!t.IsActive)
            throw new InvalidOperationException("O turno selecionado está inativo.");

        // Sem lotação na solicitação: só turnos globais (cadastro não amarra UnidadeLotacaoId).
        if (t.UnidadeLotacaoId.HasValue && !unidadeLotacaoId.HasValue)
            throw new InvalidOperationException(
                "Este turno é exclusivo de uma unidade de lotação no cadastro. Na requisição use um turno global ou informe apenas a escala legada.");

        if (t.UnidadeLotacaoId.HasValue && t.UnidadeLotacaoId != unidadeLotacaoId)
        {
            var ulNome = t.UnidadeLotacao?.Description?.Trim();
            throw new InvalidOperationException(
                string.IsNullOrEmpty(ulNome)
                    ? "O turno selecionado não é compatível com a lotação informada nesta solicitação."
                    : $"O turno selecionado é específico da lotação \"{ulNome}\" e não se aplica à lotação desta solicitação.");
        }

        return t;
    }

    private static string? SnapshotEscalaFromTurno(Turno t)
    {
        var code = (t.Code ?? "").Trim();
        var desc = (t.Description ?? "").Trim();
        if (code.Length == 0 && desc.Length == 0)
            return null;
        if (desc.Length == 0)
            return code;
        if (code.Length == 0)
            return desc;
        return $"{code} — {desc}";
    }

    private async Task CriarDesligamentoVinculadoAsync(SolicitacaoVaga vaga, CancellationToken ct)
    {
        if (!IsMotivoDesligamento(vaga)) return;
        if (vaga.DesligamentoVinculadoId.HasValue) return; // idempotente
        if (!vaga.SubstituidoFuncionarioId.HasValue || !vaga.DataDesligamento.HasValue) return;

        var tipo = ResolverTipoDesligamento(vaga);

        var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == vaga.SolicitanteId, ct))?.Name ?? "gestor";

        var textoMotivo = string.IsNullOrWhiteSpace(vaga.MotivoDesligamentoTexto)
            ? $"Gerado automaticamente a partir da requisição de vaga \"{vaga.Titulo}\" aprovada por {solicitanteNome}."
            : vaga.MotivoDesligamentoTexto!.Trim();

        var desligamento = new SolicitacaoDesligamento
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = vaga.SolicitanteId,
            FuncionarioId = vaga.SubstituidoFuncionarioId.Value,
            EmpresaId = vaga.EmpresaId,
            UnitId = vaga.UnitId,
            DataDesligamento = vaga.DataDesligamento.Value,
            TipoDesligamento = tipo,
            MotivoDesligamento = textoMotivo,
            TipoAvisoPrevio = vaga.TipoAvisoPrevioDesligamento ?? TipoAvisoPrevio.Indenizado,
            DiasAvisoPrevio = vaga.DiasAvisoPrevioDesligamento ?? 30,
            PossuiEstabilidade = vaga.PossuiEstabilidadeDesligamento ?? false,
            ElegivelRecontratacao = false,
            SubstituirPosicao = false, // já existe vaga de origem — evita loop
            SolicitacaoVagaOrigemId = vaga.Id,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesDesligamento.Add(desligamento);
        vaga.DesligamentoVinculadoId = desligamento.Id;
    }

    public async Task<SolicitacaoVagaResponse> CopyAsync(Guid sourceId, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var source = await _db.SolicitacoesVaga
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sourceId && x.TenantId == _tenantContext.TenantId, ct)
            ?? throw new InvalidOperationException("Solicitação não encontrada.");

        var resolvedSolicitanteId = await ResolveSolicitanteIdAsync(solicitanteId, ct);

        var copy = new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            AprovadorId = source.AprovadorId,
            JobPositionId = source.JobPositionId,
            UnitId = source.UnitId,
            EmpresaId = source.EmpresaId,
            CentroCustoId = source.CentroCustoId,
            UnidadeLotacaoId = null,
            Titulo = $"{source.Titulo} (cópia)",
            CodFuncaoRm = source.CodFuncaoRm,
            FuncaoNomeRm = source.FuncaoNomeRm,
            Justificativa = source.Justificativa,
            QtdPosicoes = source.QtdPosicoes,
            Urgencia = source.Urgencia,
            Status = SolicitacaoStatus.Rascunho,
            TipoSolicitacao = source.TipoSolicitacao,
            IsConfidencial = source.IsConfidencial,
            SubstituidoFuncionarioId = source.SubstituidoFuncionarioId,
            SubstituidoNome = source.SubstituidoNome,
            TipoContrato = source.TipoContrato,
            PrazoDias = source.PrazoDias,
            MotivoRequisicao = source.MotivoRequisicao,
            MotivoRequisicaoId = source.MotivoRequisicaoId,
            CnhObrigatoria = source.CnhObrigatoria,
            DisponibilidadeViagens = source.DisponibilidadeViagens,
            TurnoId = source.TurnoId,
            EscalaTrabalho = source.EscalaTrabalho,
            // Decisão de headcount — copia pro rascunho, gestor pode alterar antes de submeter
            DecisaoRH = source.DecisaoRH,
            DecisaoRHPrazoMeses = source.DecisaoRHPrazoMeses,
            DecisaoRHPrazoDataAlvo = source.DecisaoRHPrazoDataAlvo,
            FaixaSalarialMin = source.FaixaSalarialMin,
            FaixaSalarialMax = source.FaixaSalarialMax,
            RequisitosDetalhadosJson = source.RequisitosDetalhadosJson,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesVaga.Add(copy);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(copy.Id, ct))!;
    }

    private async Task<Guid> ResolveSolicitanteIdAsync(Guid? solicitanteId, CancellationToken ct)
    {
        if (solicitanteId.HasValue && solicitanteId.Value != Guid.Empty)
        {
            var existingFuncionario = await _db.Set<Funcionario>()
                .AsNoTracking()
                .AnyAsync(f => f.Id == solicitanteId.Value, ct);

            if (existingFuncionario)
                return solicitanteId.Value;
        }

        var userId = _currentUser.UserId
            ?? throw new InvalidOperationException("Usuário autenticado não encontrado para vincular a solicitação.");

        var funcionario = await _db.Set<Funcionario>()
            .FirstOrDefaultAsync(f => f.UserId == userId, ct);
        if (funcionario is not null)
            return funcionario.Id;

        var user = await _db.Set<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        string email;
        string fullName;

        if (user is not null)
        {
            email = (user.Email ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                throw new InvalidOperationException("Usuário autenticado sem e-mail válido para criar o solicitante.");
            fullName = string.IsNullOrWhiteSpace(user.FullName) ? email : user.FullName.Trim();
        }
        else if (_currentUser.IsAdmin)
        {
            // Owner: não existe como ApplicationUser, usar dados do JWT
            email = (_currentUser.Email ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                throw new InvalidOperationException("Owner sem e-mail válido para criar o solicitante.");
            fullName = "Owner";
        }
        else
        {
            throw new InvalidOperationException("Usuário autenticado não encontrado para criar o solicitante.");
        }
        var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
            email,
            fullName,
            null,
            null,
            null,
            null,
            null,
            null,
            OrigemPessoa.Funcionario,
            ct);

        var now = DateTimeOffset.UtcNow;
        funcionario = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PessoaId = pessoa.Id,
            Name = fullName,
            Email = email,
            UserId = user is not null ? userId : null,
            Status = FuncionarioStatus.Active,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.Set<Funcionario>().Add(funcionario);
        if (user is not null)
            user.FuncionarioId = funcionario.Id;
        await _db.SaveChangesAsync(ct);

        return funcionario.Id;
    }

    private void EnsureCurrentUserIsSolicitanteOuAdmin(SolicitacaoVaga entity)
    {
        if (_currentUser.IsAdmin) return;
        if (_currentUser.FuncionarioId.HasValue && entity.SolicitanteId == _currentUser.FuncionarioId.Value)
            return;
        throw new InvalidOperationException("Somente o solicitante pode alterar ou enviar esta solicitação.");
    }

    public async Task<SolicitacaoVagaResponse?> UpdateAsync(
        Guid id, SolicitacaoVagaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        EnsureCurrentUserIsSolicitanteOuAdmin(entity);

        // Draft, AjustesNecessarios, devolução da triagem ou PendenteAprovacao (este último volta a rascunho).
        if (entity.Status != SolicitacaoStatus.Rascunho &&
            entity.Status != SolicitacaoStatus.AjustesNecessarios &&
            entity.Status != SolicitacaoStatus.DevolvidaTriagemGestor &&
            entity.Status != SolicitacaoStatus.PendenteAprovacao)
            throw new InvalidOperationException("Solicitação não pode ser editada no status atual.");

        // If pending approval, retract back to draft so it can be resubmitted
        if (entity.Status == SolicitacaoStatus.PendenteAprovacao)
        {
            var statusAnteriorUpdate = entity.Status.ToString();
            entity.Status = SolicitacaoStatus.Rascunho;
            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                statusAnteriorUpdate, entity.Status.ToString(), _currentUser, null, ct);
        }

        entity.Titulo = request.Titulo;
        entity.CodFuncaoRm = request.CodFuncaoRm;
        entity.FuncaoNomeRm = request.FuncaoNomeRm;
        entity.Justificativa = request.Justificativa;
        entity.QtdPosicoes = Math.Max(request.QtdPosicoes, 1);
        entity.Urgencia = request.Urgencia;
        entity.JobPositionId = request.JobPositionId;
        entity.UnitId = request.UnitId;
        entity.AprovadorId = request.AprovadorId;
        // Sprint 1
        entity.TipoSolicitacao = request.TipoSolicitacao;
        entity.IsConfidencial = request.IsConfidencial;
        entity.SubstituidoFuncionarioId = request.SubstituidoFuncionarioId;
        if (request.TipoSolicitacao == TipoSolicitacaoVaga.Substituicao && request.SubstituidoFuncionarioId.HasValue)
        {
            var func = await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == request.SubstituidoFuncionarioId.Value, ct);
            entity.SubstituidoNome = func?.Name;
        }
        else
        {
            entity.SubstituidoNome = null;
        }
        // A.RH.013
        entity.TipoContrato = request.TipoContrato;
        entity.PrazoDias = request.PrazoDias;

        var (motivoIdUpd, motivoEnumUpd, motivoConfigUpd) = await ResolveMotivoAsync(
            request.MotivoRequisicaoId, request.MotivoRequisicao, ct);
        entity.MotivoRequisicao = motivoEnumUpd;
        entity.MotivoRequisicaoId = motivoIdUpd;
        entity.Motivo = motivoConfigUpd;

        var ehDesligamentoUpd = motivoConfigUpd is not null
            ? motivoConfigUpd.EfeitoHeadcount is EfeitoHeadcount.Diminui or EfeitoHeadcount.Ambos
            : IsMotivoDesligamentoLegacy(motivoEnumUpd);

        entity.CnhObrigatoria = request.CnhObrigatoria;
        entity.DisponibilidadeViagens = request.DisponibilidadeViagens;
        entity.EmpresaId = request.EmpresaId;
        entity.CentroCustoId = request.CentroCustoId;
        entity.UnidadeLotacaoId = request.UnidadeLotacaoId;
        // Vaga pré-vinculada: só atualiza se ainda estiver no rascunho (sem aprovação)
        if (request.VagaId.HasValue && !entity.VagaId.HasValue)
            entity.VagaId = request.VagaId;

        await AplicarTurnoOuEscalaLegadaAsync(entity, request.TurnoId, request.EscalaTrabalho, ct);

        // Dados desligamento (limpa quando motivo não é de desligamento)
        if (ehDesligamentoUpd)
        {
            entity.DataDesligamento = request.DataDesligamento;
            entity.TipoAvisoPrevioDesligamento = request.TipoAvisoPrevioDesligamento;
            entity.DiasAvisoPrevioDesligamento = request.DiasAvisoPrevioDesligamento;
            entity.PossuiEstabilidadeDesligamento = request.PossuiEstabilidadeDesligamento;
            entity.MotivoDesligamentoTexto = request.MotivoDesligamentoTexto;
        }
        else
        {
            entity.DataDesligamento = null;
            entity.TipoAvisoPrevioDesligamento = null;
            entity.DiasAvisoPrevioDesligamento = null;
            entity.PossuiEstabilidadeDesligamento = null;
            entity.MotivoDesligamentoTexto = null;
        }

        ValidarCamposDesligamento(entity);

        // Decisão de headcount (escolhida pelo gestor)
        entity.DecisaoRH = request.DecisaoRH;
        entity.DecisaoRHPrazoMeses = request.DecisaoRHPrazoMeses;
        entity.DecisaoRHPrazoDataAlvo = request.DecisaoRHPrazoDataAlvo;
        entity.FaixaSalarialMin = request.FaixaSalarialMin;
        entity.FaixaSalarialMax = request.FaixaSalarialMax;
        entity.RequisitosDetalhadosJson = string.IsNullOrWhiteSpace(request.RequisitosDetalhadosJson)
            ? null
            : request.RequisitosDetalhadosJson.Trim();

        ValidarFaixaSalarialProposta(entity.FaixaSalarialMin, entity.FaixaSalarialMax);

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Sync do desligamento vinculado:
        //   (a) se motivo passou a ser de desligamento e ainda não há vínculo → cria agora
        //   (b) se já existe vínculo e motivo ainda é de desligamento → atualiza dados
        //   (c) se já existe vínculo mas motivo deixou de ser de desligamento → cancela em cascata
        if (IsMotivoDesligamento(entity))
        {
            if (!entity.DesligamentoVinculadoId.HasValue)
            {
                await CriarDesligamentoVinculadoAsync(entity, ct);
            }
            else
            {
                await SincronizarDesligamentoVinculadoAsync(entity, ct);
            }
        }
        else if (entity.DesligamentoVinculadoId.HasValue)
        {
            var vinculoId = entity.DesligamentoVinculadoId.Value;
            entity.DesligamentoVinculadoId = null;
            await _db.SaveChangesAsync(ct);
            var desligamentoService = _serviceProvider.GetRequiredService<ISolicitacaoDesligamentoService>();
            await desligamentoService.CancelarEmCascataAsync(vinculoId, ct);
            return await GetByIdAsync(id, ct);
        }

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    private async Task SincronizarDesligamentoVinculadoAsync(SolicitacaoVaga vaga, CancellationToken ct)
    {
        if (!vaga.DesligamentoVinculadoId.HasValue) return;
        var desligamento = await _db.SolicitacoesDesligamento
            .FirstOrDefaultAsync(d => d.Id == vaga.DesligamentoVinculadoId.Value, ct);
        if (desligamento is null) return;

        // Só sincroniza se ainda está em estado editável (Rascunho/AjustesNecessarios/PendenteAprovacao)
        if (desligamento.Status != SolicitacaoStatus.Rascunho &&
            desligamento.Status != SolicitacaoStatus.AjustesNecessarios &&
            desligamento.Status != SolicitacaoStatus.PendenteAprovacao)
            return;

        var tipo = ResolverTipoDesligamento(vaga);

        if (vaga.SubstituidoFuncionarioId.HasValue)
            desligamento.FuncionarioId = vaga.SubstituidoFuncionarioId.Value;
        desligamento.EmpresaId = vaga.EmpresaId;
        desligamento.UnitId = vaga.UnitId;
        if (vaga.DataDesligamento.HasValue)
            desligamento.DataDesligamento = vaga.DataDesligamento.Value;
        desligamento.TipoDesligamento = tipo;
        desligamento.TipoAvisoPrevio = vaga.TipoAvisoPrevioDesligamento ?? desligamento.TipoAvisoPrevio;
        desligamento.DiasAvisoPrevio = vaga.DiasAvisoPrevioDesligamento ?? desligamento.DiasAvisoPrevio;
        desligamento.PossuiEstabilidade = vaga.PossuiEstabilidadeDesligamento ?? desligamento.PossuiEstabilidade;
        if (!string.IsNullOrWhiteSpace(vaga.MotivoDesligamentoTexto))
            desligamento.MotivoDesligamento = vaga.MotivoDesligamentoTexto!.Trim();
        desligamento.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

        public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        EnsureCurrentUserIsSolicitanteOuAdmin(entity);

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        // Decisão de headcount passou a ser obrigatória na submissão: quem pede a vaga decide
        // o tipo de headcount (consumir existente, provisório ou aumento definitivo).
        // Substituicao pura segue o fluxo de provisório por padrão (sem exigir DecisaoRH explícito).
        if (IsFluxoComDecisaoHeadcountGestor(entity.TipoSolicitacao) && !entity.DecisaoRH.HasValue)
            throw new InvalidOperationException("Informe a decisão de headcount antes de submeter a solicitação.");

        if (entity.DecisaoRH == TipoDecisaoHeadcount.SubstituicaoProvisoria
            && !entity.DecisaoRHPrazoDataAlvo.HasValue
            && !(entity.DecisaoRHPrazoMeses.HasValue && entity.DecisaoRHPrazoMeses.Value > 0))
            throw new InvalidOperationException("Informe o prazo da substituição provisória (data alvo ou meses).");

        entity.DecisaoRHRevisadoPorId ??= entity.SolicitanteId;
        entity.DecisaoRHEmUtc ??= DateTimeOffset.UtcNow;

        if (!entity.TurnoId.HasValue && string.IsNullOrWhiteSpace(entity.EscalaTrabalho))
            throw new InvalidOperationException("Informe o turno de trabalho ou a escala (formato legado) antes de submeter.");

        var statusAnteriorSubmit = entity.Status.ToString();

        if (SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(entity))
        {
            if (!SolicitacaoVagaFluxoAumentoQuadro.PodeGestorSubmitar(entity.Status))
                throw new InvalidOperationException(
                    "Não é possível submeter enquanto a solicitação aguarda triagem ou já foi encaminhada para aprovação.");

            await EnsureCamposMinimosEnvioAumentoQuadroAsync(entity, ct);

            entity.Status = SolicitacaoStatus.PendenteTriagem;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                statusAnteriorSubmit, entity.Status.ToString(), _currentUser, null, ct);

            var remover = _db.SolicitacoesAprovacaoEtapa
                .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal);
            _db.SolicitacoesAprovacaoEtapa.RemoveRange(remover);

            await _db.SaveChangesAsync(ct);
            await NotificarNovaTriagemRHAsync(entity, ct);
            await _recruiterNotifier.NotifyNovaEnviadaAsync(entity, ct);
            return true;
        }

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            statusAnteriorSubmit, entity.Status.ToString(), _currentUser, null, ct);

        var primeiraEtapa = await MontarEtapasRequisicaoPessoalEAvancoProcessoAsync(entity, ct);
        await _db.SaveChangesAsync(ct);

        string? excluirEmailRecrutadorSeAprovador = null;
        if (primeiraEtapa?.AprovadorId is Guid aprovPrimeiroId)
            excluirEmailRecrutadorSeAprovador = await ResolverEmailNotificacaoFuncionarioPreferindoUsuarioAsync(aprovPrimeiroId, ct);

        await NotificarPrimeiraEtapaSeAprovadorDiretoAsync(entity, primeiraEtapa, ct);
        await _recruiterNotifier.NotifyNovaEnviadaAsync(entity, ct, excluirEmailRecrutadorSeAprovador);

        return true;
    }

    public async Task<SolicitacaoVagaResponse?> IniciarTriagemAsync(Guid id, CancellationToken ct)
    {
        await EnsureUsuarioAutorizadoTriagemAsync(ct);

        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (!SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(entity))
            throw new InvalidOperationException("Triagem inicial aplica-se apenas a solicitações de aumento de quadro.");

        if (entity.Status != SolicitacaoStatus.PendenteTriagem)
            throw new InvalidOperationException("Somente solicitações com status PendenteTriagem podem iniciar triagem.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.EmTriagem;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, null, ct);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> DevolverTriagemAoGestorAsync(Guid id, string observacao, CancellationToken ct)
    {
        await EnsureUsuarioAutorizadoTriagemAsync(ct);

        var obs = observacao.Trim();
        if (string.IsNullOrEmpty(obs))
            throw new InvalidOperationException("Informe a observação da devolução.");

        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (!SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(entity))
            throw new InvalidOperationException("Devolução de triagem aplica-se apenas ao fluxo aumento de quadro.");

        if (!SolicitacaoVagaFluxoAumentoQuadro.EstaEmFilaTriagem(entity.Status))
            throw new InvalidOperationException("Somente em PendenteTriagem ou EmTriagem é possível devolver ao gestor.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.DevolvidaTriagemGestor;
        entity.ObservacaoAprovador = obs;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, obs, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação devolvida na triagem RH",
            $"Revise pendências antes de reenviar: {obs}",
            SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
            ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> EncaminharTriagemParaAprovacoesAsync(Guid id, CancellationToken ct)
    {
        await EnsureUsuarioAutorizadoTriagemAsync(ct);

        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (!SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(entity))
            throw new InvalidOperationException("Encaminhamento pela triagem aplica-se apenas ao fluxo aumento de quadro.");

        if (entity.Status != SolicitacaoStatus.EmTriagem)
            throw new InvalidOperationException("Inicie a triagem antes de encaminhar para as aprovações.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, null, ct);

        var primeira = await MontarEtapasRequisicaoPessoalEAvancoProcessoAsync(entity, ct);
        await _db.SaveChangesAsync(ct);
        await NotificarPrimeiraEtapaSeAprovadorDiretoAsync(entity, primeira, ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> TriagemReprovarAsync(Guid id, string motivo, CancellationToken ct)
    {
        await EnsureUsuarioAutorizadoTriagemAsync(ct);

        var mot = motivo.Trim();
        if (string.IsNullOrEmpty(mot))
            throw new InvalidOperationException("Informe o motivo da reprovação.");

        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (!SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(entity))
            throw new InvalidOperationException("Reprovação na triagem aplica-se apenas ao fluxo aumento de quadro.");

        if (!SolicitacaoVagaFluxoAumentoQuadro.EstaEmFilaTriagem(entity.Status))
            throw new InvalidOperationException("Reprovação interna só é permitida enquanto a solicitação está na triagem.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = mot;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, mot, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação reprovada na triagem",
            $"Motivo: {mot}",
            SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    private static void GarantirFluxoAumentoQuadroPermiteAcaoDeAprovador(SolicitacaoVaga entity)
    {
        if (!SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(entity))
            return;
        if (!SolicitacaoVagaFluxoAumentoQuadro.EstaEmFilaTriagem(entity.Status) && entity.Status != SolicitacaoStatus.DevolvidaTriagemGestor)
            return;
        throw new InvalidOperationException(
            "Esta solicitação (aumento de quadro) ainda está em triagem ou aguardando ajuste do gestor — use o fluxo de triagem ou reenvio pelo solicitante antes de aprovar/reprovar/solicitar ajustes pela cadeia de aprovação.");
    }

    private async Task EnsureUsuarioAutorizadoTriagemAsync(CancellationToken ct)
    {
        if (_currentUser.IsAdmin)
            return;
        if (!_currentUser.UserId.HasValue)
            throw new InvalidOperationException("Usuário não autenticado.");

        var roleId = await _workflow.ResolveRhRoleIdAsync(TipoFluxoAprovacao.RequisicaoPessoal, ct);
        if (!roleId.HasValue)
            throw new InvalidOperationException("Fila RH para requisição de pessoal não configurada.");

        var inRole = await _db.Set<ApplicationUserRole>()
            .AsNoTracking()
            .AnyAsync(ur => ur.UserId == _currentUser.UserId!.Value && ur.RoleId == roleId.Value, ct);
        if (!inRole)
            throw new InvalidOperationException("Sem permissão de triagem: exige perfil configurado ou administrador.");
    }

    private async Task EnsureCamposMinimosEnvioAumentoQuadroAsync(SolicitacaoVaga entity, CancellationToken ct)
    {
        if (!await _db.Funcionarios.AsNoTracking()
                .AnyAsync(f => f.Id == entity.SolicitanteId && f.UserId != null && f.Status == FuncionarioStatus.Active, ct))
            throw new InvalidOperationException("O gestor solicitante precisa estar vinculado a um usuário ativo.");

        if (!(entity.UnitId.HasValue || entity.CentroCustoId.HasValue || entity.EmpresaId.HasValue))
            throw new InvalidOperationException("Informe ao menos empresa, centro de custo ou unidade (local).");

        if (!entity.JobPositionId.HasValue)
            throw new InvalidOperationException("Informe o cargo da vaga (JobPositionId).");

        if (!entity.MotivoRequisicaoId.HasValue && !entity.MotivoRequisicao.HasValue)
            throw new InvalidOperationException("Informe o motivo da requisição.");

        if (string.IsNullOrWhiteSpace(entity.Justificativa))
            throw new InvalidOperationException("Informe a justificativa da solicitação antes do envio.");

        var jsonText = entity.RequisitosDetalhadosJson?.Trim();
        if (string.IsNullOrEmpty(jsonText) || jsonText.Length < 8)
            throw new InvalidOperationException("Informe os requisitos detalhados (JSON) antes do envio.");

        try
        {
            using var doc = JsonDocument.Parse(jsonText);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                throw new InvalidOperationException("RequisitosDetalhadosJson deve ser um objeto JSON.");
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("RequisitosDetalhadosJson inválido (JSON malformado).");
        }
    }

    private async Task<SolicitacaoAprovacaoEtapa?> MontarEtapasRequisicaoPessoalEAvancoProcessoAsync(
        SolicitacaoVaga entity, CancellationToken ct)
    {
        var id = entity.Id;
        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        var fluxoConfig = await _db.FluxosAprovacaoConfig
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal, ct);

        Guid? targetUnidadeId = fluxoConfig?.ReferenciaUnidade == ReferenciaUnidade.SolicitacaoInformada
            ? entity.UnidadeLotacaoId
            : null;

        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, null, TipoFluxoAprovacao.RequisicaoPessoal, ct, targetUnidadeId);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
            Ordem = r.Ordem,
            Label = r.Label,
            AprovadorId = r.AprovadorId,
            RoleFilaId = r.RoleFilaId,
            AcaoEtapa = r.AcaoEtapa,
            MomentoAcao = r.MomentoAcao,
            Status = StatusAprovacao.Pendente,
        }).ToList();

        _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);

        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
        while (primeiraEtapa is not null && IsProcessoStep(primeiraEtapa))
        {
            await ExecutarAcaoEtapaAsync(primeiraEtapa.AcaoEtapa, entity, ct);
            primeiraEtapa.Status = StatusAprovacao.Aprovado;
            primeiraEtapa.DataUtc = DateTimeOffset.UtcNow;
            primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault(e => e.Ordem > primeiraEtapa.Ordem);
        }

        return primeiraEtapa;
    }

    /// <summary>
    /// Mais de uma transição para <see cref="SolicitacaoStatus.PendenteAprovacao"/> indica reenvio
    /// (ex.: edição pendente → rascunho → novo submit).
    /// </summary>
    private async Task<bool> SolicitacaoFoiReenviadaParaPendenciaAposAlteracaoAsync(Guid solicitacaoVagaId, CancellationToken ct)
    {
        var vezesChegouPendente = await _db.HistoricosStatus.AsNoTracking()
            .Where(h =>
                h.TipoEntidade == TipoEntidadeStatus.SolicitacaoVaga
                && h.EntidadeId == solicitacaoVagaId
                && h.StatusNovo == nameof(SolicitacaoStatus.PendenteAprovacao))
            .CountAsync(ct);
        return vezesChegouPendente >= 2;
    }

    /// <summary>Alinha com o destino do magic link: e-mail do usuário ativo ligado ao funcionário, senão e-mail do cadastro.</summary>
    private async Task<string?> ResolverEmailNotificacaoFuncionarioPreferindoUsuarioAsync(Guid funcionarioId, CancellationToken ct)
    {
        var userMail = await _db.Set<ApplicationUser>()
            .AsNoTracking()
            .Where(u =>
                u.FuncionarioId == funcionarioId &&
                u.Email != null &&
                u.Email != "")
            .OrderByDescending(u => u.IsActive)
            .Select(u => u.Email!)
            .FirstOrDefaultAsync(ct);

        if (!string.IsNullOrWhiteSpace(userMail))
            return userMail.Trim();

        var fe = await _db.Set<Funcionario>().AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => f.Email)
            .FirstOrDefaultAsync(ct);

        return string.IsNullOrWhiteSpace(fe) ? null : fe.Trim();
    }

    private async Task NotificarPrimeiraEtapaSeAprovadorDiretoAsync(
        SolicitacaoVaga entity, SolicitacaoAprovacaoEtapa? primeiraEtapa, CancellationToken ct)
    {
        if (primeiraEtapa is null || !primeiraEtapa.AprovadorId.HasValue)
            return;

        var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))
            ?.Name ?? "Alguém";

        var reenvioAposAlteracao = await SolicitacaoFoiReenviadaParaPendenciaAposAlteracaoAsync(entity.Id, ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            primeiraEtapa.AprovadorId.Value,
            reenvioAposAlteracao ? "Solicitação de vaga atualizada (reenvio)" : "Nova solicitação de vaga para aprovação",
            reenvioAposAlteracao
                ? $"{solicitanteNome} atualizou e reenviou a solicitação: {entity.Titulo}"
                : $"{solicitanteNome} abriu uma solicitação: {entity.Titulo}",
            SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
            ct);

        try
        {
            var httpCtx = _httpContextAccessor.HttpContext;
            await _magicLink.CreateAndSendAsync(
                primeiraEtapa, TipoFluxoAprovacao.RequisicaoPessoal, entity.Id,
                entity.Titulo, solicitanteNome,
                httpCtx?.Request.Scheme, httpCtx?.Request.Host.Host, ct,
                reenvioAposAlteracao);
        }
        catch { /* best-effort */ }
    }

    private async Task NotificarNovaTriagemRHAsync(SolicitacaoVaga entity, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return;

        var roleId = await _workflow.ResolveRhRoleIdAsync(TipoFluxoAprovacao.RequisicaoPessoal, ct);
        if (!roleId.HasValue)
            return;

        var userIds = await _db.Set<ApplicationUserRole>()
            .AsNoTracking()
            .Where(ur => ur.RoleId == roleId.Value)
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync(ct);

        if (userIds.Count == 0)
            return;

        var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))
            ?.Name ?? "Gestor";

        await _notifications.PublishToUsersAsync(
            tenantId,
            userIds,
            "Nova solicitação na triagem RH",
            $"{solicitanteNome}: {entity.Titulo} — aguarda triagem antes das aprovações.",
            SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
            "info",
            ct);
    }

        public async Task<SolicitacaoVagaResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        GarantirFluxoAumentoQuadroPermiteAcaoDeAprovador(entity);
        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var statusAnteriorApprove = entity.Status.ToString();

        // Determinar qual fluxo está ativo (normal ou escalação de HC)
        var tipoFluxoAtivo = entity.Status == SolicitacaoStatus.PendenteAprovacaoAumentoHC
            ? TipoFluxoAprovacao.AumentoHeadcount
            : TipoFluxoAprovacao.RequisicaoPessoal;

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == tipoFluxoAtivo && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Nenhuma etapa de aprovação pendente encontrada.");

        if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não tem permissão para aprovar esta etapa.");

        if (etapaAtual.RoleFilaId.HasValue && _currentUser.FuncionarioId.HasValue)
            etapaAtual.AprovadorId = _currentUser.FuncionarioId;

        etapaAtual.Status = StatusAprovacao.Aprovado;
        etapaAtual.DataUtc = DateTimeOffset.UtcNow;
        if (observacao != null) etapaAtual.Observacao = observacao;

        // Safety net: se a vaga foi criada antes do fix (sem desligamento vinculado), cria agora.
        // Idempotente (no-op se já existe vínculo).
        await CriarDesligamentoVinculadoAsync(entity, ct);

        var todasEtapas = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == tipoFluxoAtivo)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        // Executar ação da etapa atual se momento = AoAprovar
        if (etapaAtual.AcaoEtapa != AcaoEtapa.Nenhuma && etapaAtual.MomentoAcao == MomentoAcao.AoAprovar)
            await ExecutarAcaoEtapaAsync(etapaAtual.AcaoEtapa, entity, ct);

        // Auto-avança por etapas de processo (sem aprovador, sem fila, com ação)
        var proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > etapaAtual.Ordem);
        while (proximaEtapa is not null && IsProcessoStep(proximaEtapa))
        {
            await ExecutarAcaoEtapaAsync(proximaEtapa.AcaoEtapa, entity, ct);
            proximaEtapa.Status = StatusAprovacao.Aprovado;
            proximaEtapa.DataUtc = DateTimeOffset.UtcNow;
            proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > proximaEtapa.Ordem);
        }

        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (proximaEtapa is not null)
        {
            // Há uma próxima etapa que precisa de aprovador
            entity.Status = SolicitacaoStatus.PendenteAprovacao;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                var solicitanteNome2 = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de vaga aguarda sua aprovação",
                    $"A solicitação \"{entity.Titulo}\" foi aprovada na etapa anterior e aguarda sua ação.",
                    SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
                    ct);

                try
                {
                    var httpCtx2 = _httpContextAccessor.HttpContext;
                    await _magicLink.CreateAndSendAsync(
                        proximaEtapa, TipoFluxoAprovacao.RequisicaoPessoal, entity.Id,
                        entity.Titulo, solicitanteNome2,
                        httpCtx2?.Request.Scheme, httpCtx2?.Request.Host.Host, ct);
                }
                catch { /* best-effort */ }
            }
        }
        else
        {
            // Fim do fluxo
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;

            if (tipoFluxoAtivo == TipoFluxoAprovacao.AumentoHeadcount)
            {
                // Escalação de aumento definitivo aprovada pela Diretoria
                if (entity.VagaId.HasValue)
                {
                    var vagaHC = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
                    if (vagaHC is not null)
                    {
                        vagaHC.HeadcountAutorizado += entity.QtdPosicoes;
                        vagaHC.HeadcountPendente = Math.Max(0, vagaHC.HeadcountPendente - entity.QtdPosicoes);
                        if (vagaHC.Status == VagaStatus.Preenchida)
                            vagaHC.Status = VagaStatus.Aberta;
                        vagaHC.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    }
                }
                entity.Status = SolicitacaoStatus.Concluida;

                await _statusHistorico.RegistrarAsync(
                    TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                    statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

                await _db.SaveChangesAsync(ct);

                await _workflow.NotifyByFuncionarioIdAsync(
                    entity.SolicitanteId,
                    "Aumento de headcount aprovado",
                    $"O aumento de headcount para \"{entity.Titulo}\" foi aprovado pela Diretoria.",
                    SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
                    ct);

                await _recruiterNotifier.NotifyFinalizadaAsync(entity.Id, ct);
            }
            else if (entity.TipoSolicitacao == TipoSolicitacaoVaga.Substituicao)
            {
                // Substituição: comportamento existente — ativar headcount provisório
                if (!entity.VagaId.HasValue)
                    await CriarVagaRascunhoAsync(entity, ct);
                if (entity.VagaId.HasValue)
                    await AtivarHeadcountProvisorioAsync(entity, ct);
                if (entity.Status != SolicitacaoStatus.Aprovada)
                    entity.Status = SolicitacaoStatus.Aprovada;

                await _statusHistorico.RegistrarAsync(
                    TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                    statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

                await _db.SaveChangesAsync(ct);

                await _workflow.NotifyByFuncionarioIdAsync(
                    entity.SolicitanteId,
                    "Solicitação de vaga aprovada",
                    $"Sua solicitação \"{entity.Titulo}\" foi aprovada.",
                    SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
                    ct);

                await _recruiterNotifier.NotifyFinalizadaAsync(entity.Id, ct);
            }
            else
            {
                // VagaNova: aplica a decisão de headcount que o gestor escolheu na criação.
                // A partir de agora o RH não decide mais — essa escolha já veio no payload.
                await AplicarDecisaoHeadcountAsync(entity, statusAnteriorApprove, observacao, ct);
                return await GetByIdAsync(id, ct);
            }
        }

        return await GetByIdAsync(id, ct);
    }

    /// <summary>
    /// Aplica a decisão de headcount que o gestor escolheu na criação da solicitação de VagaNova.
    /// Substitui o antigo método DecisaoRHAsync (que era chamado pelo RH pós-aprovação).
    /// </summary>
    private async Task AplicarDecisaoHeadcountAsync(
        SolicitacaoVaga entity,
        string statusAnterior,
        string? observacao,
        CancellationToken ct)
    {
        if (!entity.DecisaoRH.HasValue)
            throw new InvalidOperationException("VagaNova sem decisão de headcount — obrigatório ao submeter.");

        // Garante que a vaga vinculada exista
        if (!entity.VagaId.HasValue)
            await CriarVagaRascunhoAsync(entity, ct, headcountPendente: entity.QtdPosicoes);
        else
            await ProvisionarHcPendenteAsync(entity, ct);

        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId!.Value, ct)
            ?? throw new InvalidOperationException("Vaga vinculada não encontrada.");

        entity.DecisaoRHEmUtc ??= DateTimeOffset.UtcNow;
        entity.DecisaoRHRevisadoPorId ??= entity.SolicitanteId;

        switch (entity.DecisaoRH.Value)
        {
            case TipoDecisaoHeadcount.SubstituicaoProvisoria:
            {
                var expiresAt = entity.DecisaoRHPrazoDataAlvo
                    ?? (entity.DecisaoRHPrazoMeses.HasValue
                        ? DateTimeOffset.UtcNow.AddMonths(entity.DecisaoRHPrazoMeses.Value)
                        : throw new InvalidOperationException("Prazo da substituição provisória ausente."));

                vaga.HeadcountProvisorio += entity.QtdPosicoes;
                vaga.HeadcountProvisorioExpiresAtUtc = expiresAt;
                vaga.HeadcountPendente = Math.Max(0, vaga.HeadcountPendente - entity.QtdPosicoes);
                vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;

                if (vaga.Status == VagaStatus.Preenchida)
                    vaga.Status = VagaStatus.Aberta;

                _db.OcupacoesHistorico.Add(new RhPortal.Api.Domain.Entities.OcupacaoHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId ?? "",
                    VagaId = vaga.Id,
                    FuncionarioId = null,
                    DataEntrada = DateTime.UtcNow,
                    SolicitacaoOrigemId = entity.Id,
                    IsProvisorio = true,
                    ProvisorioExpiresAtUtc = vaga.HeadcountProvisorioExpiresAtUtc,
                });

                entity.Status = SolicitacaoStatus.Aprovada;
                await _statusHistorico.RegistrarAsync(TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                    statusAnterior, entity.Status.ToString(), _currentUser, observacao, ct);
                await _db.SaveChangesAsync(ct);

                await _workflow.NotifyByFuncionarioIdAsync(
                    entity.SolicitanteId,
                    "Solicitação de vaga aprovada — substituição provisória",
                    $"Sua solicitação \"{entity.Titulo}\" foi aprovada com provisório até {expiresAt:dd/MM/yyyy}.",
                    SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
                    ct);

                await _recruiterNotifier.NotifyFinalizadaAsync(entity.Id, ct);
                break;
            }

            case TipoDecisaoHeadcount.ConsumirHeadcountExistente:
            {
                var ocupados = await _db.OcupacoesHistorico
                    .CountAsync(o => o.VagaId == vaga.Id && o.DataSaida == null, ct);
                var disponivel = vaga.HeadcountAutorizado - ocupados;

                if (disponivel < entity.QtdPosicoes)
                    throw new InvalidOperationException(
                        $"Headcount insuficiente para consumo: {disponivel} slot(s) disponível(eis), {entity.QtdPosicoes} solicitado(s).");

                vaga.HeadcountPendente = Math.Max(0, vaga.HeadcountPendente - entity.QtdPosicoes);
                vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
                if (vaga.Status == VagaStatus.Preenchida)
                    vaga.Status = VagaStatus.Aberta;

                entity.Status = SolicitacaoStatus.Aprovada;
                await _statusHistorico.RegistrarAsync(TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                    statusAnterior, entity.Status.ToString(), _currentUser, observacao, ct);
                await _db.SaveChangesAsync(ct);

                await _workflow.NotifyByFuncionarioIdAsync(
                    entity.SolicitanteId,
                    "Solicitação de vaga aprovada — consumo de headcount existente",
                    $"\"{entity.Titulo}\" utilizará headcount já autorizado.",
                    SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
                    ct);

                await _recruiterNotifier.NotifyFinalizadaAsync(entity.Id, ct);
                break;
            }

            case TipoDecisaoHeadcount.AumentoDefinitivo:
            {
                // Aumento permanente requer aprovação extra (Diretoria) via fluxo AumentoHeadcount
                var etapasConfig = await _db.EtapasConfigAprovacao
                    .AsNoTracking()
                    .Where(e => e.TipoFluxo == TipoFluxoAprovacao.AumentoHeadcount)
                    .OrderBy(e => e.Ordem)
                    .ToListAsync(ct);

                if (etapasConfig.Count == 0)
                    throw new InvalidOperationException(
                        "Fluxo de aprovação para Aumento de Headcount não configurado. Configure em Admin > Aprovações.");

                var resolved = await _workflow.ResolveEtapasAsync(
                    entity.SolicitanteId, null, TipoFluxoAprovacao.AumentoHeadcount, ct);

                var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId ?? "",
                    SolicitacaoId = entity.Id,
                    TipoFluxo = TipoFluxoAprovacao.AumentoHeadcount,
                    Ordem = r.Ordem,
                    Label = r.Label,
                    AprovadorId = r.AprovadorId,
                    RoleFilaId = r.RoleFilaId,
                    AcaoEtapa = r.AcaoEtapa,
                    MomentoAcao = r.MomentoAcao,
                    Status = StatusAprovacao.Pendente,
                }).ToList();

                _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);

                entity.Status = SolicitacaoStatus.PendenteAprovacaoAumentoHC;
                await _statusHistorico.RegistrarAsync(TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                    statusAnterior, entity.Status.ToString(), _currentUser, observacao, ct);
                await _db.SaveChangesAsync(ct);

                var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
                if (primeiraEtapa?.AprovadorId.HasValue == true)
                {
                    var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking()
                        .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Gestor";
                    await _workflow.NotifyByFuncionarioIdAsync(
                        primeiraEtapa.AprovadorId.Value,
                        "Aumento de headcount aguarda sua aprovação",
                        $"{solicitanteNome} solicitou aumento de headcount para \"{entity.Titulo}\". Aguarda sua aprovação.",
                        SolicitacaoVagaFrontendLinks.SolicitacaoVagaRelativeEdit(entity.Id),
                        ct);
                }
                break;
            }
        }
    }

    /// <summary>
    /// Etapa de processo automático: sem aprovador pessoal, sem fila de perfil, com AcaoEtapa definida.
    /// Essas etapas auto-avançam sem necessitar de ação humana.
    /// </summary>
    private static bool IsProcessoStep(SolicitacaoAprovacaoEtapa e) =>
        e.AprovadorId == null && e.RoleFilaId == null && e.AcaoEtapa != AcaoEtapa.Nenhuma;

    private async Task ExecutarAcaoEtapaAsync(AcaoEtapa acao, SolicitacaoVaga entity, CancellationToken ct)
    {
        switch (acao)
        {
            case AcaoEtapa.CriarVagaRascunho:
                if (IsFluxoComDecisaoHeadcountGestor(entity.TipoSolicitacao))
                {
                    if (entity.VagaId.HasValue)
                        await ProvisionarHcPendenteAsync(entity, ct);
                    else
                        await CriarVagaRascunhoAsync(entity, ct, headcountPendente: entity.QtdPosicoes);
                    entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
                }
                else if (!entity.VagaId.HasValue)
                {
                    // Substituição sem vaga vinculada — criar rascunho
                    await CriarVagaRascunhoAsync(entity, ct);
                }
                break;

            case AcaoEtapa.EnviarIntegracao:
                var statusAnteriorAcaoEnviar = entity.Status.ToString();
                entity.Status = SolicitacaoStatus.Aprovada;
                entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
                await _statusHistorico.RegistrarAsync(
                    TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                    statusAnteriorAcaoEnviar, entity.Status.ToString(), _currentUser, null, ct);
                break;
        }
    }

    private async Task CriarVagaRascunhoAsync(SolicitacaoVaga entity, CancellationToken ct, int headcountPendente = 0)
    {
        if (entity.Solicitante is null)
            await _db.Entry(entity).Reference(e => e.Solicitante).LoadAsync(ct);

        var tenantId = _tenantContext.TenantId ?? "";
        var now = DateTimeOffset.UtcNow;
        var vagaId = Guid.NewGuid();
        var analistaRhResponsavelNome = entity.AnalistaRhResponsavelUserId.HasValue
            ? await ResolveUserDisplayNameAsync(entity.AnalistaRhResponsavelUserId.Value, ct)
            : null;
        var prioridade = entity.Urgencia switch
        {
            SolicitacaoVagaUrgencia.Critica => VagaPrioridade.Critica,
            SolicitacaoVagaUrgencia.Alta => VagaPrioridade.Alta,
            SolicitacaoVagaUrgencia.Media => VagaPrioridade.Media,
            _ => VagaPrioridade.Baixa
        };

        VagaTipoContratacao? tipoContratacao = entity.TipoContrato switch
        {
            TipoContratoVaga.CLT        => VagaTipoContratacao.CLT,
            TipoContratoVaga.Estagio    => VagaTipoContratacao.Estagio,
            TipoContratoVaga.Aprendiz   => VagaTipoContratacao.Aprendiz,
            TipoContratoVaga.Temporario => VagaTipoContratacao.Temporario,
            _ => null,
        };

        _db.Vagas.Add(new Vaga
        {
            Id = vagaId,
            TenantId = tenantId,
            Titulo = entity.Titulo,
            CodFuncaoRm = entity.CodFuncaoRm,
            FuncaoNomeRm = entity.FuncaoNomeRm,
            Status = VagaStatus.Rascunho,
            QuantidadeVagas = entity.QtdPosicoes,
            DescricaoInterna = entity.Justificativa,
            GestorRequisitante = entity.Solicitante?.Name,
            Prioridade = prioridade,
            Confidencial = entity.IsConfidencial,
            Urgente = entity.Urgencia >= SolicitacaoVagaUrgencia.Alta,
            JobPositionId = entity.JobPositionId,
            CentroCustoId = entity.CentroCustoId,
            UnidadeLotacaoId = entity.UnidadeLotacaoId,
            ExigeCnh = entity.CnhObrigatoria,
            DisponibilidadeParaViagens = entity.DisponibilidadeViagens,
            TipoContratacao = tipoContratacao,
            TurnoId = entity.TurnoId,
            EscalaTrabalhoRaw = string.IsNullOrWhiteSpace(entity.EscalaTrabalho) ? null : entity.EscalaTrabalho,
            HeadcountPendente = headcountPendente,
            RecrutadorResponsavelUserId = entity.AnalistaRhResponsavelUserId,
            RecrutadorResponsavel = string.IsNullOrWhiteSpace(analistaRhResponsavelNome)
                ? null
                : (analistaRhResponsavelNome.Length > 120 ? analistaRhResponsavelNome[..120] : analistaRhResponsavelNome),
            PesoCompetencia = 40,
            PesoExperiencia = 30,
            PesoFormacao = 15,
            PesoLocalidade = 15,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var projetoId = Guid.NewGuid();
        _db.Set<ProjetoVaga>().Add(new ProjetoVaga
        {
            Id = projetoId, TenantId = tenantId, VagaId = vagaId,
            Numero = 1, Descricao = "Rodada 1", Status = StatusProjeto.Ativo,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        });
        _db.Set<FaseProcesso>().AddRange(
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Triagem", Ordem = 0, ResponsavelTipo = ResponsavelFaseTipo.RH, CreatedAtUtc = now, UpdatedAtUtc = now },
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Entrevista RH", Ordem = 1, ResponsavelTipo = ResponsavelFaseTipo.RH, CreatedAtUtc = now, UpdatedAtUtc = now },
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Entrevista Gestor", Ordem = 2, ResponsavelTipo = ResponsavelFaseTipo.Gestor, CreatedAtUtc = now, UpdatedAtUtc = now },
            new FaseProcesso { Id = Guid.NewGuid(), TenantId = tenantId, ProjetoId = projetoId, Nome = "Aprovacao Final", Ordem = 3, ResponsavelTipo = ResponsavelFaseTipo.Gestor, CreatedAtUtc = now, UpdatedAtUtc = now }
        );

        entity.VagaId = vagaId;
    }

    private async Task ProvisionarHcPendenteAsync(SolicitacaoVaga entity, CancellationToken ct)
    {
        if (!entity.VagaId.HasValue) return;
        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
        if (vaga is null) return;
        vaga.HeadcountPendente += entity.QtdPosicoes;
        vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public async Task<SolicitacaoVagaResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        GarantirFluxoAumentoQuadroPermiteAcaoDeAprovador(entity);
        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is not null)
        {
            if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
                throw new InvalidOperationException("Você não tem permissão para reprovar esta etapa.");
            
            etapaAtual.Status = StatusAprovacao.Rejeitado;
            etapaAtual.DataUtc = DateTimeOffset.UtcNow;
            etapaAtual.Observacao = observacao;

        }

        var statusAnteriorReject = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            statusAnteriorReject, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de vaga reprovada",
            $"Sua solicitação \"{entity.Titulo}\" foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            "/gestao/painel-solicitacoes",
            ct,
            "warning");

        var solicitanteReject = await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct);
        if (!string.IsNullOrWhiteSpace(solicitanteReject?.Email))
        {
            var obsHtml = !string.IsNullOrWhiteSpace(observacao)
                ? $"<p><strong>Motivo:</strong> {observacao}</p>" : "";
            await _emailQueue.EnqueueRawAsync(
                solicitanteReject.Email,
                "Solicitação de vaga reprovada",
                $"<p>Olá {solicitanteReject.Name},</p><p>Sua solicitação de vaga <strong>{entity.Titulo}</strong> foi <strong>reprovada</strong>.</p>{obsHtml}",
                null, false, "SolicitacaoVaga", ct);
        }

        // Cascata: se tem desligamento vinculado, reprova em cascata
        if (entity.DesligamentoVinculadoId.HasValue)
        {
            var desligamentoService = _serviceProvider.GetRequiredService<ISolicitacaoDesligamentoService>();
            await desligamentoService.ReprovarEmCascataAsync(
                entity.DesligamentoVinculadoId.Value,
                $"Reprovação automática: a vaga \"{entity.Titulo}\" foi reprovada.",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

        public async Task<SolicitacaoVagaResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        GarantirFluxoAumentoQuadroPermiteAcaoDeAprovador(entity);
        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // Encerra etapas pendentes no mesmo fluxo ativo — senão /api/aprovacoes/pendentes
        // continua exibindo a solicitação para o aprovador após devolução ao solicitante.
        var tipoFluxoAtivo = entity.Status == SolicitacaoStatus.PendenteAprovacaoAumentoHC
            ? TipoFluxoAprovacao.AumentoHeadcount
            : TipoFluxoAprovacao.RequisicaoPessoal;

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == tipoFluxoAtivo && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is not null)
        {
            if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
                throw new InvalidOperationException("Você não tem permissão para solicitar ajustes nesta etapa.");

            var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
                .Where(e => e.SolicitacaoId == id && e.TipoFluxo == tipoFluxoAtivo && e.Status == StatusAprovacao.Pendente)
                .ToListAsync(ct);

            var nowEtapa = DateTimeOffset.UtcNow;
            foreach (var etapa in etapasPendentes)
            {
                etapa.Status = StatusAprovacao.Cancelado;
                etapa.DataUtc = nowEtapa;
                if (etapa.Id == etapaAtual.Id)
                    etapa.Observacao = observacao;
            }
        }

        var statusAnteriorChanges = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            statusAnteriorChanges, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação",
            $"Sua solicitação \"{entity.Titulo}\" precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            "/gestao/painel-solicitacoes",
            ct,
            "warning");

        var solicitanteChanges = await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct);
        if (!string.IsNullOrWhiteSpace(solicitanteChanges?.Email))
        {
            var obsHtml = !string.IsNullOrWhiteSpace(observacao)
                ? $"<p><strong>Observação:</strong> {observacao}</p>" : "";
            await _emailQueue.EnqueueRawAsync(
                solicitanteChanges.Email,
                "Ajustes necessários na solicitação de vaga",
                $"<p>Olá {solicitanteChanges.Name},</p><p>Sua solicitação de vaga <strong>{entity.Titulo}</strong> precisa de <strong>ajustes</strong>.</p>{obsHtml}",
                null, false, "SolicitacaoVaga", ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> CancelAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status == SolicitacaoStatus.Rascunho)
            throw new InvalidOperationException("Rascunhos não podem ser cancelados — utilize Excluir.");

        if (entity.Status == SolicitacaoStatus.Aprovada ||
            entity.Status == SolicitacaoStatus.Cancelada)
            throw new InvalidOperationException("Solicitação não pode ser cancelada no status atual.");

        // Admin e RH podem sempre cancelar fluxos travados (ex: PendenteAprovacaoAumentoHC sem quórum)
        bool podeForcar = _currentUser.IsAdmin || _currentUser.IsRH;

        // Não-admin/não-RH só pode cancelar se for o solicitante E não houve movimentação
        if (!podeForcar)
        {
            if (!_currentUser.FuncionarioId.HasValue || entity.SolicitanteId != _currentUser.FuncionarioId.Value)
                throw new InvalidOperationException("Apenas o responsável pela solicitação pode cancelá-la.");

            var houveMov = await _db.SolicitacoesAprovacaoEtapa
                .AnyAsync(e => e.SolicitacaoId == id
                    && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                    && (e.Status == StatusAprovacao.Aprovado || e.Status == StatusAprovacao.Rejeitado), ct);

            if (houveMov)
                throw new InvalidOperationException("Não é possível cancelar: já houve movimentação na solicitação. Contate o RH.");
        }

        var statusAnteriorCancel = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            statusAnteriorCancel, entity.Status.ToString(), _currentUser, null, ct);

        // Mark all pending approval steps as cancelled
        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);

        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
        }

        // Cancel the linked vaga (auto-created in Rascunho when solicitation was approved)
        // so the manager doesn't see a stale "aguardando decisão RH" or an orphaned draft vaga.
        if (entity.VagaId.HasValue)
        {
            var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
            if (vaga is not null)
            {
                vaga.HeadcountPendente = 0;
                if (vaga.Status == VagaStatus.Rascunho)
                    vaga.Status = VagaStatus.Cancelada;
                vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        await _db.SaveChangesAsync(ct);

        // Cascata: se tem desligamento vinculado, cancela em cascata
        if (entity.DesligamentoVinculadoId.HasValue)
        {
            var desligamentoService = _serviceProvider.GetRequiredService<ISolicitacaoDesligamentoService>();
            await desligamentoService.CancelarEmCascataAsync(entity.DesligamentoVinculadoId.Value, ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        EnsureCurrentUserIsSolicitanteOuAdmin(entity);

        if (entity.Status != SolicitacaoStatus.Rascunho)
            throw new InvalidOperationException("Só é possível excluir solicitações em rascunho.");

        _db.SolicitacoesVaga.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

        public async Task<SolicitacaoVagaResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        // Statuses que permitem assumir: qualquer um com etapa pendente, exceto estados terminais
        if (entity.Status is SolicitacaoStatus.Rascunho
            or SolicitacaoStatus.Aprovada
            or SolicitacaoStatus.Cancelada
            or SolicitacaoStatus.Reprovada
            or SolicitacaoStatus.Concluida
            or SolicitacaoStatus.ContratacaoConcluida
            or SolicitacaoStatus.EncerradaSemContratacao
            or SolicitacaoStatus.EmProcessoSeletivo
            or SolicitacaoStatus.Suspensa
            or SolicitacaoStatus.EmIntegracao)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");

        // Seleciona o TipoFluxo correto baseado no status atual
        var tipoFluxo = entity.Status == SolicitacaoStatus.PendenteAprovacaoAumentoHC
            ? TipoFluxoAprovacao.AumentoHeadcount
            : TipoFluxoAprovacao.RequisicaoPessoal;

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == tipoFluxo && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Não há etapa pendente para assumir.");

        // Admin pode assumir qualquer etapa de fila (RoleFilaId ou sem aprovador)
        if (_currentUser.IsAdmin && !_currentUser.IsOwner)
        {
            // Permite assumir desde que não esteja já claimed por outro
            bool jaClaimed = etapaAtual.AprovadorId.HasValue || etapaAtual.AssumedByUserId.HasValue;
            if (jaClaimed)
                throw new InvalidOperationException("Esta etapa já foi assumida por outro usuário.");
        }
        else
        {
            // Case 1: normal role queue — RoleFilaId set, no approver yet
            bool isNormalQueue = etapaAtual.RoleFilaId.HasValue && !etapaAtual.AprovadorId.HasValue;

            // Case 2: stuck step — approver resolved but has no system account
            bool isStuckStep = false;
            if (!isNormalQueue && etapaAtual.AprovadorId.HasValue)
            {
                var aprovadorHasUser = await _db.Set<Funcionario>()
                    .AsNoTracking()
                    .Where(f => f.Id == etapaAtual.AprovadorId.Value)
                    .Select(f => (bool?)(f.UserId != null))
                    .FirstOrDefaultAsync(ct);
                isStuckStep = aprovadorHasUser == false;
            }

            // Case 3: both null — unresolvable step (no approver, no role), only admin can assume
            bool isUnresolvable = !etapaAtual.AprovadorId.HasValue && !etapaAtual.RoleFilaId.HasValue;

            if (!isNormalQueue && !isStuckStep && !isUnresolvable)
                throw new InvalidOperationException("Esta etapa não pode ser assumida.");

            if (isNormalQueue)
            {
                if (etapaAtual.AprovadorId.HasValue)
                    throw new InvalidOperationException("Esta etapa já foi assumida por outro usuário.");
                if (!await _workflow.CanAssumeRoleQueueAsync(etapaAtual, _currentUser, ct))
                    throw new InvalidOperationException("Você não pertence ao perfil designado para assumir esta etapa.");
            }

            if (isStuckStep || isUnresolvable)
                throw new InvalidOperationException("Apenas administradores podem assumir esta etapa.");
        }

        // Resolve FuncionarioId — try JWT claim first, then ApplicationUser.FuncionarioId, then Funcionario.UserId
        var funcionarioId = _currentUser.FuncionarioId;
        string? assumidoPorNome = null;

        if (_currentUser.UserId.HasValue)
        {
            var userInfo = await _db.Set<ApplicationUser>()
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(u => u.Id == _currentUser.UserId.Value)
                .Select(u => new { u.FuncionarioId, u.FullName, u.UserName })
                .FirstOrDefaultAsync(ct);

            if (funcionarioId == null)
                funcionarioId = userInfo?.FuncionarioId;

            assumidoPorNome = userInfo?.FullName is { Length: > 0 } fn ? fn : userInfo?.UserName;
        }

        if (funcionarioId.HasValue)
        {
            // Admin with a linked Funcionario — normal assignment
            etapaAtual.AprovadorId = funcionarioId;
        }
        else
        {
            // Admin without Funcionario — track via UserId directly
            if (!_currentUser.UserId.HasValue)
                throw new InvalidOperationException("Não foi possível identificar o usuário autenticado.");
            etapaAtual.AssumedByUserId = _currentUser.UserId;
        }

        etapaAtual.Observacao = $"Assumida via consenso por {assumidoPorNome ?? "administrador"}";

        if (entity.Status == SolicitacaoStatus.PendenteAprovacaoRh)
            entity.Status = SolicitacaoStatus.PendenteAprovacao;

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> EfetivarAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        static bool PermiteEfetivarOuReprocessar(SolicitacaoStatus st) =>
            st is SolicitacaoStatus.Aprovada
                or SolicitacaoStatus.PendenteIntegracaoRm
                or SolicitacaoStatus.AguardandoReprocessamentoRm
                or SolicitacaoStatus.ErroIntegracaoRm;

        if (!PermiteEfetivarOuReprocessar(entity.Status))
            throw new InvalidOperationException(
                $"Só é possível efetivar/reprocessar a partir de Aprovada ou estados de reprocessamento RM (atual: {entity.Status}).");

        await _solicitacaoVagaRmIntegracao.ExecutarCriacaoRequisicaoRmAsync(id, ct);
        return await GetByIdAsync(id, ct);
    }

    /// <summary>
    /// Situação 1: ao aprovar uma substituição, incrementa HeadcountProvisorio na vaga criada
    /// e registra a data de expiração com base nos parâmetros do tenant.
    /// </summary>
    private async Task AtivarHeadcountProvisorioAsync(SolicitacaoVaga entity, CancellationToken ct)
    {
        if (!entity.VagaId.HasValue) return;

        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
        if (vaga is null) return;

        var tenantConfig = await _db.TenantConfiguracoes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == _tenantContext.TenantId, ct);

        var diasProvisao = tenantConfig?.DiasProvisaoSubstituicao ?? 30;

        vaga.HeadcountProvisorio += entity.QtdPosicoes;
        vaga.HeadcountProvisorioExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(diasProvisao);

        // Registrar slot provisório no histórico de ocupação para visibilidade na UI
        _db.OcupacoesHistorico.Add(new RhPortal.Api.Domain.Entities.OcupacaoHistorico
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            VagaId = vaga.Id,
            FuncionarioId = entity.SubstituidoFuncionarioId,
            DataEntrada = DateTime.UtcNow,
            SolicitacaoOrigemId = entity.Id,
            IsProvisorio = true,
            ProvisorioExpiresAtUtc = vaga.HeadcountProvisorioExpiresAtUtc,
        });
    }


    private Task<Guid?> ResolveUserIdByFuncionarioIdAsync(Guid funcionarioId, CancellationToken ct)
        => _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

    

    public async Task ReprovarEmCascataAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return;

        // Idempotente: não re-propaga se já está em estado terminal
        if (entity.Status == SolicitacaoStatus.Reprovada ||
            entity.Status == SolicitacaoStatus.Cancelada ||
            entity.Status == SolicitacaoStatus.Concluida ||
            entity.Status == SolicitacaoStatus.ContratacaoConcluida ||
            entity.Status == SolicitacaoStatus.EncerradaSemContratacao)
            return;

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Marca etapas pendentes como canceladas
        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && (e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                    || e.TipoFluxo == TipoFluxoAprovacao.AumentoHeadcount)
                && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);
        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
            etapa.Observacao = observacao;
        }

        // Reverter vaga rascunho vinculada (se houver)
        if (entity.VagaId.HasValue)
        {
            var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
            if (vaga is not null)
            {
                vaga.HeadcountPendente = 0;
                if (vaga.Status == VagaStatus.Rascunho)
                    vaga.Status = VagaStatus.Cancelada;
                vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de vaga reprovada em cascata",
            $"Sua solicitação \"{entity.Titulo}\" foi reprovada automaticamente. {observacao}",
            "/gestao/painel-solicitacoes",
            ct,
            "warning");
    }

    public async Task CancelarEmCascataAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return;

        if (entity.Status == SolicitacaoStatus.Reprovada ||
            entity.Status == SolicitacaoStatus.Cancelada ||
            entity.Status == SolicitacaoStatus.Concluida ||
            entity.Status == SolicitacaoStatus.ContratacaoConcluida ||
            entity.Status == SolicitacaoStatus.EncerradaSemContratacao)
            return;

        entity.Status = SolicitacaoStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && (e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                    || e.TipoFluxo == TipoFluxoAprovacao.AumentoHeadcount)
                && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);
        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
        }

        if (entity.VagaId.HasValue)
        {
            var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
            if (vaga is not null)
            {
                vaga.HeadcountPendente = 0;
                if (vaga.Status == VagaStatus.Rascunho)
                    vaga.Status = VagaStatus.Cancelada;
                vaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de vaga cancelada em cascata",
            $"Sua solicitação \"{entity.Titulo}\" foi cancelada automaticamente porque o desligamento vinculado foi cancelado.",
            "/gestao/painel-solicitacoes",
            ct,
            "info");
    }

    public async Task<SolicitacaoVagaResponse?> VincularCandidatoContratadoAsync(Guid id, Guid candidatoId, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var candidato = await _db.Set<Candidato>().FirstOrDefaultAsync(c => c.Id == candidatoId, ct);
        if (candidato is null)
            throw new InvalidOperationException("Candidato não encontrado.");

        entity.CandidatoContratadoId = candidatoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> AssignAnalistaRhAsync(Guid id, Guid? analistaRhResponsavelUserId, CancellationToken ct)
    {
        await EnsureCurrentUserPodeDistribuirAnalistaRhAsync(ct);
        await ValidarAnalistaRhAlvoAsync(analistaRhResponsavelUserId, ct);

        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (!PermiteDistribuicaoAnalistaRh(entity.Status))
            throw new InvalidOperationException("A distribuição para Analista de RH só é permitida após a aprovação do gestor requisitante.");

        entity.AnalistaRhResponsavelUserId = analistaRhResponsavelUserId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await SyncAnalistaRhNaVagaAsync(entity, ct);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<int> BulkAssignAnalistaRhAsync(IReadOnlyList<Guid> solicitacaoIds, Guid? analistaRhResponsavelUserId, CancellationToken ct)
    {
        await EnsureCurrentUserPodeDistribuirAnalistaRhAsync(ct);
        await ValidarAnalistaRhAlvoAsync(analistaRhResponsavelUserId, ct);

        var ids = (solicitacaoIds ?? Array.Empty<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
            throw new InvalidOperationException("Selecione ao menos uma solicitação para distribuir.");

        var entities = await _db.SolicitacoesVaga
            .Where(x => ids.Contains(x.Id))
            .ToListAsync(ct);

        if (entities.Count != ids.Count)
            throw new InvalidOperationException("Uma ou mais solicitações selecionadas não foram encontradas.");

        if (entities.Any(x => !PermiteDistribuicaoAnalistaRh(x.Status)))
            throw new InvalidOperationException("Só é possível distribuir solicitações já aprovadas pelo gestor requisitante.");

        var now = DateTimeOffset.UtcNow;
        foreach (var entity in entities)
        {
            entity.AnalistaRhResponsavelUserId = analistaRhResponsavelUserId;
            entity.UpdatedAtUtc = now;
            await SyncAnalistaRhNaVagaAsync(entity, ct);
        }

        await _db.SaveChangesAsync(ct);
        return entities.Count;
    }

    private async Task<bool> CanUsuarioVerSolicitacaoVagaAsync(Guid solicitanteId, Guid? centroCustoId, Guid solicitacaoId, CancellationToken ct)
    {
        if (_currentUser.IsAdmin) return true;
        var currentUserEhAnalistaRh = await CurrentUserEhAnalistaRhAsync(ct);
        if (!currentUserEhAnalistaRh
            && (_currentUser.HasPermission("*")
                || _currentUser.HasPermission("rh.contratacoes.view")
                || _currentUser.HasPermission("rh.contratacoes.triagem")
                || _currentUser.HasPermission("rh.contratacoes.selecao")))
            return true;

        var currentFuncionarioId = _currentUser.FuncionarioId;
        if (currentFuncionarioId.HasValue && solicitanteId == currentFuncionarioId.Value)
            return true;

        if (_currentUser.UserId.HasValue)
        {
            var assignedToCurrentUser = await _db.SolicitacoesVaga
                .AsNoTracking()
                .AnyAsync(s => s.Id == solicitacaoId && s.AnalistaRhResponsavelUserId == _currentUser.UserId.Value, ct);
            if (assignedToCurrentUser)
                return true;
        }

        var userRoleIds = _currentUser.UserId.HasValue
            ? await _db.Set<ApplicationUserRole>().AsNoTracking()
                .Where(ur => ur.UserId == _currentUser.UserId!.Value)
                .Select(ur => ur.RoleId)
                .ToListAsync(ct)
            : new List<Guid>();

        var inEtapaPendente = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .AnyAsync(e => e.SolicitacaoId == solicitacaoId
                           && (e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                               || e.TipoFluxo == TipoFluxoAprovacao.AumentoHeadcount)
                           && e.Status == StatusAprovacao.Pendente
                           && (
                               (e.AprovadorId.HasValue && e.AprovadorId == currentFuncionarioId)
                               || (e.RoleFilaId.HasValue && userRoleIds.Contains(e.RoleFilaId.Value))
                               || (e.AssumedByUserId.HasValue && e.AssumedByUserId == _currentUser.UserId)
                           ), ct);
        if (inEtapaPendente) return true;

        // Etapas canceladas após "solicitar ajustes" não são Pendente — sem isto o aprovador recebia 404 no GET
        // e na resposta de request-changes (GetByIdAsync), embora o status da solicitação tivesse sido atualizado.
        var participouComoAprovadorOuAssumiu = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .AnyAsync(e => e.SolicitacaoId == solicitacaoId
                           && (e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal
                               || e.TipoFluxo == TipoFluxoAprovacao.AumentoHeadcount)
                           && (
                               (e.AprovadorId.HasValue && e.AprovadorId == currentFuncionarioId)
                               || (e.AssumedByUserId.HasValue && e.AssumedByUserId == _currentUser.UserId)
                           ), ct);
        if (participouComoAprovadorOuAssumiu) return true;

        if (_currentUser.VagasDataScope == VagasDataScope.ByArea && _currentUser.CentroCustoId.HasValue)
            return centroCustoId == _currentUser.CentroCustoId.Value;
        if (_currentUser.VagasDataScope == VagasDataScope.ByRecrutador && currentFuncionarioId.HasValue)
            return solicitanteId == currentFuncionarioId.Value;
        return currentFuncionarioId.HasValue && solicitanteId == currentFuncionarioId.Value;
    }

    private void EnsureUsuarioAutorizadoSelecao()
    {
        if (_currentUser.IsAdmin) return;
        if (_currentUser.HasPermission("*") || _currentUser.HasPermission("rh.contratacoes.selecao"))
            return;
        throw new InvalidOperationException("Sem permissão para operações de seleção de contratação (RH).");
    }

    public async Task<SolicitacaoVagaResponse?> IniciarProcessoSeletivoAsync(Guid id, CancellationToken ct)
    {
        EnsureUsuarioAutorizadoSelecao();
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.EmIntegracao)
            throw new InvalidOperationException("Somente solicitações em integração RM podem iniciar o processo seletivo.");

        if (!entity.VagaId.HasValue)
            throw new InvalidOperationException("É necessário vínculo com vaga antes de iniciar o processo seletivo.");

        if (entity.IntegracaoResultado != IntegracaoResultado.Sucesso)
            throw new InvalidOperationException("A integração com o RM precisa estar concluída com sucesso antes do processo seletivo.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.EmProcessoSeletivo;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, null, ct);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> SuspenderSelecaoAsync(Guid id, string? observacao, CancellationToken ct)
    {
        EnsureUsuarioAutorizadoSelecao();
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.EmProcessoSeletivo)
            throw new InvalidOperationException("Somente solicitações em processo seletivo podem ser suspensas.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Suspensa;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, observacao?.Trim(), ct);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> RetomarSelecaoAsync(Guid id, CancellationToken ct)
    {
        EnsureUsuarioAutorizadoSelecao();
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.Suspensa)
            throw new InvalidOperationException("Somente solicitações suspensas na seleção podem ser retomadas.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.EmProcessoSeletivo;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, null, ct);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> EncerrarSemContratacaoAsync(Guid id, string observacao, CancellationToken ct)
    {
        EnsureUsuarioAutorizadoSelecao();
        var obs = observacao.Trim();
        if (string.IsNullOrEmpty(obs))
            throw new InvalidOperationException("Informe o motivo do encerramento sem contratação.");

        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.EmProcessoSeletivo && entity.Status != SolicitacaoStatus.Suspensa)
            throw new InvalidOperationException("Encerramento sem contratação só se aplica durante o processo seletivo.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.EncerradaSemContratacao;
        entity.ObservacaoAprovador = obs;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, obs, ct);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> MarcarContratacaoConcluidaAsync(Guid id, string? observacao, CancellationToken ct)
    {
        EnsureUsuarioAutorizadoSelecao();
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.EmProcessoSeletivo && entity.Status != SolicitacaoStatus.Suspensa)
            throw new InvalidOperationException("Conclusão de contratação só se aplica durante o processo seletivo.");

        var prev = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.ContratacaoConcluida;
        entity.ObservacaoAprovador = string.IsNullOrWhiteSpace(observacao) ? entity.ObservacaoAprovador : observacao.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
            prev, entity.Status.ToString(), _currentUser, observacao?.Trim(), ct);

        await _db.SaveChangesAsync(ct);

        await _recruiterNotifier.NotifyFinalizadaAsync(entity.Id, ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<IReadOnlyList<SolicitacaoVagaIndicacaoDto>> ListIndicacoesAsync(Guid solicitacaoId, CancellationToken ct)
    {
        var head = await _db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.Id == solicitacaoId)
            .Select(s => new { s.Id, s.SolicitanteId, s.CentroCustoId })
            .FirstOrDefaultAsync(ct);
        if (head is null || !await CanUsuarioVerSolicitacaoVagaAsync(head.SolicitanteId, head.CentroCustoId, head.Id, ct))
            return Array.Empty<SolicitacaoVagaIndicacaoDto>();

        var rows = await _db.SolicitacoesVagaIndicacao.AsNoTracking()
            .Where(i => i.SolicitacaoVagaId == solicitacaoId)
            .OrderByDescending(i => i.CreatedAtUtc)
            .Join(_db.Candidatos.AsNoTracking(),
                i => i.CandidatoId,
                c => c.Id,
                (i, c) => new SolicitacaoVagaIndicacaoDto(i.Id, i.CandidatoId, c.Nome, i.Observacao, i.IndicadoPorUserId, i.CreatedAtUtc))
            .ToListAsync(ct);

        return rows;
    }

    public async Task<SolicitacaoVagaIndicacaoDto?> AddIndicacaoAsync(Guid solicitacaoId, SolicitacaoVagaIndicacaoCreateRequest request, CancellationToken ct)
    {
        EnsureUsuarioAutorizadoSelecao();

        var parent = await _db.SolicitacoesVaga.FirstOrDefaultAsync(s => s.Id == solicitacaoId, ct);
        if (parent is null) return null;

        if (!await CanUsuarioVerSolicitacaoVagaAsync(parent.SolicitanteId, parent.CentroCustoId, parent.Id, ct))
            throw new InvalidOperationException("Sem acesso a esta solicitação.");

        var candidato = await _db.Candidatos.AsNoTracking()
            .AnyAsync(c => c.Id == request.CandidatoId, ct);
        if (!candidato)
            throw new InvalidOperationException("Candidato não encontrado.");

        var existe = await _db.SolicitacoesVagaIndicacao
            .AnyAsync(i => i.SolicitacaoVagaId == solicitacaoId && i.CandidatoId == request.CandidatoId, ct);
        if (existe)
            throw new InvalidOperationException("Este candidato já foi indicado para esta solicitação.");

        var row = new SolicitacaoVagaIndicacao
        {
            Id = Guid.NewGuid(),
            TenantId = parent.TenantId,
            SolicitacaoVagaId = solicitacaoId,
            CandidatoId = request.CandidatoId,
            Observacao = request.Observacao?.Trim(),
            IndicadoPorUserId = _currentUser.UserId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesVagaIndicacao.Add(row);
        await _db.SaveChangesAsync(ct);

        var nome = await _db.Candidatos.AsNoTracking()
            .Where(c => c.Id == request.CandidatoId)
            .Select(c => c.Nome)
            .FirstAsync(ct);

        return new SolicitacaoVagaIndicacaoDto(row.Id, row.CandidatoId, nome, row.Observacao, row.IndicadoPorUserId, row.CreatedAtUtc);
    }

    public async Task<bool> RemoveIndicacaoAsync(Guid solicitacaoId, Guid indicacaoId, CancellationToken ct)
    {
        var row = await _db.SolicitacoesVagaIndicacao
            .FirstOrDefaultAsync(i => i.Id == indicacaoId && i.SolicitacaoVagaId == solicitacaoId, ct);
        if (row is null) return false;

        var parent = await _db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.Id == solicitacaoId)
            .Select(s => new { s.SolicitanteId, s.CentroCustoId, s.Id })
            .FirstOrDefaultAsync(ct);
        if (parent is null) return false;
        if (!await CanUsuarioVerSolicitacaoVagaAsync(parent.SolicitanteId, parent.CentroCustoId, parent.Id, ct))
            return false;

        var podeRh = _currentUser.IsAdmin || _currentUser.HasPermission("*") || _currentUser.HasPermission("rh.contratacoes.selecao");
        var proprio = _currentUser.UserId.HasValue && row.IndicadoPorUserId == _currentUser.UserId;
        if (!podeRh && !proprio)
            throw new InvalidOperationException("Só pode remover indicações criadas pelo próprio usuário ou mediante permissão de seleção RH.");

        _db.SolicitacoesVagaIndicacao.Remove(row);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static SolicitacaoVagaResponse MapToResponse(SolicitacaoVaga s, IReadOnlyList<EtapaFluxoInfo>? etapasFluxo = null) => new(
        s.Id,
        s.Titulo,
        s.CodFuncaoRm,
        s.FuncaoNomeRm,
        s.Justificativa,
        s.QtdPosicoes,
        s.Urgencia,
        s.Status,
        s.SolicitanteId,
        s.Solicitante?.Name,
        s.AprovadorId,
        s.Aprovador?.Name,
        s.AnalistaRhResponsavelUserId,
        s.AnalistaRhResponsavelUser != null ? (s.AnalistaRhResponsavelUser.FullName ?? s.AnalistaRhResponsavelUser.Email) : null,
        s.JobPositionId,
        s.JobPosition?.Name,
        s.UnitId,
        s.Unit?.Name,
        s.VagaId,
        s.ObservacaoAprovador,
        // Sprint 1
        s.TipoSolicitacao,
        s.IsConfidencial,
        s.SubstituidoFuncionarioId,
        s.SubstituidoNome,
        // A.RH.013
        s.TipoContrato,
        s.PrazoDias,
        s.MotivoRequisicao,
        s.MotivoRequisicaoId,
        s.Motivo?.Codigo,
        s.Motivo?.Nome,
        s.Motivo?.EfeitoHeadcount,
        s.CnhObrigatoria,
        s.DisponibilidadeViagens,
        s.EscalaTrabalho,
        s.TurnoId,
        s.Turno?.Code,
        s.Turno?.Description,
        s.Turno?.StartTime,
        s.Turno?.EndTime,
        s.Turno?.Notes,
        s.Turno?.UnidadeLotacao?.Description,
        s.EmpresaId,
        s.Empresa?.Description,
        s.CentroCustoId,
        s.CentroCusto?.Description,
        s.UnidadeLotacaoId,
        s.UnidadeLotacao?.Description,
        s.CreatedAtUtc,
        s.UpdatedAtUtc,
        s.ApprovedAtUtc,
        etapasFluxo ?? Array.Empty<EtapaFluxoInfo>(),
        // Decisão RH
        s.DecisaoRH,
        s.DecisaoRHRevisadoPor?.Name,
        s.DecisaoRHEmUtc,
        s.DecisaoRHPrazoMeses,
        // Dados desligamento
        s.DataDesligamento,
        s.TipoAvisoPrevioDesligamento,
        s.DiasAvisoPrevioDesligamento,
        s.PossuiEstabilidadeDesligamento,
        s.MotivoDesligamentoTexto,
        s.DesligamentoVinculadoId,
        s.CandidatoContratadoId,
        s.CandidatoContratado?.Nome,
        s.RmCodStatus,
        s.RmUltimaStatusDescricaoRm,
        s.RmStatusSyncUltimaMensagem,
        s.RmUltimaSincronizacaoUtc,
        s.RmRequisicaoCodigo,
        s.FaixaSalarialMin,
        s.FaixaSalarialMax,
        s.RequisitosDetalhadosJson
    );

    private static void ValidarFaixaSalarialProposta(decimal? min, decimal? max)
    {
        if (!min.HasValue || !max.HasValue)
            return;

        if (min.Value >= max.Value)
            throw new InvalidOperationException(
                "Faixa salarial inválida: o valor mínimo deve ser estritamente menor que o máximo.");
    }
}
