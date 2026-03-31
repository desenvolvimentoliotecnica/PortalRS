using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.SolicitacoesBeneficio;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesBeneficio;

public interface ISolicitacaoBeneficioService
{
    Task<IReadOnlyList<SolicitacaoBeneficioGridRow>> ListAsync(SolicitacaoBeneficioListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoBeneficioResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoBeneficioResponse> CreateAsync(SolicitacaoBeneficioCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoBeneficioResponse?> UpdateAsync(Guid id, SolicitacaoBeneficioUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoBeneficioResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoBeneficioResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoBeneficioResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoBeneficioService : ISolicitacaoBeneficioService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoBeneficioService(
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

    public async Task<IReadOnlyList<SolicitacaoBeneficioGridRow>> ListAsync(
        SolicitacaoBeneficioListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesBeneficio.AsNoTracking()
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
                          || s.Descricao.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        return await q.Select(s => new SolicitacaoBeneficioGridRow(
            s.Id, s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.TipoBeneficio, s.TipoAlteracao,
            s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoBeneficioResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesBeneficio.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
    }

    public async Task<SolicitacaoBeneficioResponse> CreateAsync(
        SolicitacaoBeneficioCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        var now = DateTimeOffset.UtcNow;
        var entity = new SolicitacaoBeneficio
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            TipoBeneficio = request.TipoBeneficio,
            TipoAlteracao = request.TipoAlteracao,
            Descricao = request.Descricao,
            IncluirDependentes = request.IncluirDependentes,
            DependenteIdsJson = request.DependenteIdsJson,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.SolicitacoesBeneficio.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoBeneficioResponse?> UpdateAsync(
        Guid id, SolicitacaoBeneficioUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.TipoBeneficio = request.TipoBeneficio;
        entity.TipoAlteracao = request.TipoAlteracao;
        entity.Descricao = request.Descricao;
        entity.IncluirDependentes = request.IncluirDependentes;
        entity.DependenteIdsJson = request.DependenteIdsJson;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
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

        if (entity.Aprovador1Id.HasValue)
        {
            var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.Aprovador1Id.Value,
                "Nova solicitação de benefício para aprovação",
                $"{solicitanteNome} abriu uma solicitação de alteração de benefício.",
                $"/colaborador/solicitacoes-beneficio/{entity.Id}",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoBeneficioResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Aprovada;
        entity.ObservacaoAprovador = observacao;
        entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de benefício aprovada",
            "Sua solicitação de alteração de benefício foi aprovada.",
            $"/colaborador/solicitacoes-beneficio/{entity.Id}",
            ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoBeneficioResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de benefício reprovada",
            "Sua solicitação de alteração de benefício foi reprovada."
                + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/colaborador/solicitacoes-beneficio/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoBeneficioResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de benefício",
            "Sua solicitação de alteração de benefício precisa de ajustes."
                + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/colaborador/solicitacoes-beneficio/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesBeneficio.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static SolicitacaoBeneficioResponse MapToResponse(SolicitacaoBeneficio s) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.TipoBeneficio, s.TipoAlteracao,
        s.Descricao, s.IncluirDependentes, s.DependenteIdsJson,
        s.Aprovador1Id, s.Aprovador1?.Name, s.Aprovador1Status, s.Aprovador1DataUtc,
        s.Aprovador2Id, s.Aprovador2?.Name, s.Aprovador2Status, s.Aprovador2DataUtc,
        s.Aprovador2Habilitado,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc
    );
}
