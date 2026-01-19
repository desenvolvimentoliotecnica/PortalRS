using System.Text.Json;

namespace RhPortal.Api.Logging.Helpers;

public static class MaskingAndTruncation
{
    private static readonly string[] SensitiveKeys =
    [
        "password", "senha", "token", "refresh", "access", "authorization", "secret", "apikey", "api_key", "hash"
    ];

    public static string? Truncate(string? value, int max)
        => string.IsNullOrWhiteSpace(value) ? value : (value.Length <= max ? value : value[..max]);

    public static string? MaskJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return json;
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

    public static bool IsSensitive(string name)
        => SensitiveKeys.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase));

    private static object? MaskElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element.EnumerateObject()
                .ToDictionary(p => p.Name, p => IsSensitive(p.Name) ? "***" : MaskElement(p.Value)),
            JsonValueKind.Array => element.EnumerateArray().Select(MaskElement).ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }
}
