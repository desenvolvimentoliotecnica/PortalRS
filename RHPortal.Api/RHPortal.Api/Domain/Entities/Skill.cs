using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Skill canônica na taxonomia global (ex: "JavaScript", "React", "Gestão de Projetos").
/// </summary>
public sealed class Skill : ITenantEntity
{
    public Guid Id { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;

    /// <summary>Nome canônico (ex: "JavaScript").</summary>
    [Required, StringLength(180)]
    public string CanonicalName { get; set; } = default!;

    /// <summary>Categoria (ex: "Linguagem", "Framework", "Soft Skill", "Ferramenta").</summary>
    [StringLength(80)]
    public string? Category { get; set; }

    /// <summary>Skill pai na hierarquia (ex: React → JavaScript → Frontend).</summary>
    public Guid? ParentSkillId { get; set; }
    public Skill? ParentSkill { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public ICollection<SkillAlias> Aliases { get; set; } = new List<SkillAlias>();
}

/// <summary>
/// Alias para uma skill (ex: "JS", "ECMAScript", "JavaScript ES6" → Skill "JavaScript").
/// </summary>
public sealed class SkillAlias : ITenantEntity
{
    public Guid Id { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;

    public Guid SkillId { get; set; }
    public Skill? Skill { get; set; }

    /// <summary>Texto do alias (normalizado em lowercase).</summary>
    [Required, StringLength(180)]
    public string AliasName { get; set; } = default!;
}
