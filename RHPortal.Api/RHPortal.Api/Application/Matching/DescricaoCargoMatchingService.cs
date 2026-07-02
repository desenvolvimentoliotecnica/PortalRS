using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Geocoding;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Serviço de matching baseado em <see cref="DescricaoCargo"/> (template DNALIO)
/// + pesos calibrados por vaga + distância geocodificada.
///
/// <para><b>Quando é usado</b>: quando a Vaga tem <c>DescricaoCargoId</c> preenchido,
/// substitui o algoritmo legado de <see cref="MatchingService"/> (que usa apenas
/// <c>Vaga.Requisitos</c>). O algoritmo legado continua válido para vagas sem
/// descrição de cargo vinculada.</para>
///
/// <para><b>Score</b>: 0-100 calculado como soma ponderada de 7 sub-scores
/// (cada um 0-100). Pesos vêm da Vaga (PesoCompetencia/Experiencia/Formacao/
/// Localidade/Idioma/ConhecimentoTecnico/VivenciaEspecifica). Soma esperada: 100.</para>
///
/// <para><b>Sub-scores por categoria DNALIO</b>:
/// <list type="bullet">
///   <item><b>Competência</b> ← <c>AtividadeEspecifica</c>: % de atividades cujo texto aparece no perfil do candidato.</item>
///   <item><b>Experiência</b> ← <c>ExperienciaTempoMinimo</c> + <c>ExperienciaEspecificacao</c>: tenta bater termos no perfil.</item>
///   <item><b>Formação</b> ← <c>FormacaoMinima</c> + <c>FormacaoAreaEstudo</c>: idem.</item>
///   <item><b>Localidade</b> ← distância Haversine entre Pessoa.Lat/Lng e Empresa.Lat/Lng (vagaCC→Empresa).
///         Score = 100 quando dist=0; decai linearmente até <c>Vaga.LocalidadeMaxDistanciaKm</c> (default 50).</item>
///   <item><b>Idioma</b> ← itens <c>CompetenciaTecnica</c> com <c>Subcategoria="Idioma"</c>.</item>
///   <item><b>Conhecimento Técnico</b> ← itens <c>CompetenciaTecnica</c> SEM <c>Subcategoria="Idioma"</c>.</item>
///   <item><b>Vivência Específica</b> ← itens <c>VivenciaEspecifica</c>.</item>
/// </list>
/// </para>
///
/// <para><b>Requisitos obrigatórios</b>: itens <c>RequisitoObrigatorio</c> não atendidos
/// fazem o score ser capado em 60 (alinhado com legado) e marca breakdown.</para>
/// </summary>
public sealed class DescricaoCargoMatchingService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public DescricaoCargoMatchingService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Calcula breakdown completo de matching para um candidato em uma vaga.
    /// Retorna null se a vaga não tem DescricaoCargo (consumidor faz fallback no algoritmo legado).
    /// </summary>
    public async Task<MatchingBreakdown?> CalcularBreakdownAsync(
        Guid candidatoId,
        Guid vagaId,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;

        var vaga = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.DescricaoCargo)
                .ThenInclude(d => d!.Itens)
            .Include(v => v.Empresa)
            .Include(v => v.Unit)
                .ThenInclude(u => u!.Empresa)
            .Include(v => v.CentroCusto)
                .ThenInclude(c => c!.Empresa)
            .FirstOrDefaultAsync(v => v.Id == vagaId && v.TenantId == tenantId, ct);

        if (vaga is null) return null;
        if (vaga.DescricaoCargo is null) return null; // Vaga sem template — usa algoritmo legado

        var candidato = await _db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId && c.TenantId == tenantId, ct);
        if (candidato is null) return null;

        // Coords do candidato — tenta via Talento.Pessoa (se vinculado) ou via lookup
        // por email na tabela Pessoa (mesmo tenant). Candidato não tem PessoaId
        // direto — Pessoa é resolvida pelo email/CPF (cadastro central).
        decimal? candLat = null, candLng = null;
        if (candidato.TalentoId.HasValue)
        {
            var pessoaDoTalento = await _db.Talentos
                .AsNoTracking()
                .Where(t => t.Id == candidato.TalentoId.Value)
                .Select(t => new { t.Pessoa!.Latitude, t.Pessoa.Longitude })
                .FirstOrDefaultAsync(ct);
            if (pessoaDoTalento is not null)
            {
                candLat = pessoaDoTalento.Latitude;
                candLng = pessoaDoTalento.Longitude;
            }
        }
        if (candLat is null && !string.IsNullOrWhiteSpace(candidato.Email))
        {
            var emailNorm = candidato.Email.Trim().ToLowerInvariant();
            var pessoaPorEmail = await _db.Pessoas
                .AsNoTracking()
                .Where(p => p.TenantId == tenantId && p.Email.ToLower() == emailNorm)
                .Select(p => new { p.Latitude, p.Longitude })
                .FirstOrDefaultAsync(ct);
            if (pessoaPorEmail is not null)
            {
                candLat = pessoaPorEmail.Latitude;
                candLng = pessoaPorEmail.Longitude;
            }
        }

        var empresa = vaga.Empresa ?? vaga.Unit?.Empresa ?? vaga.CentroCusto?.Empresa;
        var empresaLat = empresa?.Latitude;
        var empresaLng = empresa?.Longitude;

        // Texto do perfil do candidato — reusa lógica do MatchingService legado
        var competenciaNomes = await _db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId && x.TenantId == tenantId)
            .Select(x => x.Nome)
            .ToListAsync(ct);

        var profileText = MatchingService.BuildCandidateProfileText(
            candidato.CvText, candidato.ResumoProfissional, competenciaNomes);
        // Pipeline de normalização: NFD+lowercase → expansão de sinônimos técnicos (AD → active
        // directory, HD → help desk, etc) → tokens → stems. Sinônimos são aplicados antes do
        // stemming para que tanto a forma siglada quanto a expandida convirjam ao mesmo stem.
        var profileNormRaw = MatchingService.NormalizeText(profileText);
        var profileNorm = TechSynonyms.Expand(profileNormRaw);
        var profileStems = PtBrStemmer.StemTextToSet(profileNorm);

        // ── Calcula sub-scores por categoria ────────────────────────────────

        var dc = vaga.DescricaoCargo;
        var itens = dc.Itens.ToList();

        var atividadesEspec = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.AtividadeEspecifica).Select(i => i.Texto).ToList();
        var vivencias       = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.VivenciaEspecifica).Select(i => i.Texto).ToList();
        var compsTecnicas   = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.CompetenciaTecnica).ToList();
        var idiomas         = compsTecnicas.Where(i => string.Equals(i.Subcategoria, "Idioma", StringComparison.OrdinalIgnoreCase)).Select(i => i.Texto).ToList();
        var techNaoIdioma   = compsTecnicas.Where(i => !string.Equals(i.Subcategoria, "Idioma", StringComparison.OrdinalIgnoreCase)).Select(i => i.Texto).ToList();
        var requisitosObrig = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.RequisitoObrigatorio).Select(i => i.Texto).ToList();

        // ── IDF global da DescricaoCargo ───────────────────────────────────
        // Calcula peso de raridade de cada token no universo dos itens desta descrição.
        // Tokens que aparecem em 1-2 itens (ex.: "manageengine", "active directory") ganham
        // IDF alto; tokens que aparecem em quase todos os itens (ex.: "suporte", "tecnico")
        // ganham IDF baixo. Usado no scoring para premiar match em skills-core raras.
        var todosTextosDnalio = itens
            .Select(i => TechSynonyms.Expand(MatchingService.NormalizeText(i.Texto)))
            .Where(t => !string.IsNullOrEmpty(t))
            .ToList();
        var idfMap = TfIdfWeightCalculator.BuildIdfMap(todosTextosDnalio, PtBrStopwords);

        var criterios = new List<MatchingCriterio>();

        // 1. Competência (atividades específicas)
        if (vaga.PesoCompetencia > 0)
            criterios.Add(BuildCriterio("Competência", vaga.PesoCompetencia, atividadesEspec, profileNorm, profileStems, idfMap));

        // 2. Experiência (texto livre — bate ExperienciaTempoMinimo + Especificacao + AreaEstudo)
        if (vaga.PesoExperiencia > 0)
        {
            var termosExp = new List<string>();
            if (!string.IsNullOrWhiteSpace(dc.ExperienciaTempoMinimo)) termosExp.Add(dc.ExperienciaTempoMinimo!);
            if (!string.IsNullOrWhiteSpace(dc.ExperienciaEspecificacao)) termosExp.Add(dc.ExperienciaEspecificacao!);
            criterios.Add(BuildCriterio("Experiência", vaga.PesoExperiencia, termosExp, profileNorm, profileStems, idfMap));
        }

        // 3. Formação
        if (vaga.PesoFormacao > 0)
        {
            var termosForm = new List<string>();
            if (!string.IsNullOrWhiteSpace(dc.FormacaoMinima)) termosForm.Add(dc.FormacaoMinima!);
            if (!string.IsNullOrWhiteSpace(dc.FormacaoAreaEstudo)) termosForm.Add(dc.FormacaoAreaEstudo!);
            criterios.Add(BuildCriterio("Formação", vaga.PesoFormacao, termosForm, profileNorm, profileStems, idfMap));
        }

        // 4. Localidade (Haversine)
        double? distanciaKm = null;
        if (vaga.PesoLocalidade > 0)
        {
            int locScore;
            if (candLat.HasValue && candLng.HasValue && empresaLat.HasValue && empresaLng.HasValue)
            {
                distanciaKm = HaversineCalculator.DistanceKm(
                    candLat.Value, candLng.Value, empresaLat.Value, empresaLng.Value);
                var maxKm = vaga.LocalidadeMaxDistanciaKm ?? 50;
                // Score linear: dist=0 → 100; dist >= maxKm → 0
                var ratio = Math.Clamp(distanciaKm.Value / maxKm, 0.0, 1.0);
                locScore = (int)Math.Round((1.0 - ratio) * 100);
            }
            else
            {
                // Sem coords: score parcial 50 (penaliza ausência mas não zera)
                locScore = 50;
            }
            var maxKmTxt = vaga.LocalidadeMaxDistanciaKm.HasValue ? $"{vaga.LocalidadeMaxDistanciaKm} km" : "50 km (default)";
            var distTxt = distanciaKm.HasValue ? $"{distanciaKm.Value:F1} km até a empresa" : "sem coordenadas (parcial)";
            criterios.Add(new MatchingCriterio(
                "Localidade",
                vaga.PesoLocalidade,
                locScore,
                Math.Round((decimal)vaga.PesoLocalidade * locScore / 100m, 1),
                new[] { distTxt },
                distanciaKm.HasValue && distanciaKm.Value > (vaga.LocalidadeMaxDistanciaKm ?? 50)
                    ? new[] { $"acima do máximo ({maxKmTxt})" }
                    : Array.Empty<string>()));
        }

        // 5. Idioma
        if (vaga.PesoIdioma > 0)
            criterios.Add(BuildCriterio("Idioma", vaga.PesoIdioma, idiomas, profileNorm, profileStems, idfMap));

        // 6. Conhecimento Técnico
        if (vaga.PesoConhecimentoTecnico > 0)
            criterios.Add(BuildCriterio("Conhecimento Técnico", vaga.PesoConhecimentoTecnico, techNaoIdioma, profileNorm, profileStems, idfMap));

        // 7. Vivência Específica
        if (vaga.PesoVivenciaEspecifica > 0)
            criterios.Add(BuildCriterio("Vivência Específica", vaga.PesoVivenciaEspecifica, vivencias, profileNorm, profileStems, idfMap));

        // ── Score final = soma das contribuições ────────────────────────────
        var pesoTotal = criterios.Sum(c => c.Peso);
        int scoreFinal;
        if (pesoTotal == 0)
        {
            scoreFinal = 0;
        }
        else
        {
            // Normaliza para 100 caso a soma dos pesos não seja 100 (RH calibrou errado)
            var contribTotal = criterios.Sum(c => c.Contribuicao);
            scoreFinal = (int)Math.Round((double)contribTotal * 100 / pesoTotal);
        }

        // ── Requisitos obrigatórios — penalidade seletiva ──────────────────
        // Filtra requisitos PROCESSUAIS (que só se resolvem na entrevista — ex.:
        // "perfil alinhado com o gestor") porque eles não aparecem em CV e
        // penalizariam candidatos injustamente. Só requisitos com skill técnica/
        // comportamental explícita contam para a penalidade.
        var requisitosAvaliaveis = requisitosObrig
            .Where(r => !string.IsNullOrWhiteSpace(r) && !IsRequisitoProcessual(r))
            .ToList();

        var faltando = requisitosAvaliaveis
            .Where(req => !ItemAtendido(req, profileNorm, profileStems, idfMap))
            .ToList();

        if (faltando.Count > 0)
        {
            scoreFinal = Math.Max(0, scoreFinal - Math.Min(20, faltando.Count * 5));
        }

        var threshold = Math.Clamp(vaga.MatchMinimoPercentual, 0, 100);
        var pass = scoreFinal >= threshold;

        return new MatchingBreakdown(
            candidatoId,
            vagaId,
            scoreFinal,
            pass,
            distanciaKm,
            criterios,
            faltando.Count > 0,
            faltando);
    }

    /// <summary>
    /// Constrói um critério genérico para uma categoria.
    ///
    /// <para>Para cada item DNALIO: tokeniza (palavras significativas ≥3 chars sem
    /// stopwords pt-br) e mede a <b>fração de tokens cobertos</b> pelo perfil
    /// do candidato. Score do critério = média das frações × 100.</para>
    ///
    /// <para>Item é considerado "coberto" para fins de listagem se a fração ≥
    /// <see cref="TokenCoverageThreshold"/> (default 0.40), mas a contribuição
    /// para o score é proporcional — não binária. Isso evita os dois extremos
    /// (substring exato = nunca casa; binário com threshold = perde nuance).</para>
    ///
    /// <para><b>Por que tokens e não substring</b>: o template DNALIO tem frases
    /// longas tipo "Documentar e gerenciar solicitações de suporte técnico em
    /// sistema de chamado Help Desk da ManageEngine"; o CV usa palavras-chave
    /// equivalentes ("ManageEngine", "Help Desk", "suporte técnico"). Substring
    /// exigiria copiar a frase do template no CV — irreal.</para>
    /// </summary>
    private static MatchingCriterio BuildCriterio(string nome, int peso, IReadOnlyList<string> textos, string profileNorm, HashSet<string> profileStems, Dictionary<string, double> idfMap)
    {
        if (textos.Count == 0)
        {
            return new MatchingCriterio(nome, peso, 0, 0m, Array.Empty<string>(), Array.Empty<string>());
        }

        var cobertos = new List<string>();
        var faltando = new List<string>();
        double somaFracoes = 0;
        int itensValidos = 0;
        foreach (var t in textos)
        {
            if (string.IsNullOrWhiteSpace(t)) continue;
            var fracao = TokenCoverageFraction(t, profileNorm, profileStems, idfMap);
            somaFracoes += fracao;
            itensValidos++;
            if (fracao >= TokenCoverageThreshold) cobertos.Add(t);
            else faltando.Add(t);
        }

        var score = itensValidos > 0
            ? (int)Math.Round(somaFracoes * 100.0 / itensValidos)
            : 0;
        var contribuicao = Math.Round((decimal)peso * score / 100m, 1);
        return new MatchingCriterio(nome, peso, score, contribuicao, cobertos, faltando);
    }

    /// <summary>Limiar de cobertura para listar item em "cobertos" vs "faltando" (apenas display).</summary>
    private const double TokenCoverageThreshold = 0.40;

    /// <summary>Tamanho mínimo de token significativo (descarta artigos/preposições).</summary>
    private const int MinTokenLength = 3;

    /// <summary>
    /// Verifica se o item está atendido no perfil — usado especificamente pela penalidade
    /// de REQUISITO OBRIGATÓRIO. Intencionalmente usa cobertura simples (sem IDF) com
    /// threshold permissivo (<see cref="RequisitoCoverageThreshold"/> = 30%) porque IDF
    /// tende a super-pesar tokens "semânticos" raros mas não-skill (ex.: "anterior" em
    /// "Experiência anterior em suporte técnico") que o CV quase nunca tem, zerando
    /// candidatos válidos.
    ///
    /// <para>Itens com 1-2 tokens significativos exigem 100% hit (evita falso positivo
    /// em "Hardware" sozinho).</para>
    /// </summary>
    private static bool ItemAtendido(string itemTexto, string profileNorm, HashSet<string> profileStems, Dictionary<string, double> idfMap)
    {
        var tokens = ExtractSignificantTokens(itemTexto);
        if (tokens.Count == 0) return false;
        if (tokens.Count <= 2)
        {
            int hits = 0;
            foreach (var tk in tokens)
                if (TokenHit(tk, profileNorm, profileStems)) hits++;
            return hits == tokens.Count;
        }
        // Cobertura simples (não IDF) — requisito "atendido" se ≥ 30% dos tokens aparecem
        int hitsAll = 0;
        foreach (var tk in tokens)
            if (TokenHit(tk, profileNorm, profileStems)) hitsAll++;
        return ((double)hitsAll / tokens.Count) >= RequisitoCoverageThreshold;
    }

    /// <summary>Threshold de cobertura para requisito obrigatório ser considerado atendido.</summary>
    private const double RequisitoCoverageThreshold = 0.30;

    /// <summary>
    /// Retorna a fração [0..1] de tokens significativos do item que aparecem no perfil,
    /// ponderada por IDF: tokens raros (alta IDF) pesam mais do que genéricos.
    ///
    /// <para><b>Fórmula</b>: <c>score = Σ(hit × idf(token)) / Σ(idf(token))</c>.
    /// Quando IDF é uniforme (todos tokens têm o mesmo peso), reduz ao cálculo
    /// simples hits/total. Com IDF calibrado, bater "ManageEngine" (raro) vale 3-4×
    /// mais que bater "através" (genérico).</para>
    ///
    /// <para>"Aparece" = stem do token está no set de stems do perfil OU token
    /// bruto aparece como substring no perfil normalizado (fallback para siglas).</para>
    /// </summary>
    private static double TokenCoverageFraction(string itemTexto, string profileNorm, HashSet<string> profileStems, Dictionary<string, double> idfMap)
    {
        var tokens = ExtractSignificantTokens(itemTexto);
        if (tokens.Count == 0) return 0;

        double hitWeight = 0;
        double totalWeight = 0;
        foreach (var tk in tokens)
        {
            var stem = PtBrStemmer.Stem(tk);
            var idf = TfIdfWeightCalculator.Get(idfMap, stem);
            totalWeight += idf;
            if (TokenHit(tk, profileNorm, profileStems)) hitWeight += idf;
        }

        if (totalWeight <= 0) return 0;
        return hitWeight / totalWeight;
    }

    /// <summary>
    /// Verifica se um token do item aparece no perfil: primeiro tenta stem → stem
    /// (invariante a flexão verbal/plural), depois fallback pra substring do token bruto.
    /// Ex.: item "trabalhar" stem "trabalh" casa com perfil que tem "trabalho" (stem "trabalh").
    /// </summary>
    private static bool TokenHit(string tokenNorm, string profileNorm, HashSet<string> profileStems)
    {
        var stem = PtBrStemmer.Stem(tokenNorm);
        if (!string.IsNullOrEmpty(stem) && profileStems.Contains(stem)) return true;
        // Fallback: substring do token original (pega siglas e termos sem flexão: "AD", "ManageEngine")
        return profileNorm.Contains(tokenNorm, StringComparison.Ordinal);
    }

    /// <summary>
    /// Heurística: detecta requisitos que são processuais (resolvidos em entrevista/gestor)
    /// e não aparecem em CV. Evita penalizar candidatos por coisas tipo "perfil alinhado
    /// com o gestor" ou "candidatos indicados pelo gestor através de requisição da vaga".
    ///
    /// <para>Padrões: o texto menciona explicitamente "gestor"/"requisição"/"processo
    /// seletivo"/"aprovação" como ator/etapa, sem mencionar skill técnica ou atributo
    /// avaliável em documento.</para>
    /// </summary>
    private static bool IsRequisitoProcessual(string texto)
    {
        var norm = MatchingService.NormalizeText(texto);
        if (string.IsNullOrEmpty(norm)) return true; // texto vazio = ignora

        // Padrões de requisitos processuais
        // "perfil alinhado com o gestor"
        // "candidatos com perfil alinhado ... gestor"
        // "através de requisição da vaga"
        // "indicado pelo gestor"
        // "aprovação do gestor"
        var palavrasProcessuais = new[]
        {
            "alinhado com o gestor", "alinhado com gestor",
            "requisicao da vaga", "requisicao de vaga",
            "indicado pelo gestor", "indicado por gestor",
            "aprovacao do gestor", "aprovado pelo gestor",
            "processo seletivo", "selecao interna",
            "disponibilidade imediata", "disponibilidade para inicio"
        };
        foreach (var p in palavrasProcessuais)
        {
            if (norm.Contains(p, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    /// <summary>
    /// Extrai tokens significativos de um texto: normaliza, EXPANDE SINÔNIMOS
    /// (AD → active directory, comunicacao eficaz → comunicacao efetiva),
    /// splita por espaço, descarta stopwords pt-br e tokens com menos de
    /// <see cref="MinTokenLength"/> chars. Retorna lista deduplicada preservando
    /// insertion order.
    ///
    /// <para><b>Importante</b>: sinônimos são expandidos no item DNALIO com o mesmo
    /// vocabulário usado no perfil — garante que "AD" no template e "Active
    /// Directory" no CV gerem os mesmos tokens pós-normalização.</para>
    /// </summary>
    private static List<string> ExtractSignificantTokens(string texto)
    {
        var norm = MatchingService.NormalizeText(texto);
        if (string.IsNullOrEmpty(norm)) return new List<string>();
        norm = TechSynonyms.Expand(norm);

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<string>();
        foreach (var raw in norm.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (raw.Length < MinTokenLength) continue;
            if (PtBrStopwords.Contains(raw)) continue;
            if (seen.Add(raw)) result.Add(raw);
        }
        return result;
    }

    /// <summary>
    /// Stopwords pt-br básicas (artigos, preposições, conjunções, pronomes mais comuns).
    /// Lista intencionalmente curta — manter apenas termos linguísticos (sem palavras
    /// de domínio, que carregam significado e devem participar do matching).
    /// </summary>
    private static readonly HashSet<string> PtBrStopwords = new(StringComparer.Ordinal)
    {
        // artigos / preposições / conjunções
        "para", "pela", "pelo", "pelas", "pelos", "com", "sem", "sob", "sobre", "entre", "ate",
        "nos", "nas", "dos", "das", "que", "como", "mas", "por", "uma", "uns", "umas",
        "ser", "sido", "sao", "esta", "estao", "estar", "estava", "esteve",
        "tem", "tendo", "teve", "tinha", "ter",
        "isso", "isto", "esse", "essa", "este", "esta", "aquilo", "aquele", "aquela",
        "seu", "sua", "seus", "suas", "dele", "dela", "deles", "delas",
        "nao", "sim", "sera", "serao", "foi", "foram",
        "ainda", "tambem", "entao", "muito", "muita", "muitos", "muitas",
        "mais", "menos", "todo", "toda", "todos", "todas", "cada",
        // verbos auxiliares e termos genéricos comuns em descrições
        "deve", "devera", "devem", "podera", "pode", "podem",
        "atraves", "junto", "qual", "quais", "onde", "quando", "porque",
    };
}
