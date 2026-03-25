using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Ciclo de avaliação de desempenho formal com perguntas configuradas.</summary>
public sealed class AvaliacaoCiclo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Ex: "Avaliação Q1 2026"</summary>
    public string Nome { get; set; } = default!;

    /// <summary>Ex: "Q1 2026", "Semestral 2026"</summary>
    public string Periodo { get; set; } = default!;

    public AvaliacaoCicloStatus Status { get; set; } = AvaliacaoCicloStatus.Aberto;

    public Guid CriadoPorId { get; set; }
    public Funcionario? CriadoPor { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }

    public List<AvaliacaoPergunta> Perguntas { get; set; } = new();
    public List<AvaliacaoResposta> Respostas { get; set; } = new();
}

/// <summary>Pergunta de um ciclo de avaliação (escala 1-5).</summary>
public sealed class AvaliacaoPergunta
{
    public Guid Id { get; set; }
    public Guid CicloId { get; set; }
    public AvaliacaoCiclo? Ciclo { get; set; }

    public string Texto { get; set; } = default!;
    public int Ordem { get; set; }
}
