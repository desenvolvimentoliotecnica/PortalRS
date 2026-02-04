using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using LioTecnica.Web.Infrastructure.Serialization;

namespace LioTecnica.Web.ViewModels.Admin;

public sealed record UserListItemViewModel(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    IReadOnlyList<string> Roles,
    FuncionarioInfoViewModel? Funcionario = null
);

public sealed record UnitInfoViewModel(Guid Id, string Code, string Name);

public sealed record ManagerInfoViewModel(Guid Id, string Name, string? Email);

public sealed record FuncionarioInfoViewModel(Guid Id, string Name, string? Email);

public sealed record UserResponseViewModel(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    IReadOnlyList<RoleInfoViewModel> Roles,
    IReadOnlyList<UnitInfoViewModel> Units,
    FuncionarioInfoViewModel? Funcionario,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record RoleListItemViewModel(
    Guid Id,
    string Name,
    string Description,
    bool IsActive,
    [property: JsonConverter(typeof(EnumNameOrNumberToIntConverter))] int VisibilityScope,
    [property: JsonConverter(typeof(EnumNameOrNumberToIntConverter))] int VagasDataScope,
    [property: JsonConverter(typeof(EnumNameOrNumberToIntConverter))] int AccessMode
);

public sealed record RoleResponseViewModel(
    Guid Id,
    string Name,
    string Description,
    bool IsActive,
    [property: JsonConverter(typeof(EnumNameOrNumberToIntConverter))] int VisibilityScope,
    [property: JsonConverter(typeof(EnumNameOrNumberToIntConverter))] int VagasDataScope,
    [property: JsonConverter(typeof(EnumNameOrNumberToIntConverter))] int AccessMode,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record RoleInfoViewModel(
    Guid Id,
    string Name
);

public sealed record MenuListItemViewModel(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool IsActive,
    bool OpenInNewTab
);

public sealed record MenuResponseViewModel(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool IsActive,
    bool OpenInNewTab,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record MenuForCurrentUserViewModel(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool OpenInNewTab
);

public sealed record RoleMenuAssignmentViewModel(
    Guid MenuId,
    string PermissionKey
);

public sealed class UsersPageViewModel
{
    public IReadOnlyList<UserListItemViewModel> Users { get; init; } = Array.Empty<UserListItemViewModel>();
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
}

public sealed class UserEditViewModel
{
    public UserFormModel User { get; init; } = new();
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
    public IReadOnlyList<UnitInfoViewModel> Units { get; init; } = Array.Empty<UnitInfoViewModel>();
    public IReadOnlyList<FuncionarioInfoViewModel> Funcionarios { get; init; } = Array.Empty<FuncionarioInfoViewModel>();
    public bool IsNew { get; init; }
}

public sealed class RolesPageViewModel
{
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
}

public sealed class MenusPageViewModel
{
    public IReadOnlyList<MenuListItemViewModel> Menus { get; init; } = Array.Empty<MenuListItemViewModel>();
}

public sealed class AccessesPageViewModel
{
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
    public IReadOnlyList<MenuListItemViewModel> Menus { get; init; } = Array.Empty<MenuListItemViewModel>();
    public IReadOnlyList<RoleMenuAssignmentViewModel> RoleMenus { get; init; } = Array.Empty<RoleMenuAssignmentViewModel>();
    public Guid? SelectedRoleId { get; init; }
}

public sealed class UserFormModel
{
    public Guid? Id { get; set; }

    [Required, EmailAddress, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    /// <summary>Obrigatório na criação. Na edição, opcional (preencher apenas para alterar). Mínimo 8 caracteres.</summary>
    [MaxLength(120)]
    public string? Password { get; set; }

    public bool IsActive { get; set; } = true;

    public List<Guid> RoleIds { get; set; } = new();

    public Guid? FuncionarioId { get; set; }

    public List<Guid> UnitIds { get; set; } = new();
}

public sealed class RoleFormModel
{
    public Guid? Id { get; set; }

    [Required, MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    /// <summary>0 = FullStructure, 1 = RestrictedByAreaOrRecruiter</summary>
    public int VisibilityScope { get; set; }

    /// <summary>0 = All, 1 = ByArea, 2 = ByRecrutador</summary>
    public int VagasDataScope { get; set; }

    /// <summary>0 = Full, 1 = ReadOnly</summary>
    public int AccessMode { get; set; }
}

public sealed class MenuFormModel
{
    public Guid? Id { get; set; }

    [Required, MaxLength(160)]
    public string DisplayName { get; set; } = string.Empty;

    [Required, MaxLength(240)]
    public string Route { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Icon { get; set; } = string.Empty;

    public int Order { get; set; }

    public Guid? ParentId { get; set; }

    [Required, MaxLength(160)]
    public string PermissionKey { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class RoleMenusFormModel
{
    [Required]
    public Guid RoleId { get; set; }

    public List<RoleMenuAssignmentViewModel> Items { get; set; } = new();
}

public sealed class AccessesFormModel
{
    [Required]
    public Guid RoleId { get; set; }

    public List<string> SelectedPermissions { get; set; } = new();
}

public sealed record EmailTemplateListItemViewModel(
    Guid Id,
    string Name,
    int Version,
    bool IsActive,
    string SubjectTemplate,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record EmailTemplateResponseViewModel(
    Guid Id,
    string Name,
    int Version,
    bool IsActive,
    string SubjectTemplate,
    string BodyHtml,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record EmailTemplateCreateViewModel(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(200)] string SubjectTemplate,
    [Required] string BodyHtml
);

public sealed record EmailTemplateUpdateViewModel(
    [Required, MaxLength(200)] string SubjectTemplate,
    [Required] string BodyHtml
);

public sealed record EmailMessageListItemViewModel(
    Guid Id,
    string To,
    string Subject,
    string Status,
    int AttemptCount,
    int MaxAttempts,
    bool IsSystem,
    string? OwnerUserName,
    string? Source,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record EmailMessageListResponseViewModel(
    IReadOnlyList<EmailMessageListItemViewModel> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages
);

public sealed record EmailAttemptItemViewModel(
    Guid Id,
    int AttemptNumber,
    string Provider,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    bool IsSuccess,
    string? ErrorMessage
);

public sealed record EmailMessageDetailViewModel(
    Guid Id,
    string To,
    string Subject,
    string BodyHtml,
    string Status,
    int AttemptCount,
    int MaxAttempts,
    bool IsSystem,
    string? OwnerUserName,
    string? Source,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    IReadOnlyList<EmailAttemptItemViewModel> Attempts
);

public sealed record EmailSummaryViewModel(
    int Total,
    int InQueue,
    int Failed,
    int SentToday
);

public sealed class EmailConfigViewModel
{
    public string Provider { get; set; } = "smtp";
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public bool SmtpEnableSsl { get; set; } = true;
    public string? SmtpUserName { get; set; }
    public bool SmtpHasPassword { get; set; }
    public string? SmtpFromName { get; set; }
    public string? SmtpFromAddress { get; set; }
    public string? ImapHost { get; set; }
    public int ImapPort { get; set; } = 993;
    public bool ImapEnableSsl { get; set; } = true;
    public string? ImapUserName { get; set; }
    public bool ImapHasPassword { get; set; }
}

public sealed class EmailConfigRequest
{
    public string Provider { get; set; } = "smtp";
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public bool SmtpEnableSsl { get; set; } = true;
    public string? SmtpUserName { get; set; }
    public string? SmtpPassword { get; set; }
    public string? SmtpFromName { get; set; }
    public string? SmtpFromAddress { get; set; }
    public string? ImapHost { get; set; }
    public int ImapPort { get; set; } = 993;
    public bool ImapEnableSsl { get; set; } = true;
    public string? ImapUserName { get; set; }
    public string? ImapPassword { get; set; }
}

public sealed class EmailConfigTestRequest
{
    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public bool? SmtpEnableSsl { get; set; }
    public string? SmtpUserName { get; set; }
    public string? SmtpPassword { get; set; }
    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? TestTo { get; set; }
    public string? ImapHost { get; set; }
    public int? ImapPort { get; set; }
    public bool? ImapEnableSsl { get; set; }
    public string? ImapUserName { get; set; }
    public string? ImapPassword { get; set; }
}
