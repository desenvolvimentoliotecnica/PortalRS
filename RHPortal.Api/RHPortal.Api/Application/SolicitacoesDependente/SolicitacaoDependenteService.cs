using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.SolicitacoesDependente;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesDependente;

public interface ISolicitacaoDependenteService
{
    Task<IReadOnlyList<SolicitacaoDependenteGridRow>> ListAsync(SolicitacaoDependenteListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoDependenteResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDependenteResponse> CreateAsync(SolicitacaoDependenteCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoDependenteResponse?> UpdateAsync(Guid id, SolicitacaoDependenteUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDependenteResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoDependenteResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoDependenteResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoDependenteResponse?> AssumirAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoDependenteService : ISolicitacaoDependenteService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoDependenteService(
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

    public async Task<IReadOnlyList<SolicitacaoDependenteGridRow>> ListAsync(
        SolicitacaoDependenteListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesDependente.AsNoTracking()
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
            q = q.Where(s => s.NomeCompleto.ToLower().Contains(term)
                          || (s.Solicitante != null && s.Solicitante.Name.ToLower().Contains(term)));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        var rawRows = await q.Select(s => new
        {
            s.Id, s.Status,
            SolicitanteNome = s.Solicitante != null ? s.Solicitante.Name : (string?)null,
            s.TipoSolicitacao, s.NomeCompleto, s.Parentesco, s.CreatedAtUtc,
        }).ToListAsync(ct);

        var ids = rawRows.Select(r => r.Id).ToList();
        var etapasPendentes = await _workflow.GetEtapasPendentesAsync(
            ids, TipoFluxoAprovacao.Dependente, ct, currentUserId: _currentUser.UserId);

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            return new SolicitacaoDependenteGridRow(
                r.Id, r.Status, r.SolicitanteNome,
                r.TipoSolicitacao, r.NomeCompleto, r.Parentesco, r.CreatedAtUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId,
                ep?.CanAssume ?? false);
        }).ToList();
    }

    public async Task<SolicitacaoDependenteResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesDependente.AsNoTracking()
            .Include(x => x.Solicitante)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
    }

    public async Task<SolicitacaoDependenteResponse> CreateAsync(
        SolicitacaoDependenteCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        var now = DateTimeOffset.UtcNow;
        var entity = new SolicitacaoDependente
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            TipoSolicitacao = request.TipoSolicitacao,
            DependenteId = request.DependenteId,
            NomeCompleto = request.NomeCompleto,
            Parentesco = request.Parentesco,
            Cpf = request.Cpf,
            DataNascimento = request.DataNascimento,
            IsPcd = request.IsPcd,
            DependenteIR = request.DependenteIR,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.SolicitacoesDependente.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoDependenteResponse?> UpdateAsync(
        Guid id, SolicitacaoDependenteUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.TipoSolicitacao = request.TipoSolicitacao;
        entity.DependenteId = request.DependenteId;
        entity.NomeCompleto = request.NomeCompleto;
        entity.Parentesco = request.Parentesco;
        entity.Cpf = request.Cpf;
        entity.DataNascimento = request.DataNascimento;
        entity.IsPcd = request.IsPcd;
        entity.DependenteIR = request.DependenteIR;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

        public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Dependente);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, null, TipoFluxoAprovacao.Dependente, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.Dependente,
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
                $"{solicitanteNome} abriu uma solicitação de dependente.",
                $"/colaborador/solicitacoes",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoDependenteResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Dependente && e.Status == StatusAprovacao.Pendente)
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
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Dependente)
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

        if (proximaEtapa is not null)
        {
            entity.Status = proximaEtapa.RoleFilaId.HasValue
                ? SolicitacaoStatus.PendenteAprovacaoRh
                : SolicitacaoStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.ObservacaoAprovador = observacao;

            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de dependente aguarda sua aprovação",
                    "Uma etapa anterior foi aprovada. Agora é a sua vez de aprovar.",
                    $"/colaborador/solicitacoes-dependente/{entity.Id}",
                    ct);
            }
        }
        else
        {
            await ExecuteDependenteCrudAsync(entity, ct);
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ObservacaoAprovador = observacao;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de dependente aprovada",
                $"Sua solicitação de {entity.TipoSolicitacao.ToString().ToLower()} de dependente ({entity.NomeCompleto}) foi aprovada.",
                $"/colaborador/solicitacoes-dependente/{entity.Id}",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDependenteResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaReject = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Dependente && e.Status == StatusAprovacao.Pendente)
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

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de dependente reprovada",
            $"Sua solicitação de {entity.TipoSolicitacao.ToString().ToLower()} de dependente ({entity.NomeCompleto}) foi reprovada."
                + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/colaborador/solicitacoes-dependente/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDependenteResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de dependente",
            $"Sua solicitação de dependente ({entity.NomeCompleto}) precisa de ajustes."
                + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/colaborador/solicitacoes-dependente/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesDependente.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static bool IsProcessoStep(SolicitacaoAprovacaoEtapa e) =>
        e.AprovadorId == null && e.RoleFilaId == null && e.AcaoEtapa != AcaoEtapa.Nenhuma;

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoDependente entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private async Task ExecuteDependenteCrudAsync(SolicitacaoDependente sol, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        switch (sol.TipoSolicitacao)
        {
            case TipoSolicitacaoDependente.Inclusao:
            {
                var dep = new Dependente
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId,
                    FuncionarioId = sol.SolicitanteId,
                    NomeCompleto = sol.NomeCompleto,
                    Parentesco = sol.Parentesco,
                    Cpf = sol.Cpf,
                    DataNascimento = sol.DataNascimento,
                    IsPcd = sol.IsPcd,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                };
                _db.Set<Dependente>().Add(dep);
                break;
            }

            case TipoSolicitacaoDependente.Alteracao when sol.DependenteId.HasValue:
            {
                var dep = await _db.Set<Dependente>()
                    .FirstOrDefaultAsync(d => d.Id == sol.DependenteId.Value, ct);
                if (dep is not null)
                {
                    dep.NomeCompleto = sol.NomeCompleto;
                    dep.Parentesco = sol.Parentesco;
                    dep.Cpf = sol.Cpf;
                    dep.DataNascimento = sol.DataNascimento;
                    dep.IsPcd = sol.IsPcd;
                    dep.UpdatedAtUtc = now;
                }
                break;
            }

            case TipoSolicitacaoDependente.Exclusao when sol.DependenteId.HasValue:
            {
                var dep = await _db.Set<Dependente>()
                    .FirstOrDefaultAsync(d => d.Id == sol.DependenteId.Value, ct);
                if (dep is not null)
                    _db.Set<Dependente>().Remove(dep);
                break;
            }
        }
    }

    public async Task<SolicitacaoDependenteResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Dependente && e.Status == StatusAprovacao.Pendente)
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

    private static SolicitacaoDependenteResponse MapToResponse(SolicitacaoDependente s) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.TipoSolicitacao, s.DependenteId,
        s.NomeCompleto, s.Parentesco, s.Cpf,
        s.DataNascimento, s.IsPcd, s.DependenteIR,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc,
        s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc
    );
}
