using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.EntrevistasSaida;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.SolicitacoesDesligamento;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.SolicitacoesDesligamento;

public interface ISolicitacaoDesligamentoService
{
    Task<IReadOnlyList<SolicitacaoDesligamentoGridRow>> ListAsync(SolicitacaoDesligamentoListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse> CreateAsync(SolicitacaoDesligamentoCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> UpdateAsync(Guid id, SolicitacaoDesligamentoUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> EfetivarAsync(Guid id, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> AssumirAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse?> CancelAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDesligamentoResponse> CopyAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Propaga reprovação a partir da vaga origem. Não valida permissões do usuário.
    /// Idempotente: ignora se o desligamento já está em estado terminal.
    /// </summary>
    /// <summary>Datasul confirma resultado da integração — move para Concluida ou registra erro.</summary>
    Task<SolicitacaoDesligamentoResponse?> ConfirmarIntegracaoAsync(Guid id, IntegracaoResultado resultado, string? mensagem, CancellationToken ct);

    Task ReprovarEmCascataAsync(Guid id, string? observacao, CancellationToken ct);

    /// <summary>
    /// Propaga cancelamento a partir da vaga origem. Não valida permissões do usuário.
    /// Idempotente: ignora se o desligamento já está em estado terminal.
    /// </summary>
    Task CancelarEmCascataAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<SolicitacaoDesligamentoPendenteIntegracaoRow>> ListPendentesIntegracaoAsync(CancellationToken ct);
}

public sealed class SolicitacaoDesligamentoService : ISolicitacaoDesligamentoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;
    private readonly IEmailQueueService _emailQueue;
    private readonly IEntrevistaSaidaService _entrevistaSaida;
    private readonly IServiceProvider _serviceProvider;
    private readonly StatusHistoricoService _statusHistorico;

    public SolicitacaoDesligamentoService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        ApprovalWorkflowHelper workflow,
        IEmailQueueService emailQueue,
        IEntrevistaSaidaService entrevistaSaida,
        IServiceProvider serviceProvider,
        StatusHistoricoService statusHistorico)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _workflow = workflow;
        _emailQueue = emailQueue;
        _entrevistaSaida = entrevistaSaida;
        _statusHistorico = statusHistorico;
        _serviceProvider = serviceProvider;
    }

    public async Task<IReadOnlyList<SolicitacaoDesligamentoGridRow>> ListAsync(
        SolicitacaoDesligamentoListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesDesligamento.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Funcionario)
            .AsQueryable();

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);

        if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

        if (query.Statuses is { Length: > 0 })
            q = q.Where(s => query.Statuses.Contains(s.Status));

        if (query.AreaId.HasValue)
            q = q.Where(s => s.Funcionario != null && s.Funcionario.CentroCustoId == query.AreaId.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(s =>
                (s.Funcionario != null && s.Funcionario.Name.ToLower().Contains(term)) ||
                s.MotivoDesligamento.ToLower().Contains(term) ||
                (s.RmIdReq != null && s.RmIdReq.ToString().Contains(term)));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        var rawRows = await q.Select(s => new
        {
            s.Id,
            s.Status,
            s.FuncionarioId,
            SolicitanteNome = s.Solicitante != null ? s.Solicitante.Name : (string?)null,
            FuncionarioNome = s.Funcionario != null ? s.Funcionario.Name : (string?)null,
            s.TipoDesligamento,
            s.DataDesligamento,
            s.CreatedAtUtc,
            s.RmIdReq,
        }).ToListAsync(ct);

        var ids = rawRows.Select(r => r.Id).ToList();
        var etapasPendentes = await _workflow.GetEtapasPendentesAsync(
            ids, TipoFluxoAprovacao.Desligamento, ct, currentUserId: _currentUser.UserId);

        var entrevistaStatus = await _entrevistaSaida.GetStatusBatchAsync(
            rawRows.Select(r => (r.Id, r.FuncionarioId)).ToList(),
            ct);

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            entrevistaStatus.TryGetValue(r.Id, out var entrevista);
            return new SolicitacaoDesligamentoGridRow(
                r.Id, r.Status, r.SolicitanteNome, r.FuncionarioNome, r.RmIdReq,
                r.TipoDesligamento, r.DataDesligamento, r.CreatedAtUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId,
                ep?.AssumedByUserId,
                ep?.CanAssume ?? false,
                ep?.CanApprove ?? false,
                entrevista?.Status,
                entrevista?.EnviadaEmUtc,
                entrevista?.RespondidaEmUtc);
        }).ToList();
    }

    public async Task<IReadOnlyList<SolicitacaoDesligamentoPendenteIntegracaoRow>> ListPendentesIntegracaoAsync(CancellationToken ct)
    {
        return await _db.SolicitacoesDesligamento
            .AsNoTracking()
            .Include(x => x.Funcionario)
            .Where(x => x.TenantId == _tenantContext.TenantId
                     && x.Status == SolicitacaoStatus.EmIntegracao
                     && x.IntegracaoResultado == null)
            .OrderBy(x => x.ApprovedAtUtc)
            .Select(x => new SolicitacaoDesligamentoPendenteIntegracaoRow(
                x.Id,
                x.Funcionario != null ? x.Funcionario.Name : null,
                x.DataDesligamento,
                x.Status))
            .ToListAsync(ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesDesligamento.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Funcionario)
            .Include(x => x.Empresa)
            .Include(x => x.Unit)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

        var etapas = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .Include(e => e.Aprovador)
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var etapaDtos = await _workflow.MapEtapasToAprovacaoResponsesAsync(etapas, ct);
        return MapToResponse(s, etapaDtos);
    }

    public async Task<SolicitacaoDesligamentoResponse> CreateAsync(
        SolicitacaoDesligamentoCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        var entity = new SolicitacaoDesligamento
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            FuncionarioId = request.FuncionarioId,
            EmpresaId = request.EmpresaId,
            UnitId = request.UnitId,
            HistoricoMedidasDisciplinares = request.HistoricoMedidasDisciplinares,
            DataDesligamento = request.DataDesligamento,
            TipoDesligamento = request.TipoDesligamento,
            MotivoDesligamento = request.MotivoDesligamento,
            TipoAvisoPrevio = request.TipoAvisoPrevio,
            DiasAvisoPrevio = request.DiasAvisoPrevio,
            PossuiEstabilidade = request.PossuiEstabilidade,
            ElegivelRecontratacao = request.ElegivelRecontratacao,
            SubstituirPosicao = request.SubstituirPosicao,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesDesligamento.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoDesligamentoResponse?> UpdateAsync(
        Guid id, SolicitacaoDesligamentoUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        // Permite edição em Rascunho, AjustesNecessarios ou PendenteAprovacao/PendenteAprovacaoRh
        // (retrocede para Rascunho quando pendente, igual à lógica da Requisição de Pessoal)
        if (entity.Status != SolicitacaoStatus.Rascunho &&
            entity.Status != SolicitacaoStatus.AjustesNecessarios &&
            entity.Status != SolicitacaoStatus.PendenteAprovacao &&
            entity.Status != SolicitacaoStatus.PendenteAprovacaoRh)
            throw new InvalidOperationException("Solicitação não pode ser editada no status atual.");

        if (entity.Status == SolicitacaoStatus.PendenteAprovacao ||
            entity.Status == SolicitacaoStatus.PendenteAprovacaoRh)
        {
            // Retrocede para rascunho; gestor deve reenviar para aprovação
            entity.Status = SolicitacaoStatus.Rascunho;

            // Cancela etapas pendentes do workflow atual
            var etapasPendentes = _db.SolicitacoesAprovacaoEtapa
                .Where(e => e.SolicitacaoId == id
                    && e.TipoFluxo == TipoFluxoAprovacao.Desligamento
                    && e.Status == StatusAprovacao.Pendente);
            foreach (var ep in etapasPendentes)
            {
                ep.Status = StatusAprovacao.Cancelado;
                ep.DataUtc = DateTimeOffset.UtcNow;
            }
        }

        entity.FuncionarioId = request.FuncionarioId;
        entity.EmpresaId = request.EmpresaId;
        entity.UnitId = request.UnitId;
        entity.HistoricoMedidasDisciplinares = request.HistoricoMedidasDisciplinares;
        entity.DataDesligamento = request.DataDesligamento;
        entity.TipoDesligamento = request.TipoDesligamento;
        entity.MotivoDesligamento = request.MotivoDesligamento;
        entity.TipoAvisoPrevio = request.TipoAvisoPrevio;
        entity.DiasAvisoPrevio = request.DiasAvisoPrevio;
        entity.PossuiEstabilidade = request.PossuiEstabilidade;
        entity.ElegivelRecontratacao = request.ElegivelRecontratacao;
        entity.SubstituirPosicao = request.SubstituirPosicao;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        var statusAnteriorSubmitDesl = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
            statusAnteriorSubmitDesl, entity.Status.ToString(), _currentUser, ct: ct);

        // Remove etapas anteriores (re-submit)
        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        // Resolve and create new etapas
        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, entity.FuncionarioId, TipoFluxoAprovacao.Desligamento, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.Desligamento,
            Ordem = r.Ordem,
            Label = r.Label,
            AprovadorId = r.AprovadorId,
            RoleFilaId = r.RoleFilaId,
            AcaoEtapa = r.AcaoEtapa,
            MomentoAcao = r.MomentoAcao,
            Status = StatusAprovacao.Pendente,
        }).ToList();

        _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);

        // Auto-avança etapas de processo no início do fluxo
        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
        while (primeiraEtapa is not null && IsProcessoStep(primeiraEtapa))
        {
            ExecutarAcaoEtapa(primeiraEtapa.AcaoEtapa, entity);
            primeiraEtapa.Status = StatusAprovacao.Aprovado;
            primeiraEtapa.DataUtc = DateTimeOffset.UtcNow;
            primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault(e => e.Ordem > primeiraEtapa.Ordem);
        }

        await _db.SaveChangesAsync(ct);

        // Notify first step
        if (primeiraEtapa is not null)
        {
            var nomeFuncionario = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct))?.Name ?? "um funcionário";
            var nomeSolicitante = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";

            if (primeiraEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    primeiraEtapa.AprovadorId.Value,
                    "Nova solicitação de desligamento para aprovação",
                    $"{nomeSolicitante} solicitou o desligamento de {nomeFuncionario}.",
                    "/gestao/painel-solicitacoes",
                    ct);
            }
        }

        return true;
    }

    public async Task<SolicitacaoDesligamentoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Nenhuma etapa de aprovação pendente encontrada.");

        if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não tem permissão para aprovar esta etapa.");

        // Register the approver (for role queue: record who assumed)
        if (etapaAtual.RoleFilaId.HasValue && _currentUser.FuncionarioId.HasValue)
            etapaAtual.AprovadorId = _currentUser.FuncionarioId;

        etapaAtual.Status = StatusAprovacao.Aprovado;
        etapaAtual.DataUtc = DateTimeOffset.UtcNow;
        etapaAtual.Observacao = observacao;

        // Carregar todas as etapas para auto-avançar process steps
        var todasEtapas = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > etapaAtual.Ordem);
        while (proximaEtapa is not null && IsProcessoStep(proximaEtapa))
        {
            ExecutarAcaoEtapa(proximaEtapa.AcaoEtapa, entity);
            proximaEtapa.Status = StatusAprovacao.Aprovado;
            proximaEtapa.DataUtc = DateTimeOffset.UtcNow;
            proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > proximaEtapa.Ordem);
        }

        var statusAnteriorApproveDesl = entity.Status.ToString();
        if (proximaEtapa is not null)
        {
            entity.Status = proximaEtapa.RoleFilaId.HasValue
                ? SolicitacaoStatus.PendenteAprovacaoRh
                : SolicitacaoStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.ObservacaoAprovador = observacao;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
                statusAnteriorApproveDesl, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de desligamento aguarda sua aprovação",
                    $"Uma etapa anterior foi aprovada. Agora é a etapa \"{proximaEtapa.Label}\" aguardando sua ação.",
                    "/gestao/painel-solicitacoes",
                    ct);
            }
        }
        else
        {
            // All steps done → finalize
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ObservacaoAprovador = observacao;
            entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
                statusAnteriorApproveDesl, entity.Status.ToString(), _currentUser, observacao, ct);

            // Se SubstituirPosicao=true, registrar para criação futura de SolicitacaoVaga
            // (campo SolicitacaoVagaGeradaId será preenchido quando a integração for implementada)

            await _db.SaveChangesAsync(ct);

            // Nota: a ocupação da vaga será fechada no painel de integração TOTVS,
            // quando o envio for confirmado (IntegracaoResultado.Sucesso).

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de desligamento aprovada",
                "Sua solicitação de desligamento foi aprovada." + (observacao is not null ? $" Observação: {observacao}" : ""),
                "/gestao/painel-solicitacoes",
                ct);

            var solicitante = await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct);
            if (!string.IsNullOrWhiteSpace(solicitante?.Email))
            {
                var obsHtml = !string.IsNullOrWhiteSpace(observacao)
                    ? $"<p><strong>Observação:</strong> {observacao}</p>" : "";
                await _emailQueue.EnqueueRawAsync(
                    solicitante.Email,
                    "Solicitação de desligamento aprovada",
                    $"<p>Olá {solicitante.Name},</p><p>Sua solicitação de desligamento foi <strong>aprovada</strong>.</p>{obsHtml}",
                    null, false, "SolicitacaoDesligamento", ct);
            }
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> EfetivarAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.Aprovada)
            throw new InvalidOperationException("Apenas solicitações com status Aprovada podem ser efetivadas.");

        var statusAnteriorEfetivarDesl = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.EmIntegracao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
            statusAnteriorEfetivarDesl, entity.Status.ToString(), _currentUser, ct: ct);

        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento && e.Status == StatusAprovacao.Pendente)
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

        var statusAnteriorRejectDesl = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
            statusAnteriorRejectDesl, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de desligamento reprovada",
            "Sua solicitação de desligamento foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
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
                "Solicitação de desligamento reprovada",
                $"<p>Olá {solicitanteReject.Name},</p><p>Sua solicitação de desligamento foi <strong>reprovada</strong>.</p>{obsHtml}",
                null, false, "SolicitacaoDesligamento", ct);
        }

        // Cascata: reprova a vaga origem, se houver
        if (entity.SolicitacaoVagaOrigemId.HasValue)
        {
            var vagaService = _serviceProvider.GetRequiredService<ISolicitacaoVagaService>();
            await vagaService.ReprovarEmCascataAsync(
                entity.SolicitacaoVagaOrigemId.Value,
                $"Reprovação automática: o desligamento vinculado foi reprovado.",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // etapaAtual stays Pendente — the solicitante fixes and resubmits (SubmitAsync will reset etapas)
        var statusAnteriorChangesDesl = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
            statusAnteriorChangesDesl, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de desligamento",
            "Sua solicitação de desligamento precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
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
                "Ajustes necessários na solicitação de desligamento",
                $"<p>Olá {solicitanteChanges.Name},</p><p>Sua solicitação de desligamento precisa de <strong>ajustes</strong>.</p>{obsHtml}",
                null, false, "SolicitacaoDesligamento", ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesDesligamento.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<SolicitacaoDesligamentoResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Não há etapa pendente para assumir.");

        var isRoleQueue = etapaAtual.RoleFilaId.HasValue;
        var isOrphanConsenso = !etapaAtual.RoleFilaId.HasValue && !etapaAtual.AprovadorId.HasValue;
        if (!isRoleQueue && !isOrphanConsenso)
            throw new InvalidOperationException("Esta etapa não pode ser assumida.");

        if (etapaAtual.AprovadorId.HasValue || etapaAtual.AssumedByUserId.HasValue)
            throw new InvalidOperationException("Esta etapa já foi assumida por outro usuário.");

        if (isRoleQueue && !await _workflow.CanAssumeRoleQueueAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não pertence ao perfil designado para assumir esta etapa.");

        if (isOrphanConsenso)
        {
            if (!_currentUser.IsAdmin || _currentUser.IsOwner)
                throw new InvalidOperationException("Owner não pode assumir etapas diretamente. Utilize um usuário com perfil Admin do tenant.");
        }

        if (_currentUser.FuncionarioId.HasValue)
            etapaAtual.AprovadorId = _currentUser.FuncionarioId;
        else if (_currentUser.UserId.HasValue)
            etapaAtual.AssumedByUserId = _currentUser.UserId;
        else
            throw new InvalidOperationException("Não foi possível identificar o usuário autenticado.");

        if (entity.Status == SolicitacaoStatus.PendenteAprovacaoRh)
            entity.Status = SolicitacaoStatus.PendenteAprovacao;

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> CancelAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status == SolicitacaoStatus.Rascunho)
            throw new InvalidOperationException("Rascunhos não podem ser cancelados — utilize Excluir.");

        if (entity.Status == SolicitacaoStatus.Aprovada || entity.Status == SolicitacaoStatus.Cancelada)
            throw new InvalidOperationException("Solicitação não pode ser cancelada no status atual.");

        var statusAnteriorCancelDesl = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
            statusAnteriorCancelDesl, entity.Status.ToString(), _currentUser, ct: ct);

        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && e.TipoFluxo == TipoFluxoAprovacao.Desligamento
                && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);

        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        // Cascata: cancela a vaga origem, se houver
        if (entity.SolicitacaoVagaOrigemId.HasValue)
        {
            var vagaService = _serviceProvider.GetRequiredService<ISolicitacaoVagaService>();
            await vagaService.CancelarEmCascataAsync(entity.SolicitacaoVagaOrigemId.Value, ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDesligamentoResponse> CopyAsync(Guid id, CancellationToken ct)
    {
        var source = await _db.SolicitacoesDesligamento
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Solicitação não encontrada.");

        var copy = new SolicitacaoDesligamento
        {
            Id = Guid.NewGuid(),
            TenantId = source.TenantId,
            SolicitanteId = source.SolicitanteId,
            FuncionarioId = source.FuncionarioId,
            EmpresaId = source.EmpresaId,
            UnitId = source.UnitId,
            HistoricoMedidasDisciplinares = source.HistoricoMedidasDisciplinares,
            DataDesligamento = source.DataDesligamento,
            TipoDesligamento = source.TipoDesligamento,
            MotivoDesligamento = source.MotivoDesligamento,
            TipoAvisoPrevio = source.TipoAvisoPrevio,
            DiasAvisoPrevio = source.DiasAvisoPrevio,
            PossuiEstabilidade = source.PossuiEstabilidade,
            ElegivelRecontratacao = source.ElegivelRecontratacao,
            SubstituirPosicao = source.SubstituirPosicao,
            Observacoes = source.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesDesligamento.Add(copy);
        await _db.SaveChangesAsync(ct);
        return (await GetByIdAsync(copy.Id, ct))!;
    }

    public async Task<SolicitacaoDesligamentoResponse?> ConfirmarIntegracaoAsync(
        Guid id, IntegracaoResultado resultado, string? mensagem, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.EmIntegracao)
            throw new InvalidOperationException("Apenas solicitações em EmIntegracao podem ter o resultado confirmado.");

        entity.IntegracaoResultado = resultado;
        entity.IntegracaoMensagem = mensagem;
        entity.IntegradaEmUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (resultado == IntegracaoResultado.Sucesso)
        {
            var statusAnterior = entity.Status.ToString();
            entity.Status = SolicitacaoStatus.Concluida;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoDesligamento, entity.Id,
                statusAnterior, entity.Status.ToString(), _currentUser, null, ct);
        }
        // Erro: mantém EmIntegracao para o RH visualizar e reprocessar

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task ReprovarEmCascataAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return;

        // Idempotente: não re-propaga se já está em estado terminal
        if (entity.Status == SolicitacaoStatus.Reprovada ||
            entity.Status == SolicitacaoStatus.Cancelada ||
            entity.Status == SolicitacaoStatus.Concluida)
            return;

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && e.TipoFluxo == TipoFluxoAprovacao.Desligamento
                && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);
        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
            etapa.Observacao = observacao;
        }

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de desligamento reprovada em cascata",
            $"Sua solicitação de desligamento foi reprovada automaticamente. {observacao}",
            "/gestao/painel-solicitacoes",
            ct,
            "warning");
    }

    public async Task CancelarEmCascataAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return;

        if (entity.Status == SolicitacaoStatus.Reprovada ||
            entity.Status == SolicitacaoStatus.Cancelada ||
            entity.Status == SolicitacaoStatus.Concluida)
            return;

        entity.Status = SolicitacaoStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && e.TipoFluxo == TipoFluxoAprovacao.Desligamento
                && e.Status == StatusAprovacao.Pendente)
            .ToListAsync(ct);
        foreach (var etapa in etapasPendentes)
        {
            etapa.Status = StatusAprovacao.Cancelado;
            etapa.DataUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de desligamento cancelada em cascata",
            "Sua solicitação de desligamento foi cancelada automaticamente porque a vaga origem foi cancelada.",
            "/gestao/painel-solicitacoes",
            ct,
            "info");
    }

    private static bool IsProcessoStep(SolicitacaoAprovacaoEtapa e) =>
        e.AprovadorId == null && e.RoleFilaId == null && e.AcaoEtapa != AcaoEtapa.Nenhuma;

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoDesligamento entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private static SolicitacaoDesligamentoResponse MapToResponse(
        SolicitacaoDesligamento s,
        IReadOnlyList<EtapaAprovacaoResponse> etapaResponses)
    {
        return new SolicitacaoDesligamentoResponse(
            s.Id,
            s.Status,
            s.SolicitanteId,
            s.Solicitante?.Name,
            s.FuncionarioId,
            s.Funcionario?.Name,
            s.EmpresaId,
            s.Empresa?.Description,
            s.UnitId,
            s.Unit?.Name,
            s.HistoricoMedidasDisciplinares,
            s.DataDesligamento,
            s.TipoDesligamento,
            s.MotivoDesligamento,
            s.TipoAvisoPrevio,
            s.DiasAvisoPrevio,
            s.PossuiEstabilidade,
            s.ElegivelRecontratacao,
            s.SubstituirPosicao,
            s.SolicitacaoVagaGeradaId,
            s.SolicitacaoVagaOrigemId,
            s.ObservacaoAprovador,
            s.Observacoes,
            s.CreatedAtUtc,
            s.UpdatedAtUtc,
            s.ApprovedAtUtc,
            s.IntegracaoResultado,
            s.IntegracaoMensagem,
            s.IntegradaEmUtc,
            etapaResponses
        );
    }
}
