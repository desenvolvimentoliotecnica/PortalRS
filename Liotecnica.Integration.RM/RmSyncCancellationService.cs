using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

public sealed class RmSyncCancellationRequestedException : Exception
{
    public RmSyncCancellationRequestedException()
        : base("Sincronizacao RM interrompida pelo usuario.")
    {
    }
}

public sealed class RmSyncCancellationService
{
    public const string RequestFileName = "cancel.request";

    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private string? _logsDir;

    public RmSyncCancellationService(IOptions<OutputOptions> outputOptions, IHostEnvironment env)
    {
        _outputOptions = outputOptions.Value;
        _env = env;
    }

    public void ClearRequest()
    {
        var path = GetRequestPath();
        if (File.Exists(path))
            File.Delete(path);
    }

    public void ThrowIfCancellationRequested()
    {
        if (File.Exists(GetRequestPath()))
            throw new RmSyncCancellationRequestedException();
    }

    private string GetRequestPath()
    {
        var dir = GetLogsDirectory();
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, RequestFileName);
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
