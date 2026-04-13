using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.Common;
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
    Task<SolicitacaoPromocaoResponse?> AssumirAsync(Guid id, CancellationToken ct);
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
            ids, TipoFluxoAprovacao.MovimentacaoPessoal, ct);

        return rawRows.Select(r =>
        {
            etapasPendentes.TryGetValue(r.Id, out var ep);
            return new SolicitacaoPromocaoGridRow(
                r.Id, r.Status, r.SolicitanteNome, r.FuncionarioNome,
                r.NovoCargoNome, r.DataEfetiva, r.CreatedAtUtc,
                ep?.Label, ep?.PendenteCom, ep?.IsQueue ?? false, ep?.AprovadorId);
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

        return MapToResponse(s, etapas);
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

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

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

        // Check next step
        var proximaEtapa = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal && e.Ordem > etapaAtual.Ordem)
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

            var funcionario = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct);
            if (funcionario is not null)
            {
                funcionario.JobPositionId = entity.NovoCargoId;
                if (entity.NovaAreaId.HasValue)
                    funcionario.AreaId = entity.NovaAreaId;
                funcionario.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de movimentação aprovada",
                "Sua solicitação de movimentação de pessoal foi aprovada.",
                "/gestao/solicitacoes",
                ct);
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

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de movimentação reprovada",
            "Sua solicitação de movimentação foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
            "/gestao/solicitacoes",
            ct,
            "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPromocaoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // etapaAtual stays Pendente — the solicitante fixes and resubmits (SubmitAsync will reset etapas)
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de movimentação",
            "Sua solicitação de movimentação de pessoal precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
            "/gestao/solicitacoes",
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

    public async Task<SolicitacaoPromocaoResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.MovimentacaoPessoal && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null || !etapaAtual.RoleFilaId.HasValue)
            throw new InvalidOperationException("Esta etapa não é uma fila de perfil para ser assumida.");

        if (etapaAtual.AprovadorId.HasValue)
            throw new InvalidOperationException("Esta etapa já foi assumida por outro usuário.");

        if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não pertence ao perfil designado para assumir esta etapa.");

        etapaAtual.AprovadorId = _currentUser.FuncionarioId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    private static SolicitacaoPromocaoResponse MapToResponse(
        SolicitacaoPromocao s,
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
            etapaResponses
        );
    }
}
