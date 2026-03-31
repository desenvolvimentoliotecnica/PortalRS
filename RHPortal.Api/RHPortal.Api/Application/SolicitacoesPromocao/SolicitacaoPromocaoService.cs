using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.SolicitacoesPromocao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

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
}

public sealed class SolicitacaoPromocaoService : ISolicitacaoPromocaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoPromocaoService(
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

    public async Task<IReadOnlyList<SolicitacaoPromocaoGridRow>> ListAsync(
        SolicitacaoPromocaoListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesPromocao.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Funcionario)
            .Include(s => s.NovoCargo)
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
                s.Justificativa.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        return await q.Select(s => new SolicitacaoPromocaoGridRow(
            s.Id,
            s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.Funcionario != null ? s.Funcionario.Name : null,
            s.NovoCargo != null ? s.NovoCargo.Name : null,
            s.DataEfetiva,
            s.CreatedAtUtc
        )).ToListAsync(ct);
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
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
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

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Resolve aprovadores via cadeia de GestorDireto
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

        // Notificar aprovador1 sobre nova solicitação pendente
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
                "Nova solicitação de promoção para aprovação",
                $"{solicitanteNome} solicitou a promoção de {funcionarioNome}.",
                $"/rh/solicitacoes-promocao/{entity.Id}",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoPromocaoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Aprovada;
        entity.ObservacaoAprovador = observacao;
        entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Atualizar cargo e área do funcionário
        var funcionario = await _db.Set<Funcionario>()
            .FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct);

        if (funcionario is not null)
        {
            funcionario.JobPositionId = entity.NovoCargoId;
            if (entity.NovaAreaId.HasValue)
                funcionario.AreaId = entity.NovaAreaId;
            funcionario.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        // Notificar solicitante que a solicitação foi aprovada
        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de promoção aprovada",
            "Sua solicitação de promoção foi aprovada." + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/rh/solicitacoes-promocao/{entity.Id}",
            ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de promoção reprovada",
            "Sua solicitação de promoção foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/rh/solicitacoes-promocao/{entity.Id}",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de promoção",
            "Sua solicitação de promoção precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/rh/solicitacoes-promocao/{entity.Id}",
            ct,
            "warning");

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

    private static SolicitacaoPromocaoResponse MapToResponse(SolicitacaoPromocao s) => new(
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
        s.Justificativa,
        // Approval chain
        s.Aprovador1Id,
        s.Aprovador1?.Name,
        s.Aprovador1Status,
        s.Aprovador1DataUtc,
        s.Aprovador2Id,
        s.Aprovador2?.Name,
        s.Aprovador2Status,
        s.Aprovador2DataUtc,
        s.Aprovador2Habilitado,
        s.ObservacaoAprovador,
        s.Observacoes,
        s.CreatedAtUtc,
        s.UpdatedAtUtc,
        s.ApprovedAtUtc
    );
}
