using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Moq;
using RhPortal.Api.Application.JobPositions;
using RhPortal.Api.Contracts.JobPositions;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.JobPositions;

/// <summary>
/// Testes do JobPositionService — CRUD completo, validação de prefixo CAR-,
/// tamanho mínimo de código, existência de área e unicidade de código.
/// </summary>
public sealed class JobPositionServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, JobPositionService Service) CriarServico()
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

        var service = new JobPositionService(db, localizer.Object);
        return (db, service);
    }

    /// <summary>
    /// Semeia uma Area — obrigatório porque JobPositionService.CreateAsync valida
    /// existência da área, e GetByIdAsync usa Include(x => x.Area) com FK não-nulável
    /// (InMemory faz inner join, entidade some se área não existir).
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

    private static JobPositionCreateRequest RequestMinimo(Guid areaId, string code = "CAR-001") =>
        new(code, "Cargo Teste", CargoStatus.Active, areaId, SeniorityLevel.Pleno, null, "0-00-00-00", null, null, null, null, null);

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaCargoPersistido()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId, "CAR-001"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("CAR-001", result.Code);
        Assert.Equal("Cargo Teste", result.Name);
        Assert.Equal(CargoStatus.Active, result.Status);
        Assert.Equal(SeniorityLevel.Pleno, result.Seniority);
        Assert.Equal(areaId, result.AreaId);
    }

    [Fact]
    public async Task Create_CodigoSemPrefixoCAR_PrefixaAutomaticamente()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId, "TI-001"), CancellationToken.None);

        Assert.Equal("CAR-TI-001", result.Code);
    }

    [Fact]
    public async Task Create_CodigoMuitoCurto_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        // "CAR-X" tem apenas 5 chars — mínimo é 6
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo(areaId, "CAR-X"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_AreaInexistente_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        // Área não existe no banco
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo(Guid.NewGuid(), "CAR-001"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_CodigoDuplicado_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(RequestMinimo(areaId, "CAR-DUP"), CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo(areaId, "CAR-DUP"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_CamposOpcionaisPreenchidos_SaoPersistidos()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var request = new JobPositionCreateRequest(
            "CAR-002", "Desenvolvedor Senior", CargoStatus.Active, areaId,
            SeniorityLevel.Senior, "Técnico", "0-00-00-00", "Desenvolve sistemas web", null, null, null, null);

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal("Técnico", result.Type);
        Assert.Equal("Desenvolve sistemas web", result.Description);
        Assert.Equal(SeniorityLevel.Senior, result.Seniority);
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

        var created = await svc.CreateAsync(RequestMinimo(areaId, "CAR-BUS"), CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("CAR-BUS", result.Code);
        Assert.Equal("Área de Teste", result.AreaName);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var request = new JobPositionUpdateRequest(
            "CAR-X01", "Nome", CargoStatus.Active, areaId, SeniorityLevel.Junior, null, "0-00-00-00", null, null, null, null, null);

        var result = await svc.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_CodigoConflitanteComOutroCargo_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(RequestMinimo(areaId, "CAR-A01"), CancellationToken.None);
        var cargo2 = await svc.CreateAsync(RequestMinimo(areaId, "CAR-B02"), CancellationToken.None);

        var request = new JobPositionUpdateRequest(
            "CAR-A01", "Novo Nome", CargoStatus.Active, areaId, SeniorityLevel.Pleno, null, "0-00-00-00", null, null, null, null, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateAsync(cargo2.Id, request, CancellationToken.None));
    }

    [Fact]
    public async Task Update_MesmoCodigoNoProprioItem_Funciona()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(RequestMinimo(areaId, "CAR-UPD"), CancellationToken.None);

        var request = new JobPositionUpdateRequest(
            "CAR-UPD", "Nome Atualizado", CargoStatus.Inactive, areaId,
            SeniorityLevel.Senior, "Técnico", "0-00-00-00", "Descrição nova", null, null, null, null);

        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Nome Atualizado", result.Name);
        Assert.Equal(CargoStatus.Inactive, result.Status);
        Assert.Equal(SeniorityLevel.Senior, result.Seniority);
        Assert.Equal("Técnico", result.Type);
        Assert.Equal("Descrição nova", result.Description);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(RequestMinimo(areaId, "CAR-DEL"), CancellationToken.None);

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

        await svc.CreateAsync(RequestMinimo(areaId, "CAR-L01"), CancellationToken.None);
        await svc.CreateAsync(RequestMinimo(areaId, "CAR-L02"), CancellationToken.None);

        var query = new JobPositionListQuery(null, null, null, null);
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
            new JobPositionCreateRequest("CAR-AT1", "Ativo", CargoStatus.Active, areaId, SeniorityLevel.Pleno, null, "0-00-00-00", null, null, null, null, null),
            CancellationToken.None);
        await svc.CreateAsync(
            new JobPositionCreateRequest("CAR-IN1", "Inativo", CargoStatus.Inactive, areaId, SeniorityLevel.Pleno, null, "0-00-00-00", null, null, null, null, null),
            CancellationToken.None);

        var query = new JobPositionListQuery(null, CargoStatus.Active, null, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.All(result.Items, item => Assert.Equal(CargoStatus.Active, item.Status));
    }

    [Fact]
    public async Task ListGrid_FiltroSeniority_RetornaApenasFiltrados()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(
            new JobPositionCreateRequest("CAR-JN1", "Junior", CargoStatus.Active, areaId, SeniorityLevel.Junior, null, "0-00-00-00", null, null, null, null, null),
            CancellationToken.None);
        await svc.CreateAsync(
            new JobPositionCreateRequest("CAR-SR1", "Senior", CargoStatus.Active, areaId, SeniorityLevel.Senior, null, "0-00-00-00", null, null, null, null, null),
            CancellationToken.None);

        var query = new JobPositionListQuery(null, null, null, SeniorityLevel.Senior);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.Equal("CAR-SR1", result.Items[0].Code);
    }
}
