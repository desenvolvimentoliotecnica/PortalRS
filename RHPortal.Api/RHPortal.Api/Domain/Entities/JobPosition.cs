using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class JobPosition : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Code { get; set; } = default!;   // CAR-XXX
    public string Name { get; set; } = default!;   // "Gerente de Produção"

    public CargoStatus Status { get; set; } = CargoStatus.Active;

    /// <summary>Centro de custo organizacional deste cargo (absorveu Area em 31.2).</summary>
    public Guid? CentroCustoId { get; set; }
    public CentroCusto? CentroCusto { get; set; }

    public SeniorityLevel Seniority { get; set; } = SeniorityLevel.Pleno;

    public string? Type { get; set; }                          // "Operacional, Liderança..."
    public string? OccupationalClassification { get; set; }   // cod_classific_ocupac
    public string? Description { get; set; }                  // "Resumo do escopo"

    /// <summary>Descrição editável pelo RH para publicação de vaga. Pode ser diferente do Description interno.</summary>
    public string? DescricaoPublicacao { get; set; }

    /// <summary>Nível hierárquico do cargo (Diretor, Gerente, Analista etc.). Opcional.</summary>
    public Guid? NivelHierarquicoId { get; set; }
    public NivelHierarquico? NivelHierarquico { get; set; }

    /// <summary>Indicador de similaridade (legado TOTVS idi_similaridad).</summary>
    public string? SimilarityIndicator { get; set; }

    /// <summary>Descrição completa do cargo (legado TOTVS dsl_complet_cargo).</summary>
    public string? FullDescription { get; set; }

    /// <summary>Nível de cargo TOTVS Datasul (FK → NivelCargo). Mapeado para cdn_niv_cargo na API SetCargo.</summary>
    public Guid? NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    /// <summary>Descrição do envelope de pagamento (des_envel_pagto). Obrigatório na API SetCargo do Datasul. Se nulo, usa o Name.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(40)]
    public string? DesEnvelPagto { get; set; }

    /// <summary>Código do cargo básico no TOTVS Datasul (cdn_cargo_basic). Usado na API SetCargo.</summary>
    public int? TotvsCargoBasicId { get; set; }

    /// <summary>Código do nível de cargo no TOTVS Datasul (cdn_niv_cargo). Usado na API SetCargo.</summary>
    public int? TotvsNivCargoId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
