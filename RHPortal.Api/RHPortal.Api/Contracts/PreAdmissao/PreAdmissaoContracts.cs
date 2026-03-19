using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.PreAdmissao;

// ── Grid / List ──

public sealed record PreAdmissaoGridRow(
    Guid Id,
    string Nome,
    string? Cpf,
    string? Email,
    string? CargoNome,
    string? AreaNome,
    string? UnitNome,
    PreAdmissaoStatus Status,
    DateOnly? DataAdmissao,
    decimal? Salario,
    PreenchidoPor PreenchidoPor,
    DateTimeOffset CreatedAtUtc
);

public sealed record PreAdmissaoListQuery(
    string? Q,
    PreAdmissaoStatus? Status,
    int? Page,
    int? PageSize
);

// ── Detail response ──

public sealed record PreAdmissaoDetailResponse(
    Guid Id,
    PreAdmissaoStatus Status,
    PreenchidoPor PreenchidoPor,
    Guid? CandidatoId,
    string? RevisadoPorNome,
    string? AprovadoPorNome,
    string? ObservacaoRh,
    string? MotivoRejeicao,

    // Pessoal
    string Nome,
    string? Cpf,
    string? Rg,
    string? RgOrgaoExpedidor,
    DateOnly? RgDataExpedicao,
    DateOnly? DataNascimento,
    Sexo Sexo,
    EstadoCivil EstadoCivil,
    string? Nacionalidade,
    string? NomeMae,
    string? NomePai,
    string? NaturalCidade,
    string? NaturalUf,

    // Estrangeiro
    string? Passaporte,
    string? RnmRne,
    DateOnly? ValidadeVisto,
    string? TipoVisto,

    // Endereço
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,

    // Contato
    string? Email,
    string? Telefone,
    string? Celular,
    string? ContatoEmergenciaNome,
    string? ContatoEmergenciaFone,

    // Bancário
    string? BancoCodigo,
    string? BancoNome,
    string? Agencia,
    string? AgenciaDigito,
    string? Conta,
    string? ContaDigito,
    TipoContaBancaria? TipoConta,

    // Trabalhista
    string? EstabelecimentoCodigo,
    string? MatriculaRM,
    Guid? UnitId,
    string? UnitNome,
    Guid? AreaId,
    string? AreaNome,
    Guid? JobPositionId,
    string? JobPositionNome,
    Guid? RequisitoCategoriaId,
    DateOnly? DataAdmissao,
    decimal? Salario,
    TipoContratacaoAdmissao? TipoContratacao,
    short? CargaHorariaSemanal,
    string? PisPasep,

    // Docs avulsos
    string? TituloEleitorNumero,
    string? TituloEleitorZona,
    string? TituloEleitorSecao,
    string? ReservistaNumero,
    string? CategoriaCnh,
    DateOnly? ValidadeCnh,
    string? Ctps,
    string? CtpsSerie,
    string? CtpsUf,

    // Validações
    bool ValidacaoCpfOk,
    bool ValidacaoCepOk,
    bool ValidacaoBancoOk,
    bool ValidacaoSalarioOk,
    string? ValidacaoSalarioJustificativa,

    // Timestamps
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? SubmittedAtUtc,
    DateTimeOffset? ApprovedAtUtc,

    // Documentos
    List<PreAdmissaoDocumentoResponse> Documentos
);

public sealed record PreAdmissaoDocumentoResponse(
    Guid Id,
    TipoDocumento Tipo,
    string NomeArquivo,
    string ContentType,
    long TamanhoBytes,
    StatusDocumento Status,
    string? ObservacaoRh,
    DateTimeOffset CreatedAtUtc
);

// ── Create / Update ──

public sealed record PreAdmissaoCreateRequest(
    PreenchidoPor PreenchidoPor,
    Guid? CandidatoId,
    string Nome,
    string? Cpf
);

public sealed record PreAdmissaoUpdateRequest(
    // Pessoal
    string Nome,
    string? Cpf,
    string? Rg,
    string? RgOrgaoExpedidor,
    DateOnly? RgDataExpedicao,
    DateOnly? DataNascimento,
    Sexo? Sexo,
    EstadoCivil? EstadoCivil,
    string? Nacionalidade,
    string? NomeMae,
    string? NomePai,
    string? NaturalCidade,
    string? NaturalUf,

    // Estrangeiro
    string? Passaporte,
    string? RnmRne,
    DateOnly? ValidadeVisto,
    string? TipoVisto,

    // Endereço
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,

    // Contato
    string? Email,
    string? Telefone,
    string? Celular,
    string? ContatoEmergenciaNome,
    string? ContatoEmergenciaFone,

    // Bancário
    string? BancoCodigo,
    string? BancoNome,
    string? Agencia,
    string? AgenciaDigito,
    string? Conta,
    string? ContaDigito,
    TipoContaBancaria? TipoConta,

    // Trabalhista
    string? EstabelecimentoCodigo,
    Guid? UnitId,
    Guid? AreaId,
    Guid? JobPositionId,
    Guid? RequisitoCategoriaId,
    DateOnly? DataAdmissao,
    decimal? Salario,
    TipoContratacaoAdmissao? TipoContratacao,
    short? CargaHorariaSemanal,
    string? PisPasep,

    // Docs avulsos
    string? TituloEleitorNumero,
    string? TituloEleitorZona,
    string? TituloEleitorSecao,
    string? ReservistaNumero,
    string? CategoriaCnh,
    DateOnly? ValidadeCnh,
    string? Ctps,
    string? CtpsSerie,
    string? CtpsUf,

    // Salário justificativa
    string? ValidacaoSalarioJustificativa
);

// ── Upload de documento ──

public sealed class UploadDocumentoRequest
{
    public IFormFile File { get; set; } = null!;
    public TipoDocumento Tipo { get; set; }
}

// ── Approve / Reject ──

public sealed record PreAdmissaoApproveRequest(string? Observacao);
public sealed record PreAdmissaoRejectRequest(string Motivo);

// ── Readmissão ──

public sealed record BuscaCpfResponse(
    bool Encontrado,
    Guid? PessoaId,
    string? Nome,
    string? Email,
    string? Fone,
    string? Cpf,
    string? Rg,
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    DateTime? DataNascimento
);
