using System.Text.Json;

namespace RhPortal.Api.Messaging.Email;

public static class EmailTemplateRenderer
{
    public static string Render(string template, IReadOnlyDictionary<string, string?> values)
    {
        var result = template ?? string.Empty;
        foreach (var kvp in values)
        {
            var token = $"{{{{{kvp.Key}}}}}";
            result = result.Replace(token, kvp.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }
        return result;
    }

    public static string ToJson(IReadOnlyDictionary<string, string?> values)
    {
        return JsonSerializer.Serialize(values);
    }
}
