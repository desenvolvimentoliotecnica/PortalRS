using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// 4 templates seed de Survey BR validados (Entrega 1.5 — Fase 1 Paridade Feedz):
/// eNPS, Clima, Liderança e Diversidade. Idempotente.
/// </summary>
public static class SurveyTemplateSeeder
{
    public const string CodENPS        = "eNPS";
    public const string CodClima       = "Clima";
    public const string CodLideranca   = "Lideranca";
    public const string CodDiversidade = "Diversidade";

    private sealed record Q(string Texto, string Tipo, IReadOnlyList<string>? Opcoes = null);
    private sealed record TplSeed(string Codigo, string Nome, string Descricao, string TipoSurvey,
        string CadenciaSugerida, int Ordem, Q[] Questions);

    private static readonly TplSeed[] Seeds =
    [
        new(CodENPS, "eNPS — Lealdade do Colaborador",
            "Pergunta única clássica do Net Promoter Score adaptada para colaboradores. Cadência sugerida: trimestral.",
            "eNPS", "0 9 1 */3 *", 10,
            [
                new("Em uma escala de 0 a 10, o quanto você recomendaria nossa empresa como um lugar para trabalhar para um amigo ou familiar?",
                    "Score0-10"),
                new("O que mais te leva a essa nota? (opcional)", "Text"),
            ]),

        new(CodClima, "Pesquisa de Clima Organizacional",
            "Termômetro completo do clima — sentimento, liderança, colaboração, autonomia, reconhecimento e crescimento. Cadência sugerida: semestral.",
            "Clima", "0 9 1 */6 *", 20,
            [
                new("Como você avalia o clima geral do seu time?",
                    "SingleChoice", new[] { "Muito bom", "Bom", "Regular", "Ruim", "Muito ruim" }),
                new("Sinto-me respeitado(a) pela minha liderança no dia a dia.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Tenho autonomia para tomar decisões dentro do meu escopo.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Recebo reconhecimento pelas minhas entregas.",
                    "SingleChoice", new[] { "Sempre", "Frequentemente", "Às vezes", "Raramente", "Nunca" }),
                new("Vejo possibilidades concretas de crescimento na empresa.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("O que mais te energiza no trabalho hoje? (opcional)", "Text"),
                new("O que mais te incomoda no trabalho hoje? (opcional)", "Text"),
            ]),

        new(CodLideranca, "Avaliação de Liderança",
            "Como sua liderança imediata está performando aos olhos do liderado. Cadência sugerida: semestral.",
            "Lideranca", "0 9 1 */6 *", 30,
            [
                new("Minha liderança define expectativas claras sobre o que se espera de mim.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Recebo feedback recorrente e útil para meu desenvolvimento.",
                    "SingleChoice", new[] { "Sempre", "Frequentemente", "Às vezes", "Raramente", "Nunca" }),
                new("Minha liderança me apoia quando preciso (técnica e emocionalmente).",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Posso discordar abertamente da minha liderança sem medo.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Minha liderança é exemplo dos valores e da cultura da empresa.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Algo específico que você gostaria que sua liderança continuasse fazendo? (opcional)", "Text"),
                new("Algo específico que você gostaria que sua liderança parasse ou começasse a fazer? (opcional)", "Text"),
            ]),

        new(CodDiversidade, "Diversidade, Equidade & Inclusão (DE&I)",
            "Pulse anônimo sobre o ambiente em DE&I — pertencimento, equidade de oportunidades e segurança psicológica. Cadência sugerida: anual.",
            "Diversidade", "0 9 1 1 *", 40,
            [
                new("Sinto que posso ser quem eu sou no trabalho (autenticidade).",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Acredito que pessoas de diferentes origens têm oportunidades equivalentes aqui.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("Já presenciei ou sofri algum tipo de comentário/comportamento discriminatório no último ano.",
                    "SingleChoice", new[] { "Sim, frequentemente", "Sim, eventualmente", "Não", "Prefiro não responder" }),
                new("Sinto-me seguro(a) para reportar qualquer situação de assédio ou discriminação.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente" }),
                new("A empresa age efetivamente quando recebe reportes desse tipo.",
                    "SingleChoice", new[] { "Concordo totalmente", "Concordo", "Neutro", "Discordo", "Não sei" }),
                new("Algo que você gostaria de compartilhar de forma anônima sobre o ambiente DE&I? (opcional)", "Text"),
            ]),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("SurveyTemplateSeeder requer um tenantId.");

        var existing = await db.SurveyTemplates
            .IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Codigo)
            .ToListAsync(ct);
        var existingSet = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var s in Seeds)
        {
            if (existingSet.Contains(s.Codigo)) continue;

            db.SurveyTemplates.Add(new SurveyTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = s.Codigo,
                Nome = s.Nome,
                Descricao = s.Descricao,
                TipoSurvey = s.TipoSurvey,
                CadenciaSugerida = s.CadenciaSugerida,
                IsSystem = true,
                IsActive = true,
                Ordem = s.Ordem,
                CriadoEmUtc = now,
                AtualizadoEmUtc = now,
                Questions = s.Questions
                    .Select((q, i) => new SurveyTemplateQuestion
                    {
                        Id = Guid.NewGuid(),
                        Texto = q.Texto,
                        Tipo = q.Tipo,
                        Ordem = i + 1,
                        OpcoesJson = q.Opcoes is { Count: > 0 } ? JsonSerializer.Serialize(q.Opcoes) : null,
                    }).ToList(),
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
