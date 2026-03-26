using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Feedback;

/// <summary>
/// Testes do FeedbackService — criação (com ratings), listagem por usuário e listagem geral.
/// FeedbackItem.FromUserId e ToUserId são FK não-nulos para ApplicationUser —
/// é necessário fazer seed de usuários para que os Includes não retornem null (comportamento de inner join do InMemory).
/// </summary>
public sealed class FeedbackServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, FeedbackService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new FeedbackService(db, tenantMock.Object);
        return (db, service);
    }

    /// <summary>
    /// Semeia um ApplicationUser necessário para as FKs não-nulas de FeedbackItem.
    /// </summary>
    private static Guid SeedUser(AppDbContext db, string email = "user@empresa.com", string fullName = "Usuário Teste")
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            FullName = fullName,
            Email = email,
            UserName = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user.Id;
    }

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaFeedback()
    {
        var (db, svc) = CriarServico();
        var fromId = SeedUser(db, "from@empresa.com", "Remetente");
        var toId = SeedUser(db, "to@empresa.com", "Destinatário");

        var request = new FeedbackCreateRequest(toId, "Ótimo trabalho!", "Elogio", false, null, null);

        var result = await svc.CreateAsync(request, fromId, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(fromId, result.FromUserId);
        Assert.Equal(toId, result.ToUserId);
        Assert.Equal("Ótimo trabalho!", result.Content);
        Assert.Equal("Elogio", result.Tipo);
        Assert.Empty(result.Ratings);
    }

    [Fact]
    public async Task Create_ComRatings_PersisteCamposEClampStars()
    {
        var (db, svc) = CriarServico();
        var fromId = SeedUser(db, "from2@empresa.com");
        var toId = SeedUser(db, "to2@empresa.com");

        var ratings = new List<FeedbackRatingInput>
        {
            new("Comunicação", 4),
            new("Técnica", 6),   // Stars acima de 5 — deve ser clampado para 5
        };
        var request = new FeedbackCreateRequest(toId, "Avaliação detalhada", null, false, null, ratings);

        var result = await svc.CreateAsync(request, fromId, CancellationToken.None);

        Assert.Equal(2, result.Ratings.Count);
        Assert.Equal(4, result.Ratings.First(r => r.ItemName == "Comunicação").Stars);
        Assert.Equal(5, result.Ratings.First(r => r.ItemName == "Técnica").Stars); // Clampado
    }

    [Fact]
    public async Task Create_TipoVazio_PersistidoComoNull()
    {
        var (db, svc) = CriarServico();
        var fromId = SeedUser(db, "from3@empresa.com");
        var toId = SeedUser(db, "to3@empresa.com");

        var request = new FeedbackCreateRequest(toId, "Conteúdo válido", "  ", false, null, null);

        var result = await svc.CreateAsync(request, fromId, CancellationToken.None);

        Assert.Null(result.Tipo);
    }

    // ── ListMine ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListMine_SemFeedbacks_RetornaListaVazia()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db);

        var result = await svc.ListMineAsync(userId, ct: CancellationToken.None);

        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task ListMine_FiltroAll_RetornaEnviadosERecebidos()
    {
        var (db, svc) = CriarServico();
        var u1 = SeedUser(db, "u1@empresa.com");
        var u2 = SeedUser(db, "u2@empresa.com");
        var u3 = SeedUser(db, "u3@empresa.com");

        // u1 envia para u2, u3 envia para u1
        await svc.CreateAsync(new FeedbackCreateRequest(u2, "Ótimo!", null, false, null, null), u1, CancellationToken.None);
        await svc.CreateAsync(new FeedbackCreateRequest(u1, "Parabéns!", null, false, null, null), u3, CancellationToken.None);
        // Feedback entre u2 e u3 (não deve aparecer para u1)
        await svc.CreateAsync(new FeedbackCreateRequest(u3, "Bem feito!", null, false, null, null), u2, CancellationToken.None);

        var result = await svc.ListMineAsync(u1, ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public async Task ListMine_FiltroReceived_RetornaApenasRecebidos()
    {
        var (db, svc) = CriarServico();
        var u1 = SeedUser(db, "r1@empresa.com");
        var u2 = SeedUser(db, "r2@empresa.com");

        // u1 envia para u2 e u2 envia para u1
        await svc.CreateAsync(new FeedbackCreateRequest(u2, "Enviado por u1", null, false, null, null), u1, CancellationToken.None);
        await svc.CreateAsync(new FeedbackCreateRequest(u1, "Recebido por u1", null, false, null, null), u2, CancellationToken.None);

        var result = await svc.ListMineAsync(u1, filter: "received", ct: CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        Assert.Equal(u1, result.Items[0].ToUserId);
    }

    [Fact]
    public async Task ListMine_FiltroSent_RetornaApenasEnviados()
    {
        var (db, svc) = CriarServico();
        var u1 = SeedUser(db, "s1@empresa.com");
        var u2 = SeedUser(db, "s2@empresa.com");

        await svc.CreateAsync(new FeedbackCreateRequest(u2, "Enviado por u1", null, false, null, null), u1, CancellationToken.None);
        await svc.CreateAsync(new FeedbackCreateRequest(u1, "Recebido por u1", null, false, null, null), u2, CancellationToken.None);

        var result = await svc.ListMineAsync(u1, filter: "sent", ct: CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        Assert.Equal(u1, result.Items[0].FromUserId);
    }

    // ── ListAll ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListAll_SemFeedbacks_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListAllAsync(ct: CancellationToken.None);

        Assert.Equal(0, result.TotalCount);
    }

    [Fact]
    public async Task ListAll_ComFeedbacks_RetornaTodos()
    {
        var (db, svc) = CriarServico();
        var u1 = SeedUser(db, "la1@empresa.com");
        var u2 = SeedUser(db, "la2@empresa.com");

        await svc.CreateAsync(new FeedbackCreateRequest(u2, "Feedback 1", null, false, null, null), u1, CancellationToken.None);
        await svc.CreateAsync(new FeedbackCreateRequest(u1, "Feedback 2", null, false, null, null), u2, CancellationToken.None);

        var result = await svc.ListAllAsync(ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
    }
}
