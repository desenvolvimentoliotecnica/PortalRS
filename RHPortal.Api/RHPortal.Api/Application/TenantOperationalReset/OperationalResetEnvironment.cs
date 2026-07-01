using Microsoft.Extensions.Hosting;
using RhPortal.Api.Logging.Helpers;

namespace RhPortal.Api.Application.TenantOperationalReset;

public static class OperationalResetEnvironment
{
    public static bool IsAllowed(IHostEnvironment env)
    {
        var (_, normalized) = EnvironmentResolver.Resolve(env);
        return normalized is "dev" or "hml";
    }
}
