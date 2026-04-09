using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.SolicitacoesPagamentoExtra;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesPagamentoExtra;

public interface ISolicitacaoPagamentoExtraService
{
    Task<IReadOnlyList<SolicitacaoPagamentoExtraGridRow>> ListAsync(SolicitacaoPagamentoExtraListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse> CreateAsync(SolicitacaoPagamentoExtraCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> UpdateAsync(Guid id, SolicitacaoPagamentoExtraUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoPagamentoExtraService : ISolicitacaoPagamentoExtraService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoPagamentoExtraService(
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

    public async Task<IReadOnlyList<SolicitacaoPagamentoExtraGridRow>> ListAsync(
        SolicitacaoPagamentoExtraListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesPagamentoExtra.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Funcionario)
            .AsQueryable();

        if (!_currentUser.IsAdmin && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);

        if (query.ApenasMeus == true && currentFuncionarioId.HasValue)
            q = q.Where(s => s.SolicitanteId == currentFuncionarioId.Value);

        if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(s =>
                (s.Funcionario != null && s.Funcionario.Name.ToLower().Contains(term)) ||
                s.Descricao.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        return await q.Select(s => new SolicitacaoPagamentoExtraGridRow(
            s.Id, s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.Funcionario != null ? s.Funcionario.Name : null,
            s.TipoPagamentoExtra,
            s.Valor, s.DataPagamento,
            s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesPagamentoExtra.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Funcionario)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
    }

    public async Task<SolicitacaoPagamentoExtraResponse> CreateAsync(
        SolicitacaoPagamentoExtraCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        var now = DateTimeOffset.UtcNow;
        var entity = new SolicitacaoPagamentoExtra
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            FuncionarioId = request.FuncionarioId,
            TipoPagamentoExtra = request.TipoPagamentoExtra,
            Valor = request.Valor,
            Descricao = request.Descricao,
            DataPagamento = request.DataPagamento,
            Competencia = request.Competencia,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.SolicitacoesPagamentoExtra.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> UpdateAsync(
        Guid id, SolicitacaoPagamentoExtraUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.FuncionarioId = request.FuncionarioId;
        entity.TipoPagamentoExtra = request.TipoPagamentoExtra;
        entity.Valor = request.Valor;
        entity.Descricao = request.Descricao;
        entity.DataPagamento = request.DataPagamento;
        entity.Competencia = request.Competencia;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var resolution = await _workflow.ResolveApproversAsync(
            entity.SolicitanteId, entity.Aprovador2Habilitado, ct);

        entity.Aprovador1Id = resolution.Aprovador1Id;
        entity.Aprovador1Status = StatusAprovacao.Pendente;
        entity.Aprovador2Habilitado = resolution.Aprovador2Habilitado;

        if (resolution.Aprovador2Id.HasValue)
        {
            entity.Aprovador2Id = resolution.Aprovador2Id;
            entity.Aprovador2Status = StatusAprovacao.Pendente;
        }

        await _db.SaveChangesAsync(ct);

        if (entity.Aprovador1Id.HasValue)
        {
            var solicitante = await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct);
            var funcionario = await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct);
            var solicitanteNome = solicitante?.Name ?? "Alguém";
            var funcionarioNome = funcionario?.Name ?? "um funcionário";

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.Aprovador1Id.Value,
                "Nova solicitação de pagamento extra para aprovação",
                $"{solicitanteNome} solicitou um pagamento extra para {funcionarioNome}.",
                $"/colaborador/solicitacoes-pagamento-extra/{entity.Id}",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Aprovada;
        entity.ObservacaoAprovador = observacao;
        entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de pagamento extra aprovada",
            "Sua solicitação de pagamento extra foi aprovada." + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/colaborador/solicitacoes-pagamento-extra/{entity.Id}",
            ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de pagamento extra reprovada",
            "Sua solicitação de pagamento extra foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/colaborador/solicitacoes-pagamento-extra/{entity.Id}",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de pagamento extra",
            "Sua solicitação de pagamento extra precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/colaborador/solicitacoes-pagamento-extra/{entity.Id}",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesPagamentoExtra.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static SolicitacaoPagamentoExtraResponse MapToResponse(SolicitacaoPagamentoExtra s) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.FuncionarioId, s.Funcionario?.Name,
        s.TipoPagamentoExtra, s.Valor,
        s.Descricao, s.DataPagamento, s.Competencia,
        s.Aprovador1Id, s.Aprovador1?.Name, s.Aprovador1Status, s.Aprovador1DataUtc,
        s.Aprovador2Id, s.Aprovador2?.Name, s.Aprovador2Status, s.Aprovador2DataUtc,
        s.Aprovador2Habilitado,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc,
        s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc
    );
}
