using System.Text.Json;
using System.Text.Json.Serialization;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

/// <summary>Garante deserialização de FuncionarioCreateRequest mesmo quando o reflection padrão falha.</summary>
public sealed class FuncionarioCreateRequestJsonConverter : JsonConverter<FuncionarioCreateRequest>
{
    public override FuncionarioCreateRequest Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using JsonDocument doc = JsonDocument.ParseValue(ref reader);
        JsonElement root = doc.RootElement;
        var r = new FuncionarioCreateRequest();
        r.Name = GetString(root, "Name", "name") ?? string.Empty;
        r.Email = GetString(root, "Email", "email") ?? string.Empty;
        r.Phone = GetString(root, "Phone", "phone");
        r.Status = GetEnum<FuncionarioStatus>(root, "Status", "status");
        r.Headcount = GetInt32(root, "Headcount", "headcount");
        r.UnitId = GetGuid(root, "UnitId", "unitId");
        r.AreaId = GetGuid(root, "AreaId", "areaId");
        r.JobPositionId = GetGuid(root, "JobPositionId", "jobPositionId");
        r.Notes = GetString(root, "Notes", "notes");
        r.UserId = GetGuid(root, "UserId", "userId");
        return r;
    }

    public override void Write(Utf8JsonWriter writer, FuncionarioCreateRequest value, JsonSerializerOptions options)
        => JsonSerializer.Serialize(writer, value, options);

    private static string? GetString(JsonElement root, string pascal, string camel)
    {
        if (root.TryGetProperty(pascal, out var p)) return p.GetString();
        if (root.TryGetProperty(camel, out var c)) return c.GetString();
        return null;
    }

    private static int GetInt32(JsonElement root, string pascal, string camel)
    {
        if (root.TryGetProperty(pascal, out var p) && p.TryGetInt32(out var v)) return v;
        if (root.TryGetProperty(camel, out var c) && c.TryGetInt32(out v)) return v;
        return 0;
    }

    private static Guid? GetGuid(JsonElement root, string pascal, string camel)
    {
        if (root.TryGetProperty(pascal, out var p) && p.TryGetGuid(out var g)) return g;
        if (root.TryGetProperty(camel, out var c) && c.TryGetGuid(out g)) return g;
        return null;
    }

    private static T GetEnum<T>(JsonElement root, string pascal, string camel) where T : struct
    {
        if (root.TryGetProperty(pascal, out var p)) return ParseEnum<T>(p);
        if (root.TryGetProperty(camel, out var c)) return ParseEnum<T>(c);
        return default;
    }

    private static T ParseEnum<T>(JsonElement el) where T : struct
    {
        if (el.TryGetInt32(out var i)) return (T)(object)i;
        var s = el.GetString();
        if (string.IsNullOrEmpty(s)) return default;
        return Enum.TryParse<T>(s, true, out var v) ? v : default;
    }
}
