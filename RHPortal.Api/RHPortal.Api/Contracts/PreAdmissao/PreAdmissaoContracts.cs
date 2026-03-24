using System.ComponentModel.DataAnnotations;
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

/// <summary>Dados completos de uma pré-admissão — pessoal, endereço, bancário, trabalhista, documentos e integração TOTVS.</summary>
/// <remarks>
/// Retornado por <c>GET /api/pre-admissao/{id}</c>. Contém todos os campos necessários para cadastro no TOTVS Progress Datasul.
/// Campos de integração (<c>integracaoResultado</c>, <c>integracaoMensagem</c>, <c>integradaEmUtc</c>) ficam null até o serviço reportar o resultado.
/// </remarks>
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
    List<PreAdmissaoDocumentoResponse> Documentos,

    // Integração TOTVS
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? IntegradaEmUtc
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

// ── Integração TOTVS ──

/// <summary>Resultado de uma tentativa de integração com o TOTVS Progress Datasul.</summary>
/// <remarks>
/// Chamar após cada tentativa, independente do resultado.
/// - <c>"sucesso"</c> → status muda para <b>Integrada (5)</b>, sai da fila permanentemente.
/// - <c>"falha"</c> → status volta para <b>Aprovada (3)</b>, registro permanece na fila para retry automático.
/// </remarks>
public sealed record IntegracaoResultadoRequest(
    /// <summary>"sucesso" ou "falha" (case-insensitive). Campo obrigatório.</summary>
    [Required] string Status,
    /// <summary>Mensagem de retorno do Progress Datasul ou descrição do erro. Opcional.</summary>
    string? Mensagem
);

/// <summary>Item da fila de integração TOTVS — dados mínimos para identificação. Buscar detalhes completos via <c>GET /api/pre-admissao/{id}</c>.</summary>
/// <remarks>
/// Retornado por <c>GET /api/pre-admissao/integracao/pendentes</c>.
/// Sempre tem <c>status = 3 (Aprovada)</c>. Ordenado por data de aprovação (FIFO).
/// </remarks>
public sealed record PreAdmissaoPendenteIntegracaoRow(
    /// <summary>ID da pré-admissão. Usar para buscar dados completos e reportar resultado.</summary>
    Guid Id,
    /// <summary>Nome completo do colaborador.</summary>
    string Nome,
    /// <summary>CPF formatado (pode ser null se não informado).</summary>
    string? Cpf,
    /// <summary>Data prevista de admissão no formato YYYY-MM-DD (pode ser null).</summary>
    DateOnly? DataAdmissao,
    /// <summary>Sempre 3 (Aprovada) neste endpoint.</summary>
    PreAdmissaoStatus Status
);

/// <summary>Linha do painel de integração TOTVS por tenant — histórico de Aprovadas e Integradas.</summary>
/// <remarks>
/// Retornado por <c>GET /api/pre-admissao/integracao/painel</c> (autenticação JWT).
/// Inclui registros nos status <b>Aprovada (3)</b> e <b>Integrada (5)</b>.
/// </remarks>
public sealed record PreAdmissaoPainelIntegracaoRow(
    Guid Id,
    string Nome,
    string? Cpf,
    DateOnly? DataAdmissao,
    PreAdmissaoStatus Status,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? ApprovedAtUtc,
    DateTimeOffset? IntegradaEmUtc
);

/// <summary>Linha do painel Owner — cross-tenant, inclui qual tenant é o registro.</summary>
public sealed record OwnerPainelIntegracaoRow(
    string TenantId,
    Guid Id,
    string Nome,
    string? Cpf,
    DateOnly? DataAdmissao,
    PreAdmissaoStatus Status,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? ApprovedAtUtc,
    DateTimeOffset? IntegradaEmUtc
);

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
