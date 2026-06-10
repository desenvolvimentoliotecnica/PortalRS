using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Dashboard;

public sealed record DashboardKpisResponse(
    int OpenVagas,
    int CvsHoje,
    int PendentesMatch,
    int Aprovados7Dias,
    int VagasForaSla
);

public sealed record DashboardSeriesResponse(
    IReadOnlyList<string> Labels,
    IReadOnlyList<int> Values
);

public sealed record DashboardFunnelResponse(
    int Recebidos,
    int Triagem,
    int Entrevista,
    int Aprovados
);

public sealed record DashboardTopMatchResponse(
    Guid VagaId,
    string? VagaTitulo,
    string? VagaCodigo,
    Guid CandidatoId,
    string CandidatoNome,
    string Origem,
    int MatchScore,
    string Etapa
);

public sealed record DashboardOpenVagaResponse(
    Guid Id,
    string? Codigo,
    string Titulo,
    string? Area,
    string? Modalidade,
    string? Cidade,
    string? Uf,
    string? Senioridade,
    DateTimeOffset UpdatedAtUtc
);

public sealed record DashboardVagaLookupResponse(
    Guid Id,
    string? Codigo,
    string Titulo
);

/// <summary>
/// Vaga com informação de quantos candidatos ainda não têm matching calculado.
/// Usado pela tela de matching IA quando aberta sem <c>vagaId</c> (ex.: clique no card
/// "N candidatos pendentes de matching" do dashboard) — mostra lista clicável.
/// </summary>
public sealed record VagaComPendentesMatchResponse(
    Guid Id,
    string? Codigo,
    string Titulo,
    string Status,
    string? Senioridade,
    string? Cidade,
    string? Uf,
    int CountPendentes
);

public sealed record DashboardAreaLookupResponse(
    Guid Id,
    string Nome
);

public sealed record AnalistaRhDashboardSolicitacaoResponse(
    Guid Id,
    string Titulo,
    SolicitacaoStatus Status,
    string? CentroCustoNome,
    string? UnitName,
    DateTimeOffset CreatedAtUtc,
    int? RmIdReq
);
