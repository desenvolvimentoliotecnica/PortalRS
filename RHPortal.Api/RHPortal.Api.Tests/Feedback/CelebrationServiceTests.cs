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
/// Testes do CelebrationService — criação de posts e comentários, listagem e reações.
/// AuthorId é FK não-nulo para ApplicationUser — seed obrigatório.
/// </summary>
public sealed class CelebrationServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, CelebrationService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new CelebrationService(db, tenantMock.Object);
        return (db, service);
    }

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

    // ── Criação de Post ───────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaPost()
    {
        var (db, svc) = CriarServico();
        var authorId = SeedUser(db, "author@empresa.com", "Autor");

        var result = await svc.CreateAsync(
            new CelebrationCreateRequest("Parabéns pela conquista!", []),
            authorId, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(authorId, result.AuthorId);
        Assert.Equal("Parabéns pela conquista!", result.Content);
        Assert.Empty(result.Mentions);
    }

    [Fact]
    public async Task Create_ComMencaoDeUsuarioValido_IncluidaNaResposta()
    {
        var (db, svc) = CriarServico();
        var authorId = SeedUser(db, "author2@empresa.com", "Autor");
        var mentionedId = SeedUser(db, "mentioned@empresa.com", "Mencionado");

        var result = await svc.CreateAsync(
            new CelebrationCreateRequest("Elogio a você!", [mentionedId]),
            authorId, CancellationToken.None);

        Assert.Single(result.Mentions);
        Assert.Equal(mentionedId, result.Mentions[0].UserId);
    }

    [Fact]
    public async Task Create_ComMencaoDeUsuarioInexistente_MencaoIgnorada()
    {
        var (db, svc) = CriarServico();
        var authorId = SeedUser(db, "author3@empresa.com");

        var result = await svc.CreateAsync(
            new CelebrationCreateRequest("Conteúdo", [Guid.NewGuid()]),
            authorId, CancellationToken.None);

        Assert.Empty(result.Mentions);
    }

    // ── ListFeed ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListFeed_SemPosts_RetornaListaVazia()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db);

        var result = await svc.ListFeedAsync(userId, null, null, null, ct: CancellationToken.None);

        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task ListFeed_FiltroAll_RetornaTodosPosts()
    {
        var (db, svc) = CriarServico();
        var user1 = SeedUser(db, "u1@empresa.com");
        var user2 = SeedUser(db, "u2@empresa.com");

        await svc.CreateAsync(new CelebrationCreateRequest("Post 1", []), user1, CancellationToken.None);
        await svc.CreateAsync(new CelebrationCreateRequest("Post 2", []), user2, CancellationToken.None);

        var result = await svc.ListFeedAsync(user1, null, null, null, ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public async Task ListFeed_FiltroSent_RetornaApenasDoAutor()
    {
        var (db, svc) = CriarServico();
        var user1 = SeedUser(db, "us1@empresa.com");
        var user2 = SeedUser(db, "us2@empresa.com");

        await svc.CreateAsync(new CelebrationCreateRequest("Post do user1", []), user1, CancellationToken.None);
        await svc.CreateAsync(new CelebrationCreateRequest("Post do user2", []), user2, CancellationToken.None);

        var result = await svc.ListFeedAsync(user1, "sent", null, null, ct: CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        Assert.Equal(user1, result.Items[0].AuthorId);
    }

    // ── GetMentionUsers ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetMentionUsers_SemFiltro_RetornaUsuariosAtivos()
    {
        var (db, svc) = CriarServico();
        SeedUser(db, "active1@empresa.com", "Ana");
        SeedUser(db, "active2@empresa.com", "Bruno");

        var result = await svc.GetMentionUsersAsync(null, ct: CancellationToken.None);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetMentionUsers_ComFiltroNome_RetornaApenasCombinando()
    {
        var (db, svc) = CriarServico();
        SeedUser(db, "ana@empresa.com", "Ana Silva");
        SeedUser(db, "bruno@empresa.com", "Bruno Costa");

        var result = await svc.GetMentionUsersAsync("ana", ct: CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("Ana Silva", result[0].FullName);
    }

    // ── CreateComment ─────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateComment_PostExistente_RetornaComment()
    {
        var (db, svc) = CriarServico();
        var authorId = SeedUser(db, "ca@empresa.com", "Autor Comment");

        var post = await svc.CreateAsync(
            new CelebrationCreateRequest("Post para comentar", []),
            authorId, CancellationToken.None);

        var comment = await svc.CreateCommentAsync(post.Id,
            new CelebrationCommentCreateRequest("Ótimo post!", []),
            authorId, CancellationToken.None);

        Assert.NotNull(comment);
        Assert.NotEqual(Guid.Empty, comment.Id);
        Assert.Equal(post.Id, comment.PostId);
        Assert.Equal(authorId, comment.AuthorId);
        Assert.Equal("Ótimo post!", comment.Content);
    }

    [Fact]
    public async Task CreateComment_PostInexistente_RetornaNull()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db);

        var result = await svc.CreateCommentAsync(Guid.NewGuid(),
            new CelebrationCommentCreateRequest("Comentário", []),
            userId, CancellationToken.None);

        Assert.Null(result);
    }

    // ── ToggleCommentReaction ─────────────────────────────────────────────────

    [Fact]
    public async Task ToggleReaction_CommentExistente_AdicionaReacao()
    {
        var (db, svc) = CriarServico();
        var authorId = SeedUser(db, "tr@empresa.com");

        var post = await svc.CreateAsync(new CelebrationCreateRequest("Post", []), authorId, CancellationToken.None);
        var comment = await svc.CreateCommentAsync(post.Id,
            new CelebrationCommentCreateRequest("Comentário", []),
            authorId, CancellationToken.None);

        var result = await svc.ToggleCommentReactionAsync(comment!.Id, authorId, "like", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("like", result.Type);
        Assert.Equal(1, result.Count);
        Assert.True(result.ReactedByMe);
    }

    [Fact]
    public async Task ToggleReaction_Novamente_RemoveReacao()
    {
        var (db, svc) = CriarServico();
        var authorId = SeedUser(db, "tr2@empresa.com");

        var post = await svc.CreateAsync(new CelebrationCreateRequest("Post", []), authorId, CancellationToken.None);
        var comment = await svc.CreateCommentAsync(post.Id,
            new CelebrationCommentCreateRequest("Comentário", []),
            authorId, CancellationToken.None);

        // Adiciona
        await svc.ToggleCommentReactionAsync(comment!.Id, authorId, "like", CancellationToken.None);
        // Remove (toggle novamente)
        var result = await svc.ToggleCommentReactionAsync(comment.Id, authorId, "like", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(0, result.Count);
        Assert.False(result.ReactedByMe);
    }

    [Fact]
    public async Task ToggleReaction_CommentInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ToggleCommentReactionAsync(Guid.NewGuid(), Guid.NewGuid(), "like", CancellationToken.None);

        Assert.Null(result);
    }
}
