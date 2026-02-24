using System.Globalization;

namespace LioTecnica.Web.E2E;

public sealed record WebE2ESettings(
    Uri BaseUrl,
    string TenantId,
    string Email,
    string Password,
    bool Headless,
    bool FailOnConsoleError)
{
    public static WebE2ESettings FromEnvironment()
    {
        var baseUrl = Environment.GetEnvironmentVariable("E2E_WEB_BASEURL") ?? "http://localhost:5064";
        var tenantId = Environment.GetEnvironmentVariable("E2E_TENANT_ID") ?? "dev";
        var email = Environment.GetEnvironmentVariable("E2E_EMAIL") ?? "admin@dev.local";
        var password = Environment.GetEnvironmentVariable("E2E_PASSWORD") ?? "ChangeThisPassword123!";

        var headless = ParseBool(Environment.GetEnvironmentVariable("E2E_HEADLESS"), defaultValue: true);
        var failOnConsoleError = ParseBool(Environment.GetEnvironmentVariable("E2E_FAIL_ON_CONSOLE_ERROR"), defaultValue: true);

        return new WebE2ESettings(
            BaseUrl: new Uri(baseUrl.TrimEnd('/')),
            TenantId: tenantId.Trim(),
            Email: email.Trim(),
            Password: password,
            Headless: headless,
            FailOnConsoleError: failOnConsoleError);
    }

    private static bool ParseBool(string? value, bool defaultValue)
    {
        if (string.IsNullOrWhiteSpace(value))
            return defaultValue;

        value = value.Trim();
        if (bool.TryParse(value, out var b))
            return b;

        // aceita 0/1
        if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i))
            return i != 0;

        return defaultValue;
    }
}

