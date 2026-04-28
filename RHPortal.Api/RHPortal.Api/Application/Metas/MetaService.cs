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

    // OKR cascateado (Entrega 1.6 — Fase 1 Paridade Feedz)
    Task<IReadOnlyList<MetaTreeNode>> ListTreeAsync(Guid? rootId, CancellationToken ct);
    Task<MetaCheckinResponse> AddCheckinAsync(Guid metaId, MetaCheckinCreateRequest request, Guid criadoPorId, CancellationToken ct);
    Task<IReadOnlyList<MetaCheckinResponse>> ListCheckinsAsync(Guid metaId, CancellationToken ct);
}

public sealed class MetaService : IMetaService
{
    private readonly AppDbContext _db;

    public MetaService(AppDbContext db) => _db = db;

    private static MetaResponse ToResponse(Meta m, int totalChildren = 0, MetaCheckin? ultimoCheckin = null) => new(
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
        m.AtualizadoEmUtc,
        m.ParentMetaId,
        totalChildren,
        ultimoCheckin?.Status,
        ultimoCheckin?.CriadoEmUtc
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
        .Select(m => ToResponse(m))
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
        .Select(m => ToResponse(m))
        .ToList();
    }

    public async Task<MetaResponse?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await WithIncludes().Where(x => x.Id == id).Select(x => (Meta?)x).FirstOrDefaultAsync(ct) is { } m
            ? ToResponse(m)
            : null;

    public async Task<MetaResponse> CreateAsync(MetaCreateRequest request, Guid criadaPorId, CancellationToken ct)
    {
        // OKR cascateado (Entrega 1.6) — valida parent existe e detecta ciclos triviais
        if (request.ParentMetaId is { } parentId)
        {
            var parentExists = await _db.Metas.AnyAsync(m => m.Id == parentId, ct);
            if (!parentExists)
                throw new InvalidOperationException("Meta-pai informada não existe.");
        }

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
            ParentMetaId = request.ParentMetaId,
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

    // ── OKR Cascateado (Entrega 1.6 — Fase 1 Paridade Feedz) ──

    public async Task<IReadOnlyList<MetaTreeNode>> ListTreeAsync(Guid? rootId, CancellationToken ct)
    {
        // Carrega TODAS as metas do tenant (filtro por query filter já aplicado) numa única query
        // e monta árvore em memória — para tenants com até alguns milhares de metas é mais simples
        // que CTE recursiva.
        var todas = await _db.Metas
            .Include(m => m.Funcionario)
            .AsNoTracking()
            .ToListAsync(ct);

        var ultimosCheckins = await _db.MetaCheckins
            .AsNoTracking()
            .GroupBy(c => c.MetaId)
            .Select(g => g.OrderByDescending(x => x.CriadoEmUtc).First())
            .ToDictionaryAsync(c => c.MetaId, c => c, ct);

        // Indexa metas por id e por parent
        var porParent = todas
            .Where(m => m.ParentMetaId.HasValue)
            .GroupBy(m => m.ParentMetaId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Titulo).ToList());

        MetaTreeNode BuildNode(Meta m)
        {
            var children = porParent.TryGetValue(m.Id, out var c)
                ? c.Select(BuildNode).ToList()
                : new List<MetaTreeNode>();

            ultimosCheckins.TryGetValue(m.Id, out var ultimo);

            return new MetaTreeNode(
                Id: m.Id,
                Titulo: m.Titulo,
                FuncionarioNome: m.Funcionario?.Name ?? "",
                ValorMeta: m.ValorMeta,
                ValorAtual: m.ValorAtual,
                Unidade: m.Unidade,
                PercentualConcluido: m.ValorMeta > 0
                    ? Math.Min(100m, Math.Round(m.ValorAtual / m.ValorMeta * 100, 1))
                    : 0m,
                Status: m.Status,
                UltimoCheckinStatus: ultimo?.Status,
                Children: children);
        }

        // Se rootId fornecido, retorna só essa árvore. Senão, retorna todas as raízes (sem parent).
        if (rootId.HasValue)
        {
            var root = todas.FirstOrDefault(m => m.Id == rootId.Value);
            return root is null ? new List<MetaTreeNode>() : new List<MetaTreeNode> { BuildNode(root) };
        }

        return todas
            .Where(m => m.ParentMetaId is null)
            .OrderBy(m => m.Titulo)
            .Select(BuildNode)
            .ToList();
    }

    public async Task<MetaCheckinResponse> AddCheckinAsync(
        Guid metaId,
        MetaCheckinCreateRequest request,
        Guid criadoPorId,
        CancellationToken ct)
    {
        if (request.Status is < 1 or > 3)
            throw new InvalidOperationException("Status do check-in deve ser 1 (verde), 2 (amarelo) ou 3 (vermelho).");

        var meta = await _db.Metas.FirstOrDefaultAsync(m => m.Id == metaId, ct)
            ?? throw new InvalidOperationException("Meta não encontrada.");

        var checkin = new MetaCheckin
        {
            Id = Guid.NewGuid(),
            MetaId = metaId,
            Status = request.Status,
            ValorAtual = request.ValorAtual,
            Comentario = string.IsNullOrWhiteSpace(request.Comentario) ? null : request.Comentario.Trim(),
            CriadoPorId = criadoPorId,
            CriadoEmUtc = DateTimeOffset.UtcNow,
        };

        _db.MetaCheckins.Add(checkin);

        // Se ValorAtual foi informado, atualiza o progresso da meta também
        if (request.ValorAtual.HasValue)
        {
            meta.ValorAtual = request.ValorAtual.Value;
            meta.AtualizadoEmUtc = DateTimeOffset.UtcNow;
            if (meta.ValorMeta > 0 && meta.ValorAtual >= meta.ValorMeta && meta.Status == MetaStatus.Ativa)
                meta.Status = MetaStatus.Concluida;
        }

        await _db.SaveChangesAsync(ct);

        var criador = await _db.Funcionarios.AsNoTracking().FirstOrDefaultAsync(f => f.Id == criadoPorId, ct);
        return new MetaCheckinResponse(
            checkin.Id, checkin.MetaId, checkin.Status, checkin.ValorAtual,
            checkin.Comentario, criadoPorId, criador?.Name ?? "", checkin.CriadoEmUtc);
    }

    public async Task<IReadOnlyList<MetaCheckinResponse>> ListCheckinsAsync(Guid metaId, CancellationToken ct)
    {
        return await _db.MetaCheckins
            .Where(c => c.MetaId == metaId)
            .Include(c => c.CriadoPor)
            .OrderByDescending(c => c.CriadoEmUtc)
            .AsNoTracking()
            .Select(c => new MetaCheckinResponse(
                c.Id, c.MetaId, c.Status, c.ValorAtual, c.Comentario,
                c.CriadoPorId, c.CriadoPor!.Name ?? "", c.CriadoEmUtc))
            .ToListAsync(ct);
    }
}
