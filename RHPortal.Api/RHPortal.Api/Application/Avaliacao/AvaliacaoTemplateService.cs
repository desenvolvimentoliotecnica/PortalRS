using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Avaliacao;

/// <summary>
/// Orquestra o catálogo de templates de avaliação (Entrega 1.1 — Fase 1 Paridade Feedz).
/// Templates de sistema chegam via seeder a cada tenant; tenants podem criar customizados.
/// </summary>
public interface IAvaliacaoTemplateService
{
    Task<IReadOnlyList<AvaliacaoTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct);
    Task<AvaliacaoTemplateResponse?> GetAsync(Guid id, CancellationToken ct);
    Task<AvaliacaoTemplateResponse> CreateAsync(AvaliacaoTemplateCreateRequest request, CancellationToken ct);
    Task<AvaliacaoCicloResponse> CriarCicloFromTemplateAsync(AvaliacaoCicloFromTemplateRequest request, Guid criadoPorId, CancellationToken ct);
}

public sealed class AvaliacaoTemplateService : IAvaliacaoTemplateService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IAvaliacaoService _avaliacaoService;
    private readonly ILogger<AvaliacaoTemplateService> _logger;

    public AvaliacaoTemplateService(
        AppDbContext db,
        ITenantContext tenant,
        IAvaliacaoService avaliacaoService,
        ILogger<AvaliacaoTemplateService> logger)
    {
        _db = db;
        _tenant = tenant;
        _avaliacaoService = avaliacaoService;
        _logger = logger;
    }

    private static AvaliacaoTemplateResponse ToResponse(AvaliacaoTemplate t) => new(
        t.Id,
        t.Codigo,
        t.Nome,
        t.Descricao,
        t.PeriodoSugerido,
        t.IsSystem,
        t.IsActive,
        t.Ordem,
        t.Perguntas.Count,
        t.CriadoEmUtc,
        t.Perguntas.OrderBy(p => p.Ordem).Select(p => new AvaliacaoTemplatePerguntaResponse(p.Id, p.Texto, p.Ordem)).ToList()
    );

    public async Task<IReadOnlyList<AvaliacaoTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct)
    {
        var query = _db.AvaliacaoTemplates
            .Include(t => t.Perguntas)
            .AsNoTracking();

        if (!incluirInativos)
            query = query.Where(t => t.IsActive);

        var templates = await query
            .OrderBy(t => t.Ordem)
            .ThenBy(t => t.Nome)
            .ToListAsync(ct);

        return templates.Select(ToResponse).ToList();
    }

    public async Task<AvaliacaoTemplateResponse?> GetAsync(Guid id, CancellationToken ct)
    {
        var template = await _db.AvaliacaoTemplates
            .Include(t => t.Perguntas)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        return template is null ? null : ToResponse(template);
    }

    public async Task<AvaliacaoTemplateResponse> CreateAsync(AvaliacaoTemplateCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo))
            throw new InvalidOperationException("Código é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Nome))
            throw new InvalidOperationException("Nome é obrigatório.");
        if (request.Perguntas is null || request.Perguntas.Count == 0)
            throw new InvalidOperationException("Template deve ter ao menos uma pergunta.");

        var codigoNormalizado = request.Codigo.Trim();
        var jaExiste = await _db.AvaliacaoTemplates
            .AnyAsync(t => t.Codigo == codigoNormalizado, ct);

        if (jaExiste)
            throw new InvalidOperationException($"Já existe um template com código '{codigoNormalizado}'.");

        // Próxima ordem (após o maior atual + 10) — facilita reordenação manual depois.
        var maiorOrdem = await _db.AvaliacaoTemplates
            .Select(t => (int?)t.Ordem)
            .MaxAsync(ct) ?? 0;

        var template = new AvaliacaoTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Codigo = codigoNormalizado,
            Nome = request.Nome.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            PeriodoSugerido = string.IsNullOrWhiteSpace(request.PeriodoSugerido) ? null : request.PeriodoSugerido.Trim(),
            IsSystem = false,
            IsActive = true,
            Ordem = maiorOrdem + 10,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
            Perguntas = request.Perguntas
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select((texto, idx) => new AvaliacaoTemplatePergunta
                {
                    Id = Guid.NewGuid(),
                    Texto = texto.Trim(),
                    Ordem = idx + 1,
                }).ToList(),
        };

        _db.AvaliacaoTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return ToResponse(template);
    }

    public async Task<AvaliacaoCicloResponse> CriarCicloFromTemplateAsync(
        AvaliacaoCicloFromTemplateRequest request,
        Guid criadoPorId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
            throw new InvalidOperationException("Nome é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Periodo))
            throw new InvalidOperationException("Período é obrigatório.");

        var template = await _db.AvaliacaoTemplates
            .Include(t => t.Perguntas)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.IsActive, ct);

        if (template is null)
            throw new InvalidOperationException("Template não encontrado ou inativo.");

        if (template.Perguntas.Count == 0)
            throw new InvalidOperationException("Template sem perguntas — não é possível criar ciclo a partir dele.");

        var perguntas = template.Perguntas
            .OrderBy(p => p.Ordem)
            .Select(p => p.Texto)
            .ToList();

        var cicloRequest = new AvaliacaoCicloCreateRequest(
            Nome: request.Nome,
            Periodo: request.Periodo,
            Perguntas: perguntas,
            Descricao: request.Descricao,
            DataInicio: request.DataInicio,
            DataFim: request.DataFim,
            IniciarEmRascunho: request.IniciarEmRascunho
        );

        _logger.LogInformation(
            "Criando ciclo de avaliação a partir do template {TemplateCodigo} ({Perguntas} perguntas) para tenant {TenantId}",
            template.Codigo, perguntas.Count, _tenant.TenantId);

        return await _avaliacaoService.CriarCicloAsync(cicloRequest, criadoPorId, ct);
    }
}
