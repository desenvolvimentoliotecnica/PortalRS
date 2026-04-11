using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Pessoas;

public sealed record PessoaCreateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional,
    [MaxLength(2000)] string? Obs,
    [MaxLength(20)] string? Cep,
    [MaxLength(200)] string? Logradouro,
    [MaxLength(40)] string? Numero,
    [MaxLength(120)] string? Bairro,
    [MaxLength(120)] string? Complemento,
    [MaxLength(14)] string? Cpf,
    [MaxLength(20)] string? Rg,
    [MaxLength(40)] string? FoneContato,
    DateTime? DataNascimento = null,
    OrigemPessoa Origem = OrigemPessoa.Manual
);

public sealed record PessoaUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional,
    [MaxLength(2000)] string? Obs,
    [MaxLength(20)] string? Cep,
    [MaxLength(200)] string? Logradouro,
    [MaxLength(40)] string? Numero,
    [MaxLength(120)] string? Bairro,
    [MaxLength(120)] string? Complemento,
    [MaxLength(14)] string? Cpf,
    [MaxLength(20)] string? Rg,
    [MaxLength(40)] string? FoneContato,
    DateTime? DataNascimento = null,
    OrigemPessoa Origem = OrigemPessoa.Manual
);

public sealed record PessoaResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    string? ResumoProfissional,
    string? Obs,
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Bairro,
    string? Complemento,
    string? Cpf,
    string? Rg,
    string? FoneContato,
    DateTime? DataNascimento,
    OrigemPessoa Origem,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record PessoaListQuery(
    string? Q,
    int Page = 1,
    int PageSize = 20,
    string Sort = "nome",
    string Dir = "asc"
);

public sealed record PessoaListItemResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    OrigemPessoa Origem,
    DateTimeOffset CreatedAtUtc,
    bool EstaBloqueado,
    Guid? BloqueioId
);

public sealed record PessoaPagedResponse(
    IReadOnlyList<PessoaListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize
);
