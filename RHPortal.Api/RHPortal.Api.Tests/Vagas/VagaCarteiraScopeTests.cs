using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Vagas;

/// <summary>
/// Cobertura do épico "Carteira de Vaga":
/// garante que VagaService.ListAsync aplica VagasDataScope corretamente
/// nos quatro cenários (All, ByArea, ByRecrutador, ByGestorRecrutador)
/// e que Admin vê tudo ignorando o scope.
/// </summary>
public sealed class VagaCarteiraScopeTests
{
    private const string Tenant = "tenant-carteira";

    private sealed record Bag(
        AppDbContext Db,
        // 31.2: Area foi absorvido por CentroCusto; os escopos organizacionais que eram
        // AreaId agora são CentroCustoId (mesma semântica, nomenclatura unificada).
        Guid AreaTiId,
        Guid AreaRhId,
        Guid GestorFuncionarioId,
        Guid RecrutadorFuncionarioId,
        Guid RecrutadorUserId,
        Guid OutroRecrutadorUserId,
        Guid VagaTiDoRecrutadorId,
        Guid VagaTiDeOutroId,
        Guid VagaRhSemRecrutadorId);

    private static Bag Seed()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenant = new Mock<ITenantContext>();
        tenant.Setup(x => x.TenantId).Returns(Tenant);

        var db = new AppDbContext(options, tenant.Object);

        var areaTi = new CentroCusto { Id = Guid.NewGuid(), TenantId = Tenant, Code = "TI", Description = "TI", IsActive = true };
        var areaRh = new CentroCusto { Id = Guid.NewGuid(), TenantId = Tenant, Code = "RH", Description = "RH", IsActive = true };
        db.CentrosCusto.AddRange(areaTi, areaRh);

        // Hierarquia: Gestor-do-Recrutador → Recrutador (via Funcionario.GestorDiretoId)
        var gestorFunc = new Funcionario
        {
            Id = Guid.NewGuid(), TenantId = Tenant, Name = "Gestor Recrutadores",
            Status = FuncionarioStatus.Active,
        };
        var recrutadorFunc = new Funcionario
        {
            Id = Guid.NewGuid(), TenantId = Tenant, Name = "Recrutador Sub",
            Status = FuncionarioStatus.Active,
            GestorDiretoId = gestorFunc.Id,
        };
        var outroRecrutadorFunc = new Funcionario
        {
            Id = Guid.NewGuid(), TenantId = Tenant, Name = "Outro Recrutador",
            Status = FuncionarioStatus.Active,
            // SEM GestorDiretoId = gestorFunc.Id → não está no time
        };
        db.Funcionarios.AddRange(gestorFunc, recrutadorFunc, outroRecrutadorFunc);

        var recrutadorUser = new ApplicationUser
        {
            Id = Guid.NewGuid(), TenantId = Tenant,
            UserName = "recrutador@t", Email = "recrutador@t",
            FullName = "Recrutador", IsActive = true,
            FuncionarioId = recrutadorFunc.Id,
        };
        var outroUser = new ApplicationUser
        {
            Id = Guid.NewGuid(), TenantId = Tenant,
            UserName = "outro@t", Email = "outro@t",
            FullName = "Outro", IsActive = true,
            FuncionarioId = outroRecrutadorFunc.Id,
        };
        db.Users.AddRange(recrutadorUser, outroUser);

        var vagaDoRecrutador = new Vaga
        {
            Id = Guid.NewGuid(), TenantId = Tenant, Titulo = "Vaga TI (minha)",
            Status = VagaStatus.Aberta, CentroCustoId = areaTi.Id,
            RecrutadorResponsavelUserId = recrutadorUser.Id,
            QuantidadeVagas = 1, HeadcountAutorizado = 1,
        };
        var vagaDeOutro = new Vaga
        {
            Id = Guid.NewGuid(), TenantId = Tenant, Titulo = "Vaga TI (de outro)",
            Status = VagaStatus.Aberta, CentroCustoId = areaTi.Id,
            RecrutadorResponsavelUserId = outroUser.Id,
            QuantidadeVagas = 1, HeadcountAutorizado = 1,
        };
        var vagaRh = new Vaga
        {
            Id = Guid.NewGuid(), TenantId = Tenant, Titulo = "Vaga RH (sem recrutador)",
            Status = VagaStatus.Aberta, CentroCustoId = areaRh.Id,
            RecrutadorResponsavelUserId = null,
            QuantidadeVagas = 1, HeadcountAutorizado = 1,
        };
        db.Vagas.AddRange(vagaDoRecrutador, vagaDeOutro, vagaRh);

        db.SaveChanges();

        return new Bag(
            db,
            areaTi.Id, areaRh.Id,
            gestorFunc.Id, recrutadorFunc.Id,
            recrutadorUser.Id, outroUser.Id,
            vagaDoRecrutador.Id, vagaDeOutro.Id, vagaRh.Id);
    }

    private static VagaService Servico(Bag bag,
        VagasDataScope scope,
        Guid? userId = null,
        Guid? areaId = null,
        Guid? funcionarioId = null,
        bool isAdmin = false)
    {
        var tenant = new Mock<ITenantContext>();
        tenant.Setup(x => x.TenantId).Returns(Tenant);

        var localizer = new Mock<IStringLocalizer<ServiceMessages>>();
        localizer.Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));

        var user = new Mock<ICurrentUserContext>();
        user.Setup(x => x.IsReadOnly).Returns(false);
        user.Setup(x => x.IsAdmin).Returns(isAdmin);
        user.Setup(x => x.VagasDataScope).Returns(scope);
        user.Setup(x => x.UserId).Returns(userId);
        user.Setup(x => x.CentroCustoId).Returns(areaId);
        user.Setup(x => x.FuncionarioId).Returns(funcionarioId);

        var logger = new Mock<ILogger<VagaService>>();
        return new VagaService(bag.Db, tenant.Object, logger.Object, localizer.Object, user.Object);
    }

    // 31.2: VagaListQuery passou a ter 4 args (Q, Status, CentroCustoId, RecrutadorUserId).
    private static VagaListQuery EmptyQuery() => new(null, null, null, null);

    // ────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task All_RetornaTodasAsVagasDoTenant()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.All);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Equal(3, lista.Count);
    }

    [Fact]
    public async Task ByArea_RetornaApenasVagasDaAreaDoUsuario()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByArea, areaId: bag.AreaTiId);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Equal(2, lista.Count);
        Assert.All(lista, v => Assert.Equal(bag.AreaTiId, v.CentroCustoId));
    }

    [Fact]
    public async Task ByArea_SemAreaIdResolvido_CaiParaAll()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByArea, areaId: null);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Equal(3, lista.Count);
    }

    [Fact]
    public async Task ByRecrutador_RetornaApenasVagasOndeUsuarioEhRecrutador()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByRecrutador, userId: bag.RecrutadorUserId);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Single(lista);
        Assert.Equal(bag.VagaTiDoRecrutadorId, lista[0].Id);
    }

    [Fact]
    public async Task ByRecrutador_UsuarioSemVagas_RetornaVazio()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByRecrutador, userId: Guid.NewGuid());

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Empty(lista);
    }

    [Fact]
    public async Task ByGestorRecrutador_RetornaApenasVagasDosSubordinados()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByGestorRecrutador, funcionarioId: bag.GestorFuncionarioId);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Single(lista);
        Assert.Equal(bag.VagaTiDoRecrutadorId, lista[0].Id);
    }

    [Fact]
    public async Task ByGestorRecrutador_SemFuncionarioIdResolvido_CaiParaAll()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByGestorRecrutador, funcionarioId: null);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Equal(3, lista.Count);
    }

    [Fact]
    public async Task Admin_IgnoraScopeEVeTudo()
    {
        var bag = Seed();
        // scope ByRecrutador + user específico, mas IsAdmin=true
        var svc = Servico(bag, VagasDataScope.ByRecrutador,
            userId: bag.RecrutadorUserId, isAdmin: true);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.Equal(3, lista.Count);
    }

    [Fact]
    public async Task ByRecrutador_NaoMostraVagaDeOutroRecrutador()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByRecrutador, userId: bag.RecrutadorUserId);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.DoesNotContain(lista, v => v.Id == bag.VagaTiDeOutroId);
        Assert.DoesNotContain(lista, v => v.Id == bag.VagaRhSemRecrutadorId);
    }

    [Fact]
    public async Task ByGestorRecrutador_NaoMostraVagaDeRecrutadorForaDoTime()
    {
        var bag = Seed();
        var svc = Servico(bag, VagasDataScope.ByGestorRecrutador, funcionarioId: bag.GestorFuncionarioId);

        var lista = await svc.ListAsync(EmptyQuery(), CancellationToken.None);

        Assert.DoesNotContain(lista, v => v.Id == bag.VagaTiDeOutroId);
        Assert.DoesNotContain(lista, v => v.Id == bag.VagaRhSemRecrutadorId);
    }
}
