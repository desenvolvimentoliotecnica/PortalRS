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
/// Testes do DevelopmentPlanService — CRUD completo incluindo goals, e listagens.
/// OwnerUserId é FK não-nulo para ApplicationUser, por isso fazemos seed.
/// </summary>
public sealed class DevelopmentPlanServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, DevelopmentPlanService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new DevelopmentPlanService(db, tenantMock.Object);
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

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaPlan()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner@empresa.com", "Gestor");

        var result = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("Plano de Desenvolvimento", "Crescer profissionalmente", null),
            ownerId, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Plano de Desenvolvimento", result.Title);
        Assert.Equal("Crescer profissionalmente", result.Description);
        Assert.Equal(ownerId, result.OwnerUserId);
        Assert.Null(result.TargetUserId);
        Assert.Empty(result.Goals);
    }

    [Fact]
    public async Task Create_ComTargetUser_PersisteCampo()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner2@empresa.com");
        var targetId = SeedUser(db, "target@empresa.com", "Colaborador Alvo");

        var result = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("PDI Colaborador", null, targetId),
            ownerId, CancellationToken.None);

        Assert.Equal(targetId, result.TargetUserId);
    }

    [Fact]
    public async Task Create_DescricaoVazia_PersistidaComoNull()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner3@empresa.com");

        var result = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("Plano Simples", "   ", null),
            ownerId, CancellationToken.None);

        Assert.Null(result.Description);
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
    public async Task GetById_IdExistente_RetornaPlan()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner4@empresa.com");

        var created = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("Plano Get", null, null),
            ownerId, CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("Plano Get", result.Title);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaCampos()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner5@empresa.com");

        var created = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("Original", "Desc original", null),
            ownerId, CancellationToken.None);

        var result = await svc.UpdateAsync(created.Id,
            new DevelopmentPlanUpdateRequest("Atualizado", "Nova descrição"),
            ownerId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Atualizado", result.Title);
        Assert.Equal("Nova descrição", result.Description);
    }

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateAsync(Guid.NewGuid(),
            new DevelopmentPlanUpdateRequest("Teste", null),
            Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_OutroOwner_RetornaNull()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner6@empresa.com");
        var outroId = SeedUser(db, "outro@empresa.com");

        var created = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("Plano", null, null),
            ownerId, CancellationToken.None);

        // Tenta atualizar com outro userId
        var result = await svc.UpdateAsync(created.Id,
            new DevelopmentPlanUpdateRequest("Atualizado", null),
            outroId, CancellationToken.None);

        Assert.Null(result);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RetornaTrue()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner7@empresa.com");

        var created = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("Para Deletar", null, null),
            ownerId, CancellationToken.None);

        var result = await svc.DeleteAsync(created.Id, ownerId, CancellationToken.None);

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

    // ── Goals ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AddGoal_PlanExistente_RetornaGoal()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner8@empresa.com");

        var plan = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("PDI com Goals", null, null),
            ownerId, CancellationToken.None);

        var goal = await svc.AddGoalAsync(plan.Id,
            new DevelopmentPlanGoalCreateRequest("Fazer curso de liderança", null, 0),
            ownerId, CancellationToken.None);

        Assert.NotNull(goal);
        Assert.NotEqual(Guid.Empty, goal.Id);
        Assert.Equal("Fazer curso de liderança", goal.Description);
        Assert.Equal(0, goal.Order);
    }

    [Fact]
    public async Task AddGoal_PlanInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.AddGoalAsync(Guid.NewGuid(),
            new DevelopmentPlanGoalCreateRequest("Goal", null, 0),
            Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateGoal_GoalExistente_AtualizaCampos()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner9@empresa.com");

        var plan = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("PDI Goals Update", null, null),
            ownerId, CancellationToken.None);
        var goal = await svc.AddGoalAsync(plan.Id,
            new DevelopmentPlanGoalCreateRequest("Original", null, 0),
            ownerId, CancellationToken.None);

        var concludedAt = DateTimeOffset.UtcNow;
        var result = await svc.UpdateGoalAsync(plan.Id, goal!.Id,
            new DevelopmentPlanGoalUpdateRequest("Atualizado", null, concludedAt, 1),
            ownerId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Atualizado", result.Description);
        Assert.Equal(concludedAt, result.ConcludedAt);
        Assert.Equal(1, result.Order);
    }

    [Fact]
    public async Task DeleteGoal_GoalExistente_RetornaTrue()
    {
        var (db, svc) = CriarServico();
        var ownerId = SeedUser(db, "owner10@empresa.com");

        var plan = await svc.CreateAsync(
            new DevelopmentPlanCreateRequest("PDI Goals Delete", null, null),
            ownerId, CancellationToken.None);
        var goal = await svc.AddGoalAsync(plan.Id,
            new DevelopmentPlanGoalCreateRequest("Para deletar", null, 0),
            ownerId, CancellationToken.None);

        var result = await svc.DeleteGoalAsync(plan.Id, goal!.Id, ownerId, CancellationToken.None);

        Assert.True(result);

        // Verifica que o goal foi removido
        var planAtualizado = await svc.GetByIdAsync(plan.Id, CancellationToken.None);
        Assert.NotNull(planAtualizado);
        Assert.Empty(planAtualizado.Goals);
    }

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListMy_RetornaPlansOndeOUserEOwnerOuTarget()
    {
        var (db, svc) = CriarServico();
        var owner = SeedUser(db, "owner11@empresa.com");
        var target = SeedUser(db, "target2@empresa.com");
        var outro = SeedUser(db, "outro2@empresa.com");

        // plan1: owner é dono
        await svc.CreateAsync(new DevelopmentPlanCreateRequest("Plan Dono", null, null), owner, CancellationToken.None);
        // plan2: owner é target
        await svc.CreateAsync(new DevelopmentPlanCreateRequest("Plan Target", null, owner), target, CancellationToken.None);
        // plan3: outro, não aparece para owner
        await svc.CreateAsync(new DevelopmentPlanCreateRequest("Plan Outro", null, null), outro, CancellationToken.None);

        var result = await svc.ListMyAsync(owner, ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public async Task ListForTeam_RetornaPlansDoGestor()
    {
        var (db, svc) = CriarServico();
        var gestor = SeedUser(db, "gestor@empresa.com");
        var target1 = SeedUser(db, "target3@empresa.com");
        var target2 = SeedUser(db, "target4@empresa.com");

        await svc.CreateAsync(new DevelopmentPlanCreateRequest("Plan T1", null, target1), gestor, CancellationToken.None);
        await svc.CreateAsync(new DevelopmentPlanCreateRequest("Plan T2", null, target2), gestor, CancellationToken.None);

        var result = await svc.ListForTeamAsync(gestor, null, ct: CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, p => Assert.Equal(gestor, p.OwnerUserId));
    }
}
