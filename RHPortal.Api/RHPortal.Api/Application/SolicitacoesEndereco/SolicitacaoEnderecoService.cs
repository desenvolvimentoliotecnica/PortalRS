using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.SolicitacoesEndereco;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesEndereco;

public interface ISolicitacaoEnderecoService
{
    Task<IReadOnlyList<SolicitacaoEnderecoGridRow>> ListAsync(SolicitacaoEnderecoListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse> CreateAsync(SolicitacaoEnderecoCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse?> UpdateAsync(Guid id, SolicitacaoEnderecoUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoEnderecoResponse?> AssumirAsync(Guid id, CancellationToken ct);
}

public sealed class SolicitacaoEnderecoService : ISolicitacaoEnderecoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoEnderecoService(
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

    public async Task<IReadOnlyList<SolicitacaoEnderecoGridRow>> ListAsync(
        SolicitacaoEnderecoListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesEndereco.AsNoTracking()
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
                          || s.Logradouro.ToLower().Contains(term)
                          || s.Cidade.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        return await q.Select(s => new SolicitacaoEnderecoGridRow(
            s.Id, s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.Cep, s.Cidade, s.Uf,
            s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoEnderecoResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesEndereco.AsNoTracking()
            .Include(x => x.Solicitante)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return s is null ? null : MapToResponse(s);
    }

    public async Task<SolicitacaoEnderecoResponse> CreateAsync(
        SolicitacaoEnderecoCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        var resolvedSolicitanteId = await _workflow.ResolveSolicitanteIdAsync(solicitanteId, ct);

        var now = DateTimeOffset.UtcNow;
        var entity = new SolicitacaoEndereco
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            Cep = request.Cep,
            Logradouro = request.Logradouro,
            Numero = request.Numero,
            Bairro = request.Bairro,
            Complemento = request.Complemento,
            Cidade = request.Cidade,
            Uf = request.Uf,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.SolicitacoesEndereco.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoEnderecoResponse?> UpdateAsync(
        Guid id, SolicitacaoEnderecoUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.Cep = request.Cep;
        entity.Logradouro = request.Logradouro;
        entity.Numero = request.Numero;
        entity.Bairro = request.Bairro;
        entity.Complemento = request.Complemento;
        entity.Cidade = request.Cidade;
        entity.Uf = request.Uf;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

        public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Endereco);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        var resolved = await _workflow.ResolveEtapasAsync(
            entity.SolicitanteId, null, TipoFluxoAprovacao.Endereco, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.Endereco,
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
                $"{solicitanteNome} abriu uma solicitação de endereço.",
                $"/colaborador/solicitacoes",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoEnderecoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Endereco && e.Status == StatusAprovacao.Pendente)
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
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Endereco)
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
                    "Solicitação de endereço aguarda sua aprovação",
                    "Uma etapa anterior foi aprovada. Agora é a sua vez de aprovar.",
                    $"/colaborador/solicitacoes-endereco/{entity.Id}",
                    ct);
            }
        }
        else
        {
            await UpdatePessoaAddressAsync(entity, ct);
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ObservacaoAprovador = observacao;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(ct);

            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId,
                "Solicitação de alteração de endereço aprovada",
                "Sua solicitação de alteração de endereço foi aprovada e os dados foram atualizados.",
                $"/colaborador/solicitacoes-endereco/{entity.Id}",
                ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoEnderecoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaReject = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Endereco && e.Status == StatusAprovacao.Pendente)
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
            "Solicitação de alteração de endereço reprovada",
            "Sua solicitação de alteração de endereço foi reprovada."
                + (observacao is not null ? $" Motivo: {observacao}" : ""),
            $"/colaborador/solicitacoes-endereco/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoEnderecoResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.ObservacaoAprovador = observacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Ajustes necessários na solicitação de endereço",
            "Sua solicitação de alteração de endereço precisa de ajustes."
                + (observacao is not null ? $" Observação: {observacao}" : ""),
            $"/colaborador/solicitacoes-endereco/{entity.Id}",
            ct, "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesEndereco.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<SolicitacaoEnderecoResponse?> AssumirAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.Endereco && e.Status == StatusAprovacao.Pendente)
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

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoEndereco entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private async Task UpdatePessoaAddressAsync(SolicitacaoEndereco sol, CancellationToken ct)
    {
        var funcionario = await _db.Set<Funcionario>()
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == sol.SolicitanteId, ct);

        if (funcionario is null) return;

        var pessoa = await _db.Set<Pessoa>()
            .FirstOrDefaultAsync(p => p.Id == funcionario.PessoaId, ct);

        if (pessoa is null) return;

        pessoa.Cep = sol.Cep;
        pessoa.Logradouro = sol.Logradouro;
        pessoa.Numero = sol.Numero;
        pessoa.Bairro = sol.Bairro;
        pessoa.Complemento = sol.Complemento;
        pessoa.Cidade = sol.Cidade;
        pessoa.Uf = sol.Uf;
        pessoa.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    private static SolicitacaoEnderecoResponse MapToResponse(SolicitacaoEndereco s) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.Cep, s.Logradouro, s.Numero, s.Bairro,
        s.Complemento, s.Cidade, s.Uf,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc,
        s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc
    );
}
