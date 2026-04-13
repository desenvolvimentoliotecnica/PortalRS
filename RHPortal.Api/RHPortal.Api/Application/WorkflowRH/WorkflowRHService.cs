using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.WorkflowRH;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.WorkflowRH;

public interface IWorkflowRHService
{
    Task<IReadOnlyList<WorkflowRHGridRow>> ListAsync(WorkflowRHListQuery query, CancellationToken ct);
    Task<WorkflowRHDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<WorkflowRHDetailResponse?> GetByVagaIdAsync(Guid vagaId, CancellationToken ct);
    Task<Guid> CreateFromTemplateAsync(TipoWorkflowRH tipo, Guid? vagaId, Guid? preAdmissaoId, CancellationToken ct);
    Task<EtapaWorkflowRHResponse?> IniciarEtapaAsync(Guid workflowId, Guid etapaId, CancellationToken ct);
    Task<EtapaWorkflowRHResponse?> ConcluirEtapaAsync(Guid workflowId, Guid etapaId, ConcluirEtapaRequest request, CancellationToken ct);
    Task<EtapaWorkflowRHResponse?> PularEtapaAsync(Guid workflowId, Guid etapaId, PularEtapaRequest request, CancellationToken ct);
    Task<EtapaWorkflowRHResponse?> AssumirEtapaAsync(Guid workflowId, Guid etapaId, CancellationToken ct);
    Task<EtapaWorkflowRHResponse?> SalvarDadosEtapaAsync(Guid workflowId, Guid etapaId, SalvarDadosEtapaRequest request, CancellationToken ct);
    Task<bool> CancelarAsync(Guid workflowId, CancellationToken ct);
    Task<IReadOnlyList<HistoricoAlteracaoResponse>> GetHistoricoAsync(Guid workflowId, Guid? etapaId, CancellationToken ct);
}

public sealed class WorkflowRHService : IWorkflowRHService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly NotificationPublisher _notifications;

    public WorkflowRHService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        NotificationPublisher notifications)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _notifications = notifications;
    }

    // ── List ─────────────────────────────────────────────

    public async Task<IReadOnlyList<WorkflowRHGridRow>> ListAsync(WorkflowRHListQuery query, CancellationToken ct)
    {
        var q = _db.WorkflowsRH.AsNoTracking()
            .Include(w => w.Vaga)
            .Include(w => w.Responsavel)
            .Include(w => w.Etapas)
            .AsQueryable();

        if (query.TipoWorkflow.HasValue)
            q = q.Where(w => w.TipoWorkflow == (TipoWorkflowRH)query.TipoWorkflow.Value);

        if (query.Status.HasValue)
            q = q.Where(w => w.Status == (WorkflowRHStatus)query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(w => w.Vaga != null && w.Vaga.Titulo.ToLower().Contains(term)
                           || w.Responsavel != null && w.Responsavel.Name.ToLower().Contains(term));
        }

        q = q.OrderByDescending(w => w.CreatedAtUtc);

        var skip = (query.Page - 1) * query.PageSize;
        var items = await q.Skip(skip).Take(query.PageSize).ToListAsync(ct);

        return items.Select(w =>
        {
            var etapaAtual = w.Etapas.OrderBy(e => e.Ordem).FirstOrDefault(e => e.Status == EtapaWorkflowRHStatus.EmAndamento);
            var concluidas = w.Etapas.Count(e => e.Status is EtapaWorkflowRHStatus.Concluida or EtapaWorkflowRHStatus.Pulada);
            var slaExcedido = w.SlaPrazoDias.HasValue && w.DataInicio.HasValue
                              && DateTimeOffset.UtcNow > w.DataInicio.Value.AddDays(w.SlaPrazoDias.Value);

            return new WorkflowRHGridRow(
                w.Id,
                (short)w.TipoWorkflow,
                FormatTipoWorkflow(w.TipoWorkflow),
                (short)w.Status,
                FormatWorkflowStatus(w.Status),
                w.VagaId,
                w.Vaga?.Titulo,
                w.PreAdmissaoId,
                null, // CandidatoNome - populated separately if needed
                w.ResponsavelId,
                w.Responsavel?.Name,
                w.Etapas.Count,
                concluidas,
                etapaAtual?.Label,
                w.SlaPrazoDias,
                slaExcedido,
                w.CreatedAtUtc
            );
        }).ToList();
    }

    // ── Get By Id ────────────────────────────────────────

    public async Task<WorkflowRHDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var w = await _db.WorkflowsRH
            .Include(x => x.Vaga)
            .Include(x => x.Responsavel)
            .Include(x => x.Etapas).ThenInclude(e => e.Responsavel)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (w is null) return null;

        return MapToDetail(w);
    }

    public async Task<WorkflowRHDetailResponse?> GetByVagaIdAsync(Guid vagaId, CancellationToken ct)
    {
        var w = await _db.WorkflowsRH
            .Include(x => x.Vaga)
            .Include(x => x.Responsavel)
            .Include(x => x.Etapas).ThenInclude(e => e.Responsavel)
            .FirstOrDefaultAsync(x => x.VagaId == vagaId && x.TipoWorkflow == TipoWorkflowRH.TriagemVaga, ct);

        if (w is null) return null;

        return MapToDetail(w);
    }

    // ── Create From Template ─────────────────────────────

    public async Task<Guid> CreateFromTemplateAsync(TipoWorkflowRH tipo, Guid? vagaId, Guid? preAdmissaoId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var now = DateTimeOffset.UtcNow;

        // Load template steps
        var configs = await _db.EtapasConfigWorkflowRH
            .Where(c => c.TipoWorkflow == tipo && c.Ativo)
            .OrderBy(c => c.Ordem)
            .ToListAsync(ct);

        // If no config exists, seed defaults for this tenant
        if (configs.Count == 0)
        {
            configs = SeedDefaultConfigs(tenantId, tipo, now);
            _db.EtapasConfigWorkflowRH.AddRange(configs);
        }

        var workflowId = Guid.NewGuid();
        var totalSlaDias = configs.Sum(c => c.SlaPrazoDias ?? 0);

        var workflow = new Domain.Entities.WorkflowRH
        {
            Id = workflowId,
            TenantId = tenantId,
            TipoWorkflow = tipo,
            VagaId = vagaId,
            PreAdmissaoId = preAdmissaoId,
            Status = WorkflowRHStatus.NaoIniciado,
            SlaPrazoDias = totalSlaDias > 0 ? totalSlaDias : null,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        // Snapshot template steps into workflow etapas
        var etapas = new List<EtapaWorkflowRH>();
        for (var i = 0; i < configs.Count; i++)
        {
            var cfg = configs[i];
            etapas.Add(new EtapaWorkflowRH
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                WorkflowId = workflowId,
                Ordem = cfg.Ordem,
                Codigo = cfg.Codigo,
                Label = cfg.Label,
                Descricao = cfg.Descricao,
                Obrigatoria = cfg.Obrigatoria,
                RoleFilaId = cfg.RoleFilaId,
                SlaPrazoDias = cfg.SlaPrazoDias,
                // First step is NaoIniciada (ready to start), rest Bloqueada
                Status = i == 0 ? EtapaWorkflowRHStatus.NaoIniciada : EtapaWorkflowRHStatus.Bloqueada,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        workflow.Etapas = etapas;
        _db.WorkflowsRH.Add(workflow);
        await _db.SaveChangesAsync(ct);

        return workflowId;
    }

    // ── Iniciar Etapa ────────────────────────────────────

    public async Task<EtapaWorkflowRHResponse?> IniciarEtapaAsync(Guid workflowId, Guid etapaId, CancellationToken ct)
    {
        var (workflow, etapa) = await LoadWorkflowAndEtapa(workflowId, etapaId, ct);
        if (workflow is null || etapa is null) return null;

        if (etapa.Status != EtapaWorkflowRHStatus.NaoIniciada)
            throw new InvalidOperationException($"Etapa '{etapa.Label}' não está no status 'Não Iniciada'. Status atual: {etapa.Status}");

        var now = DateTimeOffset.UtcNow;
        etapa.Status = EtapaWorkflowRHStatus.EmAndamento;
        etapa.DataInicio = now;
        etapa.UpdatedAtUtc = now;

        // Start workflow if not already
        if (workflow.Status == WorkflowRHStatus.NaoIniciado)
        {
            workflow.Status = WorkflowRHStatus.EmAndamento;
            workflow.DataInicio = now;
            workflow.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return MapEtapa(etapa);
    }

    // ── Concluir Etapa ───────────────────────────────────

    public async Task<EtapaWorkflowRHResponse?> ConcluirEtapaAsync(Guid workflowId, Guid etapaId, ConcluirEtapaRequest request, CancellationToken ct)
    {
        var (workflow, etapa) = await LoadWorkflowAndEtapa(workflowId, etapaId, ct);
        if (workflow is null || etapa is null) return null;

        if (etapa.Status is not (EtapaWorkflowRHStatus.EmAndamento or EtapaWorkflowRHStatus.NaoIniciada))
            throw new InvalidOperationException($"Etapa '{etapa.Label}' não pode ser concluída. Status atual: {etapa.Status}");

        var now = DateTimeOffset.UtcNow;
        etapa.Status = EtapaWorkflowRHStatus.Concluida;
        etapa.DataConclusao = now;
        etapa.DadosJson = request.DadosJson ?? etapa.DadosJson;
        etapa.Observacoes = request.Observacoes ?? etapa.Observacoes;
        etapa.UpdatedAtUtc = now;

        // Start workflow if not already
        if (workflow.Status == WorkflowRHStatus.NaoIniciado)
        {
            workflow.Status = WorkflowRHStatus.EmAndamento;
            workflow.DataInicio = now;
        }

        AdvanceToNextStep(workflow, etapa.Ordem, now);
        await _db.SaveChangesAsync(ct);
        return MapEtapa(etapa);
    }

    // ── Pular Etapa ──────────────────────────────────────

    public async Task<EtapaWorkflowRHResponse?> PularEtapaAsync(Guid workflowId, Guid etapaId, PularEtapaRequest request, CancellationToken ct)
    {
        var (workflow, etapa) = await LoadWorkflowAndEtapa(workflowId, etapaId, ct);
        if (workflow is null || etapa is null) return null;

        if (etapa.Obrigatoria)
            throw new InvalidOperationException($"Etapa '{etapa.Label}' é obrigatória e não pode ser pulada.");

        if (etapa.Status is not (EtapaWorkflowRHStatus.EmAndamento or EtapaWorkflowRHStatus.NaoIniciada))
            throw new InvalidOperationException($"Etapa '{etapa.Label}' não pode ser pulada. Status atual: {etapa.Status}");

        var now = DateTimeOffset.UtcNow;
        etapa.Status = EtapaWorkflowRHStatus.Pulada;
        etapa.DataConclusao = now;
        etapa.Observacoes = request.Observacoes;
        etapa.UpdatedAtUtc = now;

        AdvanceToNextStep(workflow, etapa.Ordem, now);
        await _db.SaveChangesAsync(ct);
        return MapEtapa(etapa);
    }

    // ── Assumir Etapa ────────────────────────────────────

    public async Task<EtapaWorkflowRHResponse?> AssumirEtapaAsync(Guid workflowId, Guid etapaId, CancellationToken ct)
    {
        var (workflow, etapa) = await LoadWorkflowAndEtapa(workflowId, etapaId, ct);
        if (workflow is null || etapa is null) return null;

        var funcionarioId = _currentUser.FuncionarioId
            ?? throw new InvalidOperationException("Usuário atual não possui funcionário vinculado.");

        etapa.ResponsavelId = funcionarioId;
        etapa.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Also set as workflow responsible if none set
        if (workflow.ResponsavelId is null)
        {
            workflow.ResponsavelId = funcionarioId;
            workflow.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return MapEtapa(etapa);
    }

    // ── Salvar Dados Etapa ───────────────────────────────

    public async Task<EtapaWorkflowRHResponse?> SalvarDadosEtapaAsync(Guid workflowId, Guid etapaId, SalvarDadosEtapaRequest request, CancellationToken ct)
    {
        var (_, etapa) = await LoadWorkflowAndEtapa(workflowId, etapaId, ct);
        if (etapa is null) return null;

        if (etapa.Status is EtapaWorkflowRHStatus.Concluida or EtapaWorkflowRHStatus.Pulada or EtapaWorkflowRHStatus.Bloqueada)
            throw new InvalidOperationException($"Não é possível salvar dados na etapa '{etapa.Label}'. Status: {etapa.Status}");

        etapa.DadosJson = request.DadosJson;
        etapa.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapEtapa(etapa);
    }

    // ── Cancelar Workflow ────────────────────────────────

    public async Task<bool> CancelarAsync(Guid workflowId, CancellationToken ct)
    {
        var workflow = await _db.WorkflowsRH
            .Include(w => w.Etapas)
            .FirstOrDefaultAsync(w => w.Id == workflowId, ct);

        if (workflow is null) return false;

        if (workflow.Status == WorkflowRHStatus.Concluido)
            throw new InvalidOperationException("Workflow já concluído, não pode ser cancelado.");

        var now = DateTimeOffset.UtcNow;
        workflow.Status = WorkflowRHStatus.Cancelado;
        workflow.DataConclusao = now;
        workflow.UpdatedAtUtc = now;

        // Cancel all non-completed steps
        foreach (var etapa in workflow.Etapas.Where(e => e.Status is not (EtapaWorkflowRHStatus.Concluida or EtapaWorkflowRHStatus.Pulada)))
        {
            etapa.Status = EtapaWorkflowRHStatus.Bloqueada;
            etapa.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Histórico ────────────────────────────────────────

    public async Task<IReadOnlyList<HistoricoAlteracaoResponse>> GetHistoricoAsync(Guid workflowId, Guid? etapaId, CancellationToken ct)
    {
        var q = _db.HistoricosAlteracaoWorkflowRH.AsNoTracking()
            .Where(h => h.WorkflowId == workflowId);

        if (etapaId.HasValue)
            q = q.Where(h => h.EtapaWorkflowId == etapaId.Value);

        var items = await q
            .OrderByDescending(h => h.DataAlteracaoUtc)
            .Include(h => h.EtapaWorkflow)
            .ToListAsync(ct);

        return items.Select(h => new HistoricoAlteracaoResponse(
            h.Id,
            h.EtapaWorkflowId,
            h.EtapaWorkflow?.Label,
            h.Campo,
            h.ValorAnterior,
            h.ValorNovo,
            (short)h.OrigemPreenchimento,
            FormatOrigem(h.OrigemPreenchimento),
            h.AlteradoPorId,
            h.AlteradoPorNome,
            h.DataAlteracaoUtc,
            h.Observacao
        )).ToList();
    }

    // ── Private Helpers ──────────────────────────────────

    private async Task<(Domain.Entities.WorkflowRH? Workflow, EtapaWorkflowRH? Etapa)> LoadWorkflowAndEtapa(
        Guid workflowId, Guid etapaId, CancellationToken ct)
    {
        var workflow = await _db.WorkflowsRH
            .Include(w => w.Etapas).ThenInclude(e => e.Responsavel)
            .FirstOrDefaultAsync(w => w.Id == workflowId, ct);

        var etapa = workflow?.Etapas.FirstOrDefault(e => e.Id == etapaId);
        return (workflow, etapa);
    }

    private void AdvanceToNextStep(Domain.Entities.WorkflowRH workflow, int currentOrdem, DateTimeOffset now)
    {
        var nextEtapa = workflow.Etapas
            .OrderBy(e => e.Ordem)
            .FirstOrDefault(e => e.Ordem > currentOrdem && e.Status == EtapaWorkflowRHStatus.Bloqueada);

        if (nextEtapa is not null)
        {
            nextEtapa.Status = EtapaWorkflowRHStatus.NaoIniciada;
            nextEtapa.UpdatedAtUtc = now;
        }
        else
        {
            // All steps done - check if all completed/skipped
            var allDone = workflow.Etapas.All(e =>
                e.Status is EtapaWorkflowRHStatus.Concluida or EtapaWorkflowRHStatus.Pulada);

            if (allDone)
            {
                workflow.Status = WorkflowRHStatus.Concluido;
                workflow.DataConclusao = now;
            }
        }

        workflow.UpdatedAtUtc = now;
    }

    private WorkflowRHDetailResponse MapToDetail(Domain.Entities.WorkflowRH w)
    {
        var slaExcedido = w.SlaPrazoDias.HasValue && w.DataInicio.HasValue
                          && DateTimeOffset.UtcNow > w.DataInicio.Value.AddDays(w.SlaPrazoDias.Value);

        // Build solicitation snapshot if linked to a Vaga via SolicitacaoVaga
        DadosSolicitacaoSnapshot? snapshot = null;
        if (w.VagaId.HasValue)
        {
            var sol = _db.SolicitacoesVaga.AsNoTracking()
                .Include(s => s.Solicitante)
                .FirstOrDefault(s => s.VagaId == w.VagaId.Value);

            if (sol is not null)
            {
                snapshot = new DadosSolicitacaoSnapshot(
                    sol.Id,
                    sol.Titulo,
                    sol.Justificativa,
                    sol.QtdPosicoes,
                    sol.Urgencia.ToString(),
                    sol.TipoSolicitacao.ToString(),
                    sol.IsConfidencial,
                    sol.SubstituidoNome,
                    null, null, null, // names resolved via lookup if needed
                    sol.TipoContrato.ToString(),
                    sol.PrazoDias,
                    sol.MotivoRequisicao?.ToString(),
                    sol.CnhObrigatoria,
                    sol.DisponibilidadeViagens,
                    sol.EscalaTrabalho,
                    null, null, null, // empresa/cc/ul names
                    sol.Solicitante?.Name ?? "",
                    sol.CreatedAtUtc
                );
            }
        }

        return new WorkflowRHDetailResponse(
            w.Id,
            (short)w.TipoWorkflow,
            FormatTipoWorkflow(w.TipoWorkflow),
            (short)w.Status,
            FormatWorkflowStatus(w.Status),
            w.VagaId,
            w.Vaga?.Titulo,
            w.PreAdmissaoId,
            null, // CandidatoNome
            w.ResponsavelId,
            w.Responsavel?.Name,
            w.DataInicio,
            w.DataConclusao,
            w.SlaPrazoDias,
            slaExcedido,
            w.CreatedAtUtc,
            w.UpdatedAtUtc,
            w.Etapas.OrderBy(e => e.Ordem).Select(MapEtapa).ToArray(),
            snapshot
        );
    }

    private static EtapaWorkflowRHResponse MapEtapa(EtapaWorkflowRH e)
    {
        var slaExcedido = e.SlaPrazoDias.HasValue && e.DataInicio.HasValue
                          && e.Status == EtapaWorkflowRHStatus.EmAndamento
                          && DateTimeOffset.UtcNow > e.DataInicio.Value.AddDays(e.SlaPrazoDias.Value);

        return new EtapaWorkflowRHResponse(
            e.Id,
            e.Ordem,
            e.Codigo,
            e.Label,
            e.Descricao,
            (short)e.Status,
            FormatEtapaStatus(e.Status),
            e.Obrigatoria,
            e.ResponsavelId,
            e.Responsavel?.Name,
            e.RoleFilaId,
            null, // RoleFilaNome - loaded on demand
            e.SlaPrazoDias,
            slaExcedido,
            e.DataInicio,
            e.DataConclusao,
            e.DadosJson,
            e.Observacoes,
            e.CreatedAtUtc
        );
    }

    // ── Seed Defaults ────────────────────────────────────

    private static List<EtapaConfigWorkflowRH> SeedDefaultConfigs(string tenantId, TipoWorkflowRH tipo, DateTimeOffset now)
    {
        if (tipo == TipoWorkflowRH.TriagemVaga)
        {
            return new List<EtapaConfigWorkflowRH>
            {
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 1, Codigo = "revisao-requisicao",  Label = "Revisão da Requisição",            Obrigatoria = true,  SlaPrazoDias = 2,  Ativo = true, UpdatedAtUtc = now },
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 2, Codigo = "complemento-dados",   Label = "Complemento de Dados",              Obrigatoria = true,  SlaPrazoDias = 3,  Ativo = true, UpdatedAtUtc = now },
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 3, Codigo = "definicao-processo",   Label = "Definição do Processo Seletivo",    Obrigatoria = true,  SlaPrazoDias = 2,  Ativo = true, UpdatedAtUtc = now },
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 4, Codigo = "publicacao-vaga",      Label = "Publicação da Vaga",                Obrigatoria = true,  SlaPrazoDias = 1,  Ativo = true, UpdatedAtUtc = now },
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 5, Codigo = "triagem-candidatos",   Label = "Triagem de Candidatos",             Obrigatoria = true,  SlaPrazoDias = 10, Ativo = true, UpdatedAtUtc = now },
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 6, Codigo = "entrevistas",          Label = "Entrevistas",                       Obrigatoria = true,  SlaPrazoDias = 15, Ativo = true, UpdatedAtUtc = now },
                new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 7, Codigo = "selecao-final",        Label = "Seleção Final e Efetivação",        Obrigatoria = true,  SlaPrazoDias = 5,  Ativo = true, UpdatedAtUtc = now },
            };
        }

        // RevisaoPosEfetivacao
        return new List<EtapaConfigWorkflowRH>
        {
            new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 1, Codigo = "validacao-documentos",    Label = "Validação de Documentos",       Obrigatoria = true,  SlaPrazoDias = 3,  Ativo = true, UpdatedAtUtc = now },
            new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 2, Codigo = "cadastro-sistema",        Label = "Cadastro no Sistema",           Obrigatoria = true,  SlaPrazoDias = 2,  Ativo = true, UpdatedAtUtc = now },
            new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 3, Codigo = "beneficios-folha",        Label = "Benefícios e Folha",            Obrigatoria = true,  SlaPrazoDias = 3,  Ativo = true, UpdatedAtUtc = now },
            new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 4, Codigo = "integracao-onboarding",   Label = "Integração/Onboarding",         Obrigatoria = false, SlaPrazoDias = 30, Ativo = true, UpdatedAtUtc = now },
            new() { Id = Guid.NewGuid(), TenantId = tenantId, TipoWorkflow = tipo, Ordem = 5, Codigo = "periodo-experiencia",     Label = "Período de Experiência",        Obrigatoria = false, SlaPrazoDias = 90, Ativo = true, UpdatedAtUtc = now },
        };
    }

    // ── Format Helpers ───────────────────────────────────

    private static string FormatTipoWorkflow(TipoWorkflowRH t) => t switch
    {
        TipoWorkflowRH.TriagemVaga => "Triagem Vaga",
        TipoWorkflowRH.RevisaoPosEfetivacao => "Revisão Pós-Efetivação",
        _ => t.ToString()
    };

    private static string FormatWorkflowStatus(WorkflowRHStatus s) => s switch
    {
        WorkflowRHStatus.NaoIniciado => "Não Iniciado",
        WorkflowRHStatus.EmAndamento => "Em Andamento",
        WorkflowRHStatus.Concluido => "Concluído",
        WorkflowRHStatus.Cancelado => "Cancelado",
        _ => s.ToString()
    };

    private static string FormatEtapaStatus(EtapaWorkflowRHStatus s) => s switch
    {
        EtapaWorkflowRHStatus.NaoIniciada => "Não Iniciada",
        EtapaWorkflowRHStatus.EmAndamento => "Em Andamento",
        EtapaWorkflowRHStatus.Concluida => "Concluída",
        EtapaWorkflowRHStatus.Pulada => "Pulada",
        EtapaWorkflowRHStatus.Bloqueada => "Bloqueada",
        _ => s.ToString()
    };

    private static string FormatOrigem(OrigemPreenchimento o) => o switch
    {
        OrigemPreenchimento.Gestor => "Gestor",
        OrigemPreenchimento.RH => "RH",
        OrigemPreenchimento.Sistema => "Sistema",
        _ => o.ToString()
    };
}
