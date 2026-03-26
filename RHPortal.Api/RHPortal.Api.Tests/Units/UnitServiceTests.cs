using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Moq;
using RhPortal.Api.Application.Units;
using RhPortal.Api.Contracts.Units;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Units;

/// <summary>
/// Testes do UnitService — CRUD completo, validações de código único,
/// UF (2 chars), CEP (8 ou 9 chars) e headcount não-negativo.
/// </summary>
public sealed class UnitServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, UnitService Service) CriarServico()
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

        var service = new UnitService(db, localizer.Object, tenantMock.Object);
        return (db, service);
    }

    private static UnitCreateRequest RequestMinimo(string code = "UN-01") =>
        new(code, "Unidade Teste", UnitStatus.Active,
            null, null, null, null, null, null, null, null, null, 0, null);

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaUnidadePersistida()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo("HQ-01"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("HQ-01", result.Code);
        Assert.Equal("Unidade Teste", result.Name);
        Assert.Equal(UnitStatus.Active, result.Status);
    }

    [Fact]
    public async Task Create_CodigoVazio_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo("   "), CancellationToken.None));
    }

    [Fact]
    public async Task Create_HeadcountNegativo_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        var request = new UnitCreateRequest("UN-NEG", "Unidade", UnitStatus.Active,
            null, null, null, null, null, null, null, null, null, -1, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task Create_CodigoDuplicado_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("DUP-01"), CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo("DUP-01"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_UfInvalida_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        // UF deve ter exatamente 2 caracteres
        var request = new UnitCreateRequest("UN-UF", "Unidade", UnitStatus.Active,
            "São Paulo", "SPX", null, null, null, null, null, null, null, 0, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task Create_CepInvalido_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        // CEP deve ter 8 ou 9 chars
        var request = new UnitCreateRequest("UN-CEP", "Unidade", UnitStatus.Active,
            null, null, null, null, "123", null, null, null, null, 0, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task Create_CamposOpcionaisPreenchidos_SaoPersistidos()
    {
        var (_, svc) = CriarServico();

        var request = new UnitCreateRequest(
            "SP-01", "Filial SP", UnitStatus.Active,
            "São Paulo", "SP", "Av. Paulista, 1000", "Bela Vista", "01310-100",
            "contato@empresa.com", "11-3000-1000", "Responsável SP", "Matriz",
            50, "Notas da unidade");

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal("São Paulo", result.City);
        Assert.Equal("SP", result.Uf);
        Assert.Equal("Av. Paulista, 1000", result.AddressLine);
        Assert.Equal("01310-100", result.ZipCode);
        Assert.Equal("contato@empresa.com", result.Email);
        Assert.Equal("11-3000-1000", result.Phone);
        Assert.Equal("Responsável SP", result.ResponsibleName);
        Assert.Equal(50, result.Headcount);
        Assert.Equal("Notas da unidade", result.Notes);
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
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("BUS-01"), CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("BUS-01", result.Code);
        Assert.Equal("Unidade Teste", result.Name);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var request = new UnitUpdateRequest("X", "Y", UnitStatus.Active,
            null, null, null, null, null, null, null, null, null, 0, null);

        var result = await svc.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_CodigoConflitanteComOutraUnidade_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("A-01"), CancellationToken.None);
        var un2 = await svc.CreateAsync(RequestMinimo("B-02"), CancellationToken.None);

        var request = new UnitUpdateRequest("A-01", "Novo Nome", UnitStatus.Active,
            null, null, null, null, null, null, null, null, null, 0, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateAsync(un2.Id, request, CancellationToken.None));
    }

    [Fact]
    public async Task Update_MesmoCodigoNaPropriaUnidade_Funciona()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("UPD-01"), CancellationToken.None);

        var request = new UnitUpdateRequest("UPD-01", "Nome Atualizado", UnitStatus.Inactive,
            null, null, null, null, null, null, null, null, null, 10, null);

        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Nome Atualizado", result.Name);
        Assert.Equal(UnitStatus.Inactive, result.Status);
        Assert.Equal(10, result.Headcount);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("DEL-01"), CancellationToken.None);

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
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("LST-01"), CancellationToken.None);
        await svc.CreateAsync(RequestMinimo("LST-02"), CancellationToken.None);

        var query = new UnitListQuery(null, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(2, result.TotalItems);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task ListGrid_FiltroStatus_RetornaApenasFiltrados()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(new UnitCreateRequest("AT-01", "Ativo", UnitStatus.Active,
            null, null, null, null, null, null, null, null, null, 0, null), CancellationToken.None);

        await svc.CreateAsync(new UnitCreateRequest("IN-01", "Inativo", UnitStatus.Inactive,
            null, null, null, null, null, null, null, null, null, 0, null), CancellationToken.None);

        var query = new UnitListQuery(null, UnitStatus.Active);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.All(result.Items, item => Assert.Equal(UnitStatus.Active, item.Status));
    }

    [Fact]
    public async Task ListGrid_FiltroBusca_RetornaApenasCorrespondentes()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(new UnitCreateRequest("SP-UNIQUE", "Filial São Paulo", UnitStatus.Active,
            null, null, null, null, null, null, null, null, null, 0, null), CancellationToken.None);

        await svc.CreateAsync(RequestMinimo("RJ-01"), CancellationToken.None);

        var query = new UnitListQuery("SP-UNIQUE", null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.Equal("SP-UNIQUE", result.Items[0].Code);
    }
}
