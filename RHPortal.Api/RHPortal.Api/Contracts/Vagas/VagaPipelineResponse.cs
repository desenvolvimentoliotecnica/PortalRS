using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

/// <summary>
/// Filtros do endpoint <c>GET /api/vagas/pipeline</c>.
/// </summary>
public sealed record VagaPipelineFiltros(
    VagaOrigemTipo? Origem,
    Guid? CentroCustoId,
    string? Q,
    bool IncluirZumbis = true);

/// <summary>
/// Resposta consolidada do pipeline operacional de vagas.
/// As colunas representam o estágio de recrutamento (não etapas internas de aprovação).
/// </summary>
public sealed record VagaPipelineResponse(
    IReadOnlyList<VagaPipelineColuna> Colunas,
    int Total);

public sealed record VagaPipelineColuna(
    int Estagio,
    string Nome,
    int Total,
    IReadOnlyList<VagaPipelineItem> Vagas);

public sealed record VagaPipelineItem(
    Guid Id,
    string? Codigo,
    string Titulo,
    VagaOrigemTipo Origem,
    string? CentroCustoNome,
    string? FuncaoNomeRm,
    VagaStatus Status,
    DateTimeOffset? DataAbertura,
    int DiasNoEstagio,
    int TotalCandidatos,
    int CandidatosAtivos,
    bool IsZumbi,
    int CiclosAusenteRm,
    string Semaforo,
    bool Urgente);
