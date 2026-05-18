using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Matching híbrido: combina o score léxico (TF-IDF + stems + sinônimos — do
/// <see cref="DescricaoCargoMatchingService"/>) com o score semântico (kNN via
/// pgvector + embeddings) e localidade (Haversine, já no léxico).
///
/// <para><b>Fórmula</b>: <c>ScoreFinal = 0.30 × léxico + 0.50 × semântico +
/// 0.20 × localidade</c> (normalizado). A localidade vem do léxico pois já usa
/// Haversine; semântico substitui a parte "conteudinal" (competência, experiência,
/// técnico, vivência) que antes era só TF-IDF.</para>
///
/// <para><b>Fallback</b>: quando Ollama não está disponível ou candidato/vaga
/// ainda não têm embeddings calculados, retorna o score léxico puro e marca
/// <c>Modo="fallback"</c>. Garante que a feature nunca quebra a UX.</para>
/// </summary>
public sealed class HybridMatchingService
{
    private readonly DescricaoCargoMatchingService _lexical;
    private readonly IVectorSearchService _vectorSearch;
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<HybridMatchingService> _logger;

    public HybridMatchingService(
        DescricaoCargoMatchingService lexical,
        IVectorSearchService vectorSearch,
        AppDbContext db,
        ITenantContext tenantContext,
        ILogger<HybridMatchingService> logger)
    {
        _lexical = lexical;
        _vectorSearch = vectorSearch;
        _db = db;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    /// <summary>
    /// Calcula o matching híbrido. Se semântico indisponível, cai em léxico puro.
    /// </summary>
    public async Task<MatchingBreakdown?> CalcularHybridAsync(Guid candidatoId, Guid vagaId, CancellationToken ct = default)
    {
        // Léxico sempre roda — é barato, offline, e serve de base/fallback.
        var lexical = await _lexical.CalcularBreakdownAsync(candidatoId, vagaId, ct);
        if (lexical is null) return null;

        // Semântico usa embeddings já persistidos (pgvector). Ollama só é necessário
        // para gerar vetores on-the-fly — não bloqueamos o híbrido se /api/tags falhar
        // mas já existirem linhas em CandidatoEmbeddings / DescricaoCargoItemEmbeddings.

        // Precisamos do DescricaoCargoId + MatchMinimoPercentual para cálculo final
        var vaga = await _db.Vagas
            .AsNoTracking()
            .Where(v => v.Id == vagaId)
            .Select(v => new { v.DescricaoCargoId, v.MatchMinimoPercentual })
            .FirstOrDefaultAsync(ct);

        if (vaga?.DescricaoCargoId is null)
        {
            return lexical with { Modo = "semantic", ScoreLexico = lexical.ScoreFinal };
        }

        // Semântico por categoria
        var semByCat = await _vectorSearch.SemanticScoreByCategoriaAsync(candidatoId, vaga.DescricaoCargoId.Value, ct);
        if (semByCat.Count == 0)
        {
            return lexical with { Modo = "semantic", ScoreLexico = lexical.ScoreFinal };
        }

        var scoreSemanticoAgg = CalcularScoreSemanticoAgregado(semByCat, lexical.Criterios);
        var evidencias = await BuildEvidenciasAsync(candidatoId, vaga.DescricaoCargoId.Value, ct);

        // Blend: léxico 30% + semântico 50% + localidade 20% (localidade já está em lexical.ScoreFinal,
        // mas precisa ser extraída do critério específico pra não contar duas vezes).
        var scoreLocalidade = lexical.Criterios.FirstOrDefault(c => c.Nome == "Localidade")?.Score ?? 50;
        var scoreContentLexical = CalcularScoreLexicoSemLocalidade(lexical);

        var scoreFinal = (int)Math.Round(
            0.30 * scoreContentLexical +
            0.50 * scoreSemanticoAgg +
            0.20 * scoreLocalidade);

        // Ainda penaliza requisitos obrigatórios faltando (léxico já aplicou — mantemos)
        if (lexical.TemRequisitoObrigatorioFaltando)
        {
            var faltando = lexical.RequisitosObrigatoriosFaltando.Count;
            scoreFinal = Math.Max(0, scoreFinal - Math.Min(20, faltando * 5));
        }
        scoreFinal = Math.Clamp(scoreFinal, 0, 100);

        var matchMin = Math.Clamp(vaga.MatchMinimoPercentual, 0, 100);
        return lexical with
        {
            ScoreFinal = scoreFinal,
            PassouMatchMinimo = scoreFinal >= matchMin,
            Modo = "ai",
            ScoreLexico = scoreContentLexical,
            ScoreSemantico = scoreSemanticoAgg,
            EvidenciasSemanticas = evidencias,
        };
    }

    /// <summary>
    /// Score léxico agregado excluindo o critério Localidade (porque entra separadamente).
    /// Calcula a média ponderada só dos critérios "conteudinais".
    /// </summary>
    private static int CalcularScoreLexicoSemLocalidade(MatchingBreakdown lexical)
    {
        var contentCriterios = lexical.Criterios.Where(c => c.Nome != "Localidade").ToList();
        var pesoTotal = contentCriterios.Sum(c => c.Peso);
        if (pesoTotal == 0) return 0;
        var contribTotal = contentCriterios.Sum(c => (double)c.Contribuicao);
        return (int)Math.Round(contribTotal * 100.0 / pesoTotal);
    }

    /// <summary>
    /// Agrega semântico por categoria aplicando os MESMOS pesos da vaga (do léxico).
    /// Categorias sem peso na vaga são ignoradas.
    /// </summary>
    private static int CalcularScoreSemanticoAgregado(
        Dictionary<DescricaoCargoItemCategoria, double> semByCat,
        IReadOnlyList<MatchingCriterio> criteriosLexicos)
    {
        // Mapa critério (Nome) → peso — usado pra replicar ponderação do léxico no semântico
        var pesosByNome = criteriosLexicos.ToDictionary(c => c.Nome, c => c.Peso);

        // Mapa categoria → nome do critério (mesma convenção usada em DescricaoCargoMatchingService)
        var categoriaToCriterio = new Dictionary<DescricaoCargoItemCategoria, string>
        {
            [DescricaoCargoItemCategoria.AtividadeEspecifica] = "Competência",
            [DescricaoCargoItemCategoria.VivenciaEspecifica]  = "Vivência Específica",
            [DescricaoCargoItemCategoria.CompetenciaTecnica]  = "Conhecimento Técnico",
            // Idioma é um subset de CompetenciaTecnica — mesmo peso, tratado junto
        };

        double pesoTotal = 0, somaPesoScore = 0;
        foreach (var kv in semByCat)
        {
            if (!categoriaToCriterio.TryGetValue(kv.Key, out var nomeCriterio)) continue;
            if (!pesosByNome.TryGetValue(nomeCriterio, out var peso) || peso <= 0) continue;
            pesoTotal += peso;
            // Converte similaridade cosseno [0..1] → percentual [0..100] com boost para tornar
            // o score mais legível. Sim cosseno 0.5 já é um match razoável com bge-m3.
            var pct = Math.Clamp(kv.Value * 100, 0, 100);
            somaPesoScore += peso * pct;
        }

        // Se nenhuma categoria correspondente, usa média simples das similaridades
        if (pesoTotal == 0)
        {
            var avg = semByCat.Values.Any() ? semByCat.Values.Average() : 0;
            return (int)Math.Round(Math.Clamp(avg * 100, 0, 100));
        }

        return (int)Math.Round(somaPesoScore / pesoTotal);
    }

    private async Task<IReadOnlyList<SemanticEvidence>> BuildEvidenciasAsync(Guid candidatoId, Guid descricaoCargoId, CancellationToken ct)
    {
        var top = await _vectorSearch.TopItemsForCandidateInDescricaoAsync(candidatoId, descricaoCargoId, topK: 3, ct);
        return top.Select(m => new SemanticEvidence(
            m.Categoria.ToString(),
            m.Subcategoria,
            m.Texto.Length > 200 ? m.Texto.Substring(0, 200) + "..." : m.Texto,
            Math.Round(m.SimilarityScore, 3)
        )).ToList();
    }

}
