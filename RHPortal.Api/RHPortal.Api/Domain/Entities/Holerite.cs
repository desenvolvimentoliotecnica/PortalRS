using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Holerite (recibo de pagamento) de um colaborador em determinado mês/ano.
/// Pode ser enviado pelo RH (upload manual) ou pelo TOTVS (webhook).
/// </summary>
public sealed class Holerite : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Mês de referência (1–12).</summary>
    public int MesReferencia { get; set; }

    /// <summary>Ano de referência (ex: 2026).</summary>
    public int AnoReferencia { get; set; }

    /// <summary>Caminho relativo do arquivo no storage (wwwroot ou S3 key).</summary>
    [MaxLength(500)]
    public string ArquivoPath { get; set; } = default!;

    /// <summary>Nome original do arquivo para exibição.</summary>
    [MaxLength(255)]
    public string ArquivoNome { get; set; } = default!;

    public long TamanhoBytes { get; set; }

    /// <summary>
    /// Quem enviou o holerite. NULL = enviado via webhook do TOTVS.
    /// Preenchido = Id do funcionário RH que fez o upload.
    /// </summary>
    public Guid? EnviadoPorId { get; set; }
    public Funcionario? EnviadoPor { get; set; }

    public DateTimeOffset EnviadoEmUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
