using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.SolicitacoesFerias;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesFerias;

public interface ISolicitacaoFeriasService
{
    Task<IReadOnlyList<SolicitacaoFeriasGridRow>> ListAsync(SolicitacaoFeriasListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoFeriasResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoFeriasResponse> CreateAsync(SolicitacaoFeriasCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoFeriasResponse?> UpdateAsync(Guid id, SolicitacaoFeriasUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoFeriasResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoFeriasResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoFeriasResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoFeriasResponse?> AssumirAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoFeriasService : ISolicitacaoFeriasService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;
    private readonly StatusHistoricoService _statusHistorico;

    public SolicitacaoFeriasService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        ApprovalWorkflowHelper workflow,
        StatusHistoricoService statusHistorico)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _workflow = workflow;
        _statusHistorico = statusHistorico;
    }

    public async Task<IReadOnlyList<SolicitacaoFeriasGridRow>> ListAsync(
        SolicitacaoFeriasListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesFerias.AsNoTracking()
            .Include(s => s.Solicitante)
            .AsQueryable();

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);

        if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

        if (query.Statuses is { Length: > 0 })
            q = q.Where(s => query.Statuses.Contains(s.Status));

        if (query.AreaId.HasValue)
            q = q.Where(s => s.Solicitante != null && s.Solicitante.AreaId == query.AreaId.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(s => (s.Solicitante != null && s.Solicitante.Name.ToLower().Contains(term))
                          || (s.PeriodoAquisitivo != null && s.PeriodoAquisitivo.ToLower().Contains(term)));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        var rawRows = await q.Select(s => new
        {
            s.Id, s.Status,
            SolicitanteNome = s.Solicitante != null ? s.Solicitante.Name : (string?)null,
            s.DataInicio, s.DataFim, s.QtdDias, s.AbonoPecuniario, s.CreatedAtUtc,
        }).ToListAsync(ct);

        var ids = rawRows.Select(r => r.Id).ToList();
        var etapasPendentes = await _workflow.GetEtapasPendentesAsync(
            ids, TipoFluxoAprovacao.Ferias, ct, currentUserId: _currentUser.UserId);

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            return new SolicitacaoFeriasGridRow(
                r.Id, r.Status, r.SolicitanteNome,
                r.DataInicio, r.DataFim, r.QtdDias, r.AbonoPecuniario, r.CreatedAtUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId,
                ep?.CanAssume ?? false);
        }).ToList();
    }

    public async Task<SolicitacaoFeriasResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesFerias.AsNoTracking()
            .Include(x => x.Solicitante)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

        var etapas = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .Include(e => e.Aprovador)
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Ferias)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var etapaDtos = await _workflow.MapEtapasToAprovacaoResponsesAsync(etapas, ct);
        return MapToResponse(s, etapaDtos);
    }

    public async Task<SolicitacaoFeriasResponse> CreateAsync(
        SolicitacaoFeriasCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        // Validação de abono pecuniário (CLT: máx 1/3 = 10 dias)
        if (request.AbonoPecuniario && request.DiasAbono > 10)
            throw new InvalidOperationException("O abono pecuniário não pode exceder 10 dias.");

        // Auto-calc QtdDias if not provided
        var qtdDias = request.QtdDias > 0
            ? request.QtdDias
            : request.DataFim.DayNumber - request.DataInicio.DayNumber + 1;

        var now = DateTimeOffset.UtcNow;
        var entity = new SolicitacaoFerias
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            PeriodoAquisitivo = request.PeriodoAquisitivo,
            DataInicio = request.DataInicio,
            DataFim = request.DataFim,
            QtdDias = qtdDias,
            AbonoPecuniario = request.AbonoPecuniario,
            DiasAbono = request.AbonoPecuniario ? Math.Min(request.DiasAbono, 10) : 0,
            Adiantamento13 = request.Adiantamento13,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.SolicitacoesFerias.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoFeriasResponse?> UpdateAsync(
        Guid id, SolicitacaoFeriasUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        if (request.AbonoPecuniario && request.DiasAbono > 10)
            throw new InvalidOperationException("O abono pecuniário não pode exceder 10 dias.");

        entity.PeriodoAquisitivo = request.PeriodoAquisitivo;
        entity.DataInicio = request.DataInicio;
        entity.DataFim = request.DataFim;
        entity.QtdDias = request.QtdDias > 0
            ? request.QtdDias
            : request.DataFim.DayNumber - request.DataInicio.DayNumber + 1;
        entity.AbonoPecuniario = request.AbonoPecuniario;
        entity.DiasAbono = request.AbonoPecuniario ? Math.Min(request.DiasAbono, 10) : 0;
        entity.Adiantamento13 = request.Adiantamento13;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

        public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        var statusAnteriorSubmit = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoFerias, entity.Id,
            statusAnteriorSubmit, entity.Status.ToString(), _currentUser, ct: ct);

        // Remove etapas anteriores
        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Ferias);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        // Instancia as novas
        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, null, TipoFluxoAprovacao.Ferias, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.Ferias,
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

        // Notificar aprovador1 (ou fila)
        if (primeiraEtapa is not null && primeiraEtapa.AprovadorId.HasValue)
        {
            var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";

            await _workflow.NotifyByFuncionarioIdAsync(
                primeiraEtapa.AprovadorId.Value,
                "Nova solicitação de férias para aprovação",
                $"{solicitanteNome} abriu uma solicitação de férias ({entity.DataInicio:dd/MM/yyyy} a {entity.DataFim:dd/MM/yyyy}).",
                $"/colaborador/solicitacoes-ferias/{entity.Id}",
                ct);
        }

        return true;
    }

        public async Task<SolicitacaoFeriasResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Ferias && e.Status == StatusAprovacao.Pendente)
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
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Ferias)
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
            entity.Status = proximaEtapa.Label.Contains("RH") ? SolicitacaoStatus.PendenteAprovacaoRh : SolicitacaoStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.ObservacaoAprovador = observacao;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoFerias, entity.Id,
                statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de férias aguarda sua aprovação",
                    $"A solicitação foi aprovada na etapa anterior e aguarda sua ação.",
                    $"/colaborador/solicitacoes-ferias/{entity.Id}",
                    ct);
            }
        }
        else
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ObservacaoAprovador = observacao;
            entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoFerias, entity.Id,
                statusAnteriorApprove, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de férias aprovada",
                $"Sua solicitação de férias ({entity.DataInicio:dd/MM/yyyy} a {entity.DataFim:dd/MM/yyyy}) foi aprovada.",
                $"/colaborador/solicitacoes-ferias/{entity.Id}",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

        public async Task<SolicitacaoFeriasResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Ferias && e.Status == StatusAprovacao.Pendente)
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
            TipoEntidadeStatus.SolicitacaoFerias, entity.Id,
            statusAnteriorReject, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de férias reprovada",
            $"Sua solicitação de férias ({entity.DataInicio:dd/MM/yyyy} a {entity.DataFim:dd/MM/yyyy}) foi reprovada."
                + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/colaborador/solicitacoes-ferias/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

        public async Task<SolicitacaoFeriasResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var statusAnteriorChanges = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoFerias, entity.Id,
            statusAnteriorChanges, entity.Status.ToString(), _currentUser, observacao, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de férias",
            $"Sua solicitação de férias precisa de ajustes."
                + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/colaborador/solicitacoes-ferias/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesFerias.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

        public async Task<SolicitacaoFeriasResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Ferias && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null || !etapaAtual.RoleFilaId.HasValue)
            throw new InvalidOperationException("Esta etapa não é uma fila de perfil para ser assumida.");

        if (etapaAtual.AprovadorId.HasValue)
            throw new InvalidOperationException("Esta etapa já foi assumida por outro usuário.");

        if (!await _workflow.CanAssumeRoleQueueAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não pertence ao perfil designado para assumir esta etapa.");

        etapaAtual.AprovadorId = _currentUser.FuncionarioId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    private static bool IsProcessoStep(SolicitacaoAprovacaoEtapa e) =>
        e.AprovadorId == null && e.RoleFilaId == null && e.AcaoEtapa != AcaoEtapa.Nenhuma;

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoFerias entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private static SolicitacaoFeriasResponse MapToResponse(
        SolicitacaoFerias s,
        IReadOnlyList<EtapaAprovacaoResponse> etapaResponses) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.PeriodoAquisitivo, s.DataInicio, s.DataFim, s.QtdDias,
        s.AbonoPecuniario, s.DiasAbono, s.Adiantamento13,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc,
        s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc,
        etapaResponses.ToList()
    );
}
