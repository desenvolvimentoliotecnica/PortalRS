namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Histórico de tentativas de criação da requisição no RM (IRM-04). Uma linha por tentativa de envio.
/// </summary>
public sealed class SolicitacaoVagaIntegracaoTentativa : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid SolicitacaoVagaId { get; set; }
    public SolicitacaoVaga? SolicitacaoVaga { get; set; }

    public DateTimeOffset TentativaEmUtc { get; set; }

    /// <summary>True se o RM aceitou a criação ou confirmou idempotência.</summary>
    public bool Sucesso { get; set; }

    /// <summary>Resumo não sensível do payload (evitar PII completo — ver builder).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(8000)]
    public string? PayloadResumo { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(2000)]
    public string? MensagemErro { get; set; }

    /// <summary>Código HTTP, SQL ou identificador técnico curto (opcional).</summary>
    public int? CodigoTecnico { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string? CodigoRmRetornado { get; set; }
}
