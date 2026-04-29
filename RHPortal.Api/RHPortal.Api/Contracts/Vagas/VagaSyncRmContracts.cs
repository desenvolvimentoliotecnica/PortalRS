using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

/// <summary>
/// Item enviado pelo worker TOTVS RM (<c>PortalVagaSyncService</c>).
///
/// Refactor 2026-04-27: a fonte primária passou a ser VREQAUMENTOQUADRO/VREQSUBSTITUICAO
/// (chave de upsert = <c>IdReqRm</c>). VRSVAGAS é apenas enriquecimento (descrição,
/// requisitos, salário negociado pelo R&S) — match heurístico por CODFUNCAO + janela
/// de data. Vagas que existem em VRSVAGAS aberta sem casamento com VREQ* viva entram
/// como itens "Direta" (chave = <c>CodVaga</c>).
///
/// Status no Portal é derivado do <c>CODSTATUS</c> da req-mãe pelo worker:
///   3 (Aprovada RM) → Aberta · 4 (Concluída/preenchida RM) → Encerrada ·
///   6 (Cancelada RM) → Cancelada · 7 (Suspensa RM) → Pausada.
/// </summary>
public sealed class VagaSyncRmItem
{
    /// <summary>
    /// IDREQ da requisição-mãe (VREQAUMENTOQUADRO ou VREQSUBSTITUICAO). Chave primária
    /// de upsert para itens com origem RM. Null para itens "Direta" (vaga em VRSVAGAS
    /// sem requisição-mãe identificada).
    /// </summary>
    public string? IdReqRm { get; set; }

    /// <summary>
    /// VRSVAGAS.CODVAGA — chave de upsert apenas para itens "Direta" (sem IdReqRm).
    /// Para itens com IdReqRm, é informativo (enriquecimento opcional via match
    /// heurístico CODFUNCAO + janela de data).
    /// </summary>
    public string? CodVaga { get; set; }

    /// <summary>Nome/título da vaga (VRSVAGAS.NOME se enriquecido; senão derivado da função).</summary>
    public string Titulo { get; set; } = default!;

    /// <summary>Status mapeado a partir do CODSTATUS da req-mãe (ou da VRSVAGAS para Direta).</summary>
    public VagaStatus Status { get; set; } = VagaStatus.NaoInformado;

    /// <summary>Data de abertura. Para itens RM = VREQ.DATAABERTURA; Direta = VRSVAGAS.DATAABERTURA.</summary>
    public DateTime? DataAbertura { get; set; }

    /// <summary>Data de fechamento (= DATACONCLUSAO ou DATACANCELAMENTO da req-mãe; ou DATAFECHAMENTO da VRSVAGAS).</summary>
    public DateTime? DataFechamento { get; set; }

    /// <summary>Quantidade de posições (NUMVAGAS da requisição-mãe quando aumento).</summary>
    public int? Quantidade { get; set; }

    /// <summary>Remuneração informada (VRSVAGAS.REMUNERACAO quando enriquecido).</summary>
    public string? Remuneracao { get; set; }

    /// <summary>Descrição/complemento (VRSVAGAS.COMPLEMENTO quando enriquecido).</summary>
    public string? Descricao { get; set; }

    /// <summary>Experiência exigida (VRSVAGAS.EXPERIENCIASEXIGIDAS quando enriquecido).</summary>
    public string? ExperienciasExigidas { get; set; }

    /// <summary>Experiência desejada (VRSVAGAS.EXPERIENCIASDESEJADAS).</summary>
    public string? ExperienciasDesejadas { get; set; }

    /// <summary>Data prevista de início na ocupação (VREQ.DATAPREVISTA).</summary>
    public DateTime? DataPrevistaInicio { get; set; }

    /// <summary>Salário previsto na requisição (VREQ.VLRSALARIO).</summary>
    public decimal? VlrSalario { get; set; }

    /// <summary>Justificativa da requisição (VREQ.JUSTIFICATIVA).</summary>
    public string? Justificativa { get; set; }

    /// <summary>Códigos de faixa salarial no RM (exibição / observação).</summary>
    public string? CodTabelaSalarial { get; set; }

    public string? CodNivelSalarial { get; set; }

    public string? CodFaixaSalarial { get; set; }

    /// <summary>Grau de instrução exigido (VRSVAGAS.CODGRAUINSTRUCAO).</summary>
    public int? CodGrauInstrucao { get; set; }

    /// <summary>Complemento do grau (VRSVAGAS.COMPLEMENTOGRAUINSTRUCAO).</summary>
    public string? ComplementoGrauInstrucao { get; set; }

    /// <summary>CBO da função (PFUNCAO.CBO).</summary>
    public string? FuncaoCbo { get; set; }

    /// <summary>Descrição da função no RM (PFUNCAO.DESCRICAO) — público sugerido.</summary>
    public string? FuncaoDescricao { get; set; }

    /// <summary>Nome do requisitante (PPESSOA via PFUNC.CHAPAREQUISITANTE).</summary>
    public string? GestorRequisitanteNome { get; set; }

    /// <summary>CHAPA do requisitante no RM (VREQ.CHAPAREQUISITANTE), usada para vincular Funcionario.</summary>
    public string? GestorRequisitanteChapa { get; set; }

    /// <summary>Código da função (PFUNCAO.CODIGO).</summary>
    public string? CodFuncao { get; set; }

    /// <summary>Código do cargo (PCARGO.CODIGO) — pré-resolvido pelo worker via PFUNCAO.CARGO.</summary>
    public string? CodCargo { get; set; }

    /// <summary>Nome específico da função (PFUNCAO.NOME). Ex.: "ANALISTA DE PRICING SR".</summary>
    public string? FuncaoNome { get; set; }

    /// <summary>Código da seção/centro de custo (CODSECAO da req-mãe).</summary>
    public string? CodSecao { get; set; }

    /// <summary>Código da filial/unidade (CODFILIAL).</summary>
    public int? CodFilial { get; set; }

    /// <summary>Hierarquia destino (IDHIERARQUIADESTINO da req-mãe).</summary>
    public int? IdHierarquiaDestinoRm { get; set; }

    /// <summary>Origem da vaga.</summary>
    public VagaOrigemTipo OrigemTipo { get; set; } = VagaOrigemTipo.Direta;

    /// <summary>
    /// IDREQ da req-mãe (mesmo que IdReqRm para itens RM). Mantido para retrocompat
    /// e como rastro informativo gravado em <c>Vaga.IdReqRmOrigem</c>.
    /// </summary>
    public string? IdReqRmOrigem { get; set; }

    /// <summary>Quando OrigemTipo=SubstituicaoDesligamento, IDREQ do desligamento (resolve OrigemDesligamentoId).</summary>
    public string? IdReqDesligamentoRm { get; set; }

    /// <summary>
    /// [DEPRECATED — usar <c>Status</c>] Compatibilidade com worker anterior. O controller
    /// continua respeitando se <c>Status</c> vier <c>NaoInformado</c>.
    /// </summary>
    public bool? Aberta { get; set; }
}

public sealed class VagaSyncRmBulkRequest
{
    public List<VagaSyncRmItem> Items { get; set; } = new();
}

public sealed record VagaSyncRmBulkResponse(int Created, int Updated, int Total, List<string> Warnings);
