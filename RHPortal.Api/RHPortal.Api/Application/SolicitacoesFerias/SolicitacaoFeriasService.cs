using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
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
}

public sealed class SolicitacaoFeriasService : ISolicitacaoFeriasService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoFeriasService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        ApprovalWorkflowHelper workflow)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _workflow = workflow;
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

        return await q.Select(s => new SolicitacaoFeriasGridRow(
            s.Id, s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.DataInicio, s.DataFim, s.QtdDias,
            s.AbonoPecuniario, s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoFeriasResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesFerias.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
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

        var resolution = await _workflow.ResolveApproversAsync(entity.SolicitanteId, entity.Aprovador2Habilitado, ct);

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.Aprovador1Id = resolution.Aprovador1Id;
        entity.Aprovador1Status = StatusAprovacao.Pendente;
        entity.Aprovador2Habilitado = resolution.Aprovador2Habilitado;
        entity.Aprovador2Id = resolution.Aprovador2Id;
        if (resolution.Aprovador2Habilitado)
            entity.Aprovador2Status = StatusAprovacao.Pendente;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Notificar aprovador1
        if (entity.Aprovador1Id.HasValue)
        {
            var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.Aprovador1Id.Value,
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

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Aprovada;
        entity.ObservacaoAprovador = observacao;
        entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Notificar solicitante
        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de férias aprovada",
            $"Sua solicitação de férias ({entity.DataInicio:dd/MM/yyyy} a {entity.DataFim:dd/MM/yyyy}) foi aprovada.",
            $"/colaborador/solicitacoes-ferias/{entity.Id}",
            ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoFeriasResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

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

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

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

    private static SolicitacaoFeriasResponse MapToResponse(SolicitacaoFerias s) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.PeriodoAquisitivo, s.DataInicio, s.DataFim, s.QtdDias,
        s.AbonoPecuniario, s.DiasAbono, s.Adiantamento13,
        s.Aprovador1Id, s.Aprovador1?.Name, s.Aprovador1Status, s.Aprovador1DataUtc,
        s.Aprovador2Id, s.Aprovador2?.Name, s.Aprovador2Status, s.Aprovador2DataUtc,
        s.Aprovador2Habilitado,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc
    );
}
