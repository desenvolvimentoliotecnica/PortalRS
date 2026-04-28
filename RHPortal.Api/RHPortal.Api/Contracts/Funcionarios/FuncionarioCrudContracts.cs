using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Contracts.Colaborador;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

/// <summary>Request para criar funcionário (inclui UserId opcional para vincular usuário existente).</summary>
public sealed class FuncionarioCreateRequest
{
    /// <summary>Construtor sem parâmetros para deserialização por System.Text.Json.</summary>
    public FuncionarioCreateRequest()
    {
        Name = string.Empty;
        Email = string.Empty;
    }

    [Required, MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(180), EmailAddress]
    public string? Email { get; set; }

    [MaxLength(40)]
    public string? Phone { get; set; }

    public FuncionarioStatus Status { get; set; }

    public int Headcount { get; set; }

    public Guid? UnitId { get; set; }

    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
    public Guid? CentroCustoId { get; set; }

    public Guid? JobPositionId { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    public Guid? UserId { get; set; }

    /// <summary>Matrícula no TOTVS Datasul (cdn_funcionario).</summary>
    [MaxLength(12)]
    public string? CdnFuncionario { get; set; }

    /// <summary>Código da empresa no TOTVS (cdn_empresa).</summary>
    [MaxLength(3)]
    public string? CdnEmpresa { get; set; }

    /// <summary>Código do estabelecimento no TOTVS (cdn_estab).</summary>
    [MaxLength(5)]
    public string? CdnEstab { get; set; }
}

/// <summary>Item retornado por GET users-without-funcionario: todos os usuários do tenant com indicação se já têm funcionário.</summary>
public sealed record UserWithoutFuncionarioItemResponse(Guid Id, string FullName, string Email, bool HasFuncionario);

public sealed record FuncionarioUpdateRequest(
    [Required, MaxLength(160)] string Name,
    [MaxLength(180), EmailAddress] string? Email,
    [MaxLength(40)] string? Phone,
    FuncionarioStatus Status,
    int Headcount,
    Guid? UnitId,
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
    Guid? CentroCustoId,
    Guid? JobPositionId,
    Guid? RequisitoCategoriaId,
    [MaxLength(1000)] string? Notes,
    // Hierarquia
    Guid? GestorDiretoId,
    Guid? NivelHierarquicoId,
    // Lotação / Centro de Custo
    Guid? UnidadeLotacaoId,
    // Chaves TOTVS
    [MaxLength(12)] string? CdnFuncionario,
    [MaxLength(3)] string? CdnEmpresa,
    [MaxLength(5)] string? CdnEstab,
    // Dados pessoais
    DateOnly? DataAdmissao,
    DateOnly? DataNascimento,
    [MaxLength(1)] string? Sexo
);

/// <summary>Request para atualizar apenas o gestor direto e nível hierárquico de um funcionário.</summary>
public sealed record FuncionarioHierarquiaRequest(
    Guid? GestorDiretoId,
    Guid? NivelHierarquicoId
);

/// <summary>
/// Item para importação em lote de colaboradores vindos do TOTVS Datasul.
/// Colunas correspondentes ao CSV de 2_extrai_colaboradores_unidade.p.
/// Chave de upsert: (CdnEmpresa + CdnEstab + CdnFuncionario).
/// </summary>
public sealed class FuncionarioImportItem
{
    /// <summary>Matrícula do funcionário no TOTVS (cdn_funcionario).</summary>
    [Required]
    public string CdnFuncionario { get; set; } = string.Empty;

    /// <summary>Código da empresa no TOTVS (cdn_empresa).</summary>
    [Required]
    public string CdnEmpresa { get; set; } = string.Empty;

    /// <summary>Código do estabelecimento no TOTVS (cdn_estab).</summary>
    [Required]
    public string CdnEstab { get; set; } = string.Empty;

    /// <summary>Nome completo (nom_pessoa_fisic).</summary>
    [Required, MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    /// <summary>E-mail (nom_e_mail). Quando presente, busca ou cria a Pessoa vinculada. Sem validação de formato para permitir vazio.</summary>
    [MaxLength(180)]
    public string? Email { get; set; }

    /// <summary>CPF (cod_id_feder).</summary>
    [MaxLength(14)]
    public string? Cpf { get; set; }

    /// <summary>Data de nascimento — aceita dd/MM/yyyy ou formato exportado pelo Excel.</summary>
    [MaxLength(30)]
    public string? DataNascimento { get; set; }

    /// <summary>RG (cod_id_estad_fisic).</summary>
    [MaxLength(20)]
    public string? Rg { get; set; }

    /// <summary>Telefone (fone).</summary>
    [MaxLength(40)]
    public string? Fone { get; set; }

    /// <summary>CEP (cod_cep_rh).</summary>
    [MaxLength(20)]
    public string? Cep { get; set; }

    /// <summary>Logradouro (nom_ender_rh).</summary>
    [MaxLength(200)]
    public string? Logradouro { get; set; }

    /// <summary>Número do endereço (cod_num_ender).</summary>
    [MaxLength(40)]
    public string? NumeroEndereco { get; set; }

    /// <summary>Bairro (nom_bairro_rh).</summary>
    [MaxLength(120)]
    public string? Bairro { get; set; }

    /// <summary>Cidade (nom_cidad_rh).</summary>
    [MaxLength(120)]
    public string? Cidade { get; set; }

    /// <summary>UF — 2 letras (cod_unid_federac_rh).</summary>
    [MaxLength(2)]
    public string? Uf { get; set; }

    /// <summary>Código da unidade de lotação no TOTVS (cod_unid_lotac) — informativo, usado pelo import-owners.</summary>
    [MaxLength(20)]
    public string? CodUnidLotac { get; set; }

    /// <summary>Código do plano de lotação no TOTVS (cdn_plano_lotac). Usado junto com CodUnidLotac para lookup único.</summary>
    [MaxLength(10)]
    public string? CdnPlanoLotac { get; set; }

    /// <summary>Data de início no cargo — aceita dd/MM/yyyy ou formato exportado pelo Excel.</summary>
    [MaxLength(30)]
    public string? DataInicCargo { get; set; }

    /// <summary>Código do cargo no TOTVS (cod_cargo) — informativo.</summary>
    [MaxLength(20)]
    public string? CodCargo { get; set; }

    /// <summary>Código do centro de custo no TOTVS (cod_ccusto).</summary>
    [MaxLength(20)]
    public string? CodCentroCusto { get; set; }

    /// <summary>Código do nível de cargo no TOTVS (cdn_niv_cargo).</summary>
    [MaxLength(10)]
    public string? CodNivCargo { get; set; }
}

/// <summary>Resultado da importação em lote de colaboradores.</summary>
public sealed record FuncionarioImportResult(
    int Created,
    int Updated,
    int Skipped,
    List<string> Errors,
    List<string> Warnings
);

/// <summary>Visão unificada 360° de um funcionário. Agrega todos os dados relevantes em um único objeto.</summary>
public sealed record FuncionarioPerfil360Response(
    // ── Dados cadastrais ──
    Guid Id,
    string Nome,
    string? Email,
    string? Telefone,
    FuncionarioStatus Status,
    string? AvatarUrl,
    DateOnly? DataAdmissao,
    DateOnly? DataNascimento,
    string? Sexo,
    bool EmExperiencia,
    int? DiasRestantesExperiencia,
    int? ProgressoExperiencia,
    // ── Cargo e estrutura ──
    string? CargoNome,
    string? FuncaoNome,
    string? AreaNome,
    string? UnidadeNome,
    string? UnidadeLotacaoNome,
    string? NivelHierarquicoNome,
    string? NivelCargoNome,
    string? CentroCustoNome,
    // ── Hierarquia ──
    Guid? GestorDiretoId,
    string? GestorDiretoNome,
    string? GestorDiretoAvatarUrl,
    // ── Chaves TOTVS ──
    string? CdnFuncionario,
    string? CdnEmpresa,
    string? CdnEstab,
    // ── TOTVS RM ──
    string? MatriculaRm,
    string? HierarquiaDescricao,
    string? CodSituacaoRm,
    string? SituacaoRmDescricao,
    // ── Pessoa: identificação ──
    string? Cpf,
    string? EstadoCivil,
    string? Naturalidade,
    string? EstadoNatal,
    string? GrauInstrucao,
    string? NomePai,
    string? NomeMae,
    string? Nacionalidade,
    // ── Pessoa: endereço ──
    string? Cep,
    string? Logradouro,
    string? NumeroEndereco,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    // ── Pessoa: documentos ──
    string? Rg,
    string? RgOrgEmissor,
    string? RgUf,
    DateTime? RgDataEmissao,
    string? CarteiraTrabalho,
    string? CarteiraTrabalhoSerie,
    string? CarteiraTrabalhoUf,
    DateTime? CarteiraTrabalhoData,
    string? NumeroPis,
    string? TituloEleitor,
    string? TituloEleitorZona,
    string? TituloEleitorSecao,
    string? CertificadoReservista,
    string? CategoriaMilitar,
    // ── Sublistas ──
    IReadOnlyList<HistoricoCarreiraItemResponse> HistoricoCarreira,
    IReadOnlyList<DependenteResponse> Dependentes,
    IReadOnlyList<DocumentoResponse> Documentos,
    IReadOnlyList<HoleriteResponse> Holerites,
    DadosBancariosResponse? DadosBancarios
);

public sealed record FuncionarioResponse(
    Guid Id,
    string Name,
    string? Email,
    string? Phone,
    FuncionarioStatus Status,
    int Headcount,
    Guid? UnitId,
    string? UnitName,
    Guid? JobPositionId,
    string? JobPositionName,
    string? JobPositionCode,
    Guid? UserId,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    // Hierarquia
    Guid? GestorDiretoId,
    string? GestorDiretoNome,
    Guid? NivelHierarquicoId,
    string? NivelHierarquicoNome,
    // Lotação TOTVS
    Guid? UnidadeLotacaoId,
    string? UnidadeLotacaoDescricao,
    // Chaves TOTVS Datasul
    string? CdnFuncionario,
    string? CdnEmpresa,
    string? CdnEstab,
    // Centro de Custo
    Guid? CentroCustoId,
    string? CentroCustoDescricao,
    // Códigos para exibição
    string? UnidadeLotacaoCode,
    string? CentroCustoCode,
    // Dados pessoais
    DateOnly? DataAdmissao,
    DateOnly? DataNascimento,
    string? Sexo,
    // TOTVS RM (LUC-122)
    string? MatriculaRm,
    Guid? HierarquiaId,
    string? HierarquiaDescricao,
    string? CodSituacaoRm,
    string? SituacaoRmDescricao,
    string? CodFuncaoRm,
    string? FuncaoNomeRm
);
