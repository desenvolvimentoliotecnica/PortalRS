namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Descrição de cargo — conteúdo rico (missão, responsabilidades, requisitos, diferenciais)
/// mantido na plataforma e reutilizado como template para criação de vagas.
/// Épico "Core Cadastros — Descrição de Cargos" (visão arquitetural §6.4).
/// Pode ser marcado como Template e/ou vinculado a um NivelCargo (Cargo Macro).
/// </summary>
public sealed class DescricaoCargo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código interno (ex.: DC-0001). Único por tenant.</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Título legível do cargo (ex.: "Analista de Produto Pleno").</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string Title { get; set; } = default!;

    /// <summary>Resumo/missão do cargo (1-2 parágrafos).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(2000)]
    public string? Summary { get; set; }

    /// <summary>Responsabilidades (HTML/Markdown livre do editor).</summary>
    public string? Responsibilities { get; set; }

    /// <summary>Requisitos (HTML/Markdown livre do editor).</summary>
    public string? Requirements { get; set; }

    /// <summary>Diferenciais / nice-to-have (HTML/Markdown livre do editor).</summary>
    public string? NiceToHave { get; set; }

    /// <summary>Benefícios oferecidos (HTML/Markdown livre do editor).</summary>
    public string? Benefits { get; set; }

    /// <summary>
    /// Flag indicando que a descrição é um template reutilizável
    /// (tipicamente vinculada a um NivelCargo). Não exclui uso direto em vaga.
    /// </summary>
    public bool IsTemplate { get; set; }

    /// <summary>Nível de cargo (Cargo Macro) ao qual a descrição está vinculada. Opcional.</summary>
    public Guid? NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
