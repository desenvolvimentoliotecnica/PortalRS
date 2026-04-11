using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.SolicitacoesDesligamento;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

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
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);\n    Task<SolicitacaoSolicitacaoDesligamentoResponse?> AssumirAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoDesligamentoService : ISolicitacaoDesligamentoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoDesligamentoService(
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

    public async Task<IReadOnlyList<SolicitacaoDesligamentoGridRow>> ListAsync(
        SolicitacaoDesligamentoListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesDesligamento.AsNoTracking()
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
                s.MotivoDesligamento.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        return await q.Select(s => new SolicitacaoDesligamentoGridRow(
            s.Id,
            s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.Funcionario != null ? s.Funcionario.Name : null,
            s.TipoDesligamento,
            s.DataDesligamento,
            s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesDesligamento.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Funcionario)
            .Include(x => x.Empresa)
            .Include(x => x.Unit)
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

        var etapas = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .Include(e => e.Aprovador)
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        return MapToResponse(s, etapas);
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

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

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

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

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
            Status = StatusAprovacao.Pendente,
        }).ToList();

        _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);
        await _db.SaveChangesAsync(ct);

        // Notify first step
        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
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
                    "/gestao/solicitacoes",
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

        // Check next step
        var proximaEtapa = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Desligamento && e.Ordem > etapaAtual.Ordem)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

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
                    "Solicitação de desligamento aguarda sua aprovação",
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

            // Se SubstituirPosicao=true, registrar para criação futura de SolicitacaoVaga
            // (campo SolicitacaoVagaGeradaId será preenchido quando a integração for implementada)

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de desligamento aprovada",
                "Sua solicitação de desligamento foi aprovada." + (observacao is not null ? $" Observação: {observacao}" : ""),
                "/gestao/solicitacoes",
                ct);
        }

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

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de desligamento reprovada",
            "Sua solicitação de desligamento foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            "/gestao/solicitacoes",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoDesligamentoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // etapaAtual stays Pendente — the solicitante fixes and resubmits (SubmitAsync will reset etapas)
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de desligamento",
            "Sua solicitação de desligamento precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            "/gestao/solicitacoes",
            ct,
            "warning");

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

    private static SolicitacaoDesligamentoResponse MapToResponse(
        SolicitacaoDesligamento s,
        IReadOnlyList<SolicitacaoAprovacaoEtapa> etapas)
    {
        var etapaResponses = etapas.Select(e => new EtapaAprovacaoResponse(
            e.Ordem,
            e.Label,
            e.AprovadorId,
            e.Aprovador?.Name,
            e.RoleFilaId,
            null,  // RoleFilaNome — not loaded here, could be added later
            e.Status switch
            {
                StatusAprovacao.Aprovado => "Aprovado",
                StatusAprovacao.Rejeitado => "Reprovado",
                _ => "Pendente"
            },
            e.DataUtc,
            e.Observacao
        )).ToList();

        // Legacy mapping from etapas for Aprovador1/Aprovador2 fields
        var etapa1 = etapas.Count > 0 ? etapas[0] : null;
        var etapa2 = etapas.Count > 1 ? etapas[1] : null;

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
            // Legacy Aprovador1/2 (mapped from etapas for backward compat)
            etapa1?.AprovadorId ?? s.Aprovador1Id,
            etapa1?.Aprovador?.Name ?? s.Aprovador1?.Name,
            etapa1?.Status ?? s.Aprovador1Status,
            etapa1?.DataUtc ?? s.Aprovador1DataUtc,
            etapa2?.AprovadorId ?? s.Aprovador2Id,
            etapa2?.Aprovador?.Name ?? s.Aprovador2?.Name,
            etapa2?.Status,
            etapa2?.DataUtc ?? s.Aprovador2DataUtc,
            etapa2 is not null,  // Aprovador2Habilitado
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
