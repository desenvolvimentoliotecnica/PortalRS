using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateDocumentoSummary(
    Guid Id,
    string NomeArquivo,
    DateTimeOffset CreatedAtUtc
);

public sealed record PortalCandidateProfileResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Cpf,
    string? Rg,
    string? DataNascimento,
    string? NomeMae,
    string? NomePai,
    string? Fone,
    string? Celular,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    string? ResumoProfissional,
    string? AvatarUrl,
    PortalCandidateDocumentoSummary? Curriculo,
    bool? TrabalhandoAtualmente,
    bool PerfilDocumentacaoCompleta
);

public sealed record PortalCandidateProfileUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(40)] string Fone,
    [MaxLength(40)] string? Celular,
    [Required, MaxLength(120)] string Cidade,
    [Required, MaxLength(2)] string Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional,
    bool? TrabalhandoAtualmente,
    [MaxLength(14)] string? Cpf,
    [MaxLength(20)] string? Rg,
    [MaxLength(10)] string? DataNascimento,
    [MaxLength(160)] string? NomeMae,
    [MaxLength(160)] string? NomePai
);

public sealed record PortalCandidateAvatarResponse(
    string? AvatarUrl
);
