using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

/// <summary>
/// Item enviado pelo worker TOTVS RM (<c>PortalVagaSyncService</c>) com dados crus
/// de VRSVAGAS + a requisição-pai (VREQAUMENTOQUADRO ou VREQSUBSTITUICAO).
/// O endpoint resolve FKs internamente via lookups por código.
/// </summary>
public sealed class VagaSyncRmItem
{
    /// <summary>VRSVAGAS.CODVAGA — chave do RM. Usada como chave de upsert junto com TenantId.</summary>
    public string CodVaga { get; set; } = default!;

    /// <summary>Nome/título da vaga (VRSVAGAS.NOME).</summary>
    public string Titulo { get; set; } = default!;

    /// <summary>Data de abertura no RM.</summary>
    public DateTime? DataAbertura { get; set; }

    /// <summary>Data de fechamento (NULL = ainda em aberto).</summary>
    public DateTime? DataFechamento { get; set; }

    /// <summary>Quantidade de posições (NUMVAGAS da requisição-pai).</summary>
    public int? Quantidade { get; set; }

    /// <summary>Remuneração informada (VRSVAGAS.REMUNERACAO).</summary>
    public string? Remuneracao { get; set; }

    /// <summary>Descrição/complemento.</summary>
    public string? Descricao { get; set; }

    /// <summary>Experiência desejada/exigida.</summary>
    public string? ExperienciasExigidas { get; set; }

    /// <summary>Código da função (PFUNCAO.CODIGO).</summary>
    public string? CodFuncao { get; set; }

    /// <summary>Código do cargo (PCARGO.CODIGO) — pre-resolvido pelo worker via PFUNCAO.CARGO.</summary>
    public string? CodCargo { get; set; }

    /// <summary>Nome específico da função (PFUNCAO.NOME). Ex.: "ANALISTA DE PRICING SR".</summary>
    public string? FuncaoNome { get; set; }

    /// <summary>Código da seção/centro de custo da requisição-pai (CODSECAO de VREQAUMENTOQUADRO ou VREQSUBSTITUICAO).</summary>
    public string? CodSecao { get; set; }

    /// <summary>Código da filial/unidade (CODFILIAL).</summary>
    public int? CodFilial { get; set; }

    /// <summary>Hierarquia destino (IDHIERARQUIADESTINO da requisição-pai).</summary>
    public int? IdHierarquiaDestinoRm { get; set; }

    /// <summary>Origem da vaga.</summary>
    public VagaOrigemTipo OrigemTipo { get; set; } = VagaOrigemTipo.Direta;

    /// <summary>IDREQ da requisição que originou a vaga (informativo, rastreável no TOTVS).</summary>
    public string? IdReqRmOrigem { get; set; }

    /// <summary>Quando OrigemTipo=SubstituicaoDesligamento, IDREQ do desligamento que originou (resolve para OrigemDesligamentoId via lookup IdReqRm).</summary>
    public string? IdReqDesligamentoRm { get; set; }

    /// <summary>
    /// Se a vaga está aberta no RM (Ativo=1 e DataFechamento futura/null).
    /// Quando false, o controller marca <c>Status=Encerrada</c>.
    /// Default null = retrocompat (controller infere de DataFechamento).
    /// Frente C: o worker manda <c>aberta=false</c> para vagas fechadas, viabilizando detecção de zumbi.
    /// </summary>
    public bool? Aberta { get; set; }
}

public sealed class VagaSyncRmBulkRequest
{
    public List<VagaSyncRmItem> Items { get; set; } = new();
}

public sealed record VagaSyncRmBulkResponse(int Created, int Updated, int Total, List<string> Warnings);
