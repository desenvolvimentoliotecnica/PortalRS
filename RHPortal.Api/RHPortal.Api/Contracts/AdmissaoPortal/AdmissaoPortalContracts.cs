using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.AdmissaoPortal;

// ── Login ──

public sealed record AdmissaoPortalLoginRequest(Guid PreAdmissaoId, string Cpf);

public sealed record AdmissaoPortalLoginResponse(Guid PreAdmissaoId, string Nome, string TenantId);

// ── Dados do portal ──

public sealed record AdmissaoPortalDataResponse(
    Guid PreAdmissaoId,
    string Nome,
    int Status,
    List<PortalDocumentoSolicitadoItem> DocumentosSolicitados,
    List<PortalDocumentoEnviadoItem> DocumentosEnviados,
    PortalDadosPessoais DadosPessoais,
    List<PreAdmissaoDependenteResponse> Dependentes,
    int? WizardCurrentStep,
    int? WizardCompletionPercent
);

public sealed record PortalDocumentoSolicitadoItem(
    int Tipo,
    string Label,
    bool Obrigatorio,
    bool JaEnviado
);

public sealed record PortalDocumentoEnviadoItem(
    Guid Id,
    int Tipo,
    /// <summary>Face do documento: 0=Único, 1=Frente, 2=Verso.</summary>
    int Lado,
    string NomeArquivo,
    long TamanhoBytes,
    int Status,
    string? ObservacaoRh,
    string PresignedUrl
);

public sealed record PortalDadosPessoais(
    // Pessoal
    string? Nome, string? NomeSocial, string? NomeAbreviado,
    string? Cpf, string? Rg, string? RgOrgaoExpedidor,
    string? RgUfExpedidor, string? RgDataExpedicao,
    string? DataNascimento, int? Sexo, int? EstadoCivil,
    string? Nacionalidade, string? PaisNacionalidade,
    string? NomeMae, string? NomePai,
    string? PaisNascimento, string? NaturalCidade, string? NaturalUf,
    int? GrauInstrucao, string? FuncDoador,

    // Endereco
    string? Cep, string? Logradouro, string? Numero,
    string? Complemento, string? Bairro, string? Cidade, string? Uf,
    string? PontoReferencia, string? ResideExterior,

    // Contato
    string? Email, string? EmailAlternativo,
    string? Telefone, string? Celular,
    int? DddTelefone, int? DddTelContato,
    string? ContatoEmergenciaNome, string? ContatoEmergenciaFone,

    // Bancario
    string? BancoCodigo, string? BancoNome, string? Agencia,
    string? AgenciaDigito, string? Conta, string? ContaDigito, int? TipoConta,

    // Trabalhista
    string? PisPasep, string? Ctps, string? CtpsSerie, string? CtpsUf, int? CtpsModelo,

    // Titulo Eleitor
    string? TituloEleitorNumero, string? TituloEleitorZona, string? TituloEleitorSecao,
    string? TituloEleitorCidade, string? TituloEleitorUf,

    // CNH
    string? CnhNumero, string? CategoriaCnh, string? CnhUf,
    string? CnhOrgaoEmissor, int? CnhDataExpedicao, int? CnhPrimeiraHabilitacao,
    string? ValidadeCnh,

    // Reservista / Doc Militar
    string? ReservistaNumero,
    int? DocMilitarTipo, string? DocMilitarNumero, string? DocMilitarSerie,
    int? DocMilitarRegiao, int? DocMilitarCircunscricao,

    // Estrangeiro
    string? Passaporte, string? RnmRne, string? ValidadeVisto, string? TipoVisto,

    // Saude e caracteristicas fisicas
    int? GrupoSanguineo, int? FatorRh, string? PossuiDeficiencia,
    string? CartaoSus, int? Altura, int? Peso,
    int? Cutis, int? Cabelo, int? Olhos, int? Manequim, int? Sapato
);

// ── Salvar dados pessoais ──

public sealed record PortalSalvarDadosRequest(
    // Pessoal
    string? Nome, string? NomeSocial, string? NomeAbreviado,
    string? Cpf, string? Rg, string? RgOrgaoExpedidor,
    string? RgUfExpedidor, string? RgDataExpedicao,
    string? DataNascimento, int? Sexo, int? EstadoCivil,
    string? Nacionalidade, string? PaisNacionalidade,
    string? NomeMae, string? NomePai,
    string? PaisNascimento, string? NaturalCidade, string? NaturalUf,
    int? GrauInstrucao, string? FuncDoador,

    // Endereco
    string? Cep, string? Logradouro, string? Numero,
    string? Complemento, string? Bairro, string? Cidade, string? Uf,
    string? PontoReferencia, string? ResideExterior,

    // Contato
    string? Email, string? EmailAlternativo,
    string? Telefone, string? Celular,
    int? DddTelefone, int? DddTelContato,
    string? ContatoEmergenciaNome, string? ContatoEmergenciaFone,

    // Bancario
    string? BancoCodigo, string? BancoNome, string? Agencia,
    string? AgenciaDigito, string? Conta, string? ContaDigito, int? TipoConta,

    // Trabalhista
    string? PisPasep, string? Ctps, string? CtpsSerie, string? CtpsUf, int? CtpsModelo,

    // Titulo Eleitor
    string? TituloEleitorNumero, string? TituloEleitorZona, string? TituloEleitorSecao,
    string? TituloEleitorCidade, string? TituloEleitorUf,

    // CNH
    string? CnhNumero, string? CategoriaCnh, string? CnhUf,
    string? CnhOrgaoEmissor, int? CnhDataExpedicao, int? CnhPrimeiraHabilitacao,
    string? ValidadeCnh,

    // Reservista / Doc Militar
    string? ReservistaNumero,
    int? DocMilitarTipo, string? DocMilitarNumero, string? DocMilitarSerie,
    int? DocMilitarRegiao, int? DocMilitarCircunscricao,

    // Estrangeiro
    string? Passaporte, string? RnmRne, string? ValidadeVisto, string? TipoVisto,

    // Saude e caracteristicas fisicas
    int? GrupoSanguineo, int? FatorRh, string? PossuiDeficiencia,
    string? CartaoSus, int? Altura, int? Peso,
    int? Cutis, int? Cabelo, int? Olhos, int? Manequim, int? Sapato
);

// ── Upload de documento ──

public sealed class PortalUploadDocumentoRequest
{
    public IFormFile File { get; set; } = null!;
    public TipoDocumento Tipo { get; set; }
    /// <summary>Face do documento: Unico (0, padrão), Frente (1) ou Verso (2).</summary>
    public LadoDocumento Lado { get; set; } = LadoDocumento.Unico;
}

// ── Dependentes ──

public sealed record PreAdmissaoDependenteResponse(
    Guid Id,
    string NomeCompleto,
    int Parentesco,
    string? Cpf,
    string DataNascimento,
    bool IsPcd
);

public sealed record DependenteCreateRequest(
    string NomeCompleto,
    int Parentesco,
    string? Cpf,
    string DataNascimento,
    bool IsPcd
);

public sealed record DependenteUpdateRequest(
    string NomeCompleto,
    int Parentesco,
    string? Cpf,
    string DataNascimento,
    bool IsPcd
);

// ── Wizard progress ──

public sealed record WizardProgressRequest(int CurrentStep, int CompletionPercent);
