using System.Text.Json;
using System.Text.Json.Serialization;

namespace LioTecnica.Web.Infrastructure.Serialization;

/// <summary>
/// Deserializes API enum values that may be sent as string (JsonStringEnumConverter) or number into int.
/// </summary>
public sealed class EnumNameOrNumberToIntConverter : JsonConverter<int>
{
    private static readonly IReadOnlyDictionary<string, int> KnownEnumNames = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        { "FullStructure", 0 },
        { "RestrictedByAreaOrRecruiter", 1 },
        { "All", 0 },
        { "ByArea", 1 },
        { "ByRecrutador", 2 },
        { "Full", 0 },
        { "ReadOnly", 1 }
    };

    public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number)
            return reader.GetInt32();
        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            if (s != null && KnownEnumNames.TryGetValue(s, out var value))
                return value;
        }
        throw new JsonException($"Expected number or known enum name for scope value.");
    }

    public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options) => writer.WriteNumberValue(value);
}
