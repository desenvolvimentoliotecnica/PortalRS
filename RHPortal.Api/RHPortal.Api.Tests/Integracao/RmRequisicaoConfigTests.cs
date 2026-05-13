using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Integracao;

public sealed class RmRequisicaoConfigTests
{
    private const string TenantId = "tenant-rm-config";

    [Fact]
    public async Task TenantConfiguracaoService_PersisteEndpointUsuarioESenhaDaRequisicaoRm()
    {
        var (db, tenantContext) = CreateDb();
        using var masterDb = new MasterDbContext(
            new DbContextOptionsBuilder<MasterDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var service = new TenantConfiguracaoService(
            db,
            tenantContext.Object,
            Mock.Of<IAiProviderFactory>(),
            Options.Create(new AiOptions()),
            masterDb,
            Mock.Of<ITenantAiSettingsResolver>());

        await service.UpsertRmRequisicaoConfigAsync(new ConfiguracaoRmRequisicaoRequest
        {
            EndpointUrl = "http://localhost:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData",
            Username = "mestre",
            Password = "segredo"
        }, CancellationToken.None);

        var loaded = await service.GetRmRequisicaoConfigAsync(CancellationToken.None);

        Assert.Equal("http://localhost:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData", loaded.EndpointUrl);
        Assert.Equal("mestre", loaded.Username);
        Assert.Equal("segredo", loaded.Password);
    }

    [Fact]
    public async Task RmClient_UsaEndpointE_BasicAuthVindosDoTenantMesmoComModeStub()
    {
        var capturedRequest = default(HttpRequestMessage);
        var handler = new FakeHttpMessageHandler(req =>
        {
            capturedRequest = req;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    {
                      "messages": [],
                      "length": 1,
                      "data": [
                        {
                          "id": "1$_$290",
                          "CODCOLREQUISICAO": 1,
                          "CODFILIAL": 1,
                          "CODSTATUS": 6,
                          "IDREQ": 290
                        }
                      ]
                    }
                    """, Encoding.UTF8, "application/json")
            };
        });

        var httpClient = new HttpClient(handler);
        var tenantConfig = new Mock<ITenantConfiguracaoService>();
        tenantConfig
            .Setup(x => x.GetRmRequisicaoConfigAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ConfiguracaoRmRequisicaoDto
            {
                EndpointUrl = "http://localhost:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData",
                Username = "mestre",
                Password = "segredo"
            });

        var client = new RmRequisicaoCreateRestClient(
            httpClient,
            Options.Create(new RmRequisicaoCreateOptions
            {
                Mode = "stub",
                CodColRequisicaoDefault = 1,
                CodLocalDefault = 1,
                CodFilialDefault = 1
            }),
            tenantConfig.Object);

        var solicitacao = new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            TipoSolicitacao = TipoSolicitacaoVaga.AumentoQuadro,
            Titulo = "Aumento quadro",
            Justificativa = "Expansão",
            QtdPosicoes = 1,
            CodFuncaoRm = "00001",
            FaixaSalarialMin = 1000,
            FaixaSalarialMax = 1500,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
            Solicitante = new Funcionario { MatriculaRm = "00001" },
            CentroCusto = new CentroCusto { Code = "01.01", Description = "Operações" },
            Empresa = new Empresa { Code = "01", Description = "Matriz" }
        };

        var outcome = await client.EnviarOuObterJaCriadoAsync(
            solicitacao,
            "tenant:key",
            "{}",
            CancellationToken.None);

        Assert.NotNull(capturedRequest);
        Assert.Equal("http://localhost:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData", capturedRequest!.RequestUri!.ToString());
        Assert.Equal("Basic", capturedRequest.Headers.Authorization?.Scheme);
        Assert.Equal(
            Convert.ToBase64String(Encoding.UTF8.GetBytes("mestre:segredo")),
            capturedRequest.Headers.Authorization?.Parameter);
        Assert.True(outcome.Sucesso);
        Assert.Equal(290, outcome.IdReq);
        Assert.Equal((short)1, outcome.CodColRequisicao);
    }

    private static (AppDbContext Db, Mock<ITenantContext> TenantContext) CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantContext = new Mock<ITenantContext>();
        tenantContext.Setup(x => x.TenantId).Returns(TenantId);

        return (new AppDbContext(options, tenantContext.Object), tenantContext);
    }

    private sealed class FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(handler(request));
    }
}
