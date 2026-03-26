using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.BloqueioPessoa;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.BloqueioPessoa;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.BloqueioPessoa;

/// <summary>
/// Testes do BloqueioPessoaService — criação manual/por pessoaId, busca,
/// listagem, exclusão e IsPessoaBlocked.
/// </summary>
public sealed class BloqueioPessoaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, BloqueioPessoaService Service, PessoaService PessoaService) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var pessoaService = new PessoaService(db, tenantMock.Object);
        var service = new BloqueioPessoaService(db, tenantMock.Object, pessoaService);
        return (db, service, pessoaService);
    }

    /// <summary>Semeia uma Pessoa no banco e retorna seu Id.</summary>
    private static async Task<Guid> SeedPessoa(PessoaService svc, string email = "pessoa@empresa.com")
    {
        var p = await svc.CreateAsync(
            new RhPortal.Api.Contracts.Pessoas.PessoaCreateRequest(
                "Pessoa Teste", email, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null,
                OrigemPessoa.Manual),
            CancellationToken.None);
        return p.Id;
    }

    // ── CreateManual ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateManual_EmailNovo_CriaPessoaEBloqueio()
    {
        var (_, svc, _) = CriarServico();

        var request = new BloqueioPessoaCreateManualRequest("João Bloqueado", "joao@empresa.com", "Comportamento inadequado");

        var result = await svc.CreateManualAsync(request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("joao@empresa.com", result.Email);
        Assert.Equal("Comportamento inadequado", result.Motivo);
        Assert.Equal(OrigemBloqueio.Manual, result.OrigemBloqueio);
    }

    [Fact]
    public async Task CreateManual_PessoaJaBloqueada_RetornaNull()
    {
        var (_, svc, _) = CriarServico();

        var request = new BloqueioPessoaCreateManualRequest("Teste", "duplo@empresa.com", null);

        await svc.CreateManualAsync(request, CancellationToken.None);

        // Segunda tentativa de bloquear o mesmo email
        var result = await svc.CreateManualAsync(request, CancellationToken.None);

        Assert.Null(result);
    }

    // ── BlockByPessoaId ───────────────────────────────────────────────────────

    [Fact]
    public async Task BlockByPessoaId_PessoaExistente_CriaBloqueio()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var pessoaId = await SeedPessoa(pessoaSvc, "bloquear@empresa.com");

        var result = await svc.BlockByPessoaIdAsync(pessoaId, "Motivo manual", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(pessoaId, result.PessoaId);
        Assert.Equal("Motivo manual", result.Motivo);
    }

    [Fact]
    public async Task BlockByPessoaId_PessoaInexistente_RetornaNull()
    {
        var (_, svc, _) = CriarServico();

        var result = await svc.BlockByPessoaIdAsync(Guid.NewGuid(), null, CancellationToken.None);

        Assert.Null(result);
    }

    // ── IsPessoaBlocked ───────────────────────────────────────────────────────

    [Fact]
    public async Task IsPessoaBlocked_NaoBloqueada_RetornaFalse()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var pessoaId = await SeedPessoa(pessoaSvc, "livre@empresa.com");

        var result = await svc.IsPessoaBlockedAsync(pessoaId, CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task IsPessoaBlocked_Bloqueada_RetornaTrue()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var pessoaId = await SeedPessoa(pessoaSvc, "bloqueada@empresa.com");

        await svc.BlockByPessoaIdAsync(pessoaId, null, CancellationToken.None);

        var result = await svc.IsPessoaBlockedAsync(pessoaId, CancellationToken.None);

        Assert.True(result);
    }

    // ── GetByPessoaId ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByPessoaId_PessoaNaoBloqueada_RetornaNull()
    {
        var (_, svc, _) = CriarServico();

        var result = await svc.GetByPessoaIdAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByPessoaId_PessoaBloqueada_RetornaBloqueio()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var pessoaId = await SeedPessoa(pessoaSvc, "getbypessoa@empresa.com");

        await svc.BlockByPessoaIdAsync(pessoaId, "Teste", CancellationToken.None);

        var result = await svc.GetByPessoaIdAsync(pessoaId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(pessoaId, result.PessoaId);
    }

    // ── GetById ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetById_IdInexistente_RetornaNull()
    {
        var (_, svc, _) = CriarServico();

        var result = await svc.GetByIdAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetById_IdExistente_RetornaBloqueio()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var pessoaId = await SeedPessoa(pessoaSvc, "getbyid@empresa.com");

        var criado = await svc.BlockByPessoaIdAsync(pessoaId, "Motivo", CancellationToken.None);

        var result = await svc.GetByIdAsync(criado!.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(criado.Id, result.Id);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var pessoaId = await SeedPessoa(pessoaSvc, "delbloq@empresa.com");

        var criado = await svc.BlockByPessoaIdAsync(pessoaId, null, CancellationToken.None);

        var deleted = await svc.DeleteAsync(criado!.Id, CancellationToken.None);

        Assert.True(deleted);
        Assert.False(await svc.IsPessoaBlockedAsync(pessoaId, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc, _) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemFiltro_RetornaTodosBloqueios()
    {
        var (_, svc, pessoaSvc) = CriarServico();
        var p1 = await SeedPessoa(pessoaSvc, "lst1@empresa.com");
        var p2 = await SeedPessoa(pessoaSvc, "lst2@empresa.com");

        await svc.BlockByPessoaIdAsync(p1, null, CancellationToken.None);
        await svc.BlockByPessoaIdAsync(p2, null, CancellationToken.None);

        var result = await svc.ListAsync(new BloqueioPessoaListQuery(null), CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Items.Count);
    }
}
