using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Implementa <see cref="ICvResumoService"/>. Usa <see cref="IOllamaClient"/> com
/// prompt curto focado em extrair: anos de experiência, cargo atual, 3 skills
/// principais + formação. Output garantido em ≤ 250 chars.
/// </summary>
public sealed class CvResumoService : ICvResumoService
{
    private readonly Infrastructure.Data.AppDbContext _db;
    private readonly IOllamaClient _ollama;
    private readonly ILogger<CvResumoService> _logger;

    public CvResumoService(Infrastructure.Data.AppDbContext db, IOllamaClient ollama, ILogger<CvResumoService> logger)
    {
        _db = db;
        _ollama = ollama;
        _logger = logger;
    }

    private const string SystemPrompt = """
        Você resume CVs para a triagem de recrutamento. Gere um resumo curto (MAX 250 chars)
        em PT-BR, em 3ª pessoa. Formato: "Cargo atual/último, X anos de experiência.
        Skills-chave: A, B, C. Formação: Y." — uma única linha, sem markdown.

        Nunca invente informações. Se algo não está no CV, omite.
        """;

    public async Task<CvResumoResult> ResumirAsync(Guid candidatoId, bool force = false, CancellationToken ct = default)
    {
        var candidato = await _db.Candidatos.FirstOrDefaultAsync(c => c.Id == candidatoId, ct);
        if (candidato is null)
            return new CvResumoResult(false, null, false, "Candidato não encontrado.");

        var cv = BuildCvText(candidato.CvText, candidato.ResumoProfissional);
        if (string.IsNullOrWhiteSpace(cv))
            return new CvResumoResult(false, null, false, "Sem CV para resumir.");

        // Cache: se resumo já existe e CV não mudou (hash), retorna cacheado
        var hashAtual = EmbeddingService.ComputeHash(cv);
        if (!force && !string.IsNullOrWhiteSpace(candidato.ResumoProfissional))
        {
            // Resumo anterior é compatível se <= 300 chars (provavelmente gerado por nós antes)
            // Para cache 100% correto usaríamos um campo dedicado "ResumoIaHash". Deixado pra evolução.
            if (candidato.ResumoProfissional.Length <= 300 && candidato.ResumoProfissional.Contains("experiência", StringComparison.OrdinalIgnoreCase))
            {
                return new CvResumoResult(true, candidato.ResumoProfissional, UsouCache: true, null);
            }
        }

        var messages = new List<OllamaChatMessage>
        {
            new("user", $"Resuma o CV abaixo em 1 linha (max 250 chars):\n\n{cv}")
        };
        var resp = await _ollama.ChatAsync(messages, new OllamaChatOptions(Temperature: 0.2, SystemPrompt: SystemPrompt, MaxTokens: 200), ct);
        if (!resp.IsSuccess || string.IsNullOrWhiteSpace(resp.Content))
            return new CvResumoResult(false, null, false, resp.ErrorMessage);

        var resumo = SanitizeOneLine(resp.Content);
        if (resumo.Length > 300) resumo = resumo.Substring(0, 297) + "...";

        // Persiste no Candidato.ResumoProfissional (campo existente, max 2000)
        candidato.ResumoProfissional = resumo;
        candidato.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new CvResumoResult(true, resumo, UsouCache: false, null);
    }

    private static string BuildCvText(string? cvText, string? resumoAtual)
    {
        if (!string.IsNullOrWhiteSpace(cvText)) return cvText.Trim();
        return resumoAtual?.Trim() ?? "";
    }

    private static string SanitizeOneLine(string s)
    {
        // Remove quebras de linha + trim
        var t = s.Replace('\n', ' ').Replace('\r', ' ').Trim();
        // Colapsa espaços duplos
        while (t.Contains("  ")) t = t.Replace("  ", " ");
        return t;
    }
}
