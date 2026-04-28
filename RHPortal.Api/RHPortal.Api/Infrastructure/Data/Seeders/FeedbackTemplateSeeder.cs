using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// 12 templates seed de mensagem de feedback (Entrega 1.3 — Fase 1 Paridade Feedz).
/// Cobertura: reconhecimento, construtivo, comunicação, liderança, colaboração, evolução,
/// pós-projeto, pós-apresentação, sob pressão, proatividade, melhoria pontual, parabéns por marco.
/// Usam placeholders entre colchetes que o usuário substitui (`[contexto]`, `[comportamento]`, etc.).
/// </summary>
public static class FeedbackTemplateSeeder
{
    public const string CodReconhecimento  = "Reconhecimento";
    public const string CodConstrutivo     = "Construtivo";
    public const string CodComunicacao     = "Comunicacao";
    public const string CodLideranca       = "Lideranca";
    public const string CodColaboracao     = "Colaboracao";
    public const string CodEvolucao        = "Evolucao";
    public const string CodPosProjeto      = "PosProjeto";
    public const string CodPosApresentacao = "PosApresentacao";
    public const string CodSobPressao      = "SobPressao";
    public const string CodProatividade    = "Proatividade";
    public const string CodMelhoria        = "Melhoria";
    public const string CodMarco           = "Marco";

    private sealed record TemplateSeed(
        string Codigo, string Nome, string Descricao, string Categoria,
        string TipoSugerido, int Ordem, string Conteudo);

    private static readonly TemplateSeed[] Seeds =
    [
        new(CodReconhecimento, "Reconhecimento de Entrega", "Reconhece um trabalho bem feito, com foco em comportamento específico e impacto.",
            "Reconhecimento", "positivo", 10,
            "Você fez um excelente trabalho em [contexto / projeto].\n\nO que mais me chamou atenção foi [comportamento específico que você observou]. Isso resultou em [impacto / resultado concreto].\n\nContinue assim — esse tipo de atitude faz diferença pro time."),

        new(CodConstrutivo, "Feedback Construtivo", "Estrutura SBI (Situação-Comportamento-Impacto) para feedback de melhoria.",
            "Construtivo", "construtivo", 20,
            "Quero compartilhar um ponto que percebi em [situação específica, com data/contexto].\n\nNotei que você [comportamento observado, sem julgamento]. Isso impactou [consequência concreta para o time / cliente / entrega].\n\nPara as próximas vezes, sugiro [proposta de mudança]. O que você acha?"),

        new(CodComunicacao, "Feedback sobre Comunicação", "Foco em clareza, escuta ativa e estilo de comunicação.",
            "Construtivo", "construtivo", 30,
            "Queria conversar sobre como você comunicou [situação específica].\n\nO que funcionou bem: [ponto positivo de clareza / objetividade].\n\nO que pode melhorar: [observação sobre tom / momento / canal / nível de detalhe].\n\nMinha sugestão é [recomendação concreta para a próxima vez]."),

        new(CodLideranca, "Feedback sobre Liderança", "Específico para líderes/gestores — direção, delegação, desenvolvimento.",
            "Construtivo", "construtivo", 40,
            "Como líder você tem feito [comportamento positivo observado] muito bem — em particular em [exemplo concreto].\n\nUm ponto de evolução que vejo é [comportamento de liderança a desenvolver]. Por exemplo, em [situação], poderia ter [alternativa].\n\nIsso te ajudaria a [benefício para o time / resultado]."),

        new(CodColaboracao, "Feedback sobre Colaboração", "Reconhece ou sinaliza padrão de trabalho em time.",
            "Reconhecimento", "positivo", 50,
            "Sua colaboração em [projeto / situação] foi [positiva / desafiadora].\n\nDestaco [comportamento específico que afetou o time]. O efeito foi [impacto na dinâmica / entrega coletiva].\n\nPara fortalecer, sugiro continuar [comportamento desejado] ou ajustar [comportamento a evoluir]."),

        new(CodEvolucao, "Reconhecimento de Evolução Técnica", "Marca progresso percebido em uma skill ou área específica.",
            "Reconhecimento", "positivo", 60,
            "Tenho observado uma evolução clara em [skill / área técnica / comportamento] desde [referência temporal].\n\nUm exemplo recente foi [situação concreta onde isso ficou visível].\n\nIsso mostra que [interpretação positiva]. Continue investindo em [direção sugerida]."),

        new(CodPosProjeto, "Feedback Pós-Projeto", "Retrospectiva individual sobre a participação em um projeto recém-encerrado.",
            "Misto", "construtivo", 70,
            "Agora que [projeto] terminou, queria devolver alguns pontos sobre sua participação.\n\nO que funcionou muito bem: [destaques positivos com exemplos].\n\nO que aprendemos / pode melhorar para um próximo: [pontos de melhoria específicos].\n\nObrigado pelo esforço e pela [característica notável durante o projeto]."),

        new(CodPosApresentacao, "Feedback Pós-Apresentação", "Devolutiva curta após uma apresentação, demo ou pitch.",
            "Misto", "construtivo", 80,
            "Sobre a apresentação de [tema / data]:\n\nPontos fortes: [estrutura / domínio do conteúdo / engajamento da audiência].\n\nPontos a evoluir: [pacing / slides / respostas a perguntas / abertura ou fechamento].\n\nNo geral [avaliação resumida]. Para a próxima, foque em [1-2 pontos prioritários]."),

        new(CodSobPressao, "Comportamento Sob Pressão", "Reconhece ou sinaliza padrão observado em momento de alta exigência.",
            "Misto", "construtivo", 90,
            "Em [situação de pressão / prazo / crise], notei que você [comportamento observado].\n\nO efeito disso foi [consequência positiva ou negativa].\n\n[Caso positivo: continue assim — é exatamente o que o time precisa nesses momentos.]\n[Caso construtivo: na próxima vez que sentir essa pressão, experimente [alternativa de regulação].]"),

        new(CodProatividade, "Reconhecimento de Proatividade", "Marca uma iniciativa que partiu do colaborador, sem ter sido pedida.",
            "Reconhecimento", "positivo", 100,
            "Quero reconhecer sua iniciativa em [ação específica que você tomou sem ninguém pedir].\n\nIsso resolveu / antecipou [problema / oportunidade] e o impacto foi [resultado concreto].\n\nEsse tipo de proatividade é exatamente o que diferencia um profissional sênior. Continue."),

        new(CodMelhoria, "Pedido de Melhoria Pontual", "Mensagem curta e direta para um ajuste específico, sem peso de avaliação.",
            "Construtivo", "construtivo", 110,
            "Pequeno ajuste pontual: notei que [observação específica e concreta] em [situação].\n\nNa próxima vez, [ação esperada].\n\nÉ um ponto pequeno mas que faz diferença em [contexto / resultado]."),

        new(CodMarco, "Parabéns por Marco / Conquista", "Celebra um marco de carreira, certificação ou conquista pessoal/profissional.",
            "Reconhecimento", "positivo", 120,
            "Parabéns por [marco / conquista — promoção, certificação, projeto entregue, aniversário de empresa, etc.]!\n\nIsso é fruto de [comportamento ou trajetória que você observou]. É um marco que merece ser celebrado.\n\nDesejo / espero [próximo passo / continuidade]. Estou aqui pra apoiar."),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("FeedbackTemplateSeeder requer um tenantId.");

        var existing = await db.FeedbackTemplates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Codigo)
            .ToListAsync(ct);

        var existingSet = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var s in Seeds)
        {
            if (existingSet.Contains(s.Codigo))
                continue;

            db.FeedbackTemplates.Add(new FeedbackTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = s.Codigo,
                Nome = s.Nome,
                Descricao = s.Descricao,
                Categoria = s.Categoria,
                Conteudo = s.Conteudo,
                TipoSugerido = s.TipoSugerido,
                IsSystem = true,
                IsActive = true,
                Ordem = s.Ordem,
                CriadoEmUtc = now,
                AtualizadoEmUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
