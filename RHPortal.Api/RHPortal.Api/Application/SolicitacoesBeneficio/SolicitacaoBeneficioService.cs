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
    Task<SolicitacaoBeneficioResponse?> AssumirAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoBeneficioService : ISolicitacaoBeneficioService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;
    private readonly StatusHistoricoService _statusHistorico;

    public SolicitacaoBeneficioService(
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

        if (query.Statuses is { Length: > 0 })
            q = q.Where(s => query.Statuses.Contains(s.Status));

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

        var statusAnteriorSubmitBen = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoBeneficio, entity.Id,
            statusAnteriorSubmitBen, entity.Status.ToString(), _currentUser, ct: ct);

        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Beneficio);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, null, TipoFluxoAprovacao.Beneficio, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.Beneficio,
            Ordem = r.Ordem,
            Label = r.Label,
            AprovadorId = r.AprovadorId,
            RoleFilaId = r.RoleFilaId,
            AcaoEtapa = r.AcaoEtapa,
            MomentoAcao = r.MomentoAcao,
            Status = StatusAprovacao.Pendente,
        }).ToList();

        _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);

        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
        while (primeiraEtapa is not null && IsProcessoStep(primeiraEtapa))
        {
            ExecutarAcaoEtapa(primeiraEtapa.AcaoEtapa, entity);
            primeiraEtapa.Status = StatusAprovacao.Aprovado;
            primeiraEtapa.DataUtc = DateTimeOffset.UtcNow;
            primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault(e => e.Ordem > primeiraEtapa.Ordem);
        }

        await _db.SaveChangesAsync(ct);

        if (primeiraEtapa is not null && primeiraEtapa.AprovadorId.HasValue)
        {
            var solicitanteNome = (await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId, ct))?.Name ?? "Alguém";

            await _workflow.NotifyByFuncionarioIdAsync(
                primeiraEtapa.AprovadorId.Value,
                "Nova solicitação para aprovação",
                $"{solicitanteNome} abriu uma solicitação de benefício.",
                $"/colaborador/solicitacoes",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoBeneficioResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Beneficio && e.Status == StatusAprovacao.Pendente)
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
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Beneficio)
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

        var statusAnteriorApproveBen = entity.Status.ToString();
        if (proximaEtapa is not null)
        {
            entity.Status = proximaEtapa.RoleFilaId.HasValue
                ? SolicitacaoStatus.PendenteAprovacaoRh
                : SolicitacaoStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.ObservacaoAprovador = observacao;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoBeneficio, entity.Id,
                statusAnteriorApproveBen, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de benefício aguarda sua aprovação",
                    "Uma etapa anterior foi aprovada. Agora é a sua vez de aprovar.",
                    $"/colaborador/solicitacoes-beneficio/{entity.Id}",
                    ct);
            }
        }
        else
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ObservacaoAprovador = observacao;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoBeneficio, entity.Id,
                statusAnteriorApproveBen, entity.Status.ToString(), _currentUser, observacao, ct);

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de benefício aprovada",
                "Sua solicitação de alteração de benefício foi aprovada.",
                $"/colaborador/solicitacoes-beneficio/{entity.Id}",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoBeneficioResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaReject = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Beneficio && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaReject is not null)
        {
            if (!await _workflow.CanApproveStepAsync(etapaReject, _currentUser, ct))
                throw new InvalidOperationException("Você não tem permissão para reprovar esta etapa.");
            etapaReject.Status = StatusAprovacao.Rejeitado;
            etapaReject.DataUtc = DateTimeOffset.UtcNow;
            etapaReject.Observacao = observacao;
        }

        var statusAnteriorRejectBen = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoBeneficio, entity.Id,
            statusAnteriorRejectBen, entity.Status.ToString(), _currentUser, observacao, ct);

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

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var statusAnteriorChangesBen = entity.Status.ToString();
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _statusHistorico.RegistrarAsync(
            TipoEntidadeStatus.SolicitacaoBeneficio, entity.Id,
            statusAnteriorChangesBen, entity.Status.ToString(), _currentUser, observacao, ct);

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

    public async Task<SolicitacaoBeneficioResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Beneficio && e.Status == StatusAprovacao.Pendente)
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

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoBeneficio entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private static SolicitacaoBeneficioResponse MapToResponse(SolicitacaoBeneficio s) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.TipoBeneficio, s.TipoAlteracao,
        s.Descricao, s.IncluirDependentes, s.DependenteIdsJson,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc,
        s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc
    );
}
