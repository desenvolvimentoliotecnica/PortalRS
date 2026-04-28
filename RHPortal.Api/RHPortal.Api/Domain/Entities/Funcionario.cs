using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Funcionario : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid? PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    public string Name { get; set; } = default!;
    public string? Email { get; set; }
    public string? Phone { get; set; }

    public FuncionarioStatus Status { get; set; } = FuncionarioStatus.Active;

    /// <summary>Quando preenchido, o funcionário foi criado a partir deste usuário.</summary>
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }

    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    /// <summary>Unidade de lotação TOTVS Datasul (cod_unid_lotac).</summary>
    public Guid? UnidadeLotacaoId { get; set; }
    public UnidadeLotacao? UnidadeLotacao { get; set; }

    public int Headcount { get; set; }

    public Guid? JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    // ── Sprint 2: Hierarquia ──

    /// <summary>Nível hierárquico do funcionário (configurável pelo Admin).</summary>
    public Guid? NivelHierarquicoId { get; set; }
    public NivelHierarquico? NivelHierarquico { get; set; }

    /// <summary>Gestor direto (superior imediato) — self-reference.</summary>
    public Guid? GestorDiretoId { get; set; }
    public Funcionario? GestorDireto { get; set; }

    public string? AvatarFileName { get; set; }

    public string? Notes { get; set; }

    // ── Chaves de integração TOTVS Datasul ──

    /// <summary>Código do funcionário no TOTVS Datasul (cdn_funcionario).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(12)]
    public string? CdnFuncionario { get; set; }

    /// <summary>
    /// CHAPA do funcionário no TOTVS RM (PFUNC.CHAPA — ex.: "00000581").
    /// Chave de integração com a Liotécnica. Populada pelo <c>PortalFuncionarioSyncService</c>.
    /// Usada por <c>Desligamento.ChapaRm</c> para resolver <c>FuncionarioId</c>.
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(20)]
    public string? MatriculaRm { get; set; }

    /// <summary>
    /// Hierarquia atual do funcionário no organograma TOTVS RM.
    /// Derivada do último <c>VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO</c> aprovado para a CHAPA.
    /// Para os ~38% sem registro em VREQTRANSFPROMOCAO, fica NULL e pode ser
    /// preenchido manualmente pelo Admin no Portal.
    /// </summary>
    public Guid? HierarquiaId { get; set; }
    public Hierarquia? Hierarquia { get; set; }

    /// <summary>
    /// PFUNC.CODSITUACAO original do TOTVS — granularidade maior que Status (Active/Inactive).
    /// Valores comuns Liotécnica: A=Ativo, F=Férias, P=Pré-admissão, D=Demitido, I=Inativo,
    /// T=Transferido, R=Aposentado, B=Beneficiário, S=Substituição, Z/W/M=outros.
    /// Tela de Funcionários pode filtrar por este código pra ver apenas demitidos, em férias, etc.
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(5)]
    public string? CodSituacaoRm { get; set; }

    /// <summary>Descrição amigável de CodSituacaoRm (ex.: "Ativo", "Férias", "Demitido").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(60)]
    public string? SituacaoRmDescricao { get; set; }

    /// <summary>Código da empresa no TOTVS Datasul (cdn_empresa).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(3)]
    public string? CdnEmpresa { get; set; }

    /// <summary>Código do estabelecimento no TOTVS Datasul (cdn_estab).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(5)]
    public string? CdnEstab { get; set; }

    /// <summary>Centro de custo do funcionário.</summary>
    public Guid? CentroCustoId { get; set; }
    public CentroCusto? CentroCusto { get; set; }

    /// <summary>Nível de cargo TOTVS Datasul (cdn_niv_cargo). Preenchido automaticamente no import.</summary>
    public Guid? NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    /// <summary>Código bruto do nível de cargo no TOTVS (cdn_niv_cargo). Usado como fallback de exibição quando NivelCargo não está cadastrado.</summary>
    public int? CdnNivCargo { get; set; }

    /// <summary>
    /// Indica que o colaborador possui campos obrigatórios não preenchidos
    /// (Pessoa, Cargo, Unidade de Lotação, Nível Hierárquico, Centro de Custo).
    /// Atualizado automaticamente em cada operação de escrita.
    /// Usado para filtros de integração e alertas na tela.
    /// </summary>
    public bool HasIncompleteData { get; set; }

    /// <summary>Data de admissão oficial (populada na materialização do PreAdmissao ou import TOTVS).</summary>
    public DateOnly? DataAdmissao { get; set; }

    /// <summary>
    /// Duração do período de experiência em dias (padrão 90).
    /// Em experiência quando DataAdmissao + PeriodoExperienciaDias > hoje.
    /// </summary>
    public int PeriodoExperienciaDias { get; set; } = 90;

    /// <summary>Data de nascimento para pirâmide etária e relatórios de diversidade.</summary>
    public DateOnly? DataNascimento { get; set; }

    /// <summary>Sexo: "M", "F" ou null. Populado na materialização do PreAdmissao ou import TOTVS.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(1)]
    public string? Sexo { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Recalcula e aplica HasIncompleteData com base nos campos obrigatórios.</summary>
    public void RefreshIncompleteData() =>
        HasIncompleteData =
            string.IsNullOrEmpty(Name) ||
            PessoaId == null ||
            JobPositionId == null ||
            UnidadeLotacaoId == null ||
            (NivelHierarquicoId == null && NivelCargoId == null && CdnNivCargo == null) ||
            CentroCustoId == null;
}
