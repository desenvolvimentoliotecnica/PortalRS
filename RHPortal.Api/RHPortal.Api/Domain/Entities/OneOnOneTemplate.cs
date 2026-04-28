namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template de pauta de reunião 1:1 — catálogo pré-pronto de tópicos por contexto
/// (carreira, performance, projeto, retorno de férias, pós-avaliação, etc.).
///
/// Quando o gestor cria um 1:1 escolhendo um template, o serviço pré-popula
/// <c>OneOnOneMeeting.Subject</c> com <see cref="Nome"/> e <c>Notes</c> com a
/// pauta formatada em markdown (cada <see cref="OneOnOneTemplateItem"/> vira um bullet).
///
/// Templates marcados com <see cref="IsSystem"/> = true chegam via seeder em todo
/// tenant (Carreira, Performance, Projeto, Onboarding, etc.) e não podem ser excluídos
/// pela UI — só duplicados/desativados. Tenants podem criar customizados (IsSystem=false).
/// </summary>
public sealed class OneOnOneTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código canônico estável (ex: "Carreira", "Performance"). Único por tenant.</summary>
    public string Codigo { get; set; } = default!;

    /// <summary>Nome exibido na UI (ex: "Carreira & Crescimento").</summary>
    public string Nome { get; set; } = default!;

    /// <summary>Descrição contextualizando quando usar — mostrada no card do catálogo.</summary>
    public string? Descricao { get; set; }

    /// <summary>Tag de categoria (ex: "Carreira", "Performance", "Wellbeing"). Para filtros futuros.</summary>
    public string? Categoria { get; set; }

    /// <summary>True para templates seed do sistema (não excluíveis). False para customizados pelo tenant.</summary>
    public bool IsSystem { get; set; }

    /// <summary>Se false, template fica oculto da UI (mas mantém histórico/integridade).</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Ordenação visual no catálogo (menor primeiro).</summary>
    public int Ordem { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }

    public List<OneOnOneTemplateItem> Itens { get; set; } = new();
}

/// <summary>Tópico/pauta dentro de um <see cref="OneOnOneTemplate"/> (texto livre).</summary>
public sealed class OneOnOneTemplateItem
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public OneOnOneTemplate? Template { get; set; }

    public string Texto { get; set; } = default!;
    public int Ordem { get; set; }
}
