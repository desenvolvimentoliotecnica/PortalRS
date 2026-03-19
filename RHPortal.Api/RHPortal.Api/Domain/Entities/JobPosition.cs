using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class JobPosition : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Code { get; set; } = default!;   // CAR-XXX
    public string Name { get; set; } = default!;   // "Gerente de Produção"

    public CargoStatus Status { get; set; } = CargoStatus.Active;

    public Guid AreaId { get; set; }
    public Area? Area { get; set; }

    public SeniorityLevel Seniority { get; set; } = SeniorityLevel.Pleno;

    public string? Type { get; set; }              // "Operacional, Liderança..."
    public string? Description { get; set; }       // "Resumo do escopo"

    /// <summary>Descrição editável pelo RH para publicação de vaga. Pode ser diferente do Description interno.</summary>
    public string? DescricaoPublicacao { get; set; }

    /// <summary>Nível hierárquico do cargo (Diretor, Gerente, Analista etc.). Opcional.</summary>
    public Guid? NivelHierarquicoId { get; set; }
    public NivelHierarquico? NivelHierarquico { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
