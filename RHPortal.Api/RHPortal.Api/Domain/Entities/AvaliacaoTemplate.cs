namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template de avaliação de desempenho — catálogo pré-pronto de perguntas
/// reutilizável para criar ciclos rapidamente.
///
/// Templates marcados com <see cref="IsSystem"/> = true são propagados pelo
/// seeder para todo tenant novo (Anual, Semestral, 30-60-90, Auto-avaliação,
/// Líder) e não podem ser excluídos pela UI — apenas duplicados/desativados.
/// Tenants podem criar seus próprios templates customizados (IsSystem=false).
/// </summary>
public sealed class AvaliacaoTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código canônico estável (ex: "Anual", "Semestral"). Único por tenant para os templates de sistema.</summary>
    public string Codigo { get; set; } = default!;

    /// <summary>Nome exibido na UI (ex: "Avaliação Anual 360°").</summary>
    public string Nome { get; set; } = default!;

    /// <summary>Descrição contextualizando quando usar (mostrada no preview do template).</summary>
    public string? Descricao { get; set; }

    /// <summary>Sugestão padrão de período (ex: "Anual", "Q1 YYYY"). Editável ao criar o ciclo.</summary>
    public string? PeriodoSugerido { get; set; }

    /// <summary>True para templates seed criados pelo sistema (não excluíveis). False para customizados pelo tenant.</summary>
    public bool IsSystem { get; set; }

    /// <summary>Se false, template fica oculto da UI (mas mantém histórico/integridade de FK).</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Ordenação visual no catálogo (menor primeiro).</summary>
    public int Ordem { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }

    public List<AvaliacaoTemplatePergunta> Perguntas { get; set; } = new();
}

/// <summary>Pergunta pré-pronta de um <see cref="AvaliacaoTemplate"/> (escala 1-5, igual a <c>AvaliacaoPergunta</c>).</summary>
public sealed class AvaliacaoTemplatePergunta
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public AvaliacaoTemplate? Template { get; set; }

    public string Texto { get; set; } = default!;
    public int Ordem { get; set; }
}
