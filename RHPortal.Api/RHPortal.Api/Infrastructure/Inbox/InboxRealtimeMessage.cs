namespace RhPortal.Api.Infrastructure.Inbox;

// Payload simples para a UI reagir a atualizações na fila.
public sealed record InboxRealtimeMessage(
    string Action,
    Guid InboxId,
    string Status,
    DateTimeOffset? ReceivedAt,
    string? Subject,
    string? Sender);
