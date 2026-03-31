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
            .Include(x => x.Aprovador1)
            .Include(x => x.Aprovador2)
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
                "Nova solicitação de alteração de endereço para aprovação",
                $"{solicitanteNome} abriu uma solicitação de alteração de endereço.",
                $"/colaborador/solicitacoes-endereco/{entity.Id}",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoEnderecoResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

        entity.Status = SolicitacaoStatus.Aprovada;
        entity.ObservacaoAprovador = observacao;
        entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // ── Atualizar endereço na Pessoa ──
        await UpdatePessoaAddressAsync(entity, ct);

        await _db.SaveChangesAsync(ct);

        await _workflow.NotifyByFuncionarioIdAsync(
            entity.SolicitanteId,
            "Solicitação de alteração de endereço aprovada",
            "Sua solicitação de alteração de endereço foi aprovada e os dados foram atualizados.",
            $"/colaborador/solicitacoes-endereco/{entity.Id}",
            ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoEnderecoResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

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

        ApprovalWorkflowHelper.ValidateCanApprove(entity.Status);

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

    /// <summary>
    /// Atualiza os campos de endereço na entidade Pessoa vinculada ao solicitante (Funcionario).
    /// </summary>
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
        s.Aprovador1Id, s.Aprovador1?.Name, s.Aprovador1Status, s.Aprovador1DataUtc,
        s.Aprovador2Id, s.Aprovador2?.Name, s.Aprovador2Status, s.Aprovador2DataUtc,
        s.Aprovador2Habilitado,
        s.ObservacaoAprovador, s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc
    );
}
