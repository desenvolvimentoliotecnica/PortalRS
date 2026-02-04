using System.Text.Json;

namespace LioTecnica.Web.Helpers;

public static class SeedJsonHelper
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static string ToJson<T>(T value) => JsonSerializer.Serialize(value, Options);
}
