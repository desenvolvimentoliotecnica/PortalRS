using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante que cada tenant tenha o conjunto padrão de 5 templates de avaliação prontos
/// (Entrega 1.1 — Fase 1 Paridade Feedz).
///
/// Templates IsSystem = true não podem ser excluídos pela UI; podem ser duplicados/desativados
/// e o tenant pode criar customizados (IsSystem = false) via POST /api/avaliacao/templates.
///
/// Idempotente: roda a cada startup e em cada provisionamento de tenant. Se o template já existe
/// (Codigo único por tenant), o seeder não toca nele — preserva customizações de RH como
/// desativação ou edição de descrição.
/// </summary>
public static class AvaliacaoTemplateSeeder
{
    /// <summary>Códigos canônicos — estáveis, usados como chave única por tenant.</summary>
    public const string CodAnual          = "Anual";
    public const string Cod180Graus       = "Av180";
    public const string Cod90Graus        = "Av90";
    public const string CodSemestral      = "Semestral";
    public const string CodTrintaSessenta = "30-60-90";
    public const string CodAutoAvaliacao  = "Auto";
    public const string CodLider          = "Lider";

    private sealed record TemplateSeed(
        string Codigo,
        string Nome,
        string Descricao,
        string PeriodoSugerido,
        int Ordem,
        string[] Perguntas);

    private static readonly TemplateSeed[] Seeds =
    [
        new(
            CodAnual,
            "Avaliação Anual 360°",
            "Avaliação completa anual com perguntas amplas — ideal para o ciclo formal de fim de ano cobrindo desempenho, comportamento e potencial.",
            "Anual",
            10,
            [
                "Atinge consistentemente as metas e entregas combinadas no período.",
                "Demonstra autonomia e proatividade na resolução de problemas complexos.",
                "Comunica-se de forma clara, objetiva e respeitosa com pares e gestores.",
                "Colabora ativamente com outras áreas e contribui para o coletivo do time.",
                "Recebe feedback de forma construtiva e aplica em melhorias visíveis.",
                "Demonstra domínio técnico/funcional adequado ao nível e cargo.",
                "Vive os valores e a cultura da empresa no dia a dia.",
                "Apresenta potencial e disposição para assumir mais responsabilidades.",
            ]),
        new(
            Cod180Graus,
            "Avaliação 180° (Gestor + Autoavaliação)",
            "Duas perspectivas: o liderado se autoavalia e o gestor avalia o liderado. Cria diálogo direto sem o peso do 360° — ideal para ciclos formais com prazo curto, equipes pequenas ou primeira avaliação estruturada.",
            "Trimestral ou Semestral",
            12,
            [
                "Demonstra clareza sobre as expectativas e o escopo do cargo.",
                "Cumpre as metas e entregas combinadas no período.",
                "Comunica-se de forma efetiva com a equipe e a liderança.",
                "Recebe feedback de forma construtiva e aplica em melhorias.",
                "Demonstra evolução técnica e comportamental ao longo do ciclo.",
                "Vive os valores e a cultura da empresa no dia a dia.",
            ]),
        new(
            Cod90Graus,
            "Avaliação 90° (Gestor → Liderado)",
            "Avaliação em uma única direção: o gestor avalia o liderado, sem autoavaliação nem pares. Mais rápida e direta — ideal para funções operacionais, equipes grandes, novos contratados ou check-ins recorrentes.",
            "Mensal ou Trimestral",
            14,
            [
                "Cumpre prazos e metas combinadas no período.",
                "Entrega trabalho com qualidade técnica adequada ao cargo.",
                "Resolve problemas dentro do escopo da função sem precisar escalar.",
                "Comunica-se claramente sobre status, riscos e bloqueios.",
                "Demonstra responsabilidade com prazos, processos e recursos da empresa.",
            ]),
        new(
            CodSemestral,
            "Avaliação Semestral",
            "Versão enxuta para meio de ano — foco em metas, comportamento e plano de desenvolvimento, sem o peso da avaliação anual.",
            "Semestral",
            20,
            [
                "Está no caminho para atingir as metas combinadas para o semestre.",
                "Demonstra evolução em relação aos pontos de desenvolvimento da última avaliação.",
                "Mantém boa qualidade técnica nas entregas do dia a dia.",
                "Colabora positivamente com o time e mantém boa comunicação.",
                "Tem clareza sobre as expectativas do cargo e o que precisa evoluir.",
            ]),
        new(
            CodTrintaSessenta,
            "30-60-90 Dias (Onboarding)",
            "Acompanhamento estruturado dos primeiros 90 dias do colaborador novo — combinando integração cultural, técnica e de processos.",
            "Onboarding",
            30,
            [
                "Compreende a missão, valores e cultura da empresa.",
                "Domina os principais processos e ferramentas necessários para o cargo.",
                "Está integrado ao time e construiu boas relações iniciais.",
                "Já entrega valor consistente nas atividades-chave do cargo.",
                "Tem clareza sobre expectativas, metas e próximos passos da função.",
                "Demonstra abertura para feedback e aprendizado contínuo.",
            ]),
        new(
            CodAutoAvaliacao,
            "Autoavaliação Simples",
            "Modelo curto para o colaborador refletir sobre o próprio desempenho antes de uma 1:1, ciclo formal ou conversa de carreira.",
            "Conforme demanda",
            40,
            [
                "Tenho clareza sobre o que é esperado de mim no cargo atual.",
                "Tenho atingido o que combinei com meu gestor / time.",
                "Tenho usado meus pontos fortes no dia a dia.",
                "Tenho evoluído nos pontos de desenvolvimento que identifiquei.",
                "Tenho recebido feedback suficiente para crescer.",
            ]),
        new(
            CodLider,
            "Avaliação de Liderança",
            "Específico para gestores e líderes — avalia capacidade de desenvolver pessoas, delegar, dar feedback e direcionar o time.",
            "Anual ou Semestral",
            50,
            [
                "Define expectativas claras e direção objetiva para o time.",
                "Dá feedback recorrente, específico e útil para o desenvolvimento das pessoas.",
                "Delega de forma adequada, dando autonomia sem abandonar.",
                "Desenvolve sucessores e ajuda os liderados a crescer profissionalmente.",
                "Toma decisões difíceis com responsabilidade e transparência.",
                "Defende o time em momentos de pressão e protege contra ruídos.",
                "É exemplo dos valores e da cultura para o time.",
            ]),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("AvaliacaoTemplateSeeder requer um tenantId.");

        // Ignora query filter — seeder roda antes do TenantContext estar resolvido em alguns paths.
        var existingCodigos = await db.AvaliacaoTemplates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Codigo)
            .ToListAsync(ct);

        var existingSet = existingCodigos.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var now = DateTimeOffset.UtcNow;
        foreach (var seed in Seeds)
        {
            if (existingSet.Contains(seed.Codigo))
                continue;

            var template = new AvaliacaoTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = seed.Codigo,
                Nome = seed.Nome,
                Descricao = seed.Descricao,
                PeriodoSugerido = seed.PeriodoSugerido,
                IsSystem = true,
                IsActive = true,
                Ordem = seed.Ordem,
                CriadoEmUtc = now,
                AtualizadoEmUtc = now,
                Perguntas = seed.Perguntas
                    .Select((texto, idx) => new AvaliacaoTemplatePergunta
                    {
                        Id = Guid.NewGuid(),
                        Texto = texto,
                        Ordem = idx + 1,
                    }).ToList(),
            };

            db.AvaliacaoTemplates.Add(template);
        }

        await db.SaveChangesAsync(ct);
    }
}
