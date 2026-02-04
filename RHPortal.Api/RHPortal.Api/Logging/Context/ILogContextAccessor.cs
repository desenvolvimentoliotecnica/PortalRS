namespace RhPortal.Api.Logging.Context;

public interface ILogContextAccessor
{
    LogContext? Current { get; set; }
    bool SuppressLogging { get; set; }
    int NextOrder();
    void IncrementError();
    void IncrementWarning();
    IDisposable BeginScope(LogContext context);
    IDisposable BeginSuppress();
}
