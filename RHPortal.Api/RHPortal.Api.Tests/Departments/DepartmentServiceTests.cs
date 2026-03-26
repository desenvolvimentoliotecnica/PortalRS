using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Moq;
using RhPortal.Api.Application.Departments;
using RhPortal.Api.Contracts.Departments;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Departments;

/// <summary>
/// Testes do DepartmentService — cobertura de CRUD completo, validação de código
/// único e filtros de listagem.
/// </summary>
public sealed class DepartmentServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, DepartmentService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);

        var localizer = new Mock<IStringLocalizer<ServiceMessages>>();
        localizer
            .Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));
        localizer
            .Setup(x => x[It.IsAny<string>(), It.IsAny<object[]>()])
            .Returns<string, object[]>((k, _) => new LocalizedString(k, k));

        var service = new DepartmentService(db, localizer.Object);
        return (db, service);
    }

    /// <summary>
    /// Cria e persiste uma Area para que DepartmentService.GetByIdAsync possa
    /// navegar até Area.Name sem NullReferenceException.
    /// </summary>
    private static Guid SeedArea(AppDbContext db)
    {
        var area = new Area
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "AREA-TEST",
            Name = "Área de Teste",
            IsActive = true,
        };
        db.Areas.Add(area);
        db.SaveChanges();
        return area.Id;
    }

    private static DepartmentCreateRequest RequestMinimo(Guid areaId, string code = "DEP-01") =>
        new(code, "Departamento Teste", areaId, DepartmentStatus.Active, 5,
            null, null, null, null, null);

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaDepartamentoPersistido()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId, "TI-01"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("TI-01", result.Code);
        Assert.Equal("Departamento Teste", result.Name);
        Assert.Equal(DepartmentStatus.Active, result.Status);
        Assert.Equal(5, result.Headcount);
    }

    [Fact]
    public async Task Create_CodigoDuplicado_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(RequestMinimo(areaId, "DUPLO"), CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo(areaId, "DUPLO"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_CamposOpcionaisPreenchidos_SaoPersistidos()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var request = new DepartmentCreateRequest(
            "RH-01", "Recursos Humanos", areaId, DepartmentStatus.Active, 10,
            "Ana Gestora", "ana@empresa.com", "11-99999-9999", "Filial SP", "Descrição detalhada");

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal("Ana Gestora", result.ManagerName);
        Assert.Equal("ana@empresa.com", result.ManagerEmail);
        Assert.Equal("11-99999-9999", result.Phone);
        Assert.Equal("Filial SP", result.BranchOrLocation);
        Assert.Equal("Descrição detalhada", result.Description);
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
    public async Task GetById_IdExistente_RetornaCamposCorretos()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(RequestMinimo(areaId, "BUS-01"), CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("BUS-01", result.Code);
        Assert.Equal("Departamento Teste", result.Name);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var request = new DepartmentUpdateRequest(
            "X", "Y", areaId, DepartmentStatus.Active, 1, null, null, null, null, null);

        var result = await svc.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_CodigoConflitanteComOutroDep_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(RequestMinimo(areaId, "A-01"), CancellationToken.None);
        var dep2 = await svc.CreateAsync(RequestMinimo(areaId, "B-02"), CancellationToken.None);

        var request = new DepartmentUpdateRequest(
            "A-01", "Novo Nome", areaId, DepartmentStatus.Active, 5,
            null, null, null, null, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateAsync(dep2.Id, request, CancellationToken.None));
    }

    [Fact]
    public async Task Update_MesmoCodigoNoProprioDep_Funciona()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(RequestMinimo(areaId, "UPD-01"), CancellationToken.None);

        var request = new DepartmentUpdateRequest(
            "UPD-01", "Nome Atualizado", areaId, DepartmentStatus.Inactive, 20,
            "Gestor Novo", null, null, null, "Descrição Nova");

        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Nome Atualizado", result.Name);
        Assert.Equal(DepartmentStatus.Inactive, result.Status);
        Assert.Equal(20, result.Headcount);
        Assert.Equal("Gestor Novo", result.ManagerName);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(RequestMinimo(areaId, "DEL-01"), CancellationToken.None);

        var deleted = await svc.DeleteAsync(created.Id, CancellationToken.None);

        Assert.True(deleted);
        Assert.Null(await svc.GetByIdAsync(created.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    // ── Listagem (grid) ───────────────────────────────────────────────────────

    [Fact]
    public async Task ListGrid_SemFiltro_RetornaItensCriados()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(RequestMinimo(areaId, "LST-01"), CancellationToken.None);
        await svc.CreateAsync(RequestMinimo(areaId, "LST-02"), CancellationToken.None);

        // DepartmentListQuery(Search?, Status?, AreaId?, Page=1, PageSize=20, Sort="name", Dir="asc")
        var query = new DepartmentListQuery(null, null, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(2, result.TotalItems);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task ListGrid_FiltroStatus_RetornaApenasFiltrados()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(
            new DepartmentCreateRequest("AT-01", "Ativo", areaId, DepartmentStatus.Active, 1, null, null, null, null, null),
            CancellationToken.None);
        await svc.CreateAsync(
            new DepartmentCreateRequest("IN-01", "Inativo", areaId, DepartmentStatus.Inactive, 1, null, null, null, null, null),
            CancellationToken.None);

        var query = new DepartmentListQuery(null, DepartmentStatus.Active, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.All(result.Items, item => Assert.Equal(DepartmentStatus.Active, item.Status));
    }

    [Fact]
    public async Task ListGrid_FiltroBusca_RetornaApenasCodigo()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(
            new DepartmentCreateRequest("BUSCA-UNIQUE", "Dept Específico", areaId, DepartmentStatus.Active, 1, null, null, null, null, null),
            CancellationToken.None);
        await svc.CreateAsync(RequestMinimo(areaId, "OUTRO-01"), CancellationToken.None);

        var query = new DepartmentListQuery("BUSCA-UNIQUE", null, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.Equal("BUSCA-UNIQUE", result.Items[0].Code);
    }
}
