using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.CamposPersonalizados;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.CamposPersonalizados;

/// <summary>
/// Testes do CampoPersonalizadoService — CRUD completo e reordenação.
/// </summary>
public sealed class CampoPersonalizadoServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, CampoPersonalizadoService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new CampoPersonalizadoService(db, tenantMock.Object);
        return (db, service);
    }

    private static CampoPersonalizadoRequest RequestMinimo(string label = "Possui CNH?") =>
        new(label, CampoPersonalizadoTipo.Checkbox);

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemCampos_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task List_ComCampos_RetornaOrdenadoPorOrdem()
    {
        var (_, svc) = CriarServico();
        var vagaId = Guid.NewGuid();

        await svc.CreateAsync(vagaId, new CampoPersonalizadoRequest("Campo A"), CancellationToken.None);
        await svc.CreateAsync(vagaId, new CampoPersonalizadoRequest("Campo B"), CancellationToken.None);
        await svc.CreateAsync(vagaId, new CampoPersonalizadoRequest("Campo C"), CancellationToken.None);

        var result = await svc.ListAsync(vagaId, CancellationToken.None);

        Assert.Equal(3, result.Count);
        Assert.Equal("Campo A", result[0].Label);
        Assert.Equal(0, result[0].Ordem);
        Assert.Equal("Campo B", result[1].Label);
        Assert.Equal(1, result[1].Ordem);
        Assert.Equal("Campo C", result[2].Label);
        Assert.Equal(2, result[2].Ordem);
    }

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_PrimeiroCampo_OrdemZero()
    {
        var (_, svc) = CriarServico();
        var vagaId = Guid.NewGuid();

        var result = await svc.CreateAsync(vagaId, RequestMinimo("Possui CNH?"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Possui CNH?", result.Label);
        Assert.Equal(0, result.Ordem);
        Assert.Equal(vagaId, result.VagaId);
    }

    [Fact]
    public async Task Create_SegundoCampo_OrdemIncrementa()
    {
        var (_, svc) = CriarServico();
        var vagaId = Guid.NewGuid();

        await svc.CreateAsync(vagaId, RequestMinimo("Campo 1"), CancellationToken.None);
        var segundo = await svc.CreateAsync(vagaId, RequestMinimo("Campo 2"), CancellationToken.None);

        Assert.Equal(1, segundo.Ordem);
    }

    [Fact]
    public async Task Create_CamposOpcionaisPreenchidos_SaoPersistidos()
    {
        var (_, svc) = CriarServico();
        var vagaId = Guid.NewGuid();

        var request = new CampoPersonalizadoRequest(
            "Nível de inglês", CampoPersonalizadoTipo.Select,
            Obrigatorio: true, IsReadOnly: false,
            ValorPadrao: null, Opcoes: "Básico;Intermediário;Avançado");

        var result = await svc.CreateAsync(vagaId, request, CancellationToken.None);

        Assert.Equal("Nível de inglês", result.Label);
        Assert.Equal(CampoPersonalizadoTipo.Select, result.Tipo);
        Assert.True(result.Obrigatorio);
        Assert.Equal("Básico;Intermediário;Avançado", result.Opcoes);
    }

    [Fact]
    public async Task Create_LabelComEspacos_ETrimmado()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(Guid.NewGuid(), new CampoPersonalizadoRequest("  Disponível para viagem?  "), CancellationToken.None);

        Assert.Equal("Disponível para viagem?", result.Label);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaCampos()
    {
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(Guid.NewGuid(), RequestMinimo("Original"), CancellationToken.None);

        var result = await svc.UpdateAsync(created.Id,
            new CampoPersonalizadoRequest("Atualizado", CampoPersonalizadoTipo.Texto, Obrigatorio: true),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Atualizado", result.Label);
        Assert.Equal(CampoPersonalizadoTipo.Texto, result.Tipo);
        Assert.True(result.Obrigatorio);
        // Ordem não muda no update
        Assert.Equal(created.Ordem, result.Ordem);
    }

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateAsync(Guid.NewGuid(), RequestMinimo(), CancellationToken.None);

        Assert.Null(result);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RetornaTrue()
    {
        var (_, svc) = CriarServico();
        var vagaId = Guid.NewGuid();
        var created = await svc.CreateAsync(vagaId, RequestMinimo(), CancellationToken.None);

        var result = await svc.DeleteAsync(created.Id, CancellationToken.None);

        Assert.True(result);
        var lista = await svc.ListAsync(vagaId, CancellationToken.None);
        Assert.Empty(lista);
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
        var vagaId = Guid.NewGuid();

        var c1 = await svc.CreateAsync(vagaId, RequestMinimo("Campo 1"), CancellationToken.None);
        var c2 = await svc.CreateAsync(vagaId, RequestMinimo("Campo 2"), CancellationToken.None);
        var c3 = await svc.CreateAsync(vagaId, RequestMinimo("Campo 3"), CancellationToken.None);

        // Inverte: Campo 3 → 0, Campo 2 → 1, Campo 1 → 2
        await svc.ReorderAsync(vagaId, [c3.Id, c2.Id, c1.Id], CancellationToken.None);

        var lista = await svc.ListAsync(vagaId, CancellationToken.None);
        Assert.Equal("Campo 3", lista[0].Label);
        Assert.Equal("Campo 2", lista[1].Label);
        Assert.Equal("Campo 1", lista[2].Label);
    }
}
