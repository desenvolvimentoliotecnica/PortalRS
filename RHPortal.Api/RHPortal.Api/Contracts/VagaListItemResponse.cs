using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

public sealed record VagaListItemResponse(
    Guid Id,
    string? Codigo,
    string Titulo,
    VagaStatus Status,

    Guid? AreaId,
    string? AreaCode,
    string? AreaName,

    Guid? DepartmentId,
    string? DepartmentCode,
    string? DepartmentName,

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
    int? RodadaAtivaCandidatos
);
