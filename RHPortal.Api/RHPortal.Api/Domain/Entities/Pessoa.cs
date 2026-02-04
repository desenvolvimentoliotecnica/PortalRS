using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Entidade de pessoa — registra dados da pessoa. Base para Talento e Funcionário.</summary>
public sealed class Pessoa : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Origem do cadastro: manual, talento, vaga, email, site, pasta, funcionário ou outro.</summary>
    public OrigemPessoa Origem { get; set; } = OrigemPessoa.Manual;

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [Required, StringLength(180)]
    public string Email { get; set; } = string.Empty;

    [StringLength(40)]
    public string? Fone { get; set; }

    [StringLength(120)]
    public string? Cidade { get; set; }

    [StringLength(2)]
    public string? Uf { get; set; }

    [StringLength(260)]
    public string? LinkedinUrl { get; set; }

    [StringLength(2000)]
    public string? ResumoProfissional { get; set; }

    [StringLength(2000)]
    public string? Obs { get; set; }

    [StringLength(20)]
    public string? Cep { get; set; }

    [StringLength(200)]
    public string? Logradouro { get; set; }

    [StringLength(40)]
    public string? Numero { get; set; }

    [StringLength(120)]
    public string? Bairro { get; set; }

    [StringLength(120)]
    public string? Complemento { get; set; }

    [StringLength(14)]
    public string? Cpf { get; set; }

    [StringLength(20)]
    public string? Rg { get; set; }

    [StringLength(40)]
    public string? FoneContato { get; set; }

    /// <summary>Data de nascimento (apenas data, sem hora).</summary>
    public DateTime? DataNascimento { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public List<PessoaBloqueio> Bloqueios { get; set; } = new();
}
