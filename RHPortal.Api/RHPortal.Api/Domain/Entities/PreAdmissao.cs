using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Pré-admissão — staging area para dados do futuro funcionário.
/// Campos aderentes ao cadastro de Pessoa Física (fp1440) e Funcionário (fp1500) do TOTVS HCM.
/// </summary>
public sealed class PreAdmissao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Workflow ──
    public PreAdmissaoStatus Status { get; set; } = PreAdmissaoStatus.Rascunho;
    public PreenchidoPor PreenchidoPor { get; set; } = PreenchidoPor.RH;

    /// <summary>Se a admissão veio de um candidato do módulo R&amp;S.</summary>
    public Guid? CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid? RevisadoPorId { get; set; }
    public Funcionario? RevisadoPor { get; set; }

    public Guid? AprovadoPorId { get; set; }
    public Funcionario? AprovadoPor { get; set; }

    [StringLength(2000)]
    public string? ObservacaoRh { get; set; }

    [StringLength(2000)]
    public string? MotivoRejeicao { get; set; }

    // ── Dados Pessoais (fp1440 — Pessoa Física) ──

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [StringLength(14)]
    public string? Cpf { get; set; }

    [StringLength(20)]
    public string? Rg { get; set; }

    [StringLength(20)]
    public string? RgOrgaoExpedidor { get; set; }

    public DateOnly? RgDataExpedicao { get; set; }

    public DateOnly? DataNascimento { get; set; }

    public Sexo Sexo { get; set; } = Sexo.NaoInformado;

    public EstadoCivil EstadoCivil { get; set; } = EstadoCivil.NaoInformado;

    [StringLength(60)]
    public string? Nacionalidade { get; set; }

    [StringLength(160)]
    public string? NomeSocial { get; set; }

    [StringLength(160)]
    public string? NomeMae { get; set; }

    [StringLength(160)]
    public string? NomePai { get; set; }

    [StringLength(120)]
    public string? NaturalCidade { get; set; }

    [StringLength(2)]
    public string? NaturalUf { get; set; }

    [StringLength(10)]
    public string? PaisNacionalidade { get; set; }

    [StringLength(1)]
    public string? ResideExterior { get; set; }

    // ── Estrangeiro ──

    [StringLength(30)]
    public string? Passaporte { get; set; }

    [StringLength(30)]
    public string? RnmRne { get; set; }

    public DateOnly? ValidadeVisto { get; set; }

    [StringLength(60)]
    public string? TipoVisto { get; set; }

    // ── RIC (Registro Identidade Civil — novo documento que substitui o RG) ──
    [StringLength(20)]
    public string? RegIdentidCivilNumero { get; set; }

    [StringLength(2)]
    public string? RegIdentidCivilUf { get; set; }

    [StringLength(120)]
    public string? RegIdentidCivilCidade { get; set; }

    [StringLength(20)]
    public string? RegIdentidCivilOrgEmiss { get; set; }

    public DateOnly? RegIdentidCivilDataExped { get; set; }

    // ── Endereço ──

    [StringLength(10)]
    public string? Cep { get; set; }

    [StringLength(200)]
    public string? Logradouro { get; set; }

    [StringLength(20)]
    public string? Numero { get; set; }

    [StringLength(120)]
    public string? Complemento { get; set; }

    [StringLength(120)]
    public string? Bairro { get; set; }

    [StringLength(120)]
    public string? Cidade { get; set; }

    [StringLength(2)]
    public string? Uf { get; set; }

    // ── Contato ──

    [StringLength(180)]
    public string? Email { get; set; }

    [StringLength(20)]
    public string? Telefone { get; set; }

    [StringLength(20)]
    public string? Celular { get; set; }

    [StringLength(160)]
    public string? ContatoEmergenciaNome { get; set; }

    [StringLength(20)]
    public string? ContatoEmergenciaFone { get; set; }

    // ── Dados Bancários ──

    [StringLength(10)]
    public string? BancoCodigo { get; set; }

    [StringLength(80)]
    public string? BancoNome { get; set; }

    [StringLength(10)]
    public string? Agencia { get; set; }

    [StringLength(2)]
    public string? AgenciaDigito { get; set; }

    [StringLength(20)]
    public string? Conta { get; set; }

    [StringLength(2)]
    public string? ContaDigito { get; set; }

    public TipoContaBancaria? TipoConta { get; set; }

    // ── Dados Trabalhistas (fp1500 — Funcionário) ──

    [StringLength(10)]
    public string? EstabelecimentoCodigo { get; set; }

    [StringLength(20)]
    public string? MatriculaRM { get; set; }

    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    public Guid? AreaId { get; set; }
    public Area? Area { get; set; }

    public Guid? JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    public Guid? RequisitoCategoriaId { get; set; }
    public RequisitoCategoria? RequisitoCategoria { get; set; }

    /// <summary>Vaga de recrutamento que originou esta admissão. Usado na materialização para criar OcupacaoHistorico.</summary>
    public Guid? VagaId { get; set; }
    public Vaga? Vaga { get; set; }

    public DateOnly? DataAdmissao { get; set; }

    public decimal? Salario { get; set; }

    public TipoContratacaoAdmissao? TipoContratacao { get; set; }

    public short? CargaHorariaSemanal { get; set; }

    [StringLength(20)]
    public string? PisPasep { get; set; }

    // ── Campos integração TOTVS (fp1500) ──

    public int? CodCargoTotvs { get; set; }
    public int? CodVinculoEmpregaticio { get; set; }
    public int? TipoFuncionario { get; set; }
    public int? CategoriaSalarial { get; set; }
    public int? GrauInstrucao { get; set; }
    public int? CodTurno { get; set; }

    [StringLength(30)]
    public string? CentroCusto { get; set; }

    [StringLength(30)]
    public string? UnidadeLotacao { get; set; }

    // ── Documentos complementares (campos avulsos) ──

    [StringLength(20)]
    public string? TituloEleitorNumero { get; set; }

    [StringLength(10)]
    public string? TituloEleitorZona { get; set; }

    [StringLength(10)]
    public string? TituloEleitorSecao { get; set; }

    [StringLength(20)]
    public string? ReservistaNumero { get; set; }

    [StringLength(10)]
    public string? CategoriaCnh { get; set; }

    public DateOnly? ValidadeCnh { get; set; }

    [StringLength(20)]
    public string? Ctps { get; set; }

    [StringLength(10)]
    public string? CtpsSerie { get; set; }

    [StringLength(2)]
    public string? CtpsUf { get; set; }

    // ── Saúde e docs complementares TOTVS ──

    public int? GrupoSanguineo { get; set; }
    public int? FatorRh { get; set; }

    [StringLength(1)]
    public string? PossuiDeficiencia { get; set; }

    public int? DocMilitarTipo { get; set; }

    [StringLength(30)]
    public string? DocMilitarNumero { get; set; }

    [StringLength(20)]
    public string? DocMilitarSerie { get; set; }

    public int? DocMilitarRegiao { get; set; }
    public int? DocMilitarCircunscricao { get; set; }

    [StringLength(30)]
    public string? CartaoSus { get; set; }

    [StringLength(120)]
    public string? TituloEleitorCidade { get; set; }

    [StringLength(2)]
    public string? TituloEleitorUf { get; set; }

    public int? CtpsModelo { get; set; }
    public int? Altura { get; set; }
    public int? Peso { get; set; }

    // ── Validações snapshot ──

    public bool ValidacaoCpfOk { get; set; }
    public bool ValidacaoCepOk { get; set; }
    public bool ValidacaoBancoOk { get; set; }
    public bool ValidacaoSalarioOk { get; set; }

    [StringLength(500)]
    public string? ValidacaoSalarioJustificativa { get; set; }

    // ── TOTVS: Empresa ──
    [StringLength(10)]
    public string? CodEmpresa { get; set; }

    // ── TOTVS: RG complemento ──
    [StringLength(2)]
    public string? RgUfExpedidor { get; set; }

    // ── TOTVS: Origem ──
    public int? OrigemFuncionario { get; set; }
    [StringLength(10)]
    public string? PaisNascimento { get; set; }

    // ── TOTVS: Características Físicas ──
    public int? Cutis { get; set; }
    public int? Cabelo { get; set; }
    public int? Olhos { get; set; }
    public int? Manequim { get; set; }
    public int? Sapato { get; set; }

    // ── TOTVS: CTPS eSocial ──
    [StringLength(10)]
    public string? CtpsSerieESocial { get; set; }

    // ── TOTVS: Contrato e Jornada ──
    public int? CodPlanoLotacao { get; set; }
    public int? CodTurma { get; set; }
    public int? NumCartaoPonto { get; set; }
    public int? CodNivel { get; set; }
    [StringLength(10)]
    public string? TipoMaoDeObra { get; set; }
    public int? FormaPagamento { get; set; }
    public decimal? SalarioSimulado { get; set; }

    // ── TOTVS: FGTS / INSS ──
    [StringLength(1)]
    public string? OptanteFgts { get; set; }
    public DateOnly? DataOpcaoFgts { get; set; }
    public int? TipoAdmissaoFgts { get; set; }
    [StringLength(1)]
    public string? RecolheFgts { get; set; }
    [StringLength(1)]
    public string? RecolheInss { get; set; }
    [StringLength(1)]
    public string? FuncQualificado { get; set; }
    public int? IndFuncVinculado { get; set; }
    [StringLength(1)]
    public string? FuncDoador { get; set; }

    // ── TOTVS: Sindicato ──
    [StringLength(1)]
    public string? Sindicalizado { get; set; }
    [StringLength(1)]
    public string? DescContribSindical { get; set; }
    [StringLength(1)]
    public string? ContribSindicDia { get; set; }
    public int? CodSindicato { get; set; }

    // ── TOTVS: Flags de Cálculo ──
    [StringLength(1)]
    public string? CargaAutomTurno { get; set; }
    [StringLength(1)]
    public string? RecebePericul { get; set; }
    [StringLength(1)]
    public string? RecebeInsalub { get; set; }
    [StringLength(1)]
    public string? RecebeAdiantamento { get; set; }
    [StringLength(1)]
    public string? ConsidEmissRAIS { get; set; }
    [StringLength(1)]
    public string? Calcula13 { get; set; }
    [StringLength(1)]
    public string? RecebeFerias { get; set; }

    // ── TOTVS: Provisões 13º ──
    public int? Avos13SalCalcAnterior { get; set; }
    public int? Avos13SalCalc { get; set; }
    public decimal? ProvAcum13Sal { get; set; }
    public decimal? ProvAcumInss13Sal { get; set; }
    public decimal? ProvAcumFgts13Sal { get; set; }

    // ── TOTVS: Provisões Férias ──
    public decimal? DiasProvFeriasMesAnterior { get; set; }
    public decimal? DiasProvFeriasMesAtual { get; set; }
    public decimal? ProvAcumFerias { get; set; }
    public decimal? ProvAcumInssFerias { get; set; }
    public decimal? ProvAcumFgtsFerias { get; set; }
    public decimal? ProvAcumFerias13 { get; set; }

    // ── TOTVS: Ponto ──
    [StringLength(1)]
    public string? EmitCartPonto { get; set; }
    public int? CodLocalMarcacao { get; set; }
    public int? CodClassFuncPontoEletronico { get; set; }

    // ── TOTVS: CNH Completo ──
    [StringLength(20)]
    public string? CnhNumero { get; set; }
    [StringLength(2)]
    public string? CnhUf { get; set; }
    [StringLength(20)]
    public string? CnhOrgaoEmissor { get; set; }
    public int? CnhDataExpedicao { get; set; }
    public int? CnhPrimeiraHabilitacao { get; set; }

    // ── TOTVS: Nome Abreviado / Contrato ──
    [StringLength(20)]
    public string? NomeAbreviado { get; set; }
    public int? DataTerminoContrato { get; set; }

    // ── TOTVS: Localidade ──
    [StringLength(10)]
    public string? PaisLocalidade { get; set; }
    public int? CodLocalidade { get; set; }
    public int? CodFpas { get; set; }

    // ── TOTVS: eSocial ──
    public int? CategoriaTrabalhoESocial { get; set; }
    public int? IndAdmissao { get; set; }
    public int? NaturezaAtividade { get; set; }
    public int? MunicipioNascimentoIbge { get; set; }
    [StringLength(5)]
    public string? TipoLogradouroESocial { get; set; }
    public int? MunicipioEnderecoIbge { get; set; }
    [StringLength(180)]
    public string? EmailAlternativo { get; set; }
    public int? TipoAdmissaoESocial { get; set; }
    public int? RegimeTrabalhista { get; set; }
    public int? RegimePrevidenciario { get; set; }
    public int? RegimeJornada { get; set; }
    [StringLength(30)]
    public string? MatriculaESocial { get; set; }

    // ── TOTVS: Visto / CAGED ──
    public int? TipoVistoEstrangeiro { get; set; }
    public int? OcorrenciaCAGED { get; set; }

    // ── Estrangeiro — campos complementares ──
    public int? OrgaoEmisPassaporte { get; set; }

    [StringLength(10)]
    public string? PaisEmisPassaporte { get; set; }

    public DateOnly? ValidadeIdentEstrangeiro { get; set; }

    public int? AnoChegada { get; set; }

    // ── Naturalizado ──
    [StringLength(60)]
    public string? PortariaNaturalizacao { get; set; }

    [StringLength(60)]
    public string? Naturalizacao { get; set; }

    // ── Certidão Civil ──
    public int? TipoCertidaoCivil { get; set; }

    public DateOnly? DataObitoCivil { get; set; }

    // ── Reside no Exterior ──
    [StringLength(20)]
    public string? CodEnderecoPostalExterior { get; set; }

    [StringLength(120)]
    public string? CidadeExterior { get; set; }

    // ── FP1500: Tipo Estatística ──
    public int? TipoEstatistica { get; set; }

    // ── TOTVS: Ponto Referência / DDD ──
    [StringLength(120)]
    public string? PontoReferencia { get; set; }
    public int? DddTelefone { get; set; }
    public int? DddTelContato { get; set; }

    // ── Timestamps ──

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? SubmittedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── TOTVS: Registro exterior ──
    [StringLength(30)]
    public string? CodRegistroExterior { get; set; }

    // ── Integração TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }

    public Guid? EfetivadoManualmentePorId { get; set; }
    public DateTimeOffset? EfetivadoManualmenteEmUtc { get; set; }

    public int TentativasIntegracao { get; set; }
    public DateTimeOffset? UltimaTentativaUtc { get; set; }

    // ── Portal candidato ──

    /// <summary>Token de acesso para o candidato preencher dados externamente (gerado pelo RH).</summary>
    [StringLength(64)]
    public string? AccessToken { get; set; }

    // ── Wizard progress ──

    public int? WizardCurrentStep { get; set; }
    public int? WizardCompletionPercent { get; set; }
    public DateTimeOffset? LastActivityUtc { get; set; }

    /// <summary>
    /// Preenchido após TOTVS confirmar a admissão (webhook Sucesso).
    /// Aponta para o Funcionario materializado a partir desta pré-admissão.
    /// Idempotência: se já preenchido, MaterializarFuncionarioAsync é no-op.
    /// </summary>
    public Guid? FuncionarioIdMaterializado { get; set; }

    // ── Navigation ──
    public List<PreAdmissaoDocumento> Documentos { get; set; } = new();
    public List<PreAdmissaoDocumentoSolicitado> DocumentosSolicitados { get; set; } = new();
    public List<PreAdmissaoDependente> Dependentes { get; set; } = new();
}
