using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Metas;
using RhPortal.Api.Contracts.Metas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Metas;

/// <summary>
/// Testes do MetaService — CRUD completo, atualização de progresso (com auto-conclusão),
/// cancelamento e listagens por funcionário e equipe.
/// </summary>
public sealed class MetaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, MetaService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new MetaService(db);
        return (db, service);
    }

    /// <summary>
    /// Semeia um Funcionario — obrigatório pois Meta.FuncionarioId e CriadaPorId são
    /// Guid não-nulável e CreateAsync usa Include com InMemory (inner join).
    /// </summary>
    private static Guid SeedFuncionario(AppDbContext db, string email = "func@empresa.com")
    {
        var funcionario = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Name = "Funcionário Teste",
            Email = email,
        };
        db.Funcionarios.Add(funcionario);
        db.SaveChanges();
        return funcionario.Id;
    }

    private static MetaCreateRequest RequestMinimo(Guid funcionarioId, string titulo = "Aumentar vendas") =>
        new(funcionarioId, titulo, null, 100m, "unidades", null);

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaMetaAtiva()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var result = await svc.CreateAsync(RequestMinimo(funcId, "Meta de Vendas"), funcId, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Meta de Vendas", result.Titulo);
        Assert.Equal(100m, result.ValorMeta);
        Assert.Equal(0m, result.ValorAtual);
        Assert.Equal(MetaStatus.Ativa, result.Status);
        Assert.Equal(0m, result.PercentualConcluido);
    }

    [Fact]
    public async Task Create_ComDescricaoEPrazo_PersisteCampos()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var prazo = new DateOnly(2026, 12, 31);
        var request = new MetaCreateRequest(funcId, "Meta Completa", "Descrição detalhada", 50m, "pontos", prazo);

        var result = await svc.CreateAsync(request, funcId, CancellationToken.None);

        Assert.Equal("Descrição detalhada", result.Descricao);
        Assert.Equal(prazo, result.Prazo);
        Assert.Equal("pontos", result.Unidade);
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
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId, "Meta BUS"), funcId, CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("Meta BUS", result.Titulo);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaCampos()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId, "Original"), funcId, CancellationToken.None);

        var request = new MetaUpdateRequest("Atualizado", "Nova descrição", 200m, "itens", null);
        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.Equal("Atualizado", result.Titulo);
        Assert.Equal("Nova descrição", result.Descricao);
        Assert.Equal(200m, result.ValorMeta);
        Assert.Equal("itens", result.Unidade);
    }

    // ── Progresso ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task AtualizarProgresso_ValorAbaixoDaMeta_MantemAtiva()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId), funcId, CancellationToken.None);

        var result = await svc.AtualizarProgressoAsync(created.Id, 50m, CancellationToken.None);

        Assert.Equal(50m, result.ValorAtual);
        Assert.Equal(MetaStatus.Ativa, result.Status);
        Assert.Equal(50m, result.PercentualConcluido);
    }

    [Fact]
    public async Task AtualizarProgresso_ValorAtingeMeta_MudaParaConcluida()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId), funcId, CancellationToken.None);

        var result = await svc.AtualizarProgressoAsync(created.Id, 100m, CancellationToken.None);

        Assert.Equal(MetaStatus.Concluida, result.Status);
        Assert.Equal(100m, result.PercentualConcluido);
    }

    [Fact]
    public async Task AtualizarProgresso_ValorAcimaDoTeto_LimitaPercentualEm100()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId), funcId, CancellationToken.None);

        var result = await svc.AtualizarProgressoAsync(created.Id, 150m, CancellationToken.None);

        // Percentual é limitado a 100 no ToResponse
        Assert.Equal(100m, result.PercentualConcluido);
    }

    // ── Cancelar ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Cancelar_MetaAtiva_MudaParaCancelada()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId), funcId, CancellationToken.None);

        await svc.CancelarAsync(created.Id, CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);
        Assert.NotNull(result);
        Assert.Equal(MetaStatus.Cancelada, result.Status);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveMeta()
    {
        var (db, svc) = CriarServico();
        var funcId = SeedFuncionario(db);

        var created = await svc.CreateAsync(RequestMinimo(funcId), funcId, CancellationToken.None);

        await svc.DeleteAsync(created.Id, CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);
        Assert.Null(result);
    }

    // ── Listagem por Funcionário ───────────────────────────────────────────────

    [Fact]
    public async Task ListByFuncionario_SemMetas_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListByFuncionarioAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ListByFuncionario_ComMetas_RetornaApenasDoFuncionario()
    {
        var (db, svc) = CriarServico();
        var func1 = SeedFuncionario(db, "f1@empresa.com");
        var func2 = SeedFuncionario(db, "f2@empresa.com");

        await svc.CreateAsync(RequestMinimo(func1, "Meta F1-1"), func1, CancellationToken.None);
        await svc.CreateAsync(RequestMinimo(func1, "Meta F1-2"), func1, CancellationToken.None);
        await svc.CreateAsync(RequestMinimo(func2, "Meta F2-1"), func2, CancellationToken.None);

        var result = await svc.ListByFuncionarioAsync(func1, CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.All(result, m => Assert.Equal(func1, m.FuncionarioId));
    }

    // ── Listagem da Equipe ────────────────────────────────────────────────────

    [Fact]
    public async Task ListMinhaEquipe_SemSubordinados_RetornaListaVazia()
    {
        var (db, svc) = CriarServico();
        var gestorId = SeedFuncionario(db, "gestor@empresa.com");

        var result = await svc.ListMinhaEquipeAsync(gestorId, CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ListMinhaEquipe_ComSubordinados_RetornaMetasDosSubordinados()
    {
        var (db, svc) = CriarServico();
        var gestorId = SeedFuncionario(db, "gestor@empresa.com");

        // Subordinado com gestor vinculado
        var subordinado = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Name = "Subordinado",
            Email = "sub@empresa.com",
            GestorDiretoId = gestorId
        };
        db.Funcionarios.Add(subordinado);
        db.SaveChanges();

        await svc.CreateAsync(RequestMinimo(subordinado.Id, "Meta do Sub"), subordinado.Id, CancellationToken.None);

        var result = await svc.ListMinhaEquipeAsync(gestorId, CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(subordinado.Id, result[0].FuncionarioId);
    }
}
