using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

/// <summary>
/// Catálogo de templates de Survey (Entrega 1.5 — Fase 1 Paridade Feedz).
/// 4 templates seed: eNPS, Clima, Liderança, Diversidade.
/// </summary>
public interface ISurveyTemplateService
{
    Task<IReadOnlyList<SurveyTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct);
    Task<SurveyTemplateResponse?> GetAsync(Guid id, CancellationToken ct);
    Task<SurveyTemplateResponse> CreateAsync(SurveyTemplateCreateRequest request, CancellationToken ct);
    Task<Guid> CreateSurveyFromTemplateAsync(SurveyFromTemplateRequest request, Guid? createdByUserId, CancellationToken ct);
}

public sealed class SurveyTemplateService : ISurveyTemplateService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ILogger<SurveyTemplateService> _logger;

    public SurveyTemplateService(AppDbContext db, ITenantContext tenant, ILogger<SurveyTemplateService> logger)
    {
        _db = db;
        _tenant = tenant;
        _logger = logger;
    }

    private static SurveyTemplateResponse ToResponse(SurveyTemplate t) => new(
        t.Id, t.Codigo, t.Nome, t.Descricao, t.TipoSurvey, t.CadenciaSugerida,
        t.IsSystem, t.IsActive, t.Ordem, t.Questions.Count, t.CriadoEmUtc,
        t.Questions.OrderBy(q => q.Ordem)
            .Select(q => new SurveyTemplateQuestionResponse(
                q.Id, q.Texto, q.Tipo, q.Ordem, ParseOpcoes(q.OpcoesJson)))
            .ToList());

    private static IReadOnlyList<string>? ParseOpcoes(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<List<string>>(json); }
        catch { return null; }
    }

    public async Task<IReadOnlyList<SurveyTemplateResponse>> ListAsync(bool incluirInativos, CancellationToken ct)
    {
        var query = _db.SurveyTemplates.Include(t => t.Questions).AsNoTracking();
        if (!incluirInativos)
            query = query.Where(t => t.IsActive);

        var ts = await query.OrderBy(t => t.Ordem).ThenBy(t => t.Nome).ToListAsync(ct);
        return ts.Select(ToResponse).ToList();
    }

    public async Task<SurveyTemplateResponse?> GetAsync(Guid id, CancellationToken ct)
    {
        var t = await _db.SurveyTemplates.Include(x => x.Questions).AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? null : ToResponse(t);
    }

    public async Task<SurveyTemplateResponse> CreateAsync(SurveyTemplateCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo)) throw new InvalidOperationException("Código é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Nome)) throw new InvalidOperationException("Nome é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.TipoSurvey)) throw new InvalidOperationException("TipoSurvey é obrigatório.");
        if (request.Questions is null || request.Questions.Count == 0)
            throw new InvalidOperationException("Pelo menos uma pergunta é obrigatória.");

        var codigo = request.Codigo.Trim();
        var jaExiste = await _db.SurveyTemplates.AnyAsync(t => t.Codigo == codigo, ct);
        if (jaExiste) throw new InvalidOperationException($"Já existe template com código '{codigo}'.");

        var maiorOrdem = await _db.SurveyTemplates.Select(t => (int?)t.Ordem).MaxAsync(ct) ?? 0;

        var template = new SurveyTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Codigo = codigo,
            Nome = request.Nome.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            TipoSurvey = request.TipoSurvey.Trim(),
            CadenciaSugerida = string.IsNullOrWhiteSpace(request.CadenciaSugerida) ? null : request.CadenciaSugerida.Trim(),
            IsSystem = false,
            IsActive = true,
            Ordem = maiorOrdem + 10,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
            Questions = request.Questions
                .Where(q => !string.IsNullOrWhiteSpace(q.Texto))
                .Select((q, i) => new SurveyTemplateQuestion
                {
                    Id = Guid.NewGuid(),
                    Texto = q.Texto.Trim(),
                    Tipo = string.IsNullOrWhiteSpace(q.Tipo) ? "Text" : q.Tipo.Trim(),
                    Ordem = i + 1,
                    OpcoesJson = q.Opcoes is { Count: > 0 } ? JsonSerializer.Serialize(q.Opcoes) : null,
                }).ToList(),
        };

        _db.SurveyTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return ToResponse(template);
    }

    public async Task<Guid> CreateSurveyFromTemplateAsync(SurveyFromTemplateRequest request, Guid? createdByUserId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new InvalidOperationException("Título é obrigatório.");

        var template = await _db.SurveyTemplates
            .Include(t => t.Questions)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.IsActive, ct);

        if (template is null)
            throw new InvalidOperationException("Template não encontrado ou inativo.");

        var surveyId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var survey = new Survey
        {
            Id = surveyId,
            TenantId = _tenant.TenantId,
            Title = request.Title.Trim(),
            Type = template.TipoSurvey,
            StartAtUtc = request.StartAtUtc,
            EndAtUtc = request.EndAtUtc,
            CreatedByUserId = createdByUserId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        foreach (var q in template.Questions.OrderBy(x => x.Ordem))
        {
            var qid = Guid.NewGuid();
            var sq = new SurveyQuestion
            {
                Id = qid,
                TenantId = _tenant.TenantId,
                SurveyId = surveyId,
                Text = q.Texto,
                Type = q.Tipo,
                Order = q.Ordem,
            };

            if (!string.IsNullOrWhiteSpace(q.OpcoesJson))
            {
                try
                {
                    var opts = JsonSerializer.Deserialize<List<string>>(q.OpcoesJson);
                    if (opts is not null)
                    {
                        var idx = 0;
                        foreach (var o in opts)
                        {
                            sq.Options.Add(new SurveyOption
                            {
                                Id = Guid.NewGuid(),
                                TenantId = _tenant.TenantId,
                                QuestionId = qid,
                                Text = o,
                                Order = ++idx,
                            });
                        }
                    }
                }
                catch (JsonException) { /* ignora opcoes corrompidas */ }
            }

            survey.Questions.Add(sq);
        }

        _db.Surveys.Add(survey);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Survey {SurveyId} criada a partir do template {Codigo} ({Total} perguntas)",
            surveyId, template.Codigo, template.Questions.Count);

        return surveyId;
    }
}
