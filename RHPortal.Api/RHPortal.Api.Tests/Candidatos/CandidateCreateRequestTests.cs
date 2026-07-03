using System.Text.Json;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Candidatos;

public sealed class CandidateCreateRequestTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };

    [Fact]
    public void Deserialize_AcceptsFonteTalentos()
    {
        var json = """
            {
              "nome": "João Silva",
              "email": "joao@example.com",
              "celular": "(11) 99999-9999",
              "fonte": "Talentos",
              "status": "Triagem",
              "vagaId": "11111111-1111-1111-1111-111111111111"
            }
            """;

        var request = JsonSerializer.Deserialize<CandidateCreateRequest>(json, JsonOptions);

        Assert.NotNull(request);
        Assert.Equal(CandidateOrigin.Talentos, request!.Fonte);
        Assert.Equal("João Silva", request.Nome);
        Assert.Equal("(11) 99999-9999", request.Celular);
    }
}
