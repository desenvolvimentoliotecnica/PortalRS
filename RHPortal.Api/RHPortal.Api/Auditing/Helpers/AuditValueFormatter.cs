using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace RhPortal.Api.Auditing.Helpers;

public static class AuditValueFormatter
{
    public static string? FormatValue(object? value, bool mask)
    {
        if (mask) return "***";
        if (value is null) return null;

        return value switch
        {
            DateTime dt => dt.ToUniversalTime().ToString("O"),
            DateTimeOffset dto => dto.ToUniversalTime().ToString("O"),
            Guid g => g.ToString(),
            _ => value.ToString()
        };
    }

    public static string SerializeDictionary(Dictionary<string, object?> values)
        => JsonSerializer.Serialize(values);

    public static Dictionary<string, object?> CaptureValues(PropertyValues values, Func<string, bool> isSensitive)
    {
        var dict = new Dictionary<string, object?>();
        foreach (var prop in values.Properties)
        {
            if (prop.IsShadowProperty()) continue;
            var name = prop.Name;
            var raw = values[prop];
            dict[name] = isSensitive(name) ? "***" : raw;
        }
        return dict;
    }
}
