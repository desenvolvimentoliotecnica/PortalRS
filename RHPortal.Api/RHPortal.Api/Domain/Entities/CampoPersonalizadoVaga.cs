using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Campo personalizado definido por RH ao configurar uma Vaga.
/// Exemplo: "Possui CNH?", "Disponibilidade para viagem", "Nível de inglês".
/// Esses campos aparecem no Portal quando o candidato se candidata.
/// </summary>
public sealed class CampoPersonalizadoVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    /// <summary>Label do campo (ex: "Possui CNH categoria B?")</summary>
    [Required, MaxLength(200)]
    public string Label { get; set; } = string.Empty;

    /// <summary>Tipo do campo: Texto, Select, Checkbox, Numero</summary>
    public CampoPersonalizadoTipo Tipo { get; set; } = CampoPersonalizadoTipo.Texto;

    /// <summary>Se obrigatório no formulário do portal.</summary>
    public bool Obrigatorio { get; set; }

    /// <summary>Campo "engessado": definido pelo RH, candidato não pode editar (apenas visualizar).</summary>
    public bool IsReadOnly { get; set; }

    /// <summary>Valor padrão do campo (quando engessado, é mostrado como fixo).</summary>
    [MaxLength(500)]
    public string? ValorPadrao { get; set; }
    /// <summary>Ordem de exibição.</summary>
    public int Ordem { get; set; }

    /// <summary>Opções separadas por ";". Apenas para Tipo = Select. Ex: "Sim;Não;Talvez"</summary>
    [MaxLength(1000)]
    public string? Opcoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public enum CampoPersonalizadoTipo : short
{
    Texto = 0,
    Select = 1,
    Checkbox = 2,
    Numero = 3
}
