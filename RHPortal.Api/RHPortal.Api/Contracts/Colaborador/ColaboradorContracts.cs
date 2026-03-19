using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Colaborador;

// ── Perfil ──

public sealed record ColaboradorPerfilResponse(
    Guid FuncionarioId,
    string Nome,
    string Email,
    string? Telefone,
    string? AreaName,
    string? UnitName,
    string? JobPositionName,
    string? AvatarUrl
);

public sealed record ColaboradorPerfilUpdateRequest(
    string Nome,
    string? Telefone
);

// ── Dependentes ──

public sealed record DependenteResponse(
    Guid Id,
    string NomeCompleto,
    Parentesco Parentesco,
    string? Cpf,
    DateOnly DataNascimento,
    bool IsPcd,
    DateTimeOffset CreatedAtUtc
);

public sealed record DependenteCreateRequest(
    string NomeCompleto,
    Parentesco Parentesco,
    string? Cpf,
    DateOnly DataNascimento,
    bool IsPcd
);

public sealed record DependenteUpdateRequest(
    string NomeCompleto,
    Parentesco Parentesco,
    string? Cpf,
    DateOnly DataNascimento,
    bool IsPcd
);

// ── Documentos ──

public sealed record DocumentoResponse(
    Guid Id,
    TipoDocumento Tipo,
    string NomeArquivo,
    string ContentType,
    long TamanhoBytes,
    StatusDocumento Status,
    string? ObservacaoRh,
    DateTimeOffset CreatedAtUtc
);

// ── Senha ──

public sealed record AlterarSenhaRequest(
    string SenhaAtual,
    string NovaSenha
);
