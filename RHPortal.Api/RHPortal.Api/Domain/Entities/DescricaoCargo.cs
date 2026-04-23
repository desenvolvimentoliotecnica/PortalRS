namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Descrição de cargo — segue o template DNALIO (referência: anexo
/// "Assistente de Suporte Tecnico.docx" enviado pelo usuário). Estrutura:
///
/// <list type="bullet">
///   <item><b>Cabeçalho</b>: <see cref="Title"/> (Cargo), <see cref="AreaTemplate"/> (Área),
///         <see cref="CboCodigo"/> (CBO).</item>
///   <item><b>Descrição Sumária</b>: <see cref="Summary"/> — resumo da função (1-2 parágrafos).</item>
///   <item><b>Atividades Específicas</b> e <b>Atividades Comuns ao Nível do Cargo</b>:
///         coleção <see cref="Itens"/> com <see cref="DescricaoCargoItem.Categoria"/> apropriada.</item>
///   <item><b>Formação</b>: <see cref="FormacaoMinima"/>, <see cref="FormacaoDesejavel"/>,
///         <see cref="FormacaoAreaEstudo"/>.</item>
///   <item><b>Experiência</b>: <see cref="ExperienciaTempoMinimo"/>, <see cref="ExperienciaTempoDesejavel"/>,
///         <see cref="ExperienciaEspecificacao"/>.</item>
///   <item><b>Vivências/Experiências Específicas</b>: itens da coleção com categoria
///         <c>VivenciaEspecifica</c> e <c>IsObrigatoria</c> distinguindo Obrigatório vs Desejável.</item>
///   <item><b>4 categorias de Competências</b> (DNALIO/Liderança/Funcional/Técnica): itens
///         da coleção com categoria correspondente.</item>
///   <item><b>Requisitos Obrigatórios</b>: itens com categoria <c>RequisitoObrigatorio</c>.</item>
///   <item><b>Revisão e Aprovação</b>: <see cref="RevisaoNumero"/>, <see cref="RevisaoData"/>,
///         <see cref="RevisaoNatureza"/>, <see cref="GestorNome"/>, <see cref="GestorEmail"/>.</item>
/// </list>
///
/// <para><b>Uso pelo MatchingService</b>: a <see cref="Vaga"/> aponta para uma DescricaoCargo
/// via <c>Vaga.DescricaoCargoId</c>. O algoritmo de matching consulta os itens estruturados
/// (não os campos HTML) para calcular score granular por categoria — permite calibrar pesos
/// (Vaga.PesoCompetencia, PesoIdioma etc.) com precisão. Os campos HTML legados continuam
/// sendo usados para apresentação pública/portal de vagas.</para>
/// </summary>
public sealed class DescricaoCargo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código interno (ex.: DC-0001). Único por tenant.</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Cargo (cabeçalho do template). Ex.: "Assistente de Suporte Técnico".</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string Title { get; set; } = default!;

    /// <summary>Área (cabeçalho do template). Ex.: "Tecnologia da Informação".</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string? AreaTemplate { get; set; }

    /// <summary>Código CBO (Classificação Brasileira de Ocupações).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(20)]
    public string? CboCodigo { get; set; }

    /// <summary>Descrição Sumária (resumo da função, 1-2 parágrafos).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(2000)]
    public string? Summary { get; set; }

    // ── Formação ────────────────────────────────────────────────────────────

    /// <summary>Formação mínima exigida (ex.: "Ensino superior Completo").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? FormacaoMinima { get; set; }

    /// <summary>Formação desejável (ex.: "Pós Graduação Cursando").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? FormacaoDesejavel { get; set; }

    /// <summary>Área de estudo esperada (ex.: "Tecnologia da informação").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? FormacaoAreaEstudo { get; set; }

    // ── Experiência ─────────────────────────────────────────────────────────

    /// <summary>Tempo mínimo de experiência (ex.: "1 ano"). Texto livre para flexibilidade.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(80)]
    public string? ExperienciaTempoMinimo { get; set; }

    /// <summary>Tempo desejável de experiência (ex.: "Inferior a 2 anos").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(80)]
    public string? ExperienciaTempoDesejavel { get; set; }

    /// <summary>Especificação de experiência (ex.: "Experiência na área ou função similar").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? ExperienciaEspecificacao { get; set; }

    // ── Revisão e Aprovação ────────────────────────────────────────────────

    /// <summary>Número da revisão do template (ex.: "00", "01").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(10)]
    public string? RevisaoNumero { get; set; }

    /// <summary>Data da revisão (preenchida pelo gestor que aprovou).</summary>
    public DateOnly? RevisaoData { get; set; }

    /// <summary>Natureza da revisão (ex.: "Descrição Inicial", "Atualização anual").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? RevisaoNatureza { get; set; }

    /// <summary>Nome do gestor responsável (ex.: "Lucas Muniz").</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? GestorNome { get; set; }

    /// <summary>E-mail do gestor responsável.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? GestorEmail { get; set; }

    // ── Campos HTML legados (apresentação pública) ─────────────────────────

    /// <summary>
    /// Responsabilidades em HTML/Markdown (texto livre do editor rico).
    /// Mantido para portal público / publicação de vaga; o matching usa
    /// os itens estruturados em <see cref="Itens"/> com categoria
    /// <c>AtividadeEspecifica</c>/<c>AtividadeComum</c>.
    /// </summary>
    public string? Responsibilities { get; set; }

    /// <summary>Requisitos em HTML/Markdown. Veja nota em <see cref="Responsibilities"/>.</summary>
    public string? Requirements { get; set; }

    /// <summary>Diferenciais / nice-to-have em HTML/Markdown.</summary>
    public string? NiceToHave { get; set; }

    /// <summary>Benefícios oferecidos em HTML/Markdown.</summary>
    public string? Benefits { get; set; }

    /// <summary>
    /// Flag indicando que a descrição é um template reutilizável
    /// (tipicamente vinculada a um NivelCargo). Não exclui uso direto em vaga.
    /// </summary>
    public bool IsTemplate { get; set; }

    /// <summary>Nível de cargo (Cargo Macro) ao qual a descrição está vinculada. Opcional.</summary>
    public Guid? NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Itens estruturados (atividades, vivências, competências, requisitos).
    /// Cascade no delete — itens morrem junto com a descrição.
    /// </summary>
    public ICollection<DescricaoCargoItem> Itens { get; set; } = new List<DescricaoCargoItem>();
}
