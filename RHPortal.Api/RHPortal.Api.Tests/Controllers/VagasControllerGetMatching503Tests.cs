using System.Net.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Controllers;
using Xunit;

namespace RhPortal.Api.Tests.Controllers;

/// <summary>
/// Testes para descobrir a causa do 503 em GET /api/vagas/{id}/matching-candidates.
/// 503 ocorre em dois casos: (1) IRHPortalAiMatchClient não registrado (null);
/// (2) RunUnifiedMatchingAsync retorna null (RHPortal.Ai indisponível ou erro).
/// </summary>
public sealed class VagasControllerGetMatching503Tests
{
    private static VagasController CreateController(
        IRHPortalAiMatchClient? aiMatchClient = null,
        string? tenantId = "test-tenant")
    {
        var userContext = new Mock<ICurrentUserContext>();
        var tenantContext = new Mock<ITenantContext>();
        tenantContext.Setup(x => x.TenantId).Returns(tenantId);

        var scopeFactory = new Mock<IServiceScopeFactory>();
        var logger = new Mock<ILogger<VagasController>>();

        return new VagasController(
            userContext.Object,
            tenantContext.Object,
            scopeFactory.Object,
            logger.Object,
            aiMatchClient
        );
    }

    [Fact]
    public async Task GetMatchingCandidates_QuandoAiMatchClientEhNull_Retorna503_ClienteNaoConfigurado()
    {
        var controller = CreateController(aiMatchClient: null);
        var vagaId = Guid.NewGuid();

        var result = await controller.GetMatchingCandidates(vagaId, scoreStore: null, minScore: 0, take: 40);

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(503, statusResult.StatusCode);
        Assert.NotNull(statusResult.Value);
        var msg = statusResult.Value.GetType().GetProperty("message")?.GetValue(statusResult.Value) as string;
        Assert.Contains("não configurado", msg ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("RhAi", msg ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetMatchingCandidates_QuandoRunUnifiedMatchingRetornaNull_Retorna503_Indisponivel()
    {
        var aiMock = new Mock<IRHPortalAiMatchClient>();
        aiMock
            .Setup(x => x.RunUnifiedMatchingAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IReadOnlyList<MatchingCandidateItemResponse>?)null);

        var controller = CreateController(aiMatchClient: aiMock.Object);
        var vagaId = Guid.NewGuid();

        var result = await controller.GetMatchingCandidates(vagaId, scoreStore: null, minScore: 0, take: 40);

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(503, statusResult.StatusCode);
        var msg = statusResult.Value?.GetType().GetProperty("message")?.GetValue(statusResult.Value) as string;
        Assert.Contains("indisponível", msg ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetMatchingCandidates_QuandoRunUnifiedMatchingLancaExcecao_Retorna503()
    {
        var aiMock = new Mock<IRHPortalAiMatchClient>();
        aiMock
            .Setup(x => x.RunUnifiedMatchingAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var controller = CreateController(aiMatchClient: aiMock.Object);
        var vagaId = Guid.NewGuid();

        var result = await controller.GetMatchingCandidates(vagaId, scoreStore: null, minScore: 0, take: 40);

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(503, statusResult.StatusCode);
        var msg = statusResult.Value?.GetType().GetProperty("message")?.GetValue(statusResult.Value) as string;
        Assert.Contains("indisponível", msg ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetMatchingCandidates_QuandoRunUnifiedMatchingRetornaLista_Retorna200()
    {
        var lista = new List<MatchingCandidateItemResponse>
        {
            new(Guid.NewGuid(), "Maria", "maria@test.com", 85, true, DateTimeOffset.UtcNow, "candidato", 80, 90, null)
        };
        var aiMock = new Mock<IRHPortalAiMatchClient>();
        aiMock
            .Setup(x => x.RunUnifiedMatchingAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(lista);

        var controller = CreateController(aiMatchClient: aiMock.Object);
        var vagaId = Guid.NewGuid();

        var result = await controller.GetMatchingCandidates(vagaId, scoreStore: null, minScore: 0, take: 40);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(200, okResult.StatusCode);
        var body = Assert.IsAssignableFrom<IReadOnlyList<MatchingCandidateItemResponse>>(okResult.Value);
        Assert.Single(body);
        Assert.Equal(85, body[0].Score);
    }
}
