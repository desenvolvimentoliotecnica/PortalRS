using System.Text;

namespace LioTecnica.Web.ViewModels.Admin;

public sealed class OperationalLogsQuery
{
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
    public string? Search { get; set; }
    public string? Level { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;

    public string ToQueryString()
    {
        var sb = new StringBuilder();
        void add(string key, string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            if (sb.Length > 0) sb.Append('&');
            sb.Append(key).Append('=').Append(Uri.EscapeDataString(value));
        }

        add("from", From?.ToString("O"));
        add("to", To?.ToString("O"));
        add("search", Search);
        add("level", Level);
        add("page", Page.ToString());
        add("pageSize", PageSize.ToString());
        return sb.ToString();
    }
}

public sealed record RequestLogListItem(
    Guid Id,
    string TransactionId,
    DateTimeOffset StartedAt,
    long DurationMs,
    string Method,
    string Path,
    int? StatusCode,
    bool IsSuccess,
    string? UserName,
    string EnvironmentNormalized,
    string DeviceType
);

public sealed record RequestLogListResponse(
    IReadOnlyList<RequestLogListItem> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages
);

public sealed record LogEntryItem(
    Guid Id,
    int Order,
    string Level,
    string Category,
    int? EventId,
    string? EventName,
    string Message,
    DateTimeOffset OccurredAt
);

public sealed record ExceptionLogItem(
    Guid Id,
    int Order,
    bool IsHandled,
    int StatusCode,
    string ExceptionType,
    string Message,
    string? Tags,
    DateTimeOffset OccurredAt
);

public sealed record RequestLogDetailResponse(
    Guid Id,
    string TransactionId,
    string? CorrelationId,
    string? TraceId,
    string EnvironmentName,
    string EnvironmentNormalized,
    string DeviceId,
    string? DeviceType,
    string? Platform,
    string? Browser,
    string? DeviceAppVersion,
    string? Locale,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    long DurationMs,
    string Method,
    string Path,
    string? QueryString,
    int? StatusCode,
    bool IsSuccess,
    string? UserId,
    string? UserName,
    string? ClientId,
    string? Ip,
    string? UserAgent,
    string? Host,
    string? Controller,
    string? Action,
    string? RouteTemplate,
    int ErrorCount,
    int WarningCount,
    IReadOnlyList<LogEntryItem> Entries,
    IReadOnlyList<ExceptionLogItem> Exceptions
);

public sealed record OperationalLogsPageViewModel(string Title);
