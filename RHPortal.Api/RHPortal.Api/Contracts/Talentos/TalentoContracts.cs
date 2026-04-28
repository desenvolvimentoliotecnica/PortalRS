using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Talentos;

public sealed record TalentoCompetenciaItem(
    Guid? Id,
    [Required, MaxLength(40)] string Tipo,
    [Required, MaxLength(120)] string Nome,
    [Required, MaxLength(40)] string Nivel,
    [MaxLength(300)] string? Evidencia,
    [MaxLength(80)] string? TempoAtuacao
);

public sealed record TalentoExperienciaItem(
    Guid? Id,
    [Required, MaxLength(160)] string Empresa,
    [Required, MaxLength(160)] string Cargo,
    [MaxLength(20)] string? Inicio,
    [MaxLength(20)] string? Fim,
    [MaxLength(40)] string? TipoContratacao,
    [MaxLength(160)] string? Local,
    [MaxLength(2400)] string? Atividades,
    [MaxLength(800)] string? ResumoAtividades,
    [MaxLength(40)] string? NivelSenioridade,
    [MaxLength(80)] string? NivelHierarquico
);

public sealed record TalentoTreinamentoItem(
    Guid? Id,
    [Required, MaxLength(160)] string Nome,
    [MaxLength(160)] string? Instituicao,
    [MaxLength(10)] string? Ano,
    [MaxLength(260)] string? Link
);

public sealed record TalentoFormacaoItem(
    Guid? Id,
    [Required, MaxLength(160)] string Curso,
    [MaxLength(160)] string? Instituicao,
    [MaxLength(40)] string? Tipo,
    [MaxLength(40)] string? Status,
    [MaxLength(20)] string? Inicio,
    [MaxLength(20)] string? Fim,
    [MaxLength(800)] string? Observacoes,
    [MaxLength(260)] string? Link
);

public sealed record TalentoDocumentoSummary(
    Guid Id,
    string NomeArquivo,
    string? ContentType,
    long? TamanhoBytes,
    DateTimeOffset CreatedAtUtc
);

/// <summary>Metadados de documento para criar no talento (sem arquivo; ex.: integração RM).</summary>
public sealed record TalentoDocumentoMetaItem(
    [Required, MaxLength(200)] string NomeArquivo,
    [MaxLength(240)] string? Descricao = null
);

public sealed record TalentoCreateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional,
    [MaxLength(2000)] string? Obs,
    OrigemTalento Origem,
    [MaxLength(14)] string? Cpf = null,
    DateTime? DataNascimento = null,
    [MaxLength(20)] string? Cep = null,
    [MaxLength(200)] string? Logradouro = null,
    [MaxLength(40)] string? Numero = null,
    [MaxLength(120)] string? Bairro = null,
    bool ForceCreate = false,
    IReadOnlyList<TalentoCompetenciaItem>? Competencias = null,
    IReadOnlyList<TalentoExperienciaItem>? Experiencias = null,
    IReadOnlyList<TalentoTreinamentoItem>? Treinamentos = null,
    IReadOnlyList<TalentoFormacaoItem>? Formacao = null,
    IReadOnlyList<TalentoDocumentoMetaItem>? Documentos = null
);

/// <summary>Result of create talento: either created or similar found (409).</summary>
public sealed record CreateTalentoResult(
    TalentoResponse? Created,
    bool SimilarFound,
    Guid? SimilarTalentoId,
    SimilarPessoaSummary? SimilarPessoaSummary
);

/// <summary>Payload for 409 Conflict when creating talento (similar found).</summary>
public sealed record CreateTalentoConflictResponse(
    bool SimilarFound,
    Guid? SimilarTalentoId,
    SimilarPessoaSummary? SimilarPessoaSummary
);

public sealed record TalentoUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? Cidade,
    [MaxLength(2)] string? Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional,
    [MaxLength(2000)] string? Obs,
    [MaxLength(14)] string? Cpf = null,
    DateTime? DataNascimento = null,
    [MaxLength(20)] string? Cep = null,
    [MaxLength(200)] string? Logradouro = null,
    [MaxLength(40)] string? Numero = null,
    [MaxLength(120)] string? Bairro = null,
    OrigemTalento Origem = OrigemTalento.Manual,
    IReadOnlyList<TalentoCompetenciaItem>? Competencias = null,
    IReadOnlyList<TalentoExperienciaItem>? Experiencias = null,
    IReadOnlyList<TalentoTreinamentoItem>? Treinamentos = null,
    IReadOnlyList<TalentoFormacaoItem>? Formacao = null
);

public sealed record TalentoListQuery(
    string? Q,
    OrigemTalento? Origem,
    int Page = 1,
    int PageSize = 20
);

public sealed record TalentoListItemResponse(
    Guid Id,
    Guid PessoaId,
    string Nome,
    string Email,
    string? Fone,
    string? Cpf,
    string? Cidade,
    string? Uf,
    OrigemTalento Origem,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    int Versao,
    CvImportStatus? CvImportStatus = null,
    Guid? CvImportJobId = null
);

public sealed record TalentoResponse(
    Guid Id,
    Guid PessoaId,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    string? ResumoProfissional,
    string? Obs,
    string? Cpf,
    DateTime? DataNascimento,
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Bairro,
    OrigemTalento Origem,
    IReadOnlyList<TalentoCompetenciaItem> Competencias,
    IReadOnlyList<TalentoExperienciaItem> Experiencias,
    IReadOnlyList<TalentoTreinamentoItem> Treinamentos,
    IReadOnlyList<TalentoFormacaoItem> Formacao,
    IReadOnlyList<TalentoDocumentoSummary> Documentos,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    int Versao,
    PendingCvImportJobResponse? PendingCvImportJob = null
);

/// <summary>Resumo do job de importação de CV (retorno imediato do upload).</summary>
public sealed record TalentoCvImportJobSummary(
    Guid Id,
    CvImportStatus Status
);

/// <summary>Resposta do upload de PDF (processamento em background).</summary>
public sealed record TalentoStartImportPdfResponse(
    TalentoResponse Talento,
    TalentoDocumentoSummary Documento,
    TalentoCvImportJobSummary ImportJob
);

/// <summary>Job pendente de validação (cadastro similar) para exibir no detalhe do talento.</summary>
public sealed record PendingCvImportJobResponse(
    Guid Id,
    Guid? SimilarTalentoId,
    SimilarPessoaSummary? SimilarPessoaSummary
);

/// <summary>Payload serializado no job quando Status = PendenteValidacao (para aprovar/recusar).</summary>
public sealed record CvImportJobValidationPayload(
    SimilarPessoaSummary? SimilarPessoaSummary,
    TalentoImportPdfSuggestedData? SuggestedData,
    TalentoUpdateRequest? TalentoUpdate
);

/// <summary>Detalhe do job pendente de validação para comparação side-by-side na UI.</summary>
public sealed record CvImportJobValidationResponse(
    Guid JobId,
    Guid PlaceholderTalentoId,
    Guid SimilarTalentoId,
    TalentoResponse? ExistingTalento,
    TalentoImportPdfSuggestedData? SuggestedData,
    DateTimeOffset CreatedAtUtc
);

public sealed record TalentoImportPdfSuggestedData(
    string? Nome,
    string? Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    string? ResumoProfissional,
    string? Cpf,
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Bairro,
    DateTime? DataNascimento,
    string? Endereco,
    IReadOnlyList<TalentoCompetenciaItem> Competencias,
    IReadOnlyList<TalentoExperienciaItem> Experiencias,
    IReadOnlyList<TalentoTreinamentoItem> Treinamentos,
    IReadOnlyList<TalentoFormacaoItem> Formacao
);

/// <summary>Resumo de pessoa/talento similar para exibição ao usuário ("Encontramos um cadastro similar...").</summary>
public sealed record SimilarPessoaSummary(
    Guid TalentoId,
    string Nome,
    string? Email,
    string? Fone
);

/// <summary>Resposta do upload de currículo no talento com extração de texto e dados sugeridos pela LLM (para revisar na tela e aplicar).</summary>
public sealed record TalentoCurriculoExtrairResponse(
    TalentoDocumentoSummary Documento,
    string? CvText,
    TalentoImportPdfSuggestedData? SuggestedData
);

/// <summary>Resposta da importação de PDF no talento. ExtracaoGptSemDados é true quando enviarParaGpt foi true mas a extração via GPT não retornou dados.</summary>
public sealed record TalentoImportPdfResponse(
    TalentoResponse Talento,
    TalentoDocumentoSummary Documento,
    TalentoImportPdfSuggestedData? SuggestedData,
    bool SimilarFound = false,
    Guid? SimilarTalentoId = null,
    SimilarPessoaSummary? SimilarPessoaSummary = null,
    bool ExtracaoGptSemDados = false
);

public sealed record TalentoPagedResponse(
    IReadOnlyList<TalentoListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize
);
