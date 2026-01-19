using System.Text.Json;

namespace RhPortal.Api.Auditing.Helpers;

public static class AuditJsonMasker
{
    private static readonly string[] SensitiveKeys =
    [
        "password", "senha", "token", "refresh", "access", "authorization", "secret", "apikey", "api_key", "hash"
    ];

    public static string? MaskSensitiveJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return json;

        try
        {
            using var doc = JsonDocument.Parse(json);
            var masked = MaskElement(doc.RootElement);
            return JsonSerializer.Serialize(masked);
        }
        catch
        {
            return json;
        }
    }

    private static object? MaskElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element.EnumerateObject()
                .ToDictionary(p => p.Name, p => MaskProperty(p.Name, p.Value)),
            JsonValueKind.Array => element.EnumerateArray()
                .Select(MaskElement)
                .ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }

    private static object? MaskProperty(string name, JsonElement value)
    {
        if (IsSensitive(name))
            return "***";
        return MaskElement(value);
    }

    public static bool IsSensitive(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return false;
        return SensitiveKeys.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase));
    }
}
