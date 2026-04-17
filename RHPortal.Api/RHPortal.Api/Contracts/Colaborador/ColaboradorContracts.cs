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

// ── Histórico de Carreira ──

public sealed record HistoricoCarreiraItemResponse(
    Guid Id,
    string? VagaDescricao,
    string? CargoNome,
    string? AreaNome,
    DateTime DataEntrada,
    DateTime? DataSaida,
    string? MotivoSaida,
    bool IsProvisorio
);

// ── Dados Bancários ──

public sealed record DadosBancariosResponse(
    Guid Id,
    string Banco,
    string Agencia,
    /// <summary>Conta mascarada (ex: ****1234) quando exibida para não-RH.</summary>
    string Conta,
    TipoContaBancaria TipoConta,
    string? Pix,
    DateTimeOffset UpdatedAtUtc
);

public sealed record DadosBancariosUpsertRequest(
    string Banco,
    string Agencia,
    string Conta,
    TipoContaBancaria TipoConta,
    string? Pix
);

// ── Holerites ──

public sealed record HoleriteResponse(
    Guid Id,
    int MesReferencia,
    int AnoReferencia,
    string ArquivoNome,
    long TamanhoBytes,
    /// <summary>Null = enviado via TOTVS. Preenchido = upload manual pelo RH.</summary>
    Guid? EnviadoPorId,
    string? EnviadoPorNome,
    DateTimeOffset EnviadoEmUtc
);

public sealed record HoleriteUploadRequest(
    Guid FuncionarioId,
    int MesReferencia,
    int AnoReferencia
);
