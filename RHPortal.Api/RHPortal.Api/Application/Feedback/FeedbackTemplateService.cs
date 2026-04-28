using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

/// <summary>
/// Catálogo de templates rápidos para envio de feedback (Entrega 1.3 — Fase 1 Paridade Feedz).
/// Templates de sistema chegam via seeder; tenants podem criar customizados.
/// </summary>
public interface IFeedbackTemplateService
{
    Task<IReadOnlyList<FeedbackTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct);
    Task<FeedbackTemplateResponse?> GetAsync(Guid id, CancellationToken ct);
    Task<FeedbackTemplateResponse> CreateAsync(FeedbackTemplateCreateRequest request, CancellationToken ct);
}

public sealed class FeedbackTemplateService : IFeedbackTemplateService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ILogger<FeedbackTemplateService> _logger;

    public FeedbackTemplateService(
        AppDbContext db,
        ITenantContext tenant,
        ILogger<FeedbackTemplateService> logger)
    {
        _db = db;
        _tenant = tenant;
        _logger = logger;
    }

    private static FeedbackTemplateResponse ToResponse(FeedbackTemplate t) => new(
        t.Id, t.Codigo, t.Nome, t.Descricao, t.Categoria, t.Conteudo, t.TipoSugerido,
        t.IsSystem, t.IsActive, t.Ordem, t.CriadoEmUtc);

    public async Task<IReadOnlyList<FeedbackTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct)
    {
        var query = _db.FeedbackTemplates.AsNoTracking();
        if (!incluirInativos)
            query = query.Where(t => t.IsActive);

        var templates = await query
            .OrderBy(t => t.Ordem)
            .ThenBy(t => t.Nome)
            .ToListAsync(ct);

        return templates.Select(ToResponse).ToList();
    }

    public async Task<FeedbackTemplateResponse?> GetAsync(Guid id, CancellationToken ct)
    {
        var t = await _db.FeedbackTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? null : ToResponse(t);
    }

    public async Task<FeedbackTemplateResponse> CreateAsync(FeedbackTemplateCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo))
            throw new InvalidOperationException("Código é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Nome))
            throw new InvalidOperationException("Nome é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Conteudo))
            throw new InvalidOperationException("Conteúdo é obrigatório.");

        var codigo = request.Codigo.Trim();
        var jaExiste = await _db.FeedbackTemplates.AnyAsync(t => t.Codigo == codigo, ct);
        if (jaExiste)
            throw new InvalidOperationException($"Já existe um template com código '{codigo}'.");

        var maiorOrdem = await _db.FeedbackTemplates.Select(t => (int?)t.Ordem).MaxAsync(ct) ?? 0;

        var template = new FeedbackTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Codigo = codigo,
            Nome = request.Nome.Trim(),
            Conteudo = request.Conteudo.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            Categoria = string.IsNullOrWhiteSpace(request.Categoria) ? null : request.Categoria.Trim(),
            TipoSugerido = string.IsNullOrWhiteSpace(request.TipoSugerido) ? null : request.TipoSugerido.Trim(),
            IsSystem = false,
            IsActive = true,
            Ordem = maiorOrdem + 10,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        };

        _db.FeedbackTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return ToResponse(template);
    }
}
