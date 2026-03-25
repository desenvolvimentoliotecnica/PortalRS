using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Metas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Metas;

public interface IMetaService
{
    Task<IReadOnlyList<MetaResponse>> ListByFuncionarioAsync(Guid funcionarioId, CancellationToken ct);
    Task<IReadOnlyList<MetaResponse>> ListMinhaEquipeAsync(Guid gestorId, CancellationToken ct);
    Task<MetaResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<MetaResponse> CreateAsync(MetaCreateRequest request, Guid criadaPorId, CancellationToken ct);
    Task<MetaResponse> UpdateAsync(Guid id, MetaUpdateRequest request, CancellationToken ct);
    Task<MetaResponse> AtualizarProgressoAsync(Guid id, decimal valorAtual, CancellationToken ct);
    Task CancelarAsync(Guid id, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class MetaService : IMetaService
{
    private readonly AppDbContext _db;

    public MetaService(AppDbContext db) => _db = db;

    private static MetaResponse ToResponse(Meta m) => new(
        m.Id,
        m.FuncionarioId,
        m.Funcionario?.Name ?? "",
        m.CriadaPorId,
        m.CriadaPor?.Name ?? "",
        m.Titulo,
        m.Descricao,
        m.ValorMeta,
        m.ValorAtual,
        m.Unidade,
        m.Prazo,
        m.Status,
        m.ValorMeta > 0 ? Math.Min(100m, Math.Round(m.ValorAtual / m.ValorMeta * 100, 1)) : 0m,
        m.CriadoEmUtc,
        m.AtualizadoEmUtc
    );

    private IQueryable<Meta> WithIncludes() =>
        _db.Metas
            .Include(x => x.Funcionario)
            .Include(x => x.CriadaPor)
            .AsNoTracking();

    public async Task<IReadOnlyList<MetaResponse>> ListByFuncionarioAsync(Guid funcionarioId, CancellationToken ct) =>
        (await WithIncludes()
            .Where(x => x.FuncionarioId == funcionarioId)
            .OrderByDescending(x => x.CriadoEmUtc)
            .ToListAsync(ct))
        .Select(ToResponse)
        .ToList();

    public async Task<IReadOnlyList<MetaResponse>> ListMinhaEquipeAsync(Guid gestorId, CancellationToken ct)
    {
        var subordinadoIds = await _db.Funcionarios
            .Where(f => f.GestorDiretoId == gestorId)
            .Select(f => f.Id)
            .ToListAsync(ct);

        return (await WithIncludes()
            .Where(x => subordinadoIds.Contains(x.FuncionarioId))
            .OrderByDescending(x => x.CriadoEmUtc)
            .ToListAsync(ct))
        .Select(ToResponse)
        .ToList();
    }

    public async Task<MetaResponse?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await WithIncludes().Where(x => x.Id == id).Select(x => (Meta?)x).FirstOrDefaultAsync(ct) is { } m
            ? ToResponse(m)
            : null;

    public async Task<MetaResponse> CreateAsync(MetaCreateRequest request, Guid criadaPorId, CancellationToken ct)
    {
        var meta = new Meta
        {
            Id = Guid.NewGuid(),
            FuncionarioId = request.FuncionarioId,
            CriadaPorId = criadaPorId,
            Titulo = request.Titulo.Trim(),
            Descricao = request.Descricao?.Trim(),
            ValorMeta = request.ValorMeta,
            ValorAtual = 0,
            Unidade = request.Unidade.Trim(),
            Prazo = request.Prazo,
            Status = MetaStatus.Ativa,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        };

        _db.Metas.Add(meta);
        await _db.SaveChangesAsync(ct);

        return ToResponse(await _db.Metas
            .Include(x => x.Funcionario)
            .Include(x => x.CriadaPor)
            .FirstAsync(x => x.Id == meta.Id, ct));
    }

    public async Task<MetaResponse> UpdateAsync(Guid id, MetaUpdateRequest request, CancellationToken ct)
    {
        var meta = await _db.Metas.FirstAsync(x => x.Id == id, ct);
        meta.Titulo = request.Titulo.Trim();
        meta.Descricao = request.Descricao?.Trim();
        meta.ValorMeta = request.ValorMeta;
        meta.Unidade = request.Unidade.Trim();
        meta.Prazo = request.Prazo;
        meta.AtualizadoEmUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return ToResponse(await _db.Metas
            .Include(x => x.Funcionario)
            .Include(x => x.CriadaPor)
            .FirstAsync(x => x.Id == id, ct));
    }

    public async Task<MetaResponse> AtualizarProgressoAsync(Guid id, decimal valorAtual, CancellationToken ct)
    {
        var meta = await _db.Metas.FirstAsync(x => x.Id == id, ct);
        meta.ValorAtual = valorAtual;
        meta.AtualizadoEmUtc = DateTimeOffset.UtcNow;

        if (meta.ValorMeta > 0 && valorAtual >= meta.ValorMeta && meta.Status == MetaStatus.Ativa)
            meta.Status = MetaStatus.Concluida;

        await _db.SaveChangesAsync(ct);

        return ToResponse(await _db.Metas
            .Include(x => x.Funcionario)
            .Include(x => x.CriadaPor)
            .FirstAsync(x => x.Id == id, ct));
    }

    public async Task CancelarAsync(Guid id, CancellationToken ct)
    {
        var meta = await _db.Metas.FirstAsync(x => x.Id == id, ct);
        meta.Status = MetaStatus.Cancelada;
        meta.AtualizadoEmUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var meta = await _db.Metas.FirstAsync(x => x.Id == id, ct);
        _db.Metas.Remove(meta);
        await _db.SaveChangesAsync(ct);
    }
}
