using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace LioTecnica.Web.Infrastructure.Logging;

/// <summary>
/// Console formatter that safely formats exceptions. Avoids TypeLoadException when the exception
/// stack trace contains Razor-generated types (e.g. AspNetCoreGeneratedDocument.Views_* ) that
/// cannot be resolved in the main assembly during Exception.ToString().
/// </summary>
public sealed class SafeExceptionConsoleFormatter : ConsoleFormatter, IDisposable
{
    private const string LogLevelPadding = ": ";
    private static readonly string MessagePadding = new(' ', GetLogLevelString(LogLevel.Information).Length + LogLevelPadding.Length);
    private static readonly string NewLineWithMessagePadding = Environment.NewLine + MessagePadding;

    private readonly IDisposable? _optionsReloadToken;
    private SimpleConsoleFormatterOptions _options;

    public const string FormatterName = "SafeSimple";

    public SafeExceptionConsoleFormatter(IOptionsMonitor<SimpleConsoleFormatterOptions> options)
        : base(FormatterName)
    {
        _options = options.CurrentValue;
        _optionsReloadToken = options.OnChange(ReloadOptions);
    }

    private void ReloadOptions(SimpleConsoleFormatterOptions options) => _options = options;

    public void Dispose() => _optionsReloadToken?.Dispose();

    public override void Write<TState>(in LogEntry<TState> logEntry, IExternalScopeProvider? scopeProvider, TextWriter textWriter)
    {
        // Get message without passing exception to formatter to avoid TypeLoadException when
        // exception stack trace contains Razor-generated types (e.g. AspNetCoreGeneratedDocument.Views_*).
        var message = logEntry.Formatter?.Invoke(logEntry.State, null) ?? string.Empty;
        var exceptionString = logEntry.Exception != null ? SafeExceptionToString(logEntry.Exception) : null;

        if (logEntry.Exception == null && string.IsNullOrEmpty(message))
            return;

        var logLevel = logEntry.LogLevel;
        var timestamp = _options.TimestampFormat != null
            ? (_options.UseUtcTimestamp ? DateTimeOffset.UtcNow : DateTimeOffset.Now).ToString(_options.TimestampFormat)
            : null;

        if (!string.IsNullOrEmpty(timestamp))
            textWriter.Write(timestamp);

        var levelStr = GetLogLevelString(logLevel);
        textWriter.Write(LogLevelPadding);
        textWriter.Write(logEntry.Category);
        textWriter.Write('[');
        textWriter.Write(logEntry.EventId.Id);
        textWriter.Write(']');

        if (!_options.SingleLine)
            textWriter.Write(Environment.NewLine);

        if (scopeProvider != null && _options.IncludeScopes)
        {
            scopeProvider.ForEachScope((scope, writer) =>
            {
                writer.Write(" => ");
                writer.Write(scope);
            }, textWriter);
            if (!_options.SingleLine)
                textWriter.Write(Environment.NewLine);
        }

        var singleLine = _options.SingleLine;

        if (!string.IsNullOrEmpty(message))
        {
            if (singleLine)
                textWriter.Write(' ');
            else
                textWriter.Write(MessagePadding);
            WriteMessage(textWriter, message, singleLine);
            if (!singleLine)
                textWriter.Write(Environment.NewLine);
        }

        if (!string.IsNullOrEmpty(exceptionString))
        {
            if (singleLine)
                textWriter.Write(' ');
            else
                textWriter.Write(MessagePadding);
            WriteMessage(textWriter, exceptionString, singleLine);
        }

        if (singleLine)
            textWriter.Write(Environment.NewLine);
    }

    private static void WriteMessage(TextWriter textWriter, string message, bool singleLine)
    {
        if (string.IsNullOrEmpty(message)) return;
        var normalized = message.Replace(Environment.NewLine, singleLine ? " " : NewLineWithMessagePadding, StringComparison.Ordinal);
        textWriter.Write(normalized);
    }

    /// <summary>
    /// Converts exception to string without triggering TypeLoadException when stack trace
    /// contains Razor-generated types that cannot be resolved in the main assembly.
    /// </summary>
    private static string SafeExceptionToString(Exception exception)
    {
        try
        {
            return exception.ToString();
        }
        catch (Exception)
        {
            var sb = new StringBuilder();
            for (var exx = exception; exx != null; exx = exx.InnerException)
            {
                if (sb.Length > 0) sb.AppendLine().Append(" ---> ");
                sb.Append(exx.GetType().FullName).Append(": ").Append(exx.Message);
            }
            sb.AppendLine();
            sb.Append("   (Stack trace omitted: type resolution failed for Razor-generated view types.)");
            return sb.ToString();
        }
    }

    private static string GetLogLevelString(LogLevel logLevel) => logLevel switch
    {
        LogLevel.Trace => "trce",
        LogLevel.Debug => "dbug",
        LogLevel.Information => "info",
        LogLevel.Warning => "warn",
        LogLevel.Error => "fail",
        LogLevel.Critical => "crit",
        _ => throw new ArgumentOutOfRangeException(nameof(logLevel))
    };
}
