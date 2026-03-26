using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.FasesProcesso;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.FasesProcesso;

/// <summary>
/// Testes do FaseProcessoService — CRUD completo, reordenação e movimentação de candidatos.
/// </summary>
public sealed class FaseProcessoServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, FaseProcessoService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new FaseProcessoService(db, tenantMock.Object);
        return (db, service);
    }

    private static Guid NewProjetoId() => Guid.NewGuid();

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemFases_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListAsync(NewProjetoId(), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task List_ComFases_RetornaOrdenadoPorOrdem()
    {
        var (_, svc) = CriarServico();
        var projetoId = NewProjetoId();

        await svc.CreateAsync(projetoId, new FaseProcessoRequest("Triagem"), CancellationToken.None);
        await svc.CreateAsync(projetoId, new FaseProcessoRequest("Entrevista"), CancellationToken.None);
        await svc.CreateAsync(projetoId, new FaseProcessoRequest("Proposta"), CancellationToken.None);

        var result = await svc.ListAsync(projetoId, CancellationToken.None);

        Assert.Equal(3, result.Count);
        Assert.Equal("Triagem", result[0].Nome);
        Assert.Equal(0, result[0].Ordem);
        Assert.Equal("Entrevista", result[1].Nome);
        Assert.Equal(1, result[1].Ordem);
        Assert.Equal("Proposta", result[2].Nome);
        Assert.Equal(2, result[2].Ordem);
    }

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_PrimeiraFase_OrdemZero()
    {
        var (_, svc) = CriarServico();
        var projetoId = NewProjetoId();

        var result = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Triagem"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Triagem", result.Nome);
        Assert.Equal(0, result.Ordem);
        Assert.Equal(projetoId, result.ProjetoId);
    }

    [Fact]
    public async Task Create_SegundaFase_OrdemIncrementa()
    {
        var (_, svc) = CriarServico();
        var projetoId = NewProjetoId();

        await svc.CreateAsync(projetoId, new FaseProcessoRequest("Triagem"), CancellationToken.None);
        var segunda = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Entrevista"), CancellationToken.None);

        Assert.Equal(1, segunda.Ordem);
    }

    [Fact]
    public async Task Create_NomeComEspacos_ETrimmado()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(NewProjetoId(), new FaseProcessoRequest("  Teste  "), CancellationToken.None);

        Assert.Equal("Teste", result.Nome);
    }

    [Fact]
    public async Task Create_ResponsavelTipoGestor_PersisteCampo()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(NewProjetoId(),
            new FaseProcessoRequest("Entrevista Gestor", ResponsavelFaseTipo.Gestor),
            CancellationToken.None);

        Assert.Equal(ResponsavelFaseTipo.Gestor, result.ResponsavelTipo);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaCampos()
    {
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(NewProjetoId(), new FaseProcessoRequest("Original"), CancellationToken.None);

        var result = await svc.UpdateAsync(created.Id,
            new FaseProcessoRequest("Atualizado", ResponsavelFaseTipo.Gestor),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Atualizado", result.Nome);
        Assert.Equal(ResponsavelFaseTipo.Gestor, result.ResponsavelTipo);
    }

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateAsync(Guid.NewGuid(), new FaseProcessoRequest("Teste"), CancellationToken.None);

        Assert.Null(result);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RetornaTrue()
    {
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(NewProjetoId(), new FaseProcessoRequest("Para Deletar"), CancellationToken.None);

        var result = await svc.DeleteAsync(created.Id, CancellationToken.None);

        Assert.True(result);
        var lista = await svc.ListAsync(created.ProjetoId, CancellationToken.None);
        Assert.Empty(lista);
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task Delete_ComCandidatosNaFase_MoveParaFaseNull()
    {
        var (db, svc) = CriarServico();
        var projetoId = NewProjetoId();
        var fase = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Triagem"), CancellationToken.None);

        // Seed ProjetoCandidato na fase (InMemory não valida FK constraints)
        var pc = new ProjetoCandidato
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            ProjetoId = projetoId,
            CandidatoId = Guid.NewGuid(),
            FaseAtualId = fase.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.ProjetoCandidatos.Add(pc);
        await db.SaveChangesAsync();

        await svc.DeleteAsync(fase.Id, CancellationToken.None);

        var pcAtualizado = await db.ProjetoCandidatos.FindAsync(pc.Id);
        Assert.NotNull(pcAtualizado);
        Assert.Null(pcAtualizado.FaseAtualId);
    }

    // ── Reorder ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Reorder_ListaOrdenada_AtualizaOrdem()
    {
        var (_, svc) = CriarServico();
        var projetoId = NewProjetoId();

        var f1 = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Triagem"), CancellationToken.None);
        var f2 = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Entrevista"), CancellationToken.None);
        var f3 = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Proposta"), CancellationToken.None);

        // Inverte: Proposta=0, Entrevista=1, Triagem=2
        await svc.ReorderAsync(projetoId, [f3.Id, f2.Id, f1.Id], CancellationToken.None);

        var lista = await svc.ListAsync(projetoId, CancellationToken.None);
        Assert.Equal("Proposta", lista[0].Nome);
        Assert.Equal("Entrevista", lista[1].Nome);
        Assert.Equal("Triagem", lista[2].Nome);
    }

    // ── MoverCandidato ────────────────────────────────────────────────────────

    [Fact]
    public async Task MoverCandidato_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.MoverCandidatoAsync(Guid.NewGuid(),
            new MoverCandidatoRequest(Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task MoverCandidato_IdExistente_AtualizaFase()
    {
        var (db, svc) = CriarServico();
        var projetoId = NewProjetoId();

        var faseOrigem = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Triagem"), CancellationToken.None);
        var faseDestino = await svc.CreateAsync(projetoId, new FaseProcessoRequest("Entrevista"), CancellationToken.None);

        var pc = new ProjetoCandidato
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            ProjetoId = projetoId,
            CandidatoId = Guid.NewGuid(),
            FaseAtualId = faseOrigem.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.ProjetoCandidatos.Add(pc);
        await db.SaveChangesAsync();

        var result = await svc.MoverCandidatoAsync(pc.Id,
            new MoverCandidatoRequest(faseDestino.Id),
            CancellationToken.None);

        Assert.True(result);
        var pcAtualizado = await db.ProjetoCandidatos.FindAsync(pc.Id);
        Assert.Equal(faseDestino.Id, pcAtualizado!.FaseAtualId);
    }
}
