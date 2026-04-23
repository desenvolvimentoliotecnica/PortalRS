using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.SolicitacoesPromocao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.SolicitacoesPromocao;

public interface ISolicitacaoPromocaoService
{
    Task<IReadOnlyList<SolicitacaoPromocaoGridRow>> ListAsync(SolicitacaoPromocaoListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse> CreateAsync(SolicitacaoPromocaoCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> UpdateAsync(Guid id, SolicitacaoPromocaoUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> AssumirAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse?> CancelAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPromocaoResponse> CopyAsync(Guid id, CancellationToken ct);
    /// <summary>RH efetiva a movimentação aprovada — move para EmIntegracao, pronta para o Datasul consumir.</summary>
    Task<SolicitacaoPromocaoResponse?> EfetivarAsync(Guid id, CancellationToken ct);
    /// <summary>Datasul confirma resultado da integração — move para Concluida ou registra erro.</summary>
    Task<SolicitacaoPromocaoResponse?> ConfirmarIntegracaoAsync(Guid id, IntegracaoResultado resultado, string? mensagem, CancellationToken ct);
}

public sealed class SolicitacaoPromocaoService : ISolicitacaoPromocaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;
    private readonly IEmailQueueService _emailQueue;
    private readonly IOcupacaoHistoricoService _ocupacaoService;
    private readonly StatusHistoricoService _statusHistorico;

    public SolicitacaoPromocaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        ApprovalWorkflowHelper workflow,
        IEmailQueueService emailQueue,
        IOcupacaoHistoricoService ocupacaoService,
        StatusHistoricoService statusHistorico)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _workflow = workflow;
        _emailQueue = emailQueue;
        _ocupacaoService = ocupacaoService;
        _statusHistorico = statusHistorico;
    }

    public async Task<IReadOnlyList<SolicitacaoPromocaoGridRow>> ListAsync(
        SolicitacaoPromocaoListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesPromocao.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Funcionario)
            .Include(s => s.NovoCargo)
            .AsQueryable();

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);

        if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

        if (query.Statuses is { Length: > 0 })
            q = q.Where(s => query.Statuses.Contains(s.Status));

        if (query.AreaId.HasValue)
            q = q.Where(s => s.Funcionario != null && s.Funcionario.AreaId == query.AreaId.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(s =>
                (s.Funcionario != null && s.Funcionario.Name.ToLower().Contains(term)) ||
                s.Justificativa.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        var rawRows = await q.Select(s => new
        {
            s.Id, s.Status,
            SolicitanteNome = s.Solicitante != null ? s.Solicitante.Name : (string?)null,
            FuncionarioNome = s.Funcionario != null ? s.Funcionario.Name : (string?)null,
            NovoCargoNome = s.NovoCargo != null ? s.NovoCargo.Name : (string?)null,
            s.DataEfetiva, s.CreatedAtUtc,
        }).ToListAsync(ct);

        var ids = rawRows.Select(r => r.Id).ToList();
        var etapasPendentes = await _workflow.GetEtapasPendentesAsync(
            ids, TipoFluxoAprovacao.MovimentacaoPessoal, ct, currentUserId: _currentUser.UserId);

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            return new SolicitacaoPromocaoGridRow(
                r.Id, r.Status, r.SolicitanteNome, r.FuncionarioNome,
                r.NovoCargoNome, r.DataEfetiva, r.CreatedAtUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId,
                ep?.AssumedByUserId,
                ep?.CanAssume ?? false);
        }).ToList();
    }

    public async Task<SolicitacaoPromocaoResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesPromocao.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Funcionario)
            .Include(x => x.CargoAtual)
            .Include(x => x.NovoCargo)
            .Include(x => x.AreaAtual)
            .Include(x => x.NovaArea)
            .Include(x => x.NovaUnidade)
            .Include(x => x.Empresa)
            .Include(x => x.Unit)
            .Include(x => x.CentroCusto)
            .Include(x => x.UnidadeLotacao)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

        var etapas = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .Include(e => e.Aprovador)
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var etapaDtos = await _workflow.MapEtapasToAprovacaoResponsesAsync(etapas, ct);
        return MapToResponse(s, etapaDtos);
    }

    public async Task<SolicitacaoPromocaoResponse> CreateAsync(
        SolicitacaoPromocaoCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        // Auto-fill CargoAtualId and AreaAtualId from the selected Funcionario
        var funcionario = await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FuncionarioId, ct);

        var cargoAtualId = request.CargoAtualId ?? funcionario?.JobPositionId;
        var areaAtualId = request.AreaAtualId ?? funcionario?.AreaId;

        var entity = new SolicitacaoPromocao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            FuncionarioId = request.FuncionarioId,
            DataEfetiva = request.DataEfetiva,
            CargoAtualId = cargoAtualId,
            NovoCargoId = request.NovoCargoId,
            AreaAtualId = areaAtualId,
            NovaAreaId = request.NovaAreaId,
            NovaUnidadeId = request.NovaUnidadeId,
            EmpresaId = request.EmpresaId,
            UnitId = request.UnitId,
            CentroCustoId = request.CentroCustoId,
            UnidadeLotacaoId = request.UnidadeLotacaoId,
            NovaLocalidade = request.NovaLocalidade,
            NovoSalario = request.NovoSalario,
            NovaPericulosidade = request.NovaPericulosidade,
            NovaRemuneracao = request.NovaRemuneracao,
            HorarioProposto = request.HorarioProposto,
            MotivoMovimentacao = request.MotivoMovimentacao,
            Justificativa = request.Justificativa,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesPromocao.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoPromocaoResponse?> UpdateAsync(
        Guid id, SolicitacaoPromocaoUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        // Auto-fill CargoAtualId and AreaAtualId from the selected Funcionario
        var funcionario = await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FuncionarioId, ct);

        entity.FuncionarioId = request.FuncionarioId;
        entity.DataEfetiva = request.DataEfetiva;
        entity.CargoAtualId = request.CargoAtualId ?? funcionario?.JobPositionId;
        entity.NovoCargoId = request.NovoCargoId;
        entity.AreaAtualId = request.AreaAtualId ?? funcionario?.AreaId;
        entity.NovaAreaId = request.NovaAreaId;
        entity.NovaUnidadeId = request.NovaUnidadeId;
        entity.EmpresaId = request.EmpresaId;
        entity.UnitId = request.UnitId;
        entity.CentroCustoId = request.CentroCustoId;
        entity.UnidadeLotacaoId = request.UnidadeLotacaoId;
        entity.NovaLocalidade = request.NovaLocalidade;
        entity.NovoSalario = request.NovoSalario;
        entity.NovaPericulosidade = request.NovaPericulosidade;
        entity.NovaRemuneracao = request.NovaRemuneracao;
        entity.HorarioProposto = request.HorarioProposto;
        entity.MotivoMovimentacao = request.MotivoMovimentacao;
        entity.Justificativa = request.Justificativa;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        var statusAnteriorSubmit = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
            statusAnteriorSubmit, entity.Status.ToString(), _currentUser, null, ct);

        // Remove etapas anteriores (re-submit)
        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        // Resolve and create new etapas
        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, entity.FuncionarioId, TipoFluxoAprovacao.MovimentacaoPessoal, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.MovimentacaoPessoal,
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

        // Notify first step (first human step after any auto-processed process steps)
        if (primeiraEtapa is not null)
        {
            var nomeFuncionario = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct))?.Name ?? "um funcionário";
            var nomeSolicitante = (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";

            if (primeiraEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    primeiraEtapa.AprovadorId.Value,
                    "Nova solicitação de movimentação para aprovação",
                    $"{nomeSolicitante} solicitou a movimentação de {nomeFuncionario}.",
                    "/gestao/solicitacoes",
                    ct);
            }
        }

        return true;
    }

    public async Task<SolicitacaoPromocaoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // Valida faixa salarial — bloqueia ou marca flag conforme política do tenant
        await ValidatePayRangeAsync(entity, ct);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal && e.Status == StatusAprovacao.Pendente)
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
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal)
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

        var statusAnteriorApprove = entity.Status.ToString();
        if (proximaEtapa is not null)
        {
            entity.Status = proximaEtapa.RoleFilaId.HasValue
                ? SolicitacaoStatus.PendenteAprovacaoRh
                : SolicitacaoStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.ObservacaoAprovador = observacao;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
                statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de movimentação aguarda sua aprovação",
                    $"Uma etapa anterior foi aprovada. Agora é a etapa \"{proximaEtapa.Label}\" aguardando sua ação.",
                    "/gestao/solicitacoes",
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
                TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
                statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

            var funcionario = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct);
            if (funcionario is not null)
            {
                funcionario.JobPositionId = entity.NovoCargoId;
                if (entity.NovaAreaId.HasValue)
                    funcionario.AreaId = entity.NovaAreaId;
                funcionario.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            // Fecha ocupação no cargo antigo e abre no novo
            await _ocupacaoService.FecharOcupacaoAsync(
                entity.FuncionarioId, MotivoSaidaOcupacao.Promocao, entity.Id, ct);

            if (funcionario?.JobPositionId.HasValue == true &&
                funcionario.UnidadeLotacaoId.HasValue &&
                funcionario.CentroCustoId.HasValue)
            {
                var vagaAlvo = await _db.Vagas.FirstOrDefaultAsync(v =>
                    v.JobPositionId == funcionario.JobPositionId &&
                    v.UnidadeLotacaoId == funcionario.UnidadeLotacaoId &&
                    v.CentroCustoId == funcionario.CentroCustoId, ct);

                if (vagaAlvo is not null)
                {
                    await _ocupacaoService.AbrirOcupacaoAsync(
                        funcionario.Id, vagaAlvo.Id, DateTime.UtcNow, entity.Id, ct);
                }
            }

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de movimentação aprovada",
                "Sua solicitação de movimentação de pessoal foi aprovada.",
                "/gestao/solicitacoes",
                ct);

            var solicitante = await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct);
            if (!string.IsNullOrWhiteSpace(solicitante?.Email))
            {
                var obsHtml = !string.IsNullOrWhiteSpace(observacao)
                    ? $"<p><strong>Observação:</strong> {observacao}</p>" : "";
                await _emailQueue.EnqueueRawAsync(
                    solicitante.Email,
                    "Solicitação de movimentação aprovada",
                    $"<p>Olá {solicitante.Name},</p><p>Sua solicitação de movimentação de pessoal foi <strong>aprovada</strong>.</p>{obsHtml}",
                    null, false, "SolicitacaoPromocao", ct);
            }
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal && e.Status == StatusAprovacao.Pendente)
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
            TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
            statusAnteriorReject, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de movimentação reprovada",
            "Sua solicitação de movimentação foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            "/gestao/solicitacoes",
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
                "Solicitação de movimentação reprovada",
                $"<p>Olá {solicitanteReject.Name},</p><p>Sua solicitação de movimentação foi <strong>reprovada</strong>.</p>{obsHtml}",
                null, false, "SolicitacaoPromocao", ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // etapaAtual stays Pendente — the solicitante fixes and resubmits (SubmitAsync will reset etapas)
        var statusAnteriorChanges = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
            statusAnteriorChanges, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de movimentação",
            "Sua solicitação de movimentação de pessoal precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            "/gestao/solicitacoes",
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
                "Ajustes necessários na solicitação de movimentação",
                $"<p>Olá {solicitanteChanges.Name},</p><p>Sua solicitação de movimentação precisa de <strong>ajustes</strong>.</p>{obsHtml}",
                null, false, "SolicitacaoPromocao", ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> EfetivarAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.Aprovada)
            throw new InvalidOperationException("Apenas solicitações com status Aprovada podem ser efetivadas.");

        var statusAnteriorEfetivar = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.EmIntegracao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
            statusAnteriorEfetivar, entity.Status.ToString(), _currentUser, null, ct);

        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> ConfirmarIntegracaoAsync(
        Guid id, IntegracaoResultado resultado, string? mensagem, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != SolicitacaoStatus.EmIntegracao)
            throw new InvalidOperationException("Apenas solicitações em EmIntegracao podem ter o resultado confirmado.");

        entity.IntegracaoResultado = resultado;
        entity.IntegracaoMensagem = mensagem;
        entity.IntegradaEmUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (resultado == IntegracaoResultado.Sucesso)
        {
            var statusAnteriorIntegracao = entity.Status.ToString();
            entity.Status = SolicitacaoStatus.Concluida;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
                statusAnteriorIntegracao, entity.Status.ToString(), _currentUser, null, ct);
        }
        // Erro: mantém EmIntegracao para o RH visualizar e reprocessar

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesPromocao.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<SolicitacaoPromocaoResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Não há etapa pendente para assumir.");

        // Queue with profile OR legacy orphan consenso step (both null).
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

        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> CancelAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status == SolicitacaoStatus.Rascunho)
            throw new InvalidOperationException("Rascunhos não podem ser cancelados — utilize Excluir.");

        if (entity.Status == SolicitacaoStatus.Aprovada || entity.Status == SolicitacaoStatus.Cancelada)
            throw new InvalidOperationException("Solicitação não pode ser cancelada no status atual.");

        var statusAnteriorCancel = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoPromocao, entity.Id,
            statusAnteriorCancel, entity.Status.ToString(), _currentUser, null, ct);

        var etapasPendentes = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id
                && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal
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

    public async Task<SolicitacaoPromocaoResponse> CopyAsync(Guid id, CancellationToken ct)
    {
        var source = await _db.SolicitacoesPromocao
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new InvalidOperationException("Solicitação não encontrada.");

        var copy = new SolicitacaoPromocao
        {
            Id = Guid.NewGuid(),
            TenantId = source.TenantId,
            SolicitanteId = source.SolicitanteId,
            FuncionarioId = source.FuncionarioId,
            DataEfetiva = source.DataEfetiva,
            CargoAtualId = source.CargoAtualId,
            NovoCargoId = source.NovoCargoId,
            AreaAtualId = source.AreaAtualId,
            NovaAreaId = source.NovaAreaId,
            NovaUnidadeId = source.NovaUnidadeId,
            EmpresaId = source.EmpresaId,
            UnitId = source.UnitId,
            CentroCustoId = source.CentroCustoId,
            UnidadeLotacaoId = source.UnidadeLotacaoId,
            MotivoMovimentacao = source.MotivoMovimentacao,
            NovaLocalidade = source.NovaLocalidade,
            NovoSalario = source.NovoSalario,
            NovaPericulosidade = source.NovaPericulosidade,
            NovaRemuneracao = source.NovaRemuneracao,
            HorarioProposto = source.HorarioProposto,
            Justificativa = source.Justificativa,
            Observacoes = source.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.SolicitacoesPromocao.Add(copy);
        await _db.SaveChangesAsync(ct);
        return (await GetByIdAsync(copy.Id, ct))!;
    }

    private static bool IsProcessoStep(SolicitacaoAprovacaoEtapa e) =>
        e.AprovadorId == null && e.RoleFilaId == null && e.AcaoEtapa != AcaoEtapa.Nenhuma;

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoPromocao entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private static SolicitacaoPromocaoResponse MapToResponse(
        SolicitacaoPromocao s,
        IReadOnlyList<EtapaAprovacaoResponse> etapaResponses)
    {
        return new SolicitacaoPromocaoResponse(
            s.Id,
            s.Status,
            s.SolicitanteId,
            s.Solicitante?.Name,
            s.FuncionarioId,
            s.Funcionario?.Name,
            s.DataEfetiva,
            s.CargoAtualId,
            s.CargoAtual?.Name,
            s.NovoCargoId,
            s.NovoCargo?.Name,
            s.AreaAtualId,
            s.AreaAtual?.Name,
            s.NovaAreaId,
            s.NovaArea?.Name,
            s.NovaUnidadeId,
            s.NovaUnidade?.Name,
            s.EmpresaId,
            s.Empresa?.Description,
            s.UnitId,
            s.Unit?.Name,
            s.CentroCustoId,
            s.CentroCusto?.Description,
            s.UnidadeLotacaoId,
            s.UnidadeLotacao?.Description,
            s.NovaLocalidade,
            s.NovoSalario,
            s.NovaPericulosidade,
            s.NovaRemuneracao,
            s.HorarioProposto,
            s.MotivoMovimentacao,
            s.Justificativa,
            s.ObservacaoAprovador,
            s.Observacoes,
            s.CreatedAtUtc,
            s.UpdatedAtUtc,
            s.ApprovedAtUtc,
            s.IntegracaoResultado,
            s.IntegracaoMensagem,
            s.IntegradaEmUtc,
            etapaResponses.ToList()
        );
    }

    /// <summary>
    /// Valida se o NovoSalario está dentro da faixa configurada para o novo cargo + estabelecimento.
    /// Comportamento:
    ///  - Sem NovoSalario → retorna (nada a validar)
    ///  - Sem faixa cadastrada para o cargo → retorna (nada a validar)
    ///  - Fora da faixa + BloqueiaSalarioForaFaixa=true → lança InvalidOperationException
    ///  - Fora da faixa + BloqueiaSalarioForaFaixa=false → apenas marca ForaFaixaSalarial=true
    /// </summary>
    private async Task ValidatePayRangeAsync(SolicitacaoPromocao entity, CancellationToken ct)
    {
        if (!entity.NovoSalario.HasValue) return;

        var config = await _db.Set<RhPortal.Api.Domain.Entities.TenantConfiguracao>().AsNoTracking().FirstOrDefaultAsync(ct);
        var bloqueia = config?.BloqueiaSalarioForaFaixa ?? false;

        var estabelecimento = await _db.Set<Funcionario>().AsNoTracking()
            .Where(f => f.Id == entity.FuncionarioId)
            .Select(f => f.CdnEstab)
            .FirstOrDefaultAsync(ct);

        // Busca faixa: prioriza estabelecimento específico; fallback para faixa sem estabelecimento
        var faixa = await _db.Set<FaixaSalarial>().AsNoTracking()
            .FirstOrDefaultAsync(f =>
                f.JobPositionId == entity.NovoCargoId &&
                f.EstabelecimentoCodigo == estabelecimento, ct);

        if (faixa is null && !string.IsNullOrWhiteSpace(estabelecimento))
        {
            faixa = await _db.Set<FaixaSalarial>().AsNoTracking()
                .FirstOrDefaultAsync(f =>
                    f.JobPositionId == entity.NovoCargoId &&
                    f.EstabelecimentoCodigo == null, ct);
        }

        if (faixa is null)
        {
            // Sem faixa cadastrada — não há como validar. Limpa flag.
            entity.ForaFaixaSalarial = false;
            return;
        }

        var forafaixa =
            entity.NovoSalario.Value < faixa.SalarioMinimo ||
            entity.NovoSalario.Value > faixa.SalarioMaximo;
        entity.ForaFaixaSalarial = forafaixa;

        if (forafaixa && bloqueia)
        {
            throw new InvalidOperationException(
                $"Salário proposto (R$ {entity.NovoSalario.Value:N2}) está fora da faixa " +
                $"configurada para o novo cargo (R$ {faixa.SalarioMinimo:N2} a R$ {faixa.SalarioMaximo:N2}). " +
                "Ajuste o valor ou altere a política de bloqueio nas configurações do tenant.");
        }
    }
}
