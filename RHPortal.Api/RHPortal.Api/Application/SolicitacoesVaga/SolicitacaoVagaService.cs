using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.SolicitacoesVaga;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
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
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoVagaService : ISolicitacaoVagaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IVagaService _vagaService;
    private readonly ICurrentUserContext _currentUser;
    private readonly IPessoaService _pessoaService;
    private readonly NotificationPublisher _notifications;

    public SolicitacaoVagaService(
        AppDbContext db,
        ITenantContext tenantContext,
        IVagaService vagaService,
        ICurrentUserContext currentUser,
        IPessoaService pessoaService,
        NotificationPublisher notifications)
    {
        _db = db;
        _tenantContext = tenantContext;
        _vagaService = vagaService;
        _currentUser = currentUser;
        _pessoaService = pessoaService;
        _notifications = notifications;
    }

    public async Task<IReadOnlyList<SolicitacaoVagaGridRow>> ListAsync(
        SolicitacaoVagaListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesVaga.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Area)
            .AsQueryable();

        // Sprint P1: VagasDataScope enforcement
        if (!_currentUser.IsAdmin)
        {
            if (_currentUser.VagasDataScope == VagasDataScope.ByArea && _currentUser.AreaId.HasValue)
                q = q.Where(s => s.AreaId == _currentUser.AreaId.Value);
            else if (_currentUser.VagasDataScope == VagasDataScope.ByRecrutador && currentFuncionarioId.HasValue)
                q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);
        }

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);

        if (query.Status.HasValue)
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

        return await q.Select(s => new SolicitacaoVagaGridRow(
            s.Id,
            s.Titulo,
            s.Urgencia,
            s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.Area != null ? s.Area.Name : null,
            s.QtdPosicoes,
            s.TipoSolicitacao,
            s.IsConfidencial,
            s.SubstituidoNome,
            s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoVagaResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesVaga.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Aprovador)
            .Include(x => x.JobPosition)
            .Include(x => x.Area)
            .Include(x => x.Unit)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
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
            // Sprint 2
            Aprovador2Habilitado = request.Aprovador2Habilitado,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesVaga.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
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
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InvalidOperationException("Usuário autenticado não encontrado para criar o solicitante.");

        var email = (user.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException("Usuário autenticado sem e-mail válido para criar o solicitante.");

        var fullName = string.IsNullOrWhiteSpace(user.FullName) ? email : user.FullName.Trim();
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
            UserId = user.Id,
            Status = FuncionarioStatus.Active,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.Set<Funcionario>().Add(funcionario);
        user.FuncionarioId = funcionario.Id;
        await _db.SaveChangesAsync(ct);

        return funcionario.Id;
    }

    public async Task<SolicitacaoVagaResponse?> UpdateAsync(
        Guid id, SolicitacaoVagaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        // Can only edit in Draft or AjustesNecessarios
        if (entity.Status != SolicitacaoVagaStatus.Rascunho &&
            entity.Status != SolicitacaoVagaStatus.AjustesNecessarios)
            throw new InvalidOperationException("Solicitação não pode ser editada no status atual.");

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
        entity.Aprovador2Habilitado = request.Aprovador2Habilitado;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        if (entity.Status != SolicitacaoVagaStatus.Rascunho &&
            entity.Status != SolicitacaoVagaStatus.AjustesNecessarios)
            throw new InvalidOperationException("Solicitação não pode ser submetida no status atual.");

        entity.Status = SolicitacaoVagaStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Sprint 2+3: Auto-resolve aprovadores from GestorDireto chain
        var solicitante = await _db.Set<Funcionario>()
            .Include(f => f.GestorDireto)
            .Include(f => f.NivelHierarquico)
            .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct);

        // Sprint P3: Compare hierarchy levels to auto-determine if Aprovador2 is required
        if (entity.JobPositionId.HasValue)
        {
            var cargoDaVaga = await _db.Set<JobPosition>().AsNoTracking()
                .Include(j => j.NivelHierarquico)
                .FirstOrDefaultAsync(j => j.Id == entity.JobPositionId.Value, ct);

            if (cargoDaVaga?.NivelHierarquico != null && solicitante?.NivelHierarquico != null)
            {
                // Lower Ordem = higher rank (CEO=1, Diretor=2, Gerente=3...)
                // If vaga's cargo level is higher or equal to solicitante's level, require Aprovador2
                if (cargoDaVaga.NivelHierarquico.Ordem <= solicitante.NivelHierarquico.Ordem)
                {
                    entity.Aprovador2Habilitado = true;
                }
            }
        }

        // Sprint P4: Tentar resolver via RegraAprovacaoVaga configurada pelo admin
        var regraResolvida = await ResolverRegraAprovacaoAsync(entity.SolicitanteId, ct);

        if (regraResolvida != null)
        {
            entity.Aprovador1Id = regraResolvida.Aprovador1FuncionarioId;
            entity.Aprovador1Status = StatusAprovacao.Pendente;

            if (regraResolvida.Aprovador2Habilitado)
            {
                entity.Aprovador2Habilitado = true;
                entity.Aprovador2Id = regraResolvida.Aprovador2FuncionarioId;
                entity.Aprovador2Status = StatusAprovacao.Pendente;
            }
        }
        else if (solicitante?.GestorDiretoId != null)
        {
            entity.Aprovador1Id = solicitante.GestorDiretoId;
            entity.Aprovador1Status = StatusAprovacao.Pendente;

            if (entity.Aprovador2Habilitado && solicitante.GestorDireto?.GestorDiretoId != null)
            {
                entity.Aprovador2Id = solicitante.GestorDireto.GestorDiretoId;
                entity.Aprovador2Status = StatusAprovacao.Pendente;
            }
            else if (entity.Aprovador2Habilitado)
            {
                // Sprint P3: Aprovador2 required but no gestor's gestor found — mark as PendenteManual
                // RH will need to manually designate an approver
                entity.Aprovador2Status = StatusAprovacao.Pendente;
                // Aprovador2Id stays null → RH assigns manually via UI
            }
        }
        else if (entity.AprovadorId != null)
        {
            // Fallback: use legacy AprovadorId as Aprovador1
            entity.Aprovador1Id = entity.AprovadorId;
            entity.Aprovador1Status = StatusAprovacao.Pendente;
        }
        else
        {
            // Nenhum aprovador configurado — bloquear envio para evitar solicitação órfã
            throw new InvalidOperationException(
                "Não foi possível determinar um aprovador para esta solicitação. " +
                "Verifique se o solicitante possui um gestor direto cadastrado, configure uma regra de aprovação ou selecione um aprovador manualmente.");
        }

        await _db.SaveChangesAsync(ct);

        // Notificar aprovador1 sobre nova solicitação pendente
        if (entity.Aprovador1Id.HasValue)
        {
            var solicitanteNome = solicitante?.Name ?? "Alguém";
            var aprovador1UserId = await ResolveUserIdByFuncionarioIdAsync(entity.Aprovador1Id.Value, ct);
            if (aprovador1UserId.HasValue)
            {
                await _notifications.PublishToUsersAsync(
                    _tenantContext.TenantId,
                    [aprovador1UserId.Value],
                    "Nova solicitação de vaga para aprovação",
                    $"{solicitanteNome} abriu uma solicitação: {entity.Titulo}",
                    $"/rs/solicitacoes/{entity.Id}",
                    ct: ct);
            }
        }

        return true;
    }

    public async Task<SolicitacaoVagaResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoVagaStatus.PendenteAprovacao)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");

        entity.Status = SolicitacaoVagaStatus.Aprovada;
        entity.ObservacaoAprovador = observacao;
        entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // ── Auto-criar vaga no módulo Recrutamento ──
        if (entity.AreaId.HasValue)
        {
            var vagaRequest = new VagaCreateRequest(
                Titulo: entity.Titulo,
                DepartmentId: null,
                AreaId: entity.AreaId.Value,
                // A vaga fica em "Rascunho" para o RH preencher detalhes do portal
                // e só depois liberar via Vaga.Status = Aberta.
                Status: VagaStatus.Rascunho,
                Codigo: null,
                AreaTime: null,
                Modalidade: null,
                Senioridade: null,
                QuantidadeVagas: entity.QtdPosicoes,
                TipoContratacao: null,
                MatchMinimoPercentual: 0,
                Weights: null,
                MatchingFiltrosRaw: null,
                DescricaoInterna: entity.Justificativa,
                CodigoInterno: null,
                CodigoCbo: null,
                MotivoAbertura: null,
                OrcamentoAprovado: null,
                GestorRequisitante: entity.Solicitante?.Name,
                RecrutadorResponsavel: null,
                Prioridade: entity.Urgencia switch
                {
                    SolicitacaoVagaUrgencia.Critica => VagaPrioridade.Critica,
                    SolicitacaoVagaUrgencia.Alta => VagaPrioridade.Alta,
                    SolicitacaoVagaUrgencia.Media => VagaPrioridade.Media,
                    _ => VagaPrioridade.Baixa
                },
                ResumoPitch: null,
                TagsResponsabilidadesRaw: null,
                TagsKeywordsRaw: null,
                Confidencial: entity.IsConfidencial,
                AceitaPcd: false,
                Urgente: entity.Urgencia >= SolicitacaoVagaUrgencia.Alta,
                GeneroPreferencia: null,
                VagaAfirmativa: false,
                LinguagemInclusiva: false,
                PublicoAfirmativo: null,
                ObservacoesPcd: null,
                ProjetoNome: null,
                ProjetoClienteAreaImpactada: null,
                ProjetoPrazoPrevisto: null,
                ProjetoDescricao: null,
                Regime: null,
                CargaSemanalHoras: null,
                Escala: null,
                HoraEntrada: null,
                HoraSaida: null,
                Intervalo: null,
                Cep: null,
                Logradouro: null,
                Numero: null,
                Bairro: null,
                Cidade: null,
                Uf: null,
                PoliticaTrabalho: null,
                ObservacoesDeslocamento: null,
                Moeda: null,
                SalarioMinimo: null,
                SalarioMaximo: null,
                Periodicidade: null,
                BonusTipo: null,
                BonusPercentual: null,
                ObservacoesRemuneracao: null,
                Escolaridade: null,
                FormacaoArea: null,
                ExperienciaMinimaAnos: null,
                TagsStackRaw: null,
                TagsIdiomasRaw: null,
                Diferenciais: null,
                ObservacoesProcesso: null,
                Visibilidade: null,
                DataInicio: null,
                DataEncerramento: null,
                CanalLinkedIn: false,
                CanalSiteCarreiras: false,
                CanalIndicacao: false,
                CanalPortaisEmprego: false,
                DescricaoPublica: null,
                LgpdSolicitarConsentimentoExplicito: false,
                LgpdCompartilharCurriculoInternamente: false,
                LgpdRetencaoAtiva: false,
                LgpdRetencaoMeses: null,
                ExigeCnh: false,
                DisponibilidadeParaViagens: false,
                ChecagemAntecedentes: false,
                SlaDiasMetaFechamento: null,
                NomeEngessado: null,
                Beneficios: null,
                Requisitos: null,
                Etapas: null,
                PerguntasTriagem: null
            );

            // Need to load Solicitante name for GestorRequisitante
            if (entity.Solicitante is null)
                await _db.Entry(entity).Reference(e => e.Solicitante).LoadAsync(ct);

            var vaga = await _vagaService.CreateAsync(vagaRequest, ct);
            entity.VagaId = vaga.Id;
        }

        await _db.SaveChangesAsync(ct);

        // Notificar solicitante que a solicitação foi aprovada
        if (entity.SolicitanteId != Guid.Empty)
        {
            // Resolução do userId do solicitante (SolicitanteId é FuncionarioId, precisamos do UserId)
            var solicitanteUserId = await _db.Set<Funcionario>().AsNoTracking()
                .Where(f => f.Id == entity.SolicitanteId)
                .Select(f => (Guid?)f.UserId)
                .FirstOrDefaultAsync(ct);

            if (solicitanteUserId.HasValue)
            {
                await _notifications.PublishToUsersAsync(
                    _tenantContext.TenantId,
                    [solicitanteUserId.Value],
                    "Solicitação de vaga aprovada",
                    $"Sua solicitação \"{entity.Titulo}\" foi aprovada.",
                    $"/rs/solicitacoes/{entity.Id}",
                    ct: ct);
            }
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoVagaStatus.PendenteAprovacao)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");

        entity.Status = SolicitacaoVagaStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Notificar solicitante que a solicitação foi reprovada
        var solicitanteUserIdReject = await _db.Set<Funcionario>().AsNoTracking()
            .Where(f => f.Id == entity.SolicitanteId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

        if (solicitanteUserIdReject.HasValue)
        {
            await _notifications.PublishToUsersAsync(
                _tenantContext.TenantId,
                [solicitanteUserIdReject.Value],
                "Solicitação de vaga reprovada",
                $"Sua solicitação \"{entity.Titulo}\" foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
                $"/rs/solicitacoes/{entity.Id}",
                "warning",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoVagaResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoVagaStatus.PendenteAprovacao)
            throw new InvalidOperationException("Solicitação não está pendente de aprovação.");

        entity.Status = SolicitacaoVagaStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Notificar solicitante que são necessários ajustes
        var solicitanteUserIdChanges = await _db.Set<Funcionario>().AsNoTracking()
            .Where(f => f.Id == entity.SolicitanteId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

        if (solicitanteUserIdChanges.HasValue)
        {
            await _notifications.PublishToUsersAsync(
                _tenantContext.TenantId,
                [solicitanteUserIdChanges.Value],
                "Ajustes necessários na solicitação",
                $"Sua solicitação \"{entity.Titulo}\" precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
                $"/rs/solicitacoes/{entity.Id}",
                "warning",
                ct);
        }

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

    private Task<Guid?> ResolveUserIdByFuncionarioIdAsync(Guid funcionarioId, CancellationToken ct)
        => _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// Busca uma RegraAprovacaoVaga ativa para o perfil do solicitante.
    /// Primeiro tenta regra específica por RoleId, depois regra padrão (SolicitanteRoleId=null).
    /// Retorna null se nenhuma regra configurada (aciona fallback de GestorDireto).
    /// </summary>
    private async Task<RegraAprovacaoVaga?> ResolverRegraAprovacaoAsync(Guid solicitanteId, CancellationToken ct)
    {
        var userId = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == solicitanteId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

        if (userId.HasValue)
        {
            var roleIds = await _db.Set<ApplicationUserRole>()
                .AsNoTracking()
                .Where(ur => ur.UserId == userId.Value)
                .Select(ur => ur.RoleId)
                .ToListAsync(ct);

            if (roleIds.Count > 0)
            {
                var regraEspecifica = await _db.Set<RegraAprovacaoVaga>()
                    .AsNoTracking()
                    .Where(r => r.Ativo && r.SolicitanteRoleId != null
                                && roleIds.Contains(r.SolicitanteRoleId.Value))
                    .FirstOrDefaultAsync(ct);

                if (regraEspecifica != null)
                    return regraEspecifica;
            }
        }

        // Fallback para regra padrão (SolicitanteRoleId == null)
        return await _db.Set<RegraAprovacaoVaga>()
            .AsNoTracking()
            .Where(r => r.Ativo && r.SolicitanteRoleId == null)
            .FirstOrDefaultAsync(ct);
    }

    private static SolicitacaoVagaResponse MapToResponse(SolicitacaoVaga s) => new(
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
        // Sprint 2
        s.Aprovador1Id,
        s.Aprovador1?.Name,
        s.Aprovador1Status,
        s.Aprovador1DataUtc,
        s.Aprovador2Id,
        s.Aprovador2?.Name,
        s.Aprovador2Status,
        s.Aprovador2DataUtc,
        s.Aprovador2Habilitado,
        s.CreatedAtUtc,
        s.UpdatedAtUtc,
        s.ApprovedAtUtc
    );
}
