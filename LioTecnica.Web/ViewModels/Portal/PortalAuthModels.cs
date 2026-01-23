using System.ComponentModel.DataAnnotations;
using System.Net;

namespace LioTecnica.Web.ViewModels.Portal;

public sealed class PortalAccessViewModel
{
    [MaxLength(64)]
    public string TenantId { get; set; } = string.Empty;

    public string? ReturnUrl { get; set; }
}

public sealed class PortalCandidateLoginInput
{
    [Required, EmailAddress, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(8), MaxLength(120)]
    public string Password { get; set; } = string.Empty;

    [Required, MaxLength(64)]
    public string TenantId { get; set; } = string.Empty;

    public string? ReturnUrl { get; set; }
}

public sealed class PortalCandidateRegisterInput
{
    [Required, MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(40)]
    public string Fone { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Cidade { get; set; } = string.Empty;

    [Required, MaxLength(2)]
    public string Uf { get; set; } = string.Empty;

    [Required, MinLength(8), MaxLength(120)]
    [RegularExpression("^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$",
        ErrorMessage = "Senha deve ter no minimo 8 caracteres, 1 letra maiuscula, 1 numero e 1 caractere especial.")]
    public string Password { get; set; } = string.Empty;

    [Required, MaxLength(64)]
    public string TenantId { get; set; } = string.Empty;

    public string? ReturnUrl { get; set; }
}

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
    [Required, MinLength(8), MaxLength(120)] string Password
);

public sealed record PortalCandidateAuthResponse(
    Guid Id,
    string Nome,
    string Email
);

public sealed record PortalCandidateAuthUiResponse(
    string RedirectUrl,
    string Nome,
    string Email
);

public sealed class PortalCandidateProfileUpdateInput
{
    [Required, MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    [Required, MaxLength(40)]
    public string Fone { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Cidade { get; set; } = string.Empty;

    [Required, MaxLength(2)]
    public string Uf { get; set; } = string.Empty;
}

public sealed record PortalCandidateProfileResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf
);

public sealed record PortalCandidateProfileUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(40)] string Fone,
    [Required, MaxLength(120)] string Cidade,
    [Required, MaxLength(2)] string Uf
);

public sealed class PortalApiResult<T>
{
    private PortalApiResult(bool success, HttpStatusCode statusCode, T? data, string? message)
    {
        Success = success;
        StatusCode = statusCode;
        Data = data;
        Message = message;
    }

    public bool Success { get; }
    public HttpStatusCode StatusCode { get; }
    public T? Data { get; }
    public string? Message { get; }

    public static PortalApiResult<T> Ok(T data)
        => new(true, HttpStatusCode.OK, data, null);

    public static PortalApiResult<T> Fail(HttpStatusCode statusCode, string? message)
        => new(false, statusCode, default, message);
}

public sealed class PortalAuthResult
{
    private PortalAuthResult(bool success, HttpStatusCode statusCode, PortalCandidateAuthResponse? data, string? message)
    {
        Success = success;
        StatusCode = statusCode;
        Data = data;
        Message = message;
    }

    public bool Success { get; }
    public HttpStatusCode StatusCode { get; }
    public PortalCandidateAuthResponse? Data { get; }
    public string? Message { get; }

    public static PortalAuthResult Ok(PortalCandidateAuthResponse data)
        => new(true, HttpStatusCode.OK, data, null);

    public static PortalAuthResult Fail(HttpStatusCode statusCode, string? message)
        => new(false, statusCode, null, message);
}
