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
/// Testes do OneOnOneService — CRUD completo e listagem por usuário.
/// ManagerId e CollaboratorId são FK não-nulos para ApplicationUser, por isso fazemos seed.
/// </summary>
public sealed class OneOnOneServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, OneOnOneService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new OneOnOneService(db, tenantMock.Object);
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

    private static DateTimeOffset ProximaSemana() =>
        DateTimeOffset.UtcNow.AddDays(7);

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaMeeting()
    {
        var (db, svc) = CriarServico();
        var managerId = SeedUser(db, "manager@empresa.com", "Gestor");
        var collaboratorId = SeedUser(db, "collab@empresa.com", "Colaborador");

        var data = ProximaSemana();
        var request = new OneOnOneCreateRequest(collaboratorId, data, "Alinhamento", "Discutir metas");

        var result = await svc.CreateAsync(request, managerId, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(managerId, result.ManagerId);
        Assert.Equal(collaboratorId, result.CollaboratorId);
        Assert.Equal(data, result.MeetingDate);
        Assert.Equal("Alinhamento", result.Subject);
        Assert.Equal("Discutir metas", result.Notes);
    }

    [Fact]
    public async Task Create_AssuntoVazio_PersistidoComoNull()
    {
        var (db, svc) = CriarServico();
        var managerId = SeedUser(db, "manager2@empresa.com");
        var collaboratorId = SeedUser(db, "collab2@empresa.com");

        var result = await svc.CreateAsync(
            new OneOnOneCreateRequest(collaboratorId, ProximaSemana(), "   ", null),
            managerId, CancellationToken.None);

        Assert.Null(result.Subject);
    }

    // ── Busca por ID ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetById_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.GetByIdAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetById_IdExistente_RetornaMeeting()
    {
        var (db, svc) = CriarServico();
        var managerId = SeedUser(db, "manager3@empresa.com");
        var collaboratorId = SeedUser(db, "collab3@empresa.com");

        var created = await svc.CreateAsync(
            new OneOnOneCreateRequest(collaboratorId, ProximaSemana()),
            managerId, CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
    }

    // ── ListForUser ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ListForUser_SemMeetings_RetornaListaVazia()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db);

        var result = await svc.ListForUserAsync(userId, ct: CancellationToken.None);

        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task ListForUser_ComoGestor_RetornaMeetingsComoManager()
    {
        var (db, svc) = CriarServico();
        var manager = SeedUser(db, "m@empresa.com", "Manager");
        var collab1 = SeedUser(db, "c1@empresa.com", "Colaborador 1");
        var collab2 = SeedUser(db, "c2@empresa.com", "Colaborador 2");

        await svc.CreateAsync(new OneOnOneCreateRequest(collab1, ProximaSemana()), manager, CancellationToken.None);
        await svc.CreateAsync(new OneOnOneCreateRequest(collab2, ProximaSemana()), manager, CancellationToken.None);

        var result = await svc.ListForUserAsync(manager, ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, m => Assert.Equal(manager, m.ManagerId));
    }

    [Fact]
    public async Task ListForUser_ComoColaborador_RetornaMeetingsComoCollaborator()
    {
        var (db, svc) = CriarServico();
        var manager1 = SeedUser(db, "m1@empresa.com");
        var manager2 = SeedUser(db, "m2@empresa.com");
        var collab = SeedUser(db, "collab@empresa.com");

        await svc.CreateAsync(new OneOnOneCreateRequest(collab, ProximaSemana()), manager1, CancellationToken.None);
        await svc.CreateAsync(new OneOnOneCreateRequest(collab, ProximaSemana().AddDays(1)), manager2, CancellationToken.None);

        var result = await svc.ListForUserAsync(collab, ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, m => Assert.Equal(collab, m.CollaboratorId));
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaCampos()
    {
        var (db, svc) = CriarServico();
        var managerId = SeedUser(db, "manager4@empresa.com");
        var collaboratorId = SeedUser(db, "collab4@empresa.com");

        var created = await svc.CreateAsync(
            new OneOnOneCreateRequest(collaboratorId, ProximaSemana(), "Assunto original"),
            managerId, CancellationToken.None);

        var novaData = ProximaSemana().AddDays(14);
        var result = await svc.UpdateAsync(created.Id,
            new OneOnOneUpdateRequest(novaData, "Assunto atualizado", "Novas notas"),
            managerId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(novaData, result.MeetingDate);
        Assert.Equal("Assunto atualizado", result.Subject);
        Assert.Equal("Novas notas", result.Notes);
    }

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateAsync(Guid.NewGuid(),
            new OneOnOneUpdateRequest(ProximaSemana()),
            Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_UserIdDiferenteDoManager_RetornaNull()
    {
        var (db, svc) = CriarServico();
        var managerId = SeedUser(db, "manager5@empresa.com");
        var outroUserId = SeedUser(db, "outro@empresa.com");
        var collaboratorId = SeedUser(db, "collab5@empresa.com");

        var created = await svc.CreateAsync(
            new OneOnOneCreateRequest(collaboratorId, ProximaSemana()),
            managerId, CancellationToken.None);

        // Tenta atualizar com userId diferente do manager
        var result = await svc.UpdateAsync(created.Id,
            new OneOnOneUpdateRequest(ProximaSemana()),
            outroUserId, CancellationToken.None);

        Assert.Null(result);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RetornaTrue()
    {
        var (db, svc) = CriarServico();
        var managerId = SeedUser(db, "manager6@empresa.com");
        var collaboratorId = SeedUser(db, "collab6@empresa.com");

        var created = await svc.CreateAsync(
            new OneOnOneCreateRequest(collaboratorId, ProximaSemana()),
            managerId, CancellationToken.None);

        var result = await svc.DeleteAsync(created.Id, managerId, CancellationToken.None);

        Assert.True(result);
        Assert.Null(await svc.GetByIdAsync(created.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }
}
