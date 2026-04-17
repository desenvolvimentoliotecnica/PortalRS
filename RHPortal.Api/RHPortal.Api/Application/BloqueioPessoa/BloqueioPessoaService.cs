using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.BloqueioPessoa;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.BloqueioPessoa;

public sealed class BloqueioPessoaService : IBloqueioPessoaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IPessoaService _pessoaService;

    public BloqueioPessoaService(AppDbContext db, ITenantContext tenantContext, IPessoaService pessoaService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _pessoaService = pessoaService;
    }

    public async Task<BloqueioPessoaPagedResponse> ListAsync(BloqueioPessoaListQuery query, CancellationToken ct)
    {
        IQueryable<PessoaBloqueio> q = _db.PessoaBloqueios
            .AsNoTracking()
            .Include(x => x.Pessoa);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var like = $"%{term}%";
            q = q.Where(b =>
                (b.Pessoa != null && (
                    EF.Functions.Like(b.Pessoa.Nome, like) ||
                    EF.Functions.Like(b.Pessoa.Email, like))));
        }

        var ordered = q.OrderByDescending(b => b.CreatedAtUtc);
        var totalCount = await ordered.CountAsync(ct);

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new BloqueioPessoaListItemResponse(
                b.Id,
                b.PessoaId,
                b.Pessoa!.Nome,
                b.Pessoa.Email,
                b.Motivo,
                b.OrigemBloqueio,
                b.CreatedAtUtc))
            .ToListAsync(ct);

        return new BloqueioPessoaPagedResponse(items, totalCount, page, pageSize);
    }

    public async Task<BloqueioPessoaResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.PessoaBloqueios
            .AsNoTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return entity?.Pessoa is null ? null : MapToResponse(entity);
    }

    public async Task<BloqueioPessoaResponse?> GetByPessoaIdAsync(Guid pessoaId, CancellationToken ct)
    {
        var entity = await _db.PessoaBloqueios
            .AsNoTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.PessoaId == pessoaId, ct);
        return entity?.Pessoa is null ? null : MapToResponse(entity);
    }

    public async Task<BloqueioPessoaResponse?> CreateManualAsync(BloqueioPessoaCreateManualRequest request, CancellationToken ct)
    {
        var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
            request.Email,
            request.Nome?.Trim(),
            null, null, null, null, null,
            request.Motivo?.Trim(),
            RhPortal.Api.Domain.Enums.OrigemPessoa.Manual,
            ct);

        return await AddBloqueioAsync(pessoa.Id, request.Motivo?.Trim(), OrigemBloqueio.Manual, null, ct);
    }

    public async Task<BloqueioPessoaResponse?> CreateFromCandidatoAsync(Guid candidatoId, CancellationToken ct)
    {
        var candidato = await _db.Candidatos
            .AsTracking()
            .Include(x => x.Talento)
            .ThenInclude(t => t!.Pessoa)
            .FirstOrDefaultAsync(x => x.Id == candidatoId, ct);
        if (candidato is null) return null;

        Guid pessoaId;
        if (candidato.Talento?.PessoaId != null)
        {
            pessoaId = candidato.Talento.PessoaId;
        }
        else
        {
            var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
                candidato.Email,
                candidato.Nome,
                candidato.Fone,
                candidato.Cidade,
                candidato.Uf,
                candidato.LinkedinUrl,
                candidato.ResumoProfissional,
                candidato.Obs,
                RhPortal.Api.Domain.Enums.OrigemPessoa.Vaga,
                ct);
            pessoaId = pessoa.Id;
        }

        return await AddBloqueioAsync(pessoaId, null, OrigemBloqueio.Candidato, null, ct);
    }

    public async Task<BloqueioPessoaResponse?> CreateFromFuncionarioAsync(Guid funcionarioId, CancellationToken ct)
    {
        var funcionario = await _db.Funcionarios
            .AsTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.Id == funcionarioId, ct);
        if (funcionario is null) return null;

        Guid pessoaId;
        if (funcionario.PessoaId.HasValue)
        {
            pessoaId = funcionario.PessoaId.Value;
        }
        else
        {
            var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
                funcionario.Email ?? string.Empty,
                funcionario.Name,
                funcionario.Phone,
                null, null, null, null,
                funcionario.Notes,
                RhPortal.Api.Domain.Enums.OrigemPessoa.Funcionario,
                ct);
            pessoaId = pessoa.Id;
            funcionario.PessoaId = pessoaId;
            await _db.SaveChangesAsync(ct);
        }

        return await AddBloqueioAsync(pessoaId, null, OrigemBloqueio.Funcionario, null, ct);
    }

    public async Task<BloqueioPessoaResponse?> CreateFromTalentoAsync(Guid talentoId, CancellationToken ct)
    {
        var talento = await _db.Talentos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == talentoId, ct);
        if (talento is null) return null;

        return await AddBloqueioAsync(talento.PessoaId, null, OrigemBloqueio.Talento, null, ct);
    }

    public async Task<BloqueioPessoaResponse?> BlockByPessoaIdAsync(Guid pessoaId, string? motivo, CancellationToken ct)
    {
        return await AddBloqueioAsync(pessoaId, motivo, OrigemBloqueio.Manual, null, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.PessoaBloqueios.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;
        _db.PessoaBloqueios.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> IsPessoaBlockedAsync(Guid pessoaId, CancellationToken ct)
    {
        return await _db.PessoaBloqueios
            .AnyAsync(x => x.PessoaId == pessoaId, ct);
    }

    private async Task<BloqueioPessoaResponse?> AddBloqueioAsync(
        Guid pessoaId,
        string? motivo,
        OrigemBloqueio origem,
        string? createdByUserId,
        CancellationToken ct)
    {
        var existing = await _db.PessoaBloqueios
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PessoaId == pessoaId, ct);
        if (existing is not null)
            return null;

        var pessoa = await _db.Pessoas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == pessoaId, ct);
        if (pessoa is null) return null;

        var entity = new PessoaBloqueio
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PessoaId = pessoaId,
            Motivo = TrimToMax(motivo, 500),
            OrigemBloqueio = origem,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = TrimToMax(createdByUserId, 120)
        };
        _db.PessoaBloqueios.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new BloqueioPessoaResponse(
            entity.Id,
            pessoaId,
            pessoa.Nome,
            pessoa.Email,
            entity.Motivo,
            entity.OrigemBloqueio,
            entity.CreatedAtUtc);
    }

    private static BloqueioPessoaResponse MapToResponse(PessoaBloqueio b) =>
        new(b.Id, b.PessoaId, b.Pessoa!.Nome, b.Pessoa.Email, b.Motivo, b.OrigemBloqueio, b.CreatedAtUtc);

    private static string? TrimToMax(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : (value.Length <= max ? value.Trim() : value.Trim().Substring(0, max));
}
