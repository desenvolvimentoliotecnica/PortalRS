using Microsoft.Extensions.Hosting;

namespace RhPortal.Api.Logging.Helpers;

public static class EnvironmentResolver
{
    public static (string Name, string Normalized) Resolve(IHostEnvironment env)
    {
        var name = env.EnvironmentName ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var normalized = Normalize(name);
        return (name, normalized);
    }

    public static string Normalize(string name)
    {
        if (name.Equals("Development", StringComparison.OrdinalIgnoreCase))
            return "dev";
        if (name.Equals("Staging", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("Homologation", StringComparison.OrdinalIgnoreCase) ||
            name.Equals("HML", StringComparison.OrdinalIgnoreCase))
            return "hml";
        if (name.Equals("Production", StringComparison.OrdinalIgnoreCase))
            return "prd";
        return name.ToLowerInvariant();
    }
}
