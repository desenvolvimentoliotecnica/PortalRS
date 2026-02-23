using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Grava em Liotecnica.Integration.RM.Logs o que o worker está rodando e o que foi extraído.
/// </summary>
public sealed class ExtractionLogWriter
{
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly object _lock = new();
    private string? _logsDir;

    public ExtractionLogWriter(IOptions<OutputOptions> outputOptions, IHostEnvironment env)
    {
        _outputOptions = outputOptions.Value;
        _env = env;
    }

    public void WriteLine(string message)
    {
        var dir = GetLogsDirectory();
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "extraction.log");
        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} | {message}";
        lock (_lock)
        {
            File.AppendAllText(path, line + Environment.NewLine);
        }
    }

    private string GetLogsDirectory()
    {
        if (_logsDir is not null)
            return _logsDir;

        var path = _outputOptions.LogsPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            _logsDir = Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        else
        {
            var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
            _logsDir = Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Logs"));
        }
        return _logsDir;
    }
}
