using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.IntegracaoTotvs;

/// <summary>Body do <c>POST /api/integracao-totvs/rm-runs</c> que o worker chama no início do sync de cada entidade.</summary>
public sealed record StartRmSyncRunRequest(
    string Entidade,
    string Operacao,
    DateTime? WatermarkAplicadoUtc);

/// <summary>Body do <c>PATCH /api/integracao-totvs/rm-runs/{id}</c> que o worker chama ao finalizar o sync de uma entidade.</summary>
public sealed record FinishRmSyncRunRequest(
    RmSyncStatus Status,
    int TotalLidos,
    int Criados,
    int Atualizados,
    int Ignorados,
    string? ErroMensagem,
    DateTime? WatermarkNovoUtc);

/// <summary>Resposta do <c>POST /api/integracao-totvs/rm-runs</c> — devolve o id que o worker usa no PATCH.</summary>
public sealed record RmSyncRunCreatedResponse(Guid Id);

/// <summary>
/// Linha do painel Owner — cross-tenant — que alimenta a aba "Sincronização RM"
/// dentro de <c>/Owner/Integracao</c>.
/// </summary>
public sealed record OwnerPainelSyncRmRow(
    string TenantId,
    Guid Id,
    string Entidade,
    string Operacao,
    RmSyncStatus Status,
    int TotalLidos,
    int Criados,
    int Atualizados,
    int Ignorados,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? EndedAtUtc,
    string? ErroMensagem,
    DateTime? WatermarkAplicadoUtc,
    DateTime? WatermarkNovoUtc);

/// <summary>
/// Resposta do <c>GET /api/integracao-totvs/rm-checkpoints</c> — devolve o watermark vigente para a entidade.
/// Quando ainda não há checkpoint registrado, todos os campos são null (worker faz full).
/// </summary>
public sealed record RmSyncCheckpointResponse(
    string Entidade,
    DateTime? LastRecModifiedOn,
    DateTimeOffset? LastRunAtUtc,
    string? LastRunStatus);

/// <summary>
/// Body do <c>PUT /api/integracao-totvs/rm-checkpoints</c> — worker grava o novo watermark
/// (MAX RECMODIFIEDON do batch) após o sync da entidade ter sido bem-sucedido.
/// </summary>
public sealed record UpdateRmSyncCheckpointRequest(
    string Entidade,
    DateTime? LastRecModifiedOn,
    string LastRunStatus);

/// <summary>
/// Linha do painel Owner cross-tenant para alertas de zumbi (Frente C).
/// </summary>
public sealed record OwnerPainelAlertaRmRow(
    string TenantId,
    Guid Id,
    string Tipo,
    string EntidadeNome,
    Guid? EntidadeId,
    string ChaveRm,
    DateTimeOffset DetectadoEmUtc,
    int CiclosAusente,
    DateTimeOffset? ResolvidoEmUtc,
    string? Acao);

/// <summary>Resolução manual de um alerta pelo Owner.</summary>
public sealed record ResolverAlertaRequest(string? Acao);

/// <summary>Tail do log físico do worker RM para exibição no painel Owner.</summary>
public sealed record OwnerRmSyncLogResponse(
    bool Exists,
    DateTimeOffset? LastModifiedUtc,
    IReadOnlyList<string> Lines);

/// <summary>Resposta da solicitação cooperativa para interromper o worker RM.</summary>
public sealed record OwnerRmSyncCancelResponse(
    bool Requested,
    DateTimeOffset RequestedAtUtc,
    string Message);

/// <summary>Intervalo entre ciclos do worker RM (persistido no tenant DB).</summary>
public sealed record RmWorkerCycleSettingsResponse(int IntervalMinutes);

/// <summary>Atualização do intervalo entre ciclos (Owner UI).</summary>
public sealed record UpdateRmWorkerCycleSettingsRequest(int IntervalMinutes);
