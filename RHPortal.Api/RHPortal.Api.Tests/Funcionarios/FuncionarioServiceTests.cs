using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Moq;
using RhPortal.Api.Application.Funcionarios;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Funcionarios;

/// <summary>
/// Testes do FuncionarioService — CRUD completo, validação de email único,
/// referências (UnitId, AreaId, JobPositionId) e UpdateHierarquia.
/// </summary>
public sealed class FuncionarioServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, FuncionarioService Service) CriarServico()
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

        // IPessoaService mock: retorna uma Pessoa nova para qualquer email
        var pessoaMock = new Mock<IPessoaService>();
        pessoaMock
            .Setup(x => x.GetOrCreateByEmailAsync(
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<OrigemPessoa?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string email, string? nome, string? fone, string? cidade,
                string? uf, string? li, string? resumo, string? obs,
                OrigemPessoa? origem, CancellationToken ct) => new Pessoa
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantTeste,
                    Nome = nome ?? email,
                    Cpf = null,
                    Origem = origem ?? OrigemPessoa.Funcionario,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow,
                });

        var service = new FuncionarioService(db, pessoaMock.Object, localizer.Object);
        return (db, service);
    }

    private static FuncionarioCreateRequest RequestMinimo(string email = "func@empresa.com") =>
        new()
        {
            Name = "Funcionário Teste",
            Email = email,
            Status = FuncionarioStatus.Active,
            Headcount = 0,
        };

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaFuncionarioPersistido()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo("joao@empresa.com"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Funcionário Teste", result.Name);
        Assert.Equal("joao@empresa.com", result.Email);
        Assert.Equal(FuncionarioStatus.Active, result.Status);
    }

    [Fact]
    public async Task Create_EmailDuplicado_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("duplicado@empresa.com"), CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo("duplicado@empresa.com"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_UnitIdInexistente_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        var request = new FuncionarioCreateRequest
        {
            Name = "Teste",
            Email = "unit@empresa.com",
            Status = FuncionarioStatus.Active,
            UnitId = Guid.NewGuid(), // Unit não existe
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task Create_CamposOpcionaisPreenchidos_SaoPersistidos()
    {
        var (_, svc) = CriarServico();

        var request = new FuncionarioCreateRequest
        {
            Name = "Maria Colaboradora",
            Email = "maria@empresa.com",
            Phone = "11-99999-0000",
            Status = FuncionarioStatus.Active,
            Headcount = 5,
            Notes = "Anotação importante",
        };

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal("11-99999-0000", result.Phone);
        Assert.Equal(5, result.Headcount);
        Assert.Equal("Anotação importante", result.Notes);
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

        var created = await svc.CreateAsync(RequestMinimo("getbyid@empresa.com"), CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("getbyid@empresa.com", result.Email);
        Assert.Equal("Funcionário Teste", result.Name);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var request = new FuncionarioUpdateRequest(
            "Nome", "email@empresa.com", null,
            FuncionarioStatus.Active, 0, null, null, null, null, null);

        var result = await svc.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_EmailConflitanteComOutroFuncionario_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("func1@empresa.com"), CancellationToken.None);
        var func2 = await svc.CreateAsync(RequestMinimo("func2@empresa.com"), CancellationToken.None);

        var request = new FuncionarioUpdateRequest(
            "Novo Nome", "func1@empresa.com", null,
            FuncionarioStatus.Active, 0, null, null, null, null, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateAsync(func2.Id, request, CancellationToken.None));
    }

    [Fact]
    public async Task Update_MesmoEmailNoProprioFuncionario_Funciona()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("upd@empresa.com"), CancellationToken.None);

        var request = new FuncionarioUpdateRequest(
            "Nome Atualizado", "upd@empresa.com", "11-88888-0000",
            FuncionarioStatus.Inactive, 3, null, null, null, null, "Nova nota");

        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Nome Atualizado", result.Name);
        Assert.Equal(FuncionarioStatus.Inactive, result.Status);
        Assert.Equal(3, result.Headcount);
        Assert.Equal("11-88888-0000", result.Phone);
        Assert.Equal("Nova nota", result.Notes);
    }

    // ── UpdateHierarquia ──────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateHierarquia_IdExistente_RetornaTrue()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("hier@empresa.com"), CancellationToken.None);
        var gestorId = Guid.NewGuid();

        var result = await svc.UpdateHierarquiaAsync(
            created.Id, gestorId, null, CancellationToken.None);

        Assert.True(result);
    }

    [Fact]
    public async Task UpdateHierarquia_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateHierarquiaAsync(
            Guid.NewGuid(), null, null, CancellationToken.None);

        Assert.False(result);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("del@empresa.com"), CancellationToken.None);

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

        await svc.CreateAsync(RequestMinimo("lst1@empresa.com"), CancellationToken.None);
        await svc.CreateAsync(RequestMinimo("lst2@empresa.com"), CancellationToken.None);

        // 31.2: FuncionarioListQuery passou a ter 4 filtros posicionais
        // (Search, Status, UnitId, JobPositionId) + os defaults de paginação.
        var query = new FuncionarioListQuery(null, null, null, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(2, result.TotalItems);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task ListGrid_FiltroStatus_RetornaApenasFiltrados()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(new FuncionarioCreateRequest
        {
            Name = "Ativo", Email = "ativo@empresa.com", Status = FuncionarioStatus.Active
        }, CancellationToken.None);

        await svc.CreateAsync(new FuncionarioCreateRequest
        {
            Name = "Inativo", Email = "inativo@empresa.com", Status = FuncionarioStatus.Inactive
        }, CancellationToken.None);

        var query = new FuncionarioListQuery(null, FuncionarioStatus.Active, null, null);
        var result = await svc.ListGridAsync(query, CancellationToken.None);

        Assert.Equal(1, result.TotalItems);
        Assert.All(result.Items, item => Assert.Equal(FuncionarioStatus.Active, item.Status));
    }
}
