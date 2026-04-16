using RhPortal.Api.Application.Common;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.WorkflowRH;
using RhPortal.Api.Contracts.SolicitacoesVaga;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
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
    Task<SolicitacaoVagaResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
        Task<SolicitacaoVagaResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> CancelAsync(Guid id, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse?> AssumirAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoVagaResponse> CopyAsync(Guid sourceId, Guid? solicitanteId, CancellationToken ct);
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
    private readonly IWorkflowRHService _workflowRH;

    public SolicitacaoVagaService(
        AppDbContext db,
        ITenantContext tenantContext,
        IVagaService vagaService,
        ICurrentUserContext currentUser,
        IPessoaService pessoaService,
        NotificationPublisher notifications,
        ApprovalWorkflowHelper workflow,
        IWorkflowRHService workflowRH)
    {
        _db = db;
        _tenantContext = tenantContext;
        _vagaService = vagaService;
        _currentUser = currentUser;
        _pessoaService = pessoaService;
        _notifications = notifications;
        _workflow = workflow;
        _workflowRH = workflowRH;
    }

    public async Task<IReadOnlyList<SolicitacaoVagaGridRow>> ListAsync(
        SolicitacaoVagaListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesVaga.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Area)
            .AsQueryable();

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
        {
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);
        }
        else if (!_currentUser.IsAdmin)
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
            if (_currentUser.VagasDataScope == VagasDataScope.ByArea && _currentUser.AreaId.HasValue)
                q = q.Where(s => s.AreaId == _currentUser.AreaId.Value
                    || solicitacaoIdsComEtapaPendente.Contains(s.Id));
            else if (_currentUser.VagasDataScope == VagasDataScope.ByRecrutador && currentFuncionarioId.HasValue)
                q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value
                    || solicitacaoIdsComEtapaPendente.Contains(s.Id));
            else
                q = q.Where(s => (currentFuncionarioId.HasValue && s.SolicitanteId == currentFuncionarioId.Value)
                    || solicitacaoIdsComEtapaPendente.Contains(s.Id));
        }

        if (query.Statuses is { Length: > 0 })
            q = q.Where(s => query.Statuses.Contains(s.Status));
        else if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

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
                AreaName = s.Area != null ? s.Area.Name : (string?)null,
                s.QtdPosicoes, s.TipoSolicitacao, s.IsConfidencial, s.SubstituidoNome, s.CreatedAtUtc,
            }).ToListAsync(ct);

        var ids = rawRows.Select(r => r.Id).ToList();
        var etapasPendentes = await _workflow.GetEtapasPendentesAsync(
            ids, TipoFluxoAprovacao.RequisicaoPessoal, ct, currentUserId: _currentUser.UserId);

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            return new SolicitacaoVagaGridRow(
                r.Id, r.Titulo, r.Urgencia, r.Status, r.SolicitanteId, r.SolicitanteNome,
                r.AprovadorId, r.AprovadorNome, r.AreaName, r.QtdPosicoes,
                r.TipoSolicitacao, r.IsConfidencial, r.SubstituidoNome, r.CreatedAtUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId, ep?.AssumedByUserId,
                ep?.CanAssume ?? false);
        }).ToList();
    }

    public async Task<SolicitacaoVagaResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesVaga.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Aprovador)
            .Include(x => x.JobPosition)
            .Include(x => x.Area)
            .Include(x => x.Unit)
            .Include(x => x.Empresa)
            .Include(x => x.CentroCusto)
            .Include(x => x.UnidadeLotacao)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

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

        var etapasFluxo = etapas.Select(e => new EtapaFluxoInfo(
            e.Ordem,
            e.Label,
            e.AssumedByUserId.HasValue && assumedUserNames.TryGetValue(e.AssumedByUserId.Value, out var adminName)
                ? adminName
                : e.Aprovador?.Name,
            e.RoleFilaId.HasValue && roleNames.TryGetValue(e.RoleFilaId.Value, out var rn) ? rn : null,
            e.Status,
            e.DataUtc,
            e.Observacao
        )).ToList();

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

        var entity = new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            AprovadorId = request.AprovadorId,
            JobPositionId = request.JobPositionId,
            AreaId = request.AreaId,
            UnitId = request.UnitId,
            Titulo = request.Titulo,
            Justificativa = request.Justificativa,
            QtdPosicoes = Math.Max(request.QtdPosicoes, 1),
            Urgencia = request.Urgencia,
            Status = SolicitacaoVagaStatus.Rascunho,
            // Sprint 1
            TipoSolicitacao = request.TipoSolicitacao,
            IsConfidencial = request.IsConfidencial,
            SubstituidoFuncionarioId = request.SubstituidoFuncionarioId,
            SubstituidoNome = substituidoNome,
            // A.RH.013
            TipoContrato = request.TipoContrato,
            PrazoDias = request.PrazoDias,
            MotivoRequisicao = request.MotivoRequisicao,
            CnhObrigatoria = request.CnhObrigatoria,
            DisponibilidadeViagens = request.DisponibilidadeViagens,
            EscalaTrabalho = request.EscalaTrabalho,
            EmpresaId = request.EmpresaId,
            CentroCustoId = request.CentroCustoId,
            UnidadeLotacaoId = request.UnidadeLotacaoId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesVaga.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
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
            AreaId = source.AreaId,
            UnitId = source.UnitId,
            EmpresaId = source.EmpresaId,
            CentroCustoId = source.CentroCustoId,
            UnidadeLotacaoId = source.UnidadeLotacaoId,
            Titulo = $"{source.Titulo} (cópia)",
            Justificativa = source.Justificativa,
            QtdPosicoes = source.QtdPosicoes,
            Urgencia = source.Urgencia,
            Status = SolicitacaoVagaStatus.Rascunho,
            TipoSolicitacao = source.TipoSolicitacao,
            IsConfidencial = source.IsConfidencial,
            SubstituidoFuncionarioId = source.SubstituidoFuncionarioId,
            SubstituidoNome = source.SubstituidoNome,
            TipoContrato = source.TipoContrato,
            PrazoDias = source.PrazoDias,
            MotivoRequisicao = source.MotivoRequisicao,
            CnhObrigatoria = source.CnhObrigatoria,
            DisponibilidadeViagens = source.DisponibilidadeViagens,
            EscalaTrabalho = source.EscalaTrabalho,
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

    public async Task<SolicitacaoVagaResponse?> UpdateAsync(
        Guid id, SolicitacaoVagaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        // Can edit in Draft, AjustesNecessarios or PendenteAprovacao (retracts and re-opens for editing)
        if (entity.Status != SolicitacaoVagaStatus.Rascunho &&
            entity.Status != SolicitacaoVagaStatus.AjustesNecessarios &&
            entity.Status != SolicitacaoVagaStatus.PendenteAprovacao)
            throw new InvalidOperationException("Solicitação não pode ser editada no status atual.");

        // If pending approval, retract back to draft so it can be resubmitted
        if (entity.Status == SolicitacaoVagaStatus.PendenteAprovacao)
        {
            entity.Status = SolicitacaoVagaStatus.Rascunho;
        }

        entity.Titulo = request.Titulo;
        entity.Justificativa = request.Justificativa;
        entity.QtdPosicoes = Math.Max(request.QtdPosicoes, 1);
        entity.Urgencia = request.Urgencia;
        entity.JobPositionId = request.JobPositionId;
        entity.AreaId = request.AreaId;
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
        entity.MotivoRequisicao = request.MotivoRequisicao;
        entity.CnhObrigatoria = request.CnhObrigatoria;
        entity.DisponibilidadeViagens = request.DisponibilidadeViagens;
        entity.EscalaTrabalho = request.EscalaTrabalho;
        entity.EmpresaId = request.EmpresaId;
        entity.CentroCustoId = request.CentroCustoId;
        entity.UnidadeLotacaoId = request.UnidadeLotacaoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

        public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.Status = SolicitacaoVagaStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Remove etapas anteriores (re-submit)
        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        // Read global config to decide which unit reference to use
        var fluxoConfig = await _db.FluxosAprovacaoConfig
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal, ct);

        Guid? targetUnidadeId = fluxoConfig?.ReferenciaUnidade == ReferenciaUnidade.SolicitacaoInformada
            ? entity.UnidadeLotacaoId
            : null;

        // Resolve and create new etapas
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

        // ── Verificar configuração do tenant: RH deve aprovar após gestores? ──
        var tenantConfig = await _db.TenantConfiguracoes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == _tenantContext.TenantId, ct);

        if (tenantConfig?.RhDeveAprovarAposGestor == true)
        {
            var maxOrdem = novasEtapas.Count > 0 ? novasEtapas.Max(e => e.Ordem) : 0;
            novasEtapas.Add(new SolicitacaoAprovacaoEtapa
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
                SolicitacaoId = entity.Id,
                TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
                Ordem = maxOrdem + 1,
                Label = "Aprovação RH",
                AprovadorId = tenantConfig.AprovadorRhId,
                RoleFilaId = null,
                Status = StatusAprovacao.Pendente,
            });
        }

        _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);

        // Auto-avança etapas de processo no início do fluxo
        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
        while (primeiraEtapa is not null && IsProcessoStep(primeiraEtapa))
        {
            await ExecutarAcaoEtapaAsync(primeiraEtapa.AcaoEtapa, entity, ct);
            primeiraEtapa.Status = StatusAprovacao.Aprovado;
            primeiraEtapa.DataUtc = DateTimeOffset.UtcNow;
            primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault(e => e.Ordem > primeiraEtapa.Ordem);
        }

        await _db.SaveChangesAsync(ct);

        // Notificar aprovador1 (ou fila)
        if (primeiraEtapa is not null && primeiraEtapa.AprovadorId.HasValue)
        {
            var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";
            await _workflow.NotifyByFuncionarioIdAsync(
                primeiraEtapa.AprovadorId.Value,
                "Nova solicitação de vaga para aprovação",
                $"{solicitanteNome} abriu uma solicitação: {entity.Titulo}",
                $"/rs/solicitacoes/{entity.Id}",
                ct);
        }

        return true;
    }

        public async Task<SolicitacaoVagaResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal && e.Status == StatusAprovacao.Pendente)
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

        var todasEtapas = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal)
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
            entity.Status = SolicitacaoVagaStatus.PendenteAprovacao;

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de vaga aguarda sua aprovação",
                    $"A solicitação \"{entity.Titulo}\" foi aprovada na etapa anterior e aguarda sua ação.",
                    $"/rs/solicitacoes/{entity.Id}",
                    ct);
            }
        }
        else
        {
            // Fim do fluxo — se EnviarIntegracao step não setou Aprovada, garantir status final
            if (entity.Status != SolicitacaoVagaStatus.Aprovada)
            {
                entity.Status = SolicitacaoVagaStatus.Aprovada;
                entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
            }

            // Se nenhuma etapa criou a vaga, criar agora (backward compatible)
            if (!entity.VagaId.HasValue)
                await CriarVagaRascunhoAsync(entity, ct);

            // Situação 1: substituição — ativar headcount provisório na vaga criada
            if (entity.TipoSolicitacao == TipoSolicitacaoVaga.Substituicao && entity.VagaId.HasValue)
                await AtivarHeadcountProvisorioAsync(entity, ct);

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de vaga aprovada",
                $"Sua solicitação \"{entity.Titulo}\" foi aprovada e a vaga foi criada.",
                $"/rs/solicitacoes/{entity.Id}",
                ct);
        }

        return await GetByIdAsync(id, ct);
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
                if (!entity.VagaId.HasValue)
                    await CriarVagaRascunhoAsync(entity, ct);
                break;

            case AcaoEtapa.EnviarIntegracao:
                entity.Status = SolicitacaoVagaStatus.Aprovada;
                entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
                break;
        }
    }

    private async Task CriarVagaRascunhoAsync(SolicitacaoVaga entity, CancellationToken ct)
    {
        if (entity.Solicitante is null)
            await _db.Entry(entity).Reference(e => e.Solicitante).LoadAsync(ct);

        var tenantId = _tenantContext.TenantId ?? "";
        var now = DateTimeOffset.UtcNow;
        var vagaId = Guid.NewGuid();
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
            AreaId = entity.AreaId,
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
            EscalaTrabalhoRaw = string.IsNullOrWhiteSpace(entity.EscalaTrabalho) ? null : entity.EscalaTrabalho,
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

        // Auto-criar workflow de triagem RH
        await _workflowRH.CreateFromTemplateAsync(
            TipoWorkflowRH.TriagemVaga, vagaId: vagaId, preAdmissaoId: null, ct);
    }

    public async Task<SolicitacaoVagaResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

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

        entity.Status = SolicitacaoVagaStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de vaga reprovada",
            $"Sua solicitação \"{entity.Titulo}\" foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/rs/solicitacoes/{entity.Id}",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

        public async Task<SolicitacaoVagaResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        entity.Status = SolicitacaoVagaStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação",
            $"Sua solicitação \"{entity.Titulo}\" precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/rs/solicitacoes/{entity.Id}",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> CancelAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status == SolicitacaoVagaStatus.Rascunho)
            throw new InvalidOperationException("Rascunhos não podem ser cancelados — utilize Excluir.");

        if (entity.Status == SolicitacaoVagaStatus.Aprovada ||
            entity.Status == SolicitacaoVagaStatus.Cancelada)
            throw new InvalidOperationException("Solicitação não pode ser cancelada no status atual.");

        entity.Status = SolicitacaoVagaStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Mark all pending approval steps as rejected
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

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        if (entity.Status != SolicitacaoVagaStatus.Rascunho)
            throw new InvalidOperationException("Só é possível excluir solicitações em rascunho.");

        _db.SolicitacoesVaga.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

        public async Task<SolicitacaoVagaResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Não há etapa pendente para assumir.");

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
        {
            if (!_currentUser.IsAdmin || _currentUser.IsOwner)
                throw new InvalidOperationException("Owner não pode assumir etapas diretamente. Utilize um usuário com perfil Admin ou Administrador no tenant.");
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
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        
        await _db.SaveChangesAsync(ct);
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
            FuncionarioId = entity.SubstituidoFuncionarioId ?? Guid.Empty,
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

    

    private static SolicitacaoVagaResponse MapToResponse(SolicitacaoVaga s, IReadOnlyList<EtapaFluxoInfo>? etapasFluxo = null) => new(
        s.Id,
        s.Titulo,
        s.Justificativa,
        s.QtdPosicoes,
        s.Urgencia,
        s.Status,
        s.SolicitanteId,
        s.Solicitante?.Name,
        s.AprovadorId,
        s.Aprovador?.Name,
        s.JobPositionId,
        s.JobPosition?.Name,
        s.AreaId,
        s.Area?.Name,
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
        s.CnhObrigatoria,
        s.DisponibilidadeViagens,
        s.EscalaTrabalho,
        s.EmpresaId,
        s.Empresa?.Description,
        s.CentroCustoId,
        s.CentroCusto?.Description,
        s.UnidadeLotacaoId,
        s.UnidadeLotacao?.Description,
        s.CreatedAtUtc,
        s.UpdatedAtUtc,
        s.ApprovedAtUtc,
        etapasFluxo ?? Array.Empty<EtapaFluxoInfo>()
    );
}
