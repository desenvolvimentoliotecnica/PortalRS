using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Hierarquia;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Hierarquia;

/// <summary>
/// Testes do NivelHierarquicoService — CRUD completo e reordenação de níveis.
/// Delete faz soft-delete (Ativo = false), não remove o registro.
/// </summary>
public sealed class NivelHierarquicoServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, NivelHierarquicoService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new NivelHierarquicoService(db, tenantMock.Object);
        return (db, service);
    }

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemNiveis_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListAsync(CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task List_ComNiveis_RetornaOrdenadoPorOrdem()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(new NivelHierarquicoRequest("Junior"), CancellationToken.None);
        await svc.CreateAsync(new NivelHierarquicoRequest("Pleno"), CancellationToken.None);
        await svc.CreateAsync(new NivelHierarquicoRequest("Senior"), CancellationToken.None);

        var result = await svc.ListAsync(CancellationToken.None);

        Assert.Equal(3, result.Count);
        Assert.Equal("Junior", result[0].Nome);
        Assert.Equal("Pleno", result[1].Nome);
        Assert.Equal("Senior", result[2].Nome);
    }

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_PrimeiroNivel_OrdemZero()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(new NivelHierarquicoRequest("Junior"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Junior", result.Nome);
        Assert.Equal(0, result.Ordem);
        Assert.True(result.Ativo);
    }

    [Fact]
    public async Task Create_SegundoNivel_OrdemIncrementa()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(new NivelHierarquicoRequest("Junior"), CancellationToken.None);
        var segundo = await svc.CreateAsync(new NivelHierarquicoRequest("Pleno"), CancellationToken.None);

        Assert.Equal(1, segundo.Ordem);
    }

    [Fact]
    public async Task Create_NomeComEspacos_ETrimmado()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(new NivelHierarquicoRequest("  Gestor  "), CancellationToken.None);

        Assert.Equal("Gestor", result.Nome);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaNome()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(new NivelHierarquicoRequest("Original"), CancellationToken.None);

        var result = await svc.UpdateAsync(created.Id, new NivelHierarquicoRequest("Atualizado"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Atualizado", result.Nome);
        Assert.Equal(created.Ordem, result.Ordem); // Ordem não muda no update
    }

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateAsync(Guid.NewGuid(), new NivelHierarquicoRequest("Teste"), CancellationToken.None);

        Assert.Null(result);
    }

    // ── Exclusão (soft-delete) ─────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_SetaAtivoFalseERetornaTrue()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(new NivelHierarquicoRequest("Para Deletar"), CancellationToken.None);

        var result = await svc.DeleteAsync(created.Id, CancellationToken.None);

        Assert.True(result);

        // Soft-delete: ainda aparece na lista
        var lista = await svc.ListAsync(CancellationToken.None);
        Assert.Single(lista);
        Assert.False(lista[0].Ativo); // Ativo = false após soft-delete
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    // ── Reorder ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Reorder_ListaOrdenada_AtualizaOrdem()
    {
        var (_, svc) = CriarServico();

        var n1 = await svc.CreateAsync(new NivelHierarquicoRequest("Junior"), CancellationToken.None);
        var n2 = await svc.CreateAsync(new NivelHierarquicoRequest("Pleno"), CancellationToken.None);
        var n3 = await svc.CreateAsync(new NivelHierarquicoRequest("Senior"), CancellationToken.None);

        // Inverte a ordem: Senior=0, Pleno=1, Junior=2
        await svc.ReorderAsync([n3.Id, n2.Id, n1.Id], CancellationToken.None);

        var lista = await svc.ListAsync(CancellationToken.None);

        Assert.Equal("Senior", lista[0].Nome);
        Assert.Equal("Pleno", lista[1].Nome);
        Assert.Equal("Junior", lista[2].Nome);
    }
}
