using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

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
    public string? NomeMae { get; set; }

    [StringLength(160)]
    public string? NomePai { get; set; }

    [StringLength(120)]
    public string? NaturalCidade { get; set; }

    [StringLength(2)]
    public string? NaturalUf { get; set; }

    // ── Estrangeiro ──

    [StringLength(30)]
    public string? Passaporte { get; set; }

    [StringLength(30)]
    public string? RnmRne { get; set; }

    public DateOnly? ValidadeVisto { get; set; }

    [StringLength(60)]
    public string? TipoVisto { get; set; }

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

    public DateOnly? DataAdmissao { get; set; }

    public decimal? Salario { get; set; }

    public TipoContratacaoAdmissao? TipoContratacao { get; set; }

    public short? CargaHorariaSemanal { get; set; }

    [StringLength(20)]
    public string? PisPasep { get; set; }

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

    // ── Validações snapshot ──

    public bool ValidacaoCpfOk { get; set; }
    public bool ValidacaoCepOk { get; set; }
    public bool ValidacaoBancoOk { get; set; }
    public bool ValidacaoSalarioOk { get; set; }

    [StringLength(500)]
    public string? ValidacaoSalarioJustificativa { get; set; }

    // ── Timestamps ──

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? SubmittedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Integração TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }

    // ── Portal candidato ──

    /// <summary>Token de acesso para o candidato preencher dados externamente (gerado pelo RH).</summary>
    [StringLength(64)]
    public string? AccessToken { get; set; }

    // ── Navigation ──
    public List<PreAdmissaoDocumento> Documentos { get; set; } = new();
    public List<PreAdmissaoDocumentoSolicitado> DocumentosSolicitados { get; set; } = new();
}
