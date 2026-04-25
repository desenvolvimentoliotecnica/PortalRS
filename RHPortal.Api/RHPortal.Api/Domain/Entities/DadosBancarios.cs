using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Dados bancários do colaborador para crédito de salário.
/// Um por funcionário — upsert na atualização.
/// </summary>
public sealed class DadosBancarios : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    [MaxLength(200)]
    public string Banco { get; set; } = default!;

    [MaxLength(20)]
    public string Agencia { get; set; } = default!;

    [MaxLength(30)]
    public string Conta { get; set; } = default!;

    public TipoContaBancaria TipoConta { get; set; }

    /// <summary>Chave PIX (CPF, e-mail, telefone ou chave aleatória).</summary>
    [MaxLength(150)]
    public string? Pix { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
