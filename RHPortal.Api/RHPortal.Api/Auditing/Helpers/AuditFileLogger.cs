using System.Text;

namespace RhPortal.Api.Auditing.Helpers;

public static class AuditFileLogger
{
    private static readonly object LockObj = new();

    public static void TryAppend(string rootPath, string message)
    {
        try
        {
            var dir = Path.Combine(rootPath, "App_Data");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, "audit-debug.log");
            var line = $"[{DateTimeOffset.UtcNow:O}] {message}{Environment.NewLine}";
            lock (LockObj)
            {
                File.AppendAllText(path, line, Encoding.UTF8);
            }
        }
        catch
        {
            // best-effort only
        }
    }
}
