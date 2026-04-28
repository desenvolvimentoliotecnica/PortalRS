using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

/// <summary>
/// Catálogo de templates de pauta para reuniões 1:1 (Entrega 1.2 — Fase 1 Paridade Feedz).
/// Templates de sistema chegam via seeder a cada tenant; tenants podem criar customizados.
/// Quando um template é usado em <see cref="OneOnOneService"/>, sua pauta é renderizada
/// como markdown nos Notes do meeting (bullets ordenados).
/// </summary>
public interface IOneOnOneTemplateService
{
    Task<IReadOnlyList<OneOnOneTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct);
    Task<OneOnOneTemplateResponse?> GetAsync(Guid id, CancellationToken ct);
    Task<OneOnOneTemplateResponse> CreateAsync(OneOnOneTemplateCreateRequest request, CancellationToken ct);

    /// <summary>
    /// Renderiza o template como (Subject, Notes-em-markdown) para o
    /// <see cref="OneOnOneService.CreateAsync"/> popular o meeting com pauta pronta.
    /// Retorna null se o template não existir ou estiver inativo.
    /// </summary>
    Task<(string Subject, string Notes)?> RenderForMeetingAsync(Guid templateId, CancellationToken ct);
}

public sealed class OneOnOneTemplateService : IOneOnOneTemplateService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ILogger<OneOnOneTemplateService> _logger;

    public OneOnOneTemplateService(
        AppDbContext db,
        ITenantContext tenant,
        ILogger<OneOnOneTemplateService> logger)
    {
        _db = db;
        _tenant = tenant;
        _logger = logger;
    }

    private static OneOnOneTemplateResponse ToResponse(OneOnOneTemplate t) => new(
        t.Id,
        t.Codigo,
        t.Nome,
        t.Descricao,
        t.Categoria,
        t.IsSystem,
        t.IsActive,
        t.Ordem,
        t.Itens.Count,
        t.CriadoEmUtc,
        t.Itens.OrderBy(i => i.Ordem).Select(i => new OneOnOneTemplateItemResponse(i.Id, i.Texto, i.Ordem)).ToList()
    );

    public async Task<IReadOnlyList<OneOnOneTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct)
    {
        var query = _db.OneOnOneTemplates
            .Include(t => t.Itens)
            .AsNoTracking();

        if (!incluirInativos)
            query = query.Where(t => t.IsActive);

        var templates = await query
            .OrderBy(t => t.Ordem)
            .ThenBy(t => t.Nome)
            .ToListAsync(ct);

        return templates.Select(ToResponse).ToList();
    }

    public async Task<OneOnOneTemplateResponse?> GetAsync(Guid id, CancellationToken ct)
    {
        var template = await _db.OneOnOneTemplates
            .Include(t => t.Itens)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        return template is null ? null : ToResponse(template);
    }

    public async Task<OneOnOneTemplateResponse> CreateAsync(OneOnOneTemplateCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo))
            throw new InvalidOperationException("Código é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Nome))
            throw new InvalidOperationException("Nome é obrigatório.");
        if (request.Itens is null || request.Itens.Count == 0)
            throw new InvalidOperationException("Template deve ter ao menos um item de pauta.");

        var codigoNormalizado = request.Codigo.Trim();
        var jaExiste = await _db.OneOnOneTemplates
            .AnyAsync(t => t.Codigo == codigoNormalizado, ct);

        if (jaExiste)
            throw new InvalidOperationException($"Já existe um template com código '{codigoNormalizado}'.");

        var maiorOrdem = await _db.OneOnOneTemplates
            .Select(t => (int?)t.Ordem)
            .MaxAsync(ct) ?? 0;

        var template = new OneOnOneTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Codigo = codigoNormalizado,
            Nome = request.Nome.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            Categoria = string.IsNullOrWhiteSpace(request.Categoria) ? null : request.Categoria.Trim(),
            IsSystem = false,
            IsActive = true,
            Ordem = maiorOrdem + 10,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
            Itens = request.Itens
                .Where(i => !string.IsNullOrWhiteSpace(i))
                .Select((texto, idx) => new OneOnOneTemplateItem
                {
                    Id = Guid.NewGuid(),
                    Texto = texto.Trim(),
                    Ordem = idx + 1,
                }).ToList(),
        };

        _db.OneOnOneTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return ToResponse(template);
    }

    public async Task<(string Subject, string Notes)?> RenderForMeetingAsync(Guid templateId, CancellationToken ct)
    {
        var template = await _db.OneOnOneTemplates
            .Include(t => t.Itens)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == templateId && t.IsActive, ct);

        if (template is null)
            return null;

        var subject = template.Nome;
        var pauta = string.Join(
            Environment.NewLine,
            template.Itens
                .OrderBy(i => i.Ordem)
                .Select(i => $"- {i.Texto}"));

        var notes = string.IsNullOrWhiteSpace(template.Descricao)
            ? $"**Pauta — {template.Nome}**{Environment.NewLine}{Environment.NewLine}{pauta}"
            : $"**Pauta — {template.Nome}**{Environment.NewLine}{Environment.NewLine}_{template.Descricao}_{Environment.NewLine}{Environment.NewLine}{pauta}";

        _logger.LogInformation(
            "Renderizando template 1:1 {Codigo} ({Itens} itens) para meeting (tenant {TenantId})",
            template.Codigo, template.Itens.Count, _tenant.TenantId);

        return (subject, notes);
    }
}
