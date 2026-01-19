using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace RhPortal.Api.Logging.Helpers;

public sealed record DeviceInfo(
    string DeviceId,
    string? DeviceType,
    string? Platform,
    string? Browser,
    string? DeviceAppVersion,
    string? Locale
);

public static class DeviceResolver
{
    public static DeviceInfo Resolve(HttpContext context)
    {
        var headers = context.Request.Headers;
        var user = context.User;
        var userAgent = headers.UserAgent.ToString();
        var locale = headers.AcceptLanguage.ToString();

        var deviceId = headers["X-Device-Id"].FirstOrDefault()
            ?? user.FindFirstValue("device_id")
            ?? Hashing.Sha256Hex($"{userAgent}|{GetIp(context)}|{locale}");

        var deviceType = headers["X-Device-Type"].FirstOrDefault()
            ?? InferDeviceType(userAgent);

        var platform = InferPlatform(userAgent);
        var browser = InferBrowser(userAgent);

        var appVersion = headers["X-App-Version"].FirstOrDefault()
            ?? typeof(DeviceResolver).Assembly.GetName().Version?.ToString();

        return new DeviceInfo(
            deviceId,
            deviceType,
            platform,
            browser,
            appVersion,
            string.IsNullOrWhiteSpace(locale) ? null : locale
        );
    }

    private static string? GetIp(HttpContext context)
        => context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
           ?? context.Connection.RemoteIpAddress?.ToString();

    private static string InferDeviceType(string ua)
    {
        if (string.IsNullOrWhiteSpace(ua)) return "unknown";
        var lower = ua.ToLowerInvariant();
        if (lower.Contains("android")) return "android";
        if (lower.Contains("iphone") || lower.Contains("ipad")) return "ios";
        if (lower.Contains("windows") || lower.Contains("macintosh") || lower.Contains("linux")) return "web";
        return "unknown";
    }

    private static string? InferPlatform(string ua)
    {
        if (string.IsNullOrWhiteSpace(ua)) return null;
        var lower = ua.ToLowerInvariant();
        if (lower.Contains("windows")) return "windows";
        if (lower.Contains("macintosh")) return "mac";
        if (lower.Contains("linux")) return "linux";
        if (lower.Contains("android")) return "android";
        if (lower.Contains("iphone") || lower.Contains("ipad")) return "ios";
        return "unknown";
    }

    private static string? InferBrowser(string ua)
    {
        if (string.IsNullOrWhiteSpace(ua)) return null;
        var lower = ua.ToLowerInvariant();
        if (lower.Contains("edg/")) return "edge";
        if (lower.Contains("chrome/")) return "chrome";
        if (lower.Contains("safari/") && !lower.Contains("chrome/")) return "safari";
        if (lower.Contains("firefox/")) return "firefox";
        return "unknown";
    }
}
