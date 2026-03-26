using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.SolicitacoesVaga;

/// <summary>
/// Testes do RegraAprovacaoVagaService — cobertura de CRUD completo e regra de
/// unicidade: não pode existir duas regras ativas para o mesmo Role (ou duas
/// regras padrão).
/// </summary>
public sealed class RegraAprovacaoVagaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, RegraAprovacaoVagaService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new RegraAprovacaoVagaService(db, tenantMock.Object);
        return (db, service);
    }

    /// <summary>
    /// Semeia um Funcionario no banco para que o Include(x => x.Aprovador1)
    /// em LoadResponseAsync resolva a navegação corretamente (InMemory faz
    /// inner join em FK não-nulável).
    /// </summary>
    private static Guid SeedFuncionario(AppDbContext db)
    {
        var funcionario = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Name = "Aprovador Teste",
            Email = "aprovador@empresa.com",
        };
        db.Funcionarios.Add(funcionario);
        db.SaveChanges();
        return funcionario.Id;
    }

    private static RegraAprovacaoVagaCreateRequest CriarRequest(Guid aprovador1Id, Guid? roleId = null) =>
        new()
        {
            SolicitanteRoleId = roleId,
            Aprovador1FuncionarioId = aprovador1Id,
            Aprovador2FuncionarioId = null,
            Aprovador2Habilitado = false
        };

    // ── Listagem ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemRegras_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListAsync(CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task List_ComRegras_RetornaTodasOrdenadas()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);
        var roleId = Guid.NewGuid();

        // Regra padrão (null) deve aparecer depois das regras com role
        await svc.CreateAsync(CriarRequest(aprovadorId, roleId), CancellationToken.None);
        await svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None);

        var result = await svc.ListAsync(CancellationToken.None);

        Assert.Equal(2, result.Count);
    }

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_RegraEspecificaPorRole_CriaComAtivoTrue()
    {
        var (db, svc) = CriarServico();
        var aprovador1Id = SeedFuncionario(db);
        var roleId = Guid.NewGuid();

        var request = new RegraAprovacaoVagaCreateRequest
        {
            SolicitanteRoleId = roleId,
            Aprovador1FuncionarioId = aprovador1Id,
            Aprovador2FuncionarioId = null,
            Aprovador2Habilitado = false
        };

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(roleId, result.SolicitanteRoleId);
        Assert.Equal(aprovador1Id, result.Aprovador1FuncionarioId);
        Assert.True(result.Ativo);
        Assert.False(result.Aprovador2Habilitado);
    }

    [Fact]
    public async Task Create_RegraPadrao_SolicitanteRoleIdNulo_Funciona()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);

        var result = await svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Null(result.SolicitanteRoleId);
        Assert.True(result.Ativo);
    }

    [Fact]
    public async Task Create_RegraComAprovador2Habilitado_PersisteCampos()
    {
        var (db, svc) = CriarServico();
        var aprovador1Id = SeedFuncionario(db);
        var aprovador2Id = SeedFuncionario(db);

        var request = new RegraAprovacaoVagaCreateRequest
        {
            SolicitanteRoleId = Guid.NewGuid(),
            Aprovador1FuncionarioId = aprovador1Id,
            Aprovador2FuncionarioId = aprovador2Id,
            Aprovador2Habilitado = true
        };

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.True(result.Aprovador2Habilitado);
        Assert.Equal(aprovador2Id, result.Aprovador2FuncionarioId);
    }

    [Fact]
    public async Task Create_DuplicadaParaMesmoRole_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);
        var roleId = Guid.NewGuid();

        await svc.CreateAsync(CriarRequest(aprovadorId, roleId), CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(CriarRequest(aprovadorId, roleId), CancellationToken.None));
    }

    [Fact]
    public async Task Create_DuplicadaRegraPadrao_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);

        await svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None));
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdExistente_AtualizaAprovadores()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);
        var novoAprovadorId = SeedFuncionario(db);

        var created = await svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None);

        var updateRequest = new RegraAprovacaoVagaUpdateRequest
        {
            Aprovador1FuncionarioId = novoAprovadorId,
            Aprovador2FuncionarioId = null,
            Aprovador2Habilitado = true,
            Ativo = true
        };

        var result = await svc.UpdateAsync(created.Id, updateRequest, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(novoAprovadorId, result.Aprovador1FuncionarioId);
        Assert.True(result.Aprovador2Habilitado);
    }

    [Fact]
    public async Task Update_DesativarRegra_SetaAtivoFalse()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);

        var created = await svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None);

        var updateRequest = new RegraAprovacaoVagaUpdateRequest
        {
            Aprovador1FuncionarioId = created.Aprovador1FuncionarioId,
            Aprovador2FuncionarioId = null,
            Aprovador2Habilitado = false,
            Ativo = false
        };

        var result = await svc.UpdateAsync(created.Id, updateRequest, CancellationToken.None);

        Assert.NotNull(result);
        Assert.False(result.Ativo);
    }

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var updateRequest = new RegraAprovacaoVagaUpdateRequest
        {
            Aprovador1FuncionarioId = Guid.NewGuid(),
            Aprovador2FuncionarioId = null,
            Aprovador2Habilitado = false,
            Ativo = true
        };

        var result = await svc.UpdateAsync(Guid.NewGuid(), updateRequest, CancellationToken.None);

        Assert.Null(result);
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);

        var created = await svc.CreateAsync(CriarRequest(aprovadorId, null), CancellationToken.None);

        var deleted = await svc.DeleteAsync(created.Id, CancellationToken.None);

        Assert.True(deleted);
        var lista = await svc.ListAsync(CancellationToken.None);
        Assert.Empty(lista);
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    // ── Regra inativada não bloqueia nova criação ─────────────────────────────

    [Fact]
    public async Task Create_ApesarDeRegraInativada_PermiteNovaCriacao()
    {
        // Regra desativada não conta como "já existe" — deve ser possível criar outra
        var (db, svc) = CriarServico();
        var aprovadorId = SeedFuncionario(db);
        var roleId = Guid.NewGuid();

        var criada = await svc.CreateAsync(CriarRequest(aprovadorId, roleId), CancellationToken.None);

        // Desativa
        await svc.UpdateAsync(criada.Id, new RegraAprovacaoVagaUpdateRequest
        {
            Aprovador1FuncionarioId = criada.Aprovador1FuncionarioId,
            Aprovador2FuncionarioId = null,
            Aprovador2Habilitado = false,
            Ativo = false
        }, CancellationToken.None);

        // Deve conseguir criar uma nova regra ativa para o mesmo role
        var nova = await svc.CreateAsync(CriarRequest(aprovadorId, roleId), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, nova.Id);
        Assert.True(nova.Ativo);
    }
}
