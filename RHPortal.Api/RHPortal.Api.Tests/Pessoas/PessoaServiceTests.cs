using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.Pessoas;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Pessoas;

/// <summary>
/// Testes do PessoaService — CRUD, GetOrCreateByEmail, FindByEmail/Cpf
/// e listagem com busca e paginação.
/// </summary>
public sealed class PessoaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, PessoaService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new PessoaService(db, tenantMock.Object);
        return (db, service);
    }

    private static PessoaCreateRequest RequestMinimo(
        string nome = "Pessoa Teste",
        string email = "pessoa@empresa.com") =>
        new(nome, email, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, OrigemPessoa.Manual);

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosValidos_RetornaPessoaPersistida()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo("João Silva", "joao@empresa.com"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("João Silva", result.Nome);
        Assert.Equal("joao@empresa.com", result.Email);
        Assert.Equal(OrigemPessoa.Manual, result.Origem);
    }

    [Fact]
    public async Task Create_EmailNormalizadoParaMinusculo()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo("Teste", "MAIUSCULO@EMPRESA.COM"), CancellationToken.None);

        Assert.Equal("maiusculo@empresa.com", result.Email);
    }

    [Fact]
    public async Task Create_CamposOpcionaisPreenchidos_SaoPersistidos()
    {
        var (_, svc) = CriarServico();

        var request = new PessoaCreateRequest(
            "Maria Completa", "maria@empresa.com",
            "11-99999-0000", "São Paulo", "SP",
            "https://linkedin.com/in/maria",
            "Desenvolvedora sênior com 10 anos de experiência",
            "Observação importante",
            "01310-100", "Av. Paulista", "1000", "Bela Vista", null,
            "529.982.247-25", "99999999", "11-88888-0000",
            new DateTime(1990, 5, 15, 0, 0, 0, DateTimeKind.Utc),
            OrigemPessoa.Talento);

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal("11-99999-0000", result.Fone);
        Assert.Equal("São Paulo", result.Cidade);
        Assert.Equal("SP", result.Uf);
        Assert.Equal("529.982.247-25", result.Cpf);
        Assert.Equal(OrigemPessoa.Talento, result.Origem);
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

        var created = await svc.CreateAsync(RequestMinimo("Nome Teste", "getbyid@empresa.com"), CancellationToken.None);

        var result = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result.Id);
        Assert.Equal("getbyid@empresa.com", result.Email);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var request = new PessoaUpdateRequest("Novo", "novo@empresa.com", null, null, null,
            null, null, null, null, null, null, null, null, null, null, null);

        var result = await svc.UpdateAsync(Guid.NewGuid(), request, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_IdExistente_AtualizaCampos()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("Original", "upd@empresa.com"), CancellationToken.None);

        var request = new PessoaUpdateRequest(
            "Atualizado", "upd@empresa.com", "11-77777-0000",
            "Rio de Janeiro", "RJ", null, null, null,
            null, null, null, null, null, null, null, null,
            null, OrigemPessoa.Candidatura);

        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Atualizado", result.Nome);
        Assert.Equal("11-77777-0000", result.Fone);
        Assert.Equal("Rio de Janeiro", result.Cidade);
        Assert.Equal(OrigemPessoa.Candidatura, result.Origem);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo("Del", "del@empresa.com"), CancellationToken.None);

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

    // ── FindByEmail ───────────────────────────────────────────────────────────

    [Fact]
    public async Task FindByEmail_EmailInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.FindByEmailAsync("naoexiste@empresa.com", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task FindByEmail_EmailExistente_RetornaPessoa()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("Fulano", "fulano@empresa.com"), CancellationToken.None);

        var result = await svc.FindByEmailAsync("fulano@empresa.com", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("fulano@empresa.com", result.Email);
    }

    [Fact]
    public async Task FindByEmail_EmailVazio_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.FindByEmailAsync("   ", CancellationToken.None);

        Assert.Null(result);
    }

    // ── GetOrCreateByEmail ────────────────────────────────────────────────────

    [Fact]
    public async Task GetOrCreate_EmailNovo_CriaNovaPessoa()
    {
        var (_, svc) = CriarServico();

        var result = await svc.GetOrCreateByEmailAsync(
            "novo@empresa.com", "Novo Funcionario", null, null, null, null, null, null,
            OrigemPessoa.Funcionario, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("novo@empresa.com", result.Email);
        Assert.Equal(OrigemPessoa.Funcionario, result.Origem);
    }

    [Fact]
    public async Task GetOrCreate_EmailExistente_RetornaExistente()
    {
        var (_, svc) = CriarServico();

        var primeiro = await svc.GetOrCreateByEmailAsync(
            "existe@empresa.com", "Primeiro", null, null, null, null, null, null,
            OrigemPessoa.Manual, CancellationToken.None);

        var segundo = await svc.GetOrCreateByEmailAsync(
            "existe@empresa.com", "Atualizado", "11-99999-0000", null, null, null, null, null,
            OrigemPessoa.Manual, CancellationToken.None);

        // Deve retornar a mesma entidade, não criar nova
        Assert.Equal(primeiro.Id, segundo.Id);
        // E atualizar o nome
        Assert.Equal("Atualizado", segundo.Nome);
    }

    [Fact]
    public async Task GetOrCreate_EmailVazio_LancaArgumentException()
    {
        var (_, svc) = CriarServico();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.GetOrCreateByEmailAsync(
                "   ", null, null, null, null, null, null, null,
                OrigemPessoa.Manual, CancellationToken.None));
    }

    // ── FindByCpf ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task FindByCpf_CpfInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.FindByCpfAsync("529.982.247-25", CancellationToken.None);

        Assert.Null(result);
    }

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemFiltro_RetornaTodasPessoas()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("Ana", "ana@empresa.com"), CancellationToken.None);
        await svc.CreateAsync(RequestMinimo("Bruno", "bruno@empresa.com"), CancellationToken.None);

        var result = await svc.ListAsync(new PessoaListQuery(null), CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task List_ComFiltroNome_RetornaApenasCorrespondentes()
    {
        var (_, svc) = CriarServico();

        await svc.CreateAsync(RequestMinimo("Carlos Único", "carlos@empresa.com"), CancellationToken.None);
        await svc.CreateAsync(RequestMinimo("Daniela", "daniela@empresa.com"), CancellationToken.None);

        var result = await svc.ListAsync(new PessoaListQuery("Carlos"), CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        Assert.Equal("carlos@empresa.com", result.Items[0].Email);
    }
}
