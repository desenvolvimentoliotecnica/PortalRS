using System.Text.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Logging.Logger;

public sealed class DbLogger : ILogger
{
    private const int MaxMessage = 8 * 1024;
    private const int MaxStack = 16 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string _category;
    private readonly ILogContextAccessor _accessor;
    private readonly ChannelWriter<LogEntryEnvelope> _writer;

    public DbLogger(string category, ILogContextAccessor accessor, ChannelWriter<LogEntryEnvelope> writer)
    {
        _category = category;
        _accessor = accessor;
        _writer = writer;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel)
        => logLevel != LogLevel.None;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel)) return;
        if (_accessor.SuppressLogging) return;
        if (_category.StartsWith("RhPortal.Api.Logging", StringComparison.OrdinalIgnoreCase)) return;

        var context = _accessor.Current;
        if (context is null) return;

        if (logLevel >= LogLevel.Warning)
            _accessor.IncrementWarning();
        if (logLevel >= LogLevel.Error)
            _accessor.IncrementError();

        var message = formatter(state, exception);
        message = MaskingAndTruncation.Truncate(message, MaxMessage) ?? string.Empty;

        var propertiesJson = BuildPropertiesJson(state);

        var entry = new LogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = context.TenantId,
            RequestLogId = context.RequestLogId,
            TransactionId = context.TransactionId,
            EnvironmentName = context.EnvironmentName,
            EnvironmentNormalized = context.EnvironmentNormalized,
            DeviceId = context.DeviceId,
            DeviceType = context.DeviceType,
            Platform = context.Platform,
            Browser = context.Browser,
            DeviceAppVersion = context.DeviceAppVersion,
            Locale = context.Locale,
            Order = context.NextOrder(),
            Level = logLevel.ToString(),
            Category = _category,
            EventId = eventId.Id == 0 ? null : eventId.Id,
            EventName = string.IsNullOrWhiteSpace(eventId.Name) ? null : eventId.Name,
            Message = message,
            ExceptionType = exception?.GetType().FullName,
            ExceptionMessage = MaskingAndTruncation.Truncate(exception?.Message, MaxMessage),
            ExceptionStackTrace = MaskingAndTruncation.Truncate(exception?.StackTrace, MaxStack),
            PropertiesJson = propertiesJson,
            OccurredAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };

        if (!_writer.TryWrite(new LogEntryEnvelope(entry)))
        {
            if (logLevel >= LogLevel.Warning)
                _accessor.IncrementWarning();
        }
    }

    private static string? BuildPropertiesJson<TState>(TState state)
    {
        if (state is not IEnumerable<KeyValuePair<string, object?>> props)
            return null;

        var dict = new Dictionary<string, object?>();
        foreach (var kv in props)
        {
            if (kv.Key == "{OriginalFormat}") continue;
            dict[kv.Key] = MaskingAndTruncation.IsSensitive(kv.Key) ? "***" : kv.Value;
        }

        if (dict.Count == 0) return null;
        return JsonSerializer.Serialize(dict, JsonOptions);
    }
}
