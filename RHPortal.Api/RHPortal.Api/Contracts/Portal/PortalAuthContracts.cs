using System.ComponentModel.DataAnnotations;

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
        ErrorMessage = "Senha deve ter no minimo 8 caracteres, 1 letra maiuscula, 1 numero e 1 caractere especial.")]
    string Password
);

public sealed record PortalCandidateAuthResponse(
    Guid Id,
    string Nome,
    string Email
);
