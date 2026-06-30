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
    DateTimeOffset CreatedAtUtc,
    int TotalDocumentos,
    int DocumentosPendentes,
    int DocumentosValidados,
    int DocumentosRejeitados,
    int? WizardCurrentStep,
    int? WizardCompletionPercent,
    DateTimeOffset? LastActivityUtc,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem
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
    string Nome, string? NomeSocial, string? NomeAbreviado,
    string? Cpf, string? Rg, string? RgOrgaoExpedidor, string? RgUfExpedidor,
    DateOnly? RgDataExpedicao, DateOnly? DataNascimento,
    Sexo Sexo, EstadoCivil EstadoCivil,
    string? Nacionalidade, string? PaisNacionalidade,
    string? NomeMae, string? NomePai,
    string? NaturalCidade, string? NaturalUf, string? PaisNascimento,

    // Estrangeiro
    string? Passaporte, string? RnmRne, DateOnly? ValidadeVisto, string? TipoVisto,
    string? ResideExterior, int? TipoVistoEstrangeiro,

    // RIC (Registro Identidade Civil)
    string? RegIdentidCivilNumero, string? RegIdentidCivilUf,
    string? RegIdentidCivilCidade, string? RegIdentidCivilOrgEmiss,
    DateOnly? RegIdentidCivilDataExped,

    // Endereço
    string? Cep, string? Logradouro, string? Numero, string? Complemento,
    string? Bairro, string? Cidade, string? Uf,
    string? PontoReferencia, string? TipoLogradouroESocial,
    int? MunicipioEnderecoIbge,

    // Contato
    string? Email, string? EmailAlternativo,
    string? Telefone, string? Celular,
    int? DddTelefone, int? DddTelContato,
    string? ContatoEmergenciaNome, string? ContatoEmergenciaFone,

    // Bancário
    string? BancoCodigo, string? BancoNome, string? Agencia, string? AgenciaDigito,
    string? Conta, string? ContaDigito, TipoContaBancaria? TipoConta,

    // Trabalhista
    string? EstabelecimentoCodigo, string? CodEmpresa, string? MatriculaRM,
    Guid? UnitId, string? UnitNome, Guid? CentroCustoId, string? CentroCustoNome,
    Guid? JobPositionId, string? JobPositionNome,
    DateOnly? DataAdmissao, decimal? Salario,
    TipoContratacaoAdmissao? TipoContratacao, short? CargaHorariaSemanal,
    string? PisPasep,

    // TOTVS: Cargo/Vinculo
    int? CodCargoTotvs, int? CodVinculoEmpregaticio, int? TipoFuncionario,
    int? CategoriaSalarial, int? GrauInstrucao, int? CodTurno,
    string? CentroCustoTotvs, string? UnidadeLotacao,
    int? CodPlanoLotacao, int? CodTurma, int? NumCartaoPonto, int? CodNivel,
    string? TipoMaoDeObra, int? FormaPagamento, decimal? SalarioSimulado,
    int? OrigemFuncionario, int? IndFuncVinculado, string? FuncQualificado,

    // TOTVS: FGTS/INSS
    string? OptanteFgts, DateOnly? DataOpcaoFgts, int? TipoAdmissaoFgts,
    string? RecolheFgts, string? RecolheInss,

    // TOTVS: Sindicato
    string? Sindicalizado, string? DescContribSindical, string? ContribSindicDia, int? CodSindicato,

    // TOTVS: Flags calculo
    string? CargaAutomTurno, string? RecebePericul, string? RecebeInsalub,
    string? RecebeAdiantamento, string? ConsidEmissRAIS, string? Calcula13, string? RecebeFerias,

    // TOTVS: Provisoes 13
    int? Avos13SalCalcAnterior, int? Avos13SalCalc,
    decimal? ProvAcum13Sal, decimal? ProvAcumInss13Sal, decimal? ProvAcumFgts13Sal,

    // TOTVS: Provisoes Ferias
    decimal? DiasProvFeriasMesAnterior, decimal? DiasProvFeriasMesAtual,
    decimal? ProvAcumFerias, decimal? ProvAcumInssFerias, decimal? ProvAcumFgtsFerias, decimal? ProvAcumFerias13,

    // TOTVS: Ponto
    string? EmitCartPonto, int? CodLocalMarcacao, int? CodClassFuncPontoEletronico,

    // Docs avulsos
    string? TituloEleitorNumero, string? TituloEleitorZona, string? TituloEleitorSecao,
    string? TituloEleitorCidade, string? TituloEleitorUf,
    string? ReservistaNumero, string? CategoriaCnh, DateOnly? ValidadeCnh,
    string? Ctps, string? CtpsSerie, string? CtpsUf, int? CtpsModelo,
    string? CtpsSerieESocial,

    // CNH completo
    string? CnhNumero, string? CnhUf, string? CnhOrgaoEmissor,
    DateOnly? CnhDataExpedicao, DateOnly? CnhPrimeiraHabilitacao,

    // Doc Militar
    int? DocMilitarTipo, string? DocMilitarNumero, string? DocMilitarSerie,
    int? DocMilitarRegiao, int? DocMilitarCircunscricao,

    // Saude e caracteristicas fisicas
    int? GrupoSanguineo, int? FatorRh, string? PossuiDeficiencia, string? FuncDoador,
    string? CartaoSus, int? Altura, int? Peso,
    int? Cutis, int? Cabelo, int? Olhos, int? Manequim, int? Sapato,

    // TOTVS: Nome Abreviado / Contrato
    int? DataTerminoContrato,

    // TOTVS: Localidade
    string? PaisLocalidade, int? CodLocalidade, int? CodFpas,

    // TOTVS: eSocial
    int? CategoriaTrabalhoESocial, int? IndAdmissao, int? NaturezaAtividade,
    int? MunicipioNascimentoIbge, int? TipoAdmissaoESocial,
    int? RegimeTrabalhista, int? RegimePrevidenciario, int? RegimeJornada,
    string? MatriculaESocial, string? PaisNacionalidadeValue,

    // TOTVS: CAGED
    int? OcorrenciaCAGED,

    // TOTVS: Registro exterior
    string? CodRegistroExterior,

    // Validações
    bool ValidacaoCpfOk, bool ValidacaoCepOk, bool ValidacaoBancoOk,
    bool ValidacaoSalarioOk, string? ValidacaoSalarioJustificativa,

    // Timestamps
    DateTimeOffset CreatedAtUtc, DateTimeOffset? SubmittedAtUtc, DateTimeOffset? ApprovedAtUtc,

    // Wizard
    int? WizardCurrentStep, int? WizardCompletionPercent, DateTimeOffset? LastActivityUtc,

    // Documentos
    List<PreAdmissaoDocumentoResponse> Documentos,
    List<DocumentoSolicitadoResponse> DocumentosSolicitados,

    // Dependentes
    List<PreAdmissaoDependenteDetailResponse> Dependentes,

    // Portal candidato
    string? AccessToken,

    // Integração TOTVS
    IntegracaoResultado? IntegracaoResultado, string? IntegracaoMensagem, DateTimeOffset? IntegradaEmUtc
);

public sealed record PreAdmissaoDependenteDetailResponse(
    Guid Id, string NomeCompleto, Parentesco Parentesco,
    string? Cpf, DateOnly DataNascimento, bool IsPcd
);

public sealed record PreAdmissaoDocumentoResponse(
    Guid Id,
    TipoDocumento Tipo,
    /// <summary>Face do documento: 0=Único, 1=Frente, 2=Verso.</summary>
    LadoDocumento Lado,
    string NomeArquivo,
    string ContentType,
    long TamanhoBytes,
    StatusDocumento Status,
    string? ObservacaoRh,
    DateTimeOffset CreatedAtUtc,
    /// <summary>Presigned URL S3 para download direto (expira em 15 min).</summary>
    string PresignedUrl
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
    string Nome, string? NomeSocial, string? NomeAbreviado,
    string? Cpf, string? Rg, string? RgOrgaoExpedidor, string? RgUfExpedidor,
    DateOnly? RgDataExpedicao, DateOnly? DataNascimento,
    Sexo? Sexo, EstadoCivil? EstadoCivil,
    string? Nacionalidade, string? PaisNacionalidade,
    string? NomeMae, string? NomePai,
    string? NaturalCidade, string? NaturalUf, string? PaisNascimento,

    // Estrangeiro
    string? Passaporte, string? RnmRne, DateOnly? ValidadeVisto, string? TipoVisto,
    string? ResideExterior, int? TipoVistoEstrangeiro,

    // RIC (Registro Identidade Civil)
    string? RegIdentidCivilNumero, string? RegIdentidCivilUf,
    string? RegIdentidCivilCidade, string? RegIdentidCivilOrgEmiss,
    DateOnly? RegIdentidCivilDataExped,

    // Endereço
    string? Cep, string? Logradouro, string? Numero, string? Complemento,
    string? Bairro, string? Cidade, string? Uf,
    string? PontoReferencia, string? TipoLogradouroESocial, int? MunicipioEnderecoIbge,

    // Contato
    string? Email, string? EmailAlternativo,
    string? Telefone, string? Celular,
    int? DddTelefone, int? DddTelContato,
    string? ContatoEmergenciaNome, string? ContatoEmergenciaFone,

    // Bancário
    string? BancoCodigo, string? BancoNome, string? Agencia, string? AgenciaDigito,
    string? Conta, string? ContaDigito, TipoContaBancaria? TipoConta,

    // Trabalhista
    string? EstabelecimentoCodigo, string? CodEmpresa,
    Guid? UnitId, Guid? CentroCustoId, Guid? JobPositionId,
    DateOnly? DataAdmissao, decimal? Salario,
    TipoContratacaoAdmissao? TipoContratacao, short? CargaHorariaSemanal,
    string? PisPasep,

    // TOTVS: Cargo/Vinculo
    int? CodCargoTotvs, int? CodVinculoEmpregaticio, int? TipoFuncionario,
    int? CategoriaSalarial, int? GrauInstrucao, int? CodTurno,
    string? CentroCustoTotvs, string? UnidadeLotacao,
    int? CodPlanoLotacao, int? CodTurma, int? NumCartaoPonto, int? CodNivel,
    string? TipoMaoDeObra, int? FormaPagamento, decimal? SalarioSimulado,
    int? OrigemFuncionario, int? IndFuncVinculado, string? FuncQualificado,

    // TOTVS: FGTS/INSS
    string? OptanteFgts, DateOnly? DataOpcaoFgts, int? TipoAdmissaoFgts,
    string? RecolheFgts, string? RecolheInss,

    // TOTVS: Sindicato
    string? Sindicalizado, string? DescContribSindical, string? ContribSindicDia, int? CodSindicato,

    // TOTVS: Flags calculo
    string? CargaAutomTurno, string? RecebePericul, string? RecebeInsalub,
    string? RecebeAdiantamento, string? ConsidEmissRAIS, string? Calcula13, string? RecebeFerias,

    // TOTVS: Provisoes 13
    int? Avos13SalCalcAnterior, int? Avos13SalCalc,
    decimal? ProvAcum13Sal, decimal? ProvAcumInss13Sal, decimal? ProvAcumFgts13Sal,

    // TOTVS: Provisoes Ferias
    decimal? DiasProvFeriasMesAnterior, decimal? DiasProvFeriasMesAtual,
    decimal? ProvAcumFerias, decimal? ProvAcumInssFerias, decimal? ProvAcumFgtsFerias, decimal? ProvAcumFerias13,

    // TOTVS: Ponto
    string? EmitCartPonto, int? CodLocalMarcacao, int? CodClassFuncPontoEletronico,

    // Docs avulsos
    string? TituloEleitorNumero, string? TituloEleitorZona, string? TituloEleitorSecao,
    string? TituloEleitorCidade, string? TituloEleitorUf,
    string? ReservistaNumero, string? CategoriaCnh, DateOnly? ValidadeCnh,
    string? Ctps, string? CtpsSerie, string? CtpsUf, int? CtpsModelo,
    string? CtpsSerieESocial,

    // CNH completo
    string? CnhNumero, string? CnhUf, string? CnhOrgaoEmissor,
    DateOnly? CnhDataExpedicao, DateOnly? CnhPrimeiraHabilitacao,

    // Doc Militar
    int? DocMilitarTipo, string? DocMilitarNumero, string? DocMilitarSerie,
    int? DocMilitarRegiao, int? DocMilitarCircunscricao,

    // Saude
    int? GrupoSanguineo, int? FatorRh, string? PossuiDeficiencia, string? FuncDoador,
    string? CartaoSus, int? Altura, int? Peso,
    int? Cutis, int? Cabelo, int? Olhos, int? Manequim, int? Sapato,

    // TOTVS: Contrato
    int? DataTerminoContrato,

    // TOTVS: Localidade
    string? PaisLocalidade, int? CodLocalidade, int? CodFpas,

    // TOTVS: eSocial
    int? CategoriaTrabalhoESocial, int? IndAdmissao, int? NaturezaAtividade,
    int? MunicipioNascimentoIbge, int? TipoAdmissaoESocial,
    int? RegimeTrabalhista, int? RegimePrevidenciario, int? RegimeJornada,
    string? MatriculaESocial,

    // TOTVS: CAGED
    int? OcorrenciaCAGED,

    // TOTVS: Registro exterior
    string? CodRegistroExterior,

    // TOTVS: Estatística (obrigatório pelo validator; faltava no contract)
    int? TipoEstatistica,

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

// ── Aprovação de contratação pelo gestor (inicia fluxo Ítalo) ──

/// <summary>
/// Dados mínimos para o gestor aprovar a contratação de um candidato.
/// Dispara a coleta de documentos via Ítalo (WhatsApp).
/// </summary>
public sealed record AprovarContratacaoRequest(
    /// <summary>ID do candidato no módulo de R&amp;S (opcional — para vincular à pré-admissão).</summary>
    Guid? CandidatoId,
    /// <summary>ID da vaga/recrutamento que originou a pré-admissão.</summary>
    Guid? VagaId,
    /// <summary>Nome completo do candidato.</summary>
    string Nome,
    /// <summary>CPF do candidato (opcional — Ítalo pode confirmar via OCR).</summary>
    string? Cpf,
    /// <summary>E-mail para contato com o candidato.</summary>
    string? Email,
    /// <summary>Celular/WhatsApp do candidato — usado pelo Ítalo para iniciar a coleta.</summary>
    string? Celular,
    Guid? UnitId,
    Guid? CentroCustoId,
    Guid? JobPositionId,
    DateOnly? DataAdmissao,
    decimal? Salario
);

// ── Webhook Ítalo — dados OCR dos documentos coletados ──

/// <summary>
/// Payload enviado pelo Ítalo após processar cada documento do candidato via Lambda OCR.
/// Chamado para cada documento (RG, CPF, comprovante de residência).
/// </summary>
public sealed record DocumentoExternoRequest(
    /// <summary>Tipo do documento processado: "rg", "cpf", "comprovante_residencia".</summary>
    string TipoDocumento,
    /// <summary>Nome original do arquivo enviado pelo candidato.</summary>
    string? NomeArquivo,
    /// <summary>Content-type do arquivo (ex: "image/jpeg", "application/pdf").</summary>
    string? ContentType,
    /// <summary>Conteúdo do documento em Base64 para persistência.</summary>
    string? DocumentoBase64,
    /// <summary>Dados extraídos do RG pelo agente OCR ler_rg.</summary>
    DadosOcrRg? DadosRg,
    /// <summary>Dados extraídos do CPF pelo agente OCR ler_cpf.</summary>
    DadosOcrCpf? DadosCpf,
    /// <summary>Dados extraídos do comprovante de residência pelo agente ler_comprovante_residencia.</summary>
    DadosOcrComprovante? DadosComprovante
);

public sealed record DadosOcrRg(
    string? NomeCompleto,
    string? NumeroRg,
    string? NumeroCpf,
    string? NivelConfiabilidade
);

public sealed record DadosOcrCpf(
    string? NumeroCpf,
    string? NivelConfiabilidade
);

public sealed record DadosOcrComprovante(
    string? NomeCompleto,
    string? EnderecoConcatenato,
    string? Cep,
    string? Logradouro,
    string? Numero,
    string? Bairro,
    string? Cidade,
    string? Uf,
    string? NivelConfiabilidade
);

// ── Admissão manual pelo RH (candidato aprovado no recrutamento) ──

/// <summary>
/// RH inicia admissão manual a partir de um candidato aprovado.
/// A pré-admissão é criada em Rascunho pré-preenchida com os dados do candidato.
/// </summary>
public sealed record IniciarManualRequest(
    /// <summary>ID do candidato aprovado no módulo de R&amp;S.</summary>
    [Required] Guid CandidatoId,
    /// <summary>Data prevista de admissão (opcional — pode ser preenchida no wizard).</summary>
    DateOnly? DataAdmissao,
    /// <summary>ID do cargo (opcional — pode ser preenchido no wizard).</summary>
    Guid? JobPositionId,
    /// <summary>ID do centro de custo organizacional (opcional). Absorveu Area/Department em 31.2.</summary>
    Guid? CentroCustoId,
    /// <summary>ID da unidade/filial (opcional).</summary>
    Guid? UnitId,
    /// <summary>Salário proposto (opcional).</summary>
    decimal? Salario,
    /// <summary>Tipo de contratação (opcional).</summary>
    TipoContratacaoAdmissao? TipoContratacao
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

// ── Solicitação de documentos pelo RH ──

public sealed record SalvarDocumentosSolicitadosRequest(
    List<DocumentoSolicitadoEntry> Documentos
);

public sealed record DocumentoSolicitadoEntry(
    TipoDocumento TipoDocumento,
    bool Obrigatorio
);

public sealed record DocumentoSolicitadoResponse(
    TipoDocumento TipoDocumento,
    string Label,
    bool Obrigatorio
);

// ── Gerar link de acesso do candidato ──

public sealed record GerarLinkRequest(string? Cpf, bool EnviarEmail = true, bool EnviarWhatsapp = true);

public sealed record GerarLinkResponse(string AccessToken, string PublicUrl, bool EmailEnviado, bool WhatsappEnviado);

// ── Re-solicitação de documentos ao candidato ──

public sealed record SolicitarReenvioDocumentosRequest(
    int[] TiposDocumento,
    string? ObservacaoRh,
    bool EnviarEmail = true
);

public sealed record SolicitarReenvioDocumentosResponse(
    string PublicUrl,
    bool EmailEnviado,
    IReadOnlyList<string> DocumentosSolicitados
);

// ── Validação de documento individual pelo RH ──

public sealed record ValidarDocumentoRequest(
    [Required] StatusDocumento Status,
    string? ObservacaoRh
);

public sealed record ValidarDocumentoResponse(
    Guid Id,
    StatusDocumento Status,
    string? ObservacaoRh,
    DateTimeOffset UpdatedAtUtc
);
