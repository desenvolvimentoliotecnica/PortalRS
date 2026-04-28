using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Meta individual ou de equipe, com acompanhamento de progresso.</summary>
public sealed class Meta : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Funcionário ao qual a meta pertence.</summary>
    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Funcionário que criou a meta (gestor ou RH).</summary>
    public Guid CriadaPorId { get; set; }
    public Funcionario? CriadaPor { get; set; }

    public string Titulo { get; set; } = default!;
    public string? Descricao { get; set; }

    /// <summary>Valor-alvo a ser atingido.</summary>
    public decimal ValorMeta { get; set; }

    /// <summary>Progresso atual.</summary>
    public decimal ValorAtual { get; set; }

    /// <summary>Unidade de medida: "%", "R$", "qtd", etc.</summary>
    public string Unidade { get; set; } = "%";

    public DateOnly? Prazo { get; set; }

    public MetaStatus Status { get; set; } = MetaStatus.Ativa;

    /// <summary>
    /// OKR cascateado (Entrega 1.6 — Fase 1 Paridade Feedz):
    /// quando preenchido, esta meta é filha de outra (ex: meta da empresa → meta da área → meta individual).
    /// </summary>
    public Guid? ParentMetaId { get; set; }
    public Meta? ParentMeta { get; set; }
    public ICollection<Meta> ChildMetas { get; set; } = new List<Meta>();

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }

    public ICollection<MetaCheckin> Checkins { get; set; } = new List<MetaCheckin>();
}

/// <summary>
/// Check-in semanal/quinzenal sobre o progresso de uma meta (Entrega 1.6 — Fase 1 Paridade Feedz).
/// Equivalente ao "weekly status" do Lattice/Qulture: snapshot de Status (verde/amarelo/vermelho)
/// + ValorAtual no momento + comentário.
/// </summary>
public sealed class MetaCheckin : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid MetaId { get; set; }
    public Meta? Meta { get; set; }

    /// <summary>Status semanal — 1=Verde (no caminho), 2=Amarelo (atenção), 3=Vermelho (em risco).</summary>
    public int Status { get; set; }

    public decimal? ValorAtual { get; set; }

    public string? Comentario { get; set; }

    public Guid CriadoPorId { get; set; }
    public Funcionario? CriadoPor { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
}
