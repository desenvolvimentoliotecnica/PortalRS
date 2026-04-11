using RhPortal.Api.Application.Common;
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

    public SolicitacaoVagaService(
        AppDbContext db,
        ITenantContext tenantContext,
        IVagaService vagaService,
        ICurrentUserContext currentUser,
        IPessoaService pessoaService,
        NotificationPublisher notifications,
        ApprovalWorkflowHelper workflow)
    {
        _db = db;
        _tenantContext = tenantContext;
        _vagaService = vagaService;
        _currentUser = currentUser;
        _pessoaService = pessoaService;
        _notifications = notifications;
        _workflow = workflow;
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

        return await q
            .Include(s => s.Aprovador)
            .Include(s => s.Aprovador1)
            .Select(s => new SolicitacaoVagaGridRow(
            s.Id,
            s.Titulo,
            s.Urgencia,
            s.Status,
            s.SolicitanteId,
            s.Solicitante != null ? s.Solicitante.Name : null,
            // Aprovador1Id (workflow real) tem prioridade sobre AprovadorId (legado)
            s.Aprovador1Id ?? s.AprovadorId,
            s.Aprovador1 != null ? s.Aprovador1.Name : (s.Aprovador != null ? s.Aprovador.Name : null),
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
            .Include(x => x.Empresa)
            .Include(x => x.CentroCusto)
            .Include(x => x.UnidadeLotacao)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .Include(x => x.Aprovador3)
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
            entity.Aprovador1Status = StatusAprovacao.Pendente;
            entity.Aprovador2Status = null;
            entity.Aprovador3Status = null;
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
        entity.Aprovador2Habilitado = request.Aprovador2Habilitado;
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

        // Resolve and create new etapas
        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, null, TipoFluxoAprovacao.RequisicaoPessoal, ct);

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

        // Espelhamento para os campos legados Aprovador1/Aprovador2/Aprovador3
        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
        var segundaEtapa = novasEtapas.OrderBy(e => e.Ordem).Skip(1).FirstOrDefault();
        var terceiraEtapa = novasEtapas.OrderBy(e => e.Ordem).Skip(2).FirstOrDefault();

        if (primeiraEtapa is not null)
        {
            entity.Aprovador1Id = primeiraEtapa.AprovadorId;
            entity.Aprovador1Status = primeiraEtapa.Status;
        }

        entity.Aprovador2Habilitado = segundaEtapa is not null;
        if (segundaEtapa is not null)
        {
            entity.Aprovador2Id = segundaEtapa.AprovadorId;
            entity.Aprovador2Status = segundaEtapa.Status;
        }
        else
        {
            entity.Aprovador2Id = null;
            entity.Aprovador2Status = null;
        }

        entity.Aprovador3Habilitado = terceiraEtapa is not null;
        if (terceiraEtapa is not null)
        {
            entity.Aprovador3Id = terceiraEtapa.AprovadorId;
            entity.Aprovador3Status = terceiraEtapa.Status;
        }
        else
        {
            entity.Aprovador3Id = null;
            entity.Aprovador3Status = null;
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
        etapaAtual.Observacao = observacao;

        var todasEtapas = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > etapaAtual.Ordem);

        // Espelhar nos legados
        var indAtual = todasEtapas.IndexOf(etapaAtual);
        if (indAtual == 0)
        {
            entity.Aprovador1Id = etapaAtual.AprovadorId;
            entity.Aprovador1Status = etapaAtual.Status;
            entity.Aprovador1DataUtc = etapaAtual.DataUtc;
        }
        else if (indAtual == 1)
        {
            entity.Aprovador2Id = etapaAtual.AprovadorId;
            entity.Aprovador2Status = etapaAtual.Status;
            entity.Aprovador2DataUtc = etapaAtual.DataUtc;
        }
        else if (indAtual == 2)
        {
            entity.Aprovador3Id = etapaAtual.AprovadorId;
            entity.Aprovador3Status = etapaAtual.Status;
            entity.Aprovador3DataUtc = etapaAtual.DataUtc;
        }

        if (proximaEtapa is not null)
        {
            entity.Status = proximaEtapa.Label.Contains("RH") ? SolicitacaoVagaStatus.PendenteAprovacaoRh : SolicitacaoVagaStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.ObservacaoAprovador = observacao;

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
            // Fim do fluxo
            entity.Status = SolicitacaoVagaStatus.Aprovada;
            entity.ObservacaoAprovador = observacao;
            entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            // Criar vaga 
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

            var logIndex = await _db.SolicitacoesAprovacaoEtapa.Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal && e.Ordem < etapaAtual.Ordem).CountAsync(ct);
            if (logIndex == 0) { entity.Aprovador1Status = StatusAprovacao.Rejeitado; }
            else if (logIndex == 1) { entity.Aprovador2Status = StatusAprovacao.Rejeitado; }
            else if (logIndex == 2) { entity.Aprovador3Status = StatusAprovacao.Rejeitado; }
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

        if (entity.Status == SolicitacaoVagaStatus.Aprovada ||
            entity.Status == SolicitacaoVagaStatus.Cancelada)
            throw new InvalidOperationException("Solicitação não pode ser cancelada no status atual.");

        entity.Status = SolicitacaoVagaStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
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

        if (etapaAtual is null || !etapaAtual.RoleFilaId.HasValue)
            throw new InvalidOperationException("Esta etapa não é uma fila de perfil para ser assumida.");

        if (etapaAtual.AprovadorId.HasValue)
            throw new InvalidOperationException("Esta etapa já foi assumida por outro usuário.");

        if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não pertence ao perfil designado para assumir esta etapa.");

        etapaAtual.AprovadorId = _currentUser.FuncionarioId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        
        var logIndex = await _db.SolicitacoesAprovacaoEtapa.Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal && e.Ordem < etapaAtual.Ordem).CountAsync(ct);
        if (logIndex == 0) { entity.Aprovador1Id = _currentUser.FuncionarioId; }
        else if (logIndex == 1) { entity.Aprovador2Id = _currentUser.FuncionarioId; }
        else if (logIndex == 2) { entity.Aprovador3Id = _currentUser.FuncionarioId; }

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    private Task<Guid?> ResolveUserIdByFuncionarioIdAsync(Guid funcionarioId, CancellationToken ct)
        => _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => (Guid?)f.UserId)
            .FirstOrDefaultAsync(ct);

    

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
        // Aprovação RH (Aprovador3)
        s.Aprovador3Id,
        s.Aprovador3?.Name,
        s.Aprovador3Status,
        s.Aprovador3DataUtc,
        s.Aprovador3Habilitado,
        s.CreatedAtUtc,
        s.UpdatedAtUtc,
        s.ApprovedAtUtc
    );
}
