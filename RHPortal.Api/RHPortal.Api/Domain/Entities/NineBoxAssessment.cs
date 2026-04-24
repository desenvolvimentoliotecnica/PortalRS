namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Posicionamento de um funcionário na matriz Nine-in-Box (3x3).
/// Eixo X = Desempenho (1=Baixo, 2=Médio, 3=Alto)
/// Eixo Y = Potencial (1=Baixo, 2=Médio, 3=Alto)
/// </summary>
public sealed class NineBoxAssessment : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    public Guid AvaliadorId { get; set; }
    public Funcionario? Avaliador { get; set; }

    /// <summary>1 = Baixo, 2 = Médio, 3 = Alto</summary>
    public int Desempenho { get; set; }

    /// <summary>1 = Baixo, 2 = Médio, 3 = Alto</summary>
    public int Potencial { get; set; }

    public string? Observacoes { get; set; }

    /// <summary>
    /// Quando a posição vem de um ciclo de avaliação (via calibragem do comitê),
    /// referencia o ciclo de origem. Null quando é snapshot avulso do gestor.
    /// </summary>
    public Guid? CicloAvaliacaoId { get; set; }
    public AvaliacaoCiclo? CicloAvaliacao { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }
}
