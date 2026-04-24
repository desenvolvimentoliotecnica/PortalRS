using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Item estruturado dentro de uma <see cref="DescricaoCargo"/> — uma linha do
/// template DNALIO (atividade, vivência, competência ou requisito obrigatório).
///
/// O <see cref="Categoria"/> distingue qual seção o item pertence; o
/// <see cref="MatchingService"/> agrupa por categoria para calcular score
/// granular (Competências DNALIO, Vivências obrigatórias, Competências Técnicas, etc.).
///
/// Cada item pode ter um <see cref="NivelMinimo"/> opcional (ex.: "Avançado" pra
/// uma competência técnica), usado no matching para distinguir requisitos de
/// nível básico vs avançado.
/// </summary>
public sealed class DescricaoCargoItem : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid DescricaoCargoId { get; set; }
    public DescricaoCargo? DescricaoCargo { get; set; }

    public DescricaoCargoItemCategoria Categoria { get; set; }

    /// <summary>Texto livre da linha (ex.: "Hardware", "Trabalho em Equipe", "Experiência em sistemas de Chamado").</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string Texto { get; set; } = default!;

    /// <summary>
    /// Marca o item como obrigatório (Obrigatório vs Desejável no template).
    /// Significativo principalmente para <c>VivenciaEspecifica</c>, <c>RequisitoObrigatorio</c>
    /// e <c>CompetenciaTecnica</c>. Para outras categorias, fica como <c>true</c> por padrão.
    /// </summary>
    public bool IsObrigatoria { get; set; } = true;

    /// <summary>
    /// Nível mínimo aceitável (ex.: "Básico", "Intermediário", "Avançado", "Fluente").
    /// Texto livre para flexibilidade — competências técnicas e idiomas costumam usar.
    /// Pode ficar null para itens sem gradação (atividades, requisitos binários).
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(40)]
    public string? NivelMinimo { get; set; }

    /// <summary>
    /// Categoria livre interna (ex.: "Hardware", "Software", "Idioma", "Segurança da Informação").
    /// Permite agrupar itens do mesmo tipo dentro de <c>CompetenciaTecnica</c> sem criar
    /// tabela adicional. Para idioma, usar este campo para o nome do idioma (ex.: "Inglês").
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(80)]
    public string? Subcategoria { get; set; }

    /// <summary>Ordem de exibição dentro da categoria.</summary>
    public int Ordem { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
