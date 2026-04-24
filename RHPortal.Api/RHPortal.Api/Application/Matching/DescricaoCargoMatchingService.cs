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

        var empresa = vaga.CentroCusto?.Empresa;
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
        var profileNorm = MatchingService.NormalizeText(profileText);

        // ── Calcula sub-scores por categoria ────────────────────────────────

        var dc = vaga.DescricaoCargo;
        var itens = dc.Itens.ToList();

        var atividadesEspec = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.AtividadeEspecifica).Select(i => i.Texto).ToList();
        var vivencias       = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.VivenciaEspecifica).Select(i => i.Texto).ToList();
        var compsTecnicas   = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.CompetenciaTecnica).ToList();
        var idiomas         = compsTecnicas.Where(i => string.Equals(i.Subcategoria, "Idioma", StringComparison.OrdinalIgnoreCase)).Select(i => i.Texto).ToList();
        var techNaoIdioma   = compsTecnicas.Where(i => !string.Equals(i.Subcategoria, "Idioma", StringComparison.OrdinalIgnoreCase)).Select(i => i.Texto).ToList();
        var requisitosObrig = itens.Where(i => i.Categoria == DescricaoCargoItemCategoria.RequisitoObrigatorio).Select(i => i.Texto).ToList();

        var criterios = new List<MatchingCriterio>();

        // 1. Competência (atividades específicas)
        if (vaga.PesoCompetencia > 0)
            criterios.Add(BuildCriterio("Competência", vaga.PesoCompetencia, atividadesEspec, profileNorm));

        // 2. Experiência (texto livre — bate ExperienciaTempoMinimo + Especificacao + AreaEstudo)
        if (vaga.PesoExperiencia > 0)
        {
            var termosExp = new List<string>();
            if (!string.IsNullOrWhiteSpace(dc.ExperienciaTempoMinimo)) termosExp.Add(dc.ExperienciaTempoMinimo!);
            if (!string.IsNullOrWhiteSpace(dc.ExperienciaEspecificacao)) termosExp.Add(dc.ExperienciaEspecificacao!);
            criterios.Add(BuildCriterio("Experiência", vaga.PesoExperiencia, termosExp, profileNorm));
        }

        // 3. Formação
        if (vaga.PesoFormacao > 0)
        {
            var termosForm = new List<string>();
            if (!string.IsNullOrWhiteSpace(dc.FormacaoMinima)) termosForm.Add(dc.FormacaoMinima!);
            if (!string.IsNullOrWhiteSpace(dc.FormacaoAreaEstudo)) termosForm.Add(dc.FormacaoAreaEstudo!);
            criterios.Add(BuildCriterio("Formação", vaga.PesoFormacao, termosForm, profileNorm));
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
            criterios.Add(BuildCriterio("Idioma", vaga.PesoIdioma, idiomas, profileNorm));

        // 6. Conhecimento Técnico
        if (vaga.PesoConhecimentoTecnico > 0)
            criterios.Add(BuildCriterio("Conhecimento Técnico", vaga.PesoConhecimentoTecnico, techNaoIdioma, profileNorm));

        // 7. Vivência Específica
        if (vaga.PesoVivenciaEspecifica > 0)
            criterios.Add(BuildCriterio("Vivência Específica", vaga.PesoVivenciaEspecifica, vivencias, profileNorm));

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

        // ── Requisitos obrigatórios — penalidade ────────────────────────────
        var faltando = requisitosObrig
            .Where(req => !string.IsNullOrWhiteSpace(req) &&
                          !profileNorm.Contains(MatchingService.NormalizeText(req), StringComparison.Ordinal))
            .ToList();

        if (faltando.Count > 0)
        {
            scoreFinal = Math.Max(0, scoreFinal - Math.Min(40, faltando.Count * 15));
            scoreFinal = Math.Min(scoreFinal, 60);
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
    /// Constrói um critério genérico para uma categoria: para cada texto da lista,
    /// verifica se aparece no perfil normalizado. Score = (encontrados / total) * 100.
    /// </summary>
    private static MatchingCriterio BuildCriterio(string nome, int peso, IReadOnlyList<string> textos, string profileNorm)
    {
        if (textos.Count == 0)
        {
            return new MatchingCriterio(nome, peso, 0, 0m, Array.Empty<string>(), Array.Empty<string>());
        }

        var cobertos = new List<string>();
        var faltando = new List<string>();
        foreach (var t in textos)
        {
            if (string.IsNullOrWhiteSpace(t)) continue;
            var termo = MatchingService.NormalizeText(t);
            if (string.IsNullOrEmpty(termo)) continue;
            if (profileNorm.Contains(termo, StringComparison.Ordinal))
                cobertos.Add(t);
            else
                faltando.Add(t);
        }

        var totalRelevante = cobertos.Count + faltando.Count;
        var score = totalRelevante > 0 ? (int)Math.Round(cobertos.Count * 100.0 / totalRelevante) : 0;
        var contribuicao = Math.Round((decimal)peso * score / 100m, 1);
        return new MatchingCriterio(nome, peso, score, contribuicao, cobertos, faltando);
    }
}
