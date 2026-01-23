using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateLoginRequest(
    [Required, MaxLength(180)] string Email,
    [Required, MinLength(8), MaxLength(120)] string Password
);

public sealed record PortalCandidateRegisterRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [Required, MaxLength(40)] string Fone,
    [Required, MaxLength(120)] string Cidade,
    [Required, MaxLength(2)] string Uf,
    [Required, MinLength(8), MaxLength(120)]
    [RegularExpression("^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$",
        ErrorMessageResourceType = typeof(ValidationMessages),
        ErrorMessageResourceName = "ValidationErrors.PasswordPolicy")]
    string Password
);

public sealed record PortalCandidateAuthResponse(
    Guid Id,
    string Nome,
    string Email
);
