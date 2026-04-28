namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template de mensagem de feedback — atalho rápido com placeholder estruturado
/// para eliminar a "tela em branco" ao enviar feedback (Entrega 1.3 — Fase 1 Paridade Feedz).
///
/// Diferente de Avaliacao/1:1 (que têm sub-itens), aqui o template é monolítico:
/// um único <see cref="Conteudo"/> com placeholders entre colchetes (ex: "[contexto]",
/// "[comportamento específico]") que o usuário substitui ao escrever.
/// </summary>
public sealed class FeedbackTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código canônico estável (ex: "Reconhecimento", "Construtivo"). Único por tenant.</summary>
    public string Codigo { get; set; } = default!;

    /// <summary>Nome exibido no card do catálogo.</summary>
    public string Nome { get; set; } = default!;

    /// <summary>Descrição contextual — quando usar este modelo.</summary>
    public string? Descricao { get; set; }

    /// <summary>Tag de categoria ("Reconhecimento", "Construtivo", "Comunicação", etc.).</summary>
    public string? Categoria { get; set; }

    /// <summary>
    /// Texto-base do feedback com placeholders entre colchetes. O frontend pré-popula
    /// o campo Content do <see cref="FeedbackItem"/> com este texto e o usuário substitui.
    /// </summary>
    public string Conteudo { get; set; } = default!;

    /// <summary>Tipo sugerido (positivo/construtivo/observação) — copiado para FeedbackItem.Tipo se aplicável.</summary>
    public string? TipoSugerido { get; set; }

    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public int Ordem { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }
}
