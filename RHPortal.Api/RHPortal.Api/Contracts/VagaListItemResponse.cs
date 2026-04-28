using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

public sealed record VagaListItemResponse(
    Guid Id,
    string? Codigo,
    string Titulo,
    VagaStatus Status,

    /// <summary>Centro de Custo — absorveu Area + Department em 31.2.</summary>
    Guid? CentroCustoId,
    string? CentroCustoCode,
    string? CentroCustoNome,

    VagaModalidade? Modalidade,
    VagaSenioridade? Senioridade,
    int QuantidadeVagas,
    int MatchMinimoPercentual,

    bool Confidencial,
    bool Urgente,
    bool AceitaPcd,

    DateOnly? DataInicio,
    DateOnly? DataEncerramento,
    DateTimeOffset? DataAbertura,
    int? SlaDiasMetaFechamento,

    string? Cidade,
    string? Uf,

    int RequisitosTotal,
    int RequisitosObrigatorios,

    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,

    int HeadcountAutorizado,
    int HeadcountOcupado,
    bool IsEstrutural,

    // Headcount provisório (substituição em andamento)
    int HeadcountProvisorio,
    DateTimeOffset? HeadcountProvisorioExpiresAtUtc,

    // Alerta de vaga sem preenchimento
    bool AlertaVagaSemFill,
    int? AlertaDiasSemFill,
    DateTimeOffset? AlertaSnoozeAteUtc,

    // Headcount pendente de decisão do RH (VagaNova aprovada, RH ainda não decidiu)
    int HeadcountPendente,

    // Alerta: headcount provisório (substituição) com prazo vencido
    bool AlertaHCProvVencido,

    Guid? UnidadeLotacaoId,
    string? UnidadeLotacaoCode,
    string? UnidadeLotacaoName,

    // Rodada (publicação) ativa — null se vaga não tiver rodada ativa
    int? RodadaAtivaNumero,
    int? RodadaAtivaCandidatos,

    // Origem TOTVS RM (refactor 2026-04-26)
    /// <summary>Origem da vaga (Manual, AumentoQuadro, SubstituicaoDesligamento, SubstituicaoPromocao, Direta).</summary>
    VagaOrigemTipo OrigemTipo,
    /// <summary>Quando vaga é substituição de desligamento, nome do funcionário desligado (lookup via OrigemDesligamentoId → Desligamento.Funcionario.Name).</summary>
    string? SubstituindoNome,
    /// <summary>Hierarquia (organograma TOTVS) que a vaga pertence. Null = sem hierarquia mapeada.</summary>
    Guid? HierarquiaId,
    string? HierarquiaDescricao,
    /// <summary>IDREQ da requisição-mãe no TOTVS (informativo, rastreável).</summary>
    string? IdReqRmOrigem
);
