using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai;

public sealed class SalarioSuggesterService : ISalarioSuggesterService
{
    private readonly AppDbContext _db;
    private readonly IOllamaClient _ollama;
    private readonly ILogger<SalarioSuggesterService> _logger;

    public SalarioSuggesterService(AppDbContext db, IOllamaClient ollama, ILogger<SalarioSuggesterService> logger)
    {
        _db = db;
        _ollama = ollama;
        _logger = logger;
    }

    private const string SystemPrompt = """
        Você ajuda RH a calibrar faixas salariais. Sempre responde em JSON válido:
        { "min": 3500.00, "max": 4800.00, "justificativa": "texto curto" }

        Regra: use SOMENTE os dados internos fornecidos no contexto. Se não houver referência
        similar suficiente, retorne min=null, max=null e explique na justificativa.
        Nunca invente dados de mercado externos.
        """;

    public async Task<SalarioSuggestionResult> SuggerirAsync(Guid vagaId, CancellationToken ct = default)
    {
        var vaga = await _db.Vagas
            .AsNoTracking()
            .Where(v => v.Id == vagaId)
            .Select(v => new
            {
                v.Id, v.Titulo, v.Senioridade, v.Cidade, v.Uf, v.TipoContratacao,
                v.DescricaoCargoId, v.CategoriaSalarialId,
                v.SalarioMinimo, v.SalarioMaximo,
            })
            .FirstOrDefaultAsync(ct);

        if (vaga is null)
            return new SalarioSuggestionResult(false, null, null, null, null, "Vaga não encontrada.");

        // Vagas similares: mesmo cargo (DescricaoCargoId ou título próximo) + mesma UF preferencial
        var referencias = new List<string>();
        var vagasSimilares = new List<(string tit, decimal? min, decimal? max)>();

        if (vaga.DescricaoCargoId.HasValue)
        {
            var rows = await _db.Vagas.AsNoTracking()
                .Where(v => v.Id != vaga.Id && v.DescricaoCargoId == vaga.DescricaoCargoId)
                .Select(v => new { v.Titulo, v.SalarioMinimo, v.SalarioMaximo, v.Uf })
                .Take(10)
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                vagasSimilares.Add((r.Titulo, r.SalarioMinimo, r.SalarioMaximo));
                referencias.Add($"Vaga '{r.Titulo}' ({r.Uf}): {FmtBr(r.SalarioMinimo)} - {FmtBr(r.SalarioMaximo)}");
            }
        }

        // Categoria Salarial do tenant (se a vaga tem uma)
        decimal? catValor = null;
        if (vaga.CategoriaSalarialId.HasValue)
        {
            var cs = await _db.CategoriasSalariais.AsNoTracking()
                .Where(c => c.Id == vaga.CategoriaSalarialId.Value)
                .Select(c => new { c.Code, c.ValorBase })
                .FirstOrDefaultAsync(ct);
            if (cs is not null)
            {
                catValor = cs.ValorBase;
                referencias.Add($"Categoria salarial {cs.Code}: ValorBase R$ {cs.ValorBase:N2}");
            }
        }

        // Dados da DescricaoCargo (senioridade, formação, experiência)
        string? senioridade = vaga.Senioridade?.ToString();
        string? formacaoMinima = null;
        string? experienciaMinima = null;
        if (vaga.DescricaoCargoId.HasValue)
        {
            var dc = await _db.DescricoesCargo.AsNoTracking()
                .Where(d => d.Id == vaga.DescricaoCargoId.Value)
                .Select(d => new { d.FormacaoMinima, d.ExperienciaTempoMinimo })
                .FirstOrDefaultAsync(ct);
            if (dc is not null)
            {
                formacaoMinima = dc.FormacaoMinima;
                experienciaMinima = dc.ExperienciaTempoMinimo;
            }
        }

        var userPrompt = BuildPrompt(vaga.Titulo, senioridade, vaga.Cidade, vaga.Uf, vaga.TipoContratacao?.ToString(), formacaoMinima, experienciaMinima, vagasSimilares, catValor);
        var resp = await _ollama.ChatAsync(
            new List<OllamaChatMessage> { new("user", userPrompt) },
            new OllamaChatOptions(Temperature: 0.2, SystemPrompt: SystemPrompt, MaxTokens: 600),
            ct);
        if (!resp.IsSuccess || string.IsNullOrWhiteSpace(resp.Content))
            return new SalarioSuggestionResult(false, null, null, null, referencias, resp.ErrorMessage);

        var parsed = TryParse(resp.Content);
        if (parsed is null)
            return new SalarioSuggestionResult(false, null, null, null, referencias, "JSON inválido retornado pelo LLM.");

        return new SalarioSuggestionResult(
            IsSuccess: true,
            SalarioMinimoSugerido: parsed.Min,
            SalarioMaximoSugerido: parsed.Max,
            Justificativa: parsed.Justificativa,
            Referencias: referencias,
            ErrorMessage: null);
    }

    private static string BuildPrompt(
        string titulo, string? senioridade, string? cidade, string? uf, string? tipo,
        string? formacaoMin, string? expMin,
        List<(string tit, decimal? min, decimal? max)> vagasSimilares,
        decimal? catValor)
    {
        var sb = new StringBuilder();
        sb.Append("Vaga: ").Append(titulo);
        if (!string.IsNullOrEmpty(senioridade)) sb.Append(" (").Append(senioridade).Append(')');
        if (!string.IsNullOrEmpty(tipo)) sb.Append(" — ").Append(tipo);
        if (!string.IsNullOrEmpty(cidade)) sb.Append(" em ").Append(cidade);
        if (!string.IsNullOrEmpty(uf)) sb.Append('/').Append(uf);
        sb.AppendLine();
        if (!string.IsNullOrEmpty(formacaoMin)) sb.Append("Formação mín: ").AppendLine(formacaoMin);
        if (!string.IsNullOrEmpty(expMin)) sb.Append("Experiência mín: ").AppendLine(expMin);
        if (catValor.HasValue) sb.Append("Categoria salarial interna — ValorBase: R$ ").Append(catValor.Value.ToString("N2")).AppendLine();

        if (vagasSimilares.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("Vagas similares no tenant:");
            foreach (var v in vagasSimilares)
                sb.Append("  • ").Append(v.tit).Append(": ").Append(FmtBr(v.min)).Append(" – ").AppendLine(FmtBr(v.max));
        }
        else sb.AppendLine("Nenhuma vaga similar como referência interna.");

        sb.AppendLine();
        sb.AppendLine("Sugira faixa (min, max) em R$ com base APENAS no contexto acima.");
        return sb.ToString();
    }

    private static string FmtBr(decimal? v) => v.HasValue ? $"R$ {v.Value:N2}" : "—";

    private sealed class Parsed { public decimal? Min { get; set; } public decimal? Max { get; set; } public string? Justificativa { get; set; } }
    private static Parsed? TryParse(string raw)
    {
        try
        {
            var trimmed = raw.Trim();
            if (trimmed.StartsWith("```"))
            {
                var nl = trimmed.IndexOf('\n');
                if (nl > 0) trimmed = trimmed.Substring(nl + 1);
                if (trimmed.EndsWith("```")) trimmed = trimmed.Substring(0, trimmed.Length - 3);
            }
            return JsonSerializer.Deserialize<Parsed>(trimmed, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch { return null; }
    }
}
