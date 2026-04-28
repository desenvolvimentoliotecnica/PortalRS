using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante que cada tenant tenha o conjunto padrão de 10 templates de pauta para 1:1
/// (Entrega 1.2 — Fase 1 Paridade Feedz).
///
/// Templates IsSystem = true não podem ser excluídos pela UI; podem ser duplicados/desativados.
/// Idempotente: roda a cada startup e em cada provisionamento de tenant.
/// </summary>
public static class OneOnOneTemplateSeeder
{
    /// <summary>Códigos canônicos — únicos por tenant.</summary>
    public const string CodCheckin       = "CheckIn";
    public const string CodCarreira      = "Carreira";
    public const string CodPerformance   = "Performance";
    public const string CodProjeto       = "Projeto";
    public const string CodOnboarding    = "Onboarding";
    public const string CodPosAvaliacao  = "PosAvaliacao";
    public const string CodRetornoFerias = "RetornoFerias";
    public const string CodWellbeing     = "Wellbeing";
    public const string CodConflito      = "Conflito";
    public const string CodPromocao      = "Promocao";

    private sealed record TemplateSeed(
        string Codigo,
        string Nome,
        string Descricao,
        string Categoria,
        int Ordem,
        string[] Itens);

    private static readonly TemplateSeed[] Seeds =
    [
        new(
            CodCheckin,
            "Check-in Semanal Rápido",
            "1:1 curto e direto, ideal para semanas com agenda apertada. Foca em status, bloqueios e prioridades.",
            "Performance",
            10,
            [
                "O que está indo bem desde o último 1:1?",
                "O que precisa de ajuste ou está te bloqueando?",
                "Quais as 2-3 prioridades para a próxima semana?",
                "Há algo no qual você precisa de apoio meu?",
            ]),
        new(
            CodCarreira,
            "Carreira & Crescimento",
            "Conversa de plano de carreira: aspirações de longo prazo, skills a desenvolver e próximos passos concretos.",
            "Carreira",
            20,
            [
                "Como você se enxerga profissionalmente daqui a 1-2 anos?",
                "Quais skills você quer desenvolver para chegar lá?",
                "Quais experiências/projetos te ajudariam a crescer?",
                "O que está faltando hoje no seu cargo atual?",
                "Como posso te ajudar nos próximos 90 dias?",
            ]),
        new(
            CodPerformance,
            "Acompanhamento de Metas",
            "Revisão estruturada das metas/OKRs do período: progresso, riscos, suporte necessário.",
            "Performance",
            30,
            [
                "Status de cada meta principal do período (verde/amarelo/vermelho).",
                "Quais entregas avançaram e quais estão atrasadas?",
                "Quais riscos enxerga para fechar o período?",
                "O que precisa ser repriorizado ou descontinuado?",
                "Que recursos/decisões você precisa de mim?",
            ]),
        new(
            CodProjeto,
            "Status de Projeto",
            "Foco em um projeto específico: escopo, timeline, riscos e dependências cross-time.",
            "Performance",
            40,
            [
                "Qual o status atual do projeto contra o plano?",
                "Quais marcos foram entregues desde o último 1:1?",
                "Quais bloqueios técnicos ou de negócio existem?",
                "Há dependências de outras áreas em risco?",
                "Que decisões precisam ser tomadas nesta semana?",
            ]),
        new(
            CodOnboarding,
            "Onboarding (30/60/90 dias)",
            "Acompanhamento estruturado dos primeiros 90 dias do colaborador novo. Use a cada marco.",
            "Onboarding",
            50,
            [
                "Como você está se sentindo na empresa até agora?",
                "O que aprendeu sobre o cargo, time e cultura nas últimas semanas?",
                "Quais dúvidas ainda persistem sobre processos, ferramentas ou pessoas?",
                "Há algo do onboarding que poderia ter sido melhor?",
                "Quais são as prioridades concretas para os próximos 30 dias?",
                "Tem todo o acesso/equipamento/treinamento que precisa?",
            ]),
        new(
            CodPosAvaliacao,
            "Pós-Avaliação de Desempenho",
            "Conversa imediatamente após o ciclo formal: revisar feedbacks, alinhar expectativas, montar plano de desenvolvimento.",
            "Carreira",
            60,
            [
                "Como você recebeu os feedbacks do ciclo? Algum surpreendeu?",
                "Quais pontos fortes você quer continuar amplificando?",
                "Quais pontos de desenvolvimento você prioriza para o próximo ciclo?",
                "Que ações concretas (curso, projeto, mentoria) entram no PDI?",
                "Há expectativas minhas como gestor que precisamos realinhar?",
            ]),
        new(
            CodRetornoFerias,
            "Retorno de Férias / Afastamento",
            "Reabertura suave após período fora — atualização do que mudou e re-priorização das próximas entregas.",
            "Wellbeing",
            70,
            [
                "Como foram as férias / o período fora? Conseguiu desconectar?",
                "Como está se sentindo no retorno?",
                "Resumo do que aconteceu enquanto você estava fora (decisões, mudanças, novidades).",
                "Como está a carga de trabalho acumulada — precisa de ajuda para repriorizar?",
                "Algo mudou nas suas prioridades pessoais que afeta o trabalho?",
            ]),
        new(
            CodWellbeing,
            "Bem-estar & Carga de Trabalho",
            "Conversa específica sobre saúde mental, carga, energia e equilíbrio. Fundamental quando humor está em queda.",
            "Wellbeing",
            80,
            [
                "Como você está se sentindo nas últimas semanas (energia, motivação, ansiedade)?",
                "Como está sua carga de trabalho — sustentável, no limite, insustentável?",
                "Há alguma fonte específica de estresse que eu possa ajudar a remover?",
                "Está conseguindo desconectar fora do horário?",
                "O que mudaria no seu dia a dia se pudesse?",
            ]),
        new(
            CodConflito,
            "Resolução de Conflito",
            "Conversa para lidar com tensão entre colegas, áreas ou diferenças de expectativa. Foco em fatos, sentimentos e próximos passos.",
            "Wellbeing",
            90,
            [
                "Descreva a situação como você está vendo (fatos, sem julgamentos).",
                "Como isso está te afetando profissional e pessoalmente?",
                "Qual seria o resultado ideal para você?",
                "Que parte está sob seu controle?",
                "Quais próximos passos vamos combinar (com prazo)?",
            ]),
        new(
            CodPromocao,
            "Conversa sobre Promoção",
            "Diálogo formal sobre evolução de cargo: critérios objetivos, evidências, timeline e gaps.",
            "Carreira",
            100,
            [
                "Quais conquistas concretas justificariam a promoção?",
                "Que comportamentos do próximo nível você já demonstra hoje?",
                "Quais gaps existem entre você e o nível-alvo?",
                "Há projetos ou responsabilidades que aceleram esse caminho?",
                "Qual timeline realista (próximo ciclo, 6 meses, 1 ano)?",
            ]),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("OneOnOneTemplateSeeder requer um tenantId.");

        var existingCodigos = await db.OneOnOneTemplates
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

            var template = new OneOnOneTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = seed.Codigo,
                Nome = seed.Nome,
                Descricao = seed.Descricao,
                Categoria = seed.Categoria,
                IsSystem = true,
                IsActive = true,
                Ordem = seed.Ordem,
                CriadoEmUtc = now,
                AtualizadoEmUtc = now,
                Itens = seed.Itens
                    .Select((texto, idx) => new OneOnOneTemplateItem
                    {
                        Id = Guid.NewGuid(),
                        Texto = texto,
                        Ordem = idx + 1,
                    }).ToList(),
            };

            db.OneOnOneTemplates.Add(template);
        }

        await db.SaveChangesAsync(ct);
    }
}
