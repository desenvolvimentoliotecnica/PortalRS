namespace RhPortal.Api.Domain.Entities;

/// <summary>Respostas de um avaliador sobre um avaliando em um ciclo.</summary>
public sealed class AvaliacaoResposta : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CicloId { get; set; }
    public AvaliacaoCiclo? Ciclo { get; set; }

    public Guid AvaliadorId { get; set; }
    public Funcionario? Avaliador { get; set; }

    public Guid AvaliandoId { get; set; }
    public Funcionario? Avaliando { get; set; }

    /// <summary>Média das notas (1-5). Calculado no momento da submissão.</summary>
    public decimal Score { get; set; }

    /// <summary>JSON: [{perguntaId, nota}]</summary>
    public string RespostasJson { get; set; } = "[]";

    public DateTimeOffset CriadoEmUtc { get; set; }
}
