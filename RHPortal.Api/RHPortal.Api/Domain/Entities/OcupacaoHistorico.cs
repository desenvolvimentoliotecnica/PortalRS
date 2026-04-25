using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

public sealed class OcupacaoHistorico : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid? VagaId { get; set; }
    public Vaga? Vaga { get; set; }

    public Guid? FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    public DateTime DataEntrada { get; set; }
    public DateTime? DataSaida { get; set; }
    public MotivoSaidaOcupacao? MotivoSaida { get; set; }

    /// <summary>Id da solicitação (desligamento, promoção etc.) que gerou este evento.</summary>
    public Guid? SolicitacaoOrigemId { get; set; }

    /// <summary>
    /// Quando true, este slot foi criado por uma requisição de substituição e está em período provisório.
    /// </summary>
    public bool IsProvisorio { get; set; } = false;

    /// <summary>
    /// Data/hora em que o slot provisório expira. Null para slots normais.
    /// </summary>
    public DateTimeOffset? ProvisorioExpiresAtUtc { get; set; }
}

public enum MotivoSaidaOcupacao
{
    Desligamento = 0,
    Promocao = 1,
    Transferencia = 2,
    Manual = 3,
}
