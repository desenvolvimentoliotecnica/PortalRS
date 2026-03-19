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

    [MaxLength(260)]
    public string? LinkedinUrl { get; set; }

    [MaxLength(2000)]
    public string? ResumoProfissional { get; set; }

    [Required, MaxLength(40)]
    public string Fone { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Cidade { get; set; } = string.Empty;

    [Required, MaxLength(2)]
    public string Uf { get; set; } = string.Empty;

    public bool? TrabalhandoAtualmente { get; set; }
}

public sealed record PortalCandidateDocumentoSummary(
    Guid Id,
    string NomeArquivo,
    DateTimeOffset CreatedAtUtc
);

public sealed record PortalCandidateProfileResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    string? ResumoProfissional,
    string? AvatarUrl,
    PortalCandidateDocumentoSummary? Curriculo,
    bool? TrabalhandoAtualmente
);

public sealed record PortalCandidateProfileUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(40)] string Fone,
    [Required, MaxLength(120)] string Cidade,
    [Required, MaxLength(2)] string Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional,
    bool? TrabalhandoAtualmente
);

public sealed record PortalCandidateAvatarResponse(
    string? AvatarUrl
);

public sealed record PortalCandidateSkillDto(
    Guid Id,
    string Tipo,
    string Nome,
    string Nivel,
    string? Evidencia
);

public sealed record PortalCandidateCertificationDto(
    Guid Id,
    string Nome,
    string? Instituicao,
    string? Ano,
    string? Link
);

public sealed record PortalCandidatePortfolioLinksDto(
    string? Linkedin,
    string? Github,
    string? Portfolio,
    string? Drive
);

public sealed record PortalCandidatePortfolioPrefsDto(
    string? WorkModel,
    string? Availability,
    string? Salary,
    string? Shift,
    string? Note
);

public sealed record PortalCandidateSkillsPortfolioResponse(
    IReadOnlyList<PortalCandidateSkillDto> Skills,
    IReadOnlyList<PortalCandidateCertificationDto> Certifications,
    PortalCandidatePortfolioLinksDto Links,
    PortalCandidatePortfolioPrefsDto Preferences,
    string? Tags
);

public sealed record PortalCandidateSkillRequest(
    [Required, MaxLength(40)] string Tipo,
    [Required, MaxLength(120)] string Nome,
    [Required, MaxLength(40)] string Nivel,
    [MaxLength(300)] string? Evidencia
);

public sealed record PortalCandidateCertificationRequest(
    [Required, MaxLength(160)] string Nome,
    [MaxLength(160)] string? Instituicao,
    [MaxLength(10)] string? Ano,
    [MaxLength(260)] string? Link
);

public sealed record PortalCandidatePortfolioUpdateRequest(
    [MaxLength(40)] string? WorkModel,
    [MaxLength(40)] string? Availability,
    [MaxLength(40)] string? Salary,
    [MaxLength(40)] string? Shift,
    [MaxLength(200)] string? Note,
    [MaxLength(260)] string? Linkedin,
    [MaxLength(260)] string? Github,
    [MaxLength(260)] string? Portfolio,
    [MaxLength(260)] string? Drive,
    [MaxLength(400)] string? Tags
);

public sealed record PortalCandidatePortfolioResponse(
    PortalCandidatePortfolioLinksDto Links,
    PortalCandidatePortfolioPrefsDto Preferences,
    string? Tags
);

public sealed record PortalCandidateEducationSummaryDto(
    string? Nivel,
    string? AreaPrincipal,
    string? Situacao,
    string? Destaques
);

public sealed record PortalCandidateEducationItemDto(
    Guid Id,
    string Curso,
    string? Instituicao,
    string? Tipo,
    string? Status,
    string? Inicio,
    string? Fim,
    string? Observacoes,
    string? Link
);

public sealed record PortalCandidateEducationResponse(
    PortalCandidateEducationSummaryDto Summary,
    IReadOnlyList<PortalCandidateEducationItemDto> Items
);

public sealed record PortalCandidateEducationSummaryRequest(
    [MaxLength(60)] string? Nivel,
    [MaxLength(120)] string? AreaPrincipal,
    [MaxLength(40)] string? Situacao,
    [MaxLength(260)] string? Destaques
);

public sealed record PortalCandidateEducationItemRequest(
    [Required, MaxLength(160)] string Curso,
    [MaxLength(160)] string? Instituicao,
    [MaxLength(40)] string? Tipo,
    [MaxLength(40)] string? Status,
    [MaxLength(20)] string? Inicio,
    [MaxLength(20)] string? Fim,
    [MaxLength(800)] string? Observacoes,
    [MaxLength(260)] string? Link
);

public sealed record PortalCandidatePreferencesResponse(
    string? CargoAlvo,
    string? Senioridade,
    string? InicioDisponivel,
    string? Resumo,
    string? AreasInteresse,
    string? ModeloTrabalho,
    string? Jornada,
    string? TipoContrato,
    string? Viagens,
    string? Mudanca,
    string? CidadePreferida,
    string? DistanciaMaxKm,
    string? ObsDeslocamento,
    string? PretensaoSalarial,
    string? PretensaoNegociavel,
    string? BeneficiosDesejados,
    string? NaoAbreMaoDe,
    DateTimeOffset? UpdatedAtUtc
);

public sealed record PortalCandidatePreferencesRequest(
    string? CargoAlvo,
    string? Senioridade,
    string? InicioDisponivel,
    string? Resumo,
    string? AreasInteresse,
    string? ModeloTrabalho,
    string? Jornada,
    string? TipoContrato,
    string? Viagens,
    string? Mudanca,
    string? CidadePreferida,
    string? DistanciaMaxKm,
    string? ObsDeslocamento,
    string? PretensaoSalarial,
    string? PretensaoNegociavel,
    string? BeneficiosDesejados,
    string? NaoAbreMaoDe
);

public sealed record PortalCandidateExperienceDto(
    Guid Id,
    string Empresa,
    string Cargo,
    string? Inicio,
    string? Fim,
    string? Local,
    string? Atividades
);

public sealed record PortalCandidateProjectDto(
    Guid Id,
    string Nome,
    string? Periodo,
    string? Descricao,
    string? Link,
    string? Stack,
    string? Destaques
);

public sealed record PortalCandidateExperienceProjectResponse(
    IReadOnlyList<PortalCandidateExperienceDto> Experiences,
    IReadOnlyList<PortalCandidateProjectDto> Projects
);

public sealed record PortalCandidateExperienceRequest(
    [Required, MaxLength(160)] string Empresa,
    [Required, MaxLength(160)] string Cargo,
    [MaxLength(20)] string? Inicio,
    [MaxLength(20)] string? Fim,
    [MaxLength(160)] string? Local,
    [MaxLength(2400)] string? Atividades
);

public sealed record PortalCandidateProjectRequest(
    [Required, MaxLength(160)] string Nome,
    [MaxLength(60)] string? Periodo,
    [MaxLength(600)] string? Descricao,
    [MaxLength(260)] string? Link,
    [MaxLength(400)] string? Stack,
    [MaxLength(1600)] string? Destaques
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
