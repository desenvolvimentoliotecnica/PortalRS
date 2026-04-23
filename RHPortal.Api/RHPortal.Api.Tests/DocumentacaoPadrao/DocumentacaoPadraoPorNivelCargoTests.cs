using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.DocumentacaoPadrao;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.DocumentacaoPadrao;

/// <summary>
/// Fase 3F — Onboarding por Cargo Macro.
/// Overrides por NivelCargo sobrepõem o padrão global do tenant, com fallback automático
/// quando um tipo de documento não tem override.
/// </summary>
public sealed class DocumentacaoPadraoPorNivelCargoTests
{
    private const string TenantTeste = "tenant-docs-nivel";

    private static (AppDbContext Db, DocumentacaoPadraoService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(options, tenantMock.Object);

        var service = new DocumentacaoPadraoService(db, tenantMock.Object);
        return (db, service);
    }

    private static Guid SeedNivelCargo(AppDbContext db, string nome = "Júnior", int cdn = 10)
    {
        var n = new NivelCargo
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CdnNivCargo = cdn,
            NomReduz = nome.Length > 6 ? nome[..6] : nome,
            NomComplet = nome,
        };
        db.NiveisCargo.Add(n);
        db.SaveChanges();
        return n.Id;
    }

    private static void SeedConfigGlobal(AppDbContext db, short tipo, short configuracao)
    {
        db.DocumentacaoPadraoConfigs.Add(new DocumentacaoPadraoConfig
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            TipoDocumento = tipo,
            Configuracao = configuracao,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task GetByNivelCargo_NivelInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();
        var r = await svc.GetByNivelCargoAsync(Guid.NewGuid(), default);
        Assert.Null(r);
    }

    [Fact]
    public async Task GetByNivelCargo_SemOverride_UsaGlobal()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // RG obrigatório
        SeedConfigGlobal(db, tipo: 1, configuracao: 1); // CPF opcional

        var r = await svc.GetByNivelCargoAsync(nivelId, default);

        Assert.NotNull(r);
        var rg = r!.Documentos.Single(x => x.TipoDocumento == 0);
        Assert.Equal((short)0, rg.Configuracao);
        Assert.False(rg.OverrideAtivo);

        var cpf = r.Documentos.Single(x => x.TipoDocumento == 1);
        Assert.Equal((short)1, cpf.Configuracao);
        Assert.False(cpf.OverrideAtivo);
    }

    [Fact]
    public async Task GetByNivelCargo_ComOverride_SobrepoeGlobal()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db, "Gerente");
        SeedConfigGlobal(db, tipo: 0, configuracao: 1); // global: RG opcional

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var r = await svc.GetByNivelCargoAsync(nivelId, default);
        var rg = r!.Documentos.Single(x => x.TipoDocumento == 0);

        Assert.Equal((short)0, rg.Configuracao);
        Assert.True(rg.OverrideAtivo);
    }

    [Fact]
    public async Task GetByNivelCargo_SemGlobalNemOverride_UsaPadraoNaoPedido()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        var r = await svc.GetByNivelCargoAsync(nivelId, default);

        Assert.NotNull(r);
        Assert.All(r!.Documentos, d => Assert.Equal((short)2, d.Configuracao));
        Assert.All(r.Documentos, d => Assert.False(d.OverrideAtivo));
    }

    [Fact]
    public async Task Save_CriaOverridesNovos()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos =
            [
                new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 },
                new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 },
            ],
        }, default);

        var overrides = db.DocumentacaoPadraoPorNivelCargoConfigs.ToList();
        Assert.Equal(2, overrides.Count);
        Assert.All(overrides, o => Assert.Equal(nivelId, o.NivelCargoId));
        Assert.All(overrides, o => Assert.Equal(TenantTeste, o.TenantId));
    }

    [Fact]
    public async Task Save_AtualizaExistente()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var only = db.DocumentacaoPadraoPorNivelCargoConfigs.Single();
        Assert.Equal((short)1, only.Configuracao);
    }

    [Fact]
    public async Task Save_RemoveOverridesAusentesNoPayload()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos =
            [
                new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 },
                new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 },
            ],
        }, default);

        // Segundo save mantém só o tipo 0 → tipo 1 deve ser removido.
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var restantes = db.DocumentacaoPadraoPorNivelCargoConfigs.ToList();
        Assert.Single(restantes);
        Assert.Equal((short)0, restantes[0].TipoDocumento);
    }

    [Fact]
    public async Task Save_NivelInexistente_LancaErro()
    {
        var (_, svc) = CriarServico();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SaveByNivelCargoAsync(Guid.NewGuid(), new SalvarDocumentacaoPadraoPorNivelRequest
            {
                Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
            }, default));
    }

    [Fact]
    public async Task Save_PayloadVazio_LimpaTodosOverrides()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [],
        }, default);

        Assert.Empty(db.DocumentacaoPadraoPorNivelCargoConfigs.ToList());
    }

    [Fact]
    public async Task GetTiposEfetivos_SemNivel_RetornaApenasGlobal()
    {
        var (db, svc) = CriarServico();
        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // obrigatório
        SeedConfigGlobal(db, tipo: 1, configuracao: 2); // não pedido (filtrado)
        SeedConfigGlobal(db, tipo: 2, configuracao: 1); // opcional

        var r = await svc.GetTiposEfetivosAsync(null, null, default);

        Assert.Equal(2, r.Count);
        Assert.Contains(r, x => x.TipoDocumento == 0 && x.Obrigatorio);
        Assert.Contains(r, x => x.TipoDocumento == 2 && !x.Obrigatorio);
    }

    [Fact]
    public async Task GetTiposEfetivos_ComOverride_PrevaleceSobreGlobal()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // obrigatório
        SeedConfigGlobal(db, tipo: 1, configuracao: 0); // obrigatório

        // Override torna tipo 0 opcional e tipo 1 não pedido.
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos =
            [
                new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 },
                new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 2 },
            ],
        }, default);

        var r = await svc.GetTiposEfetivosAsync(nivelId, null, default);

        // tipo 1 saiu (Configuracao=2 "Não pedido" é filtrado).
        Assert.Single(r);
        Assert.Equal((short)0, r[0].TipoDocumento);
        Assert.False(r[0].Obrigatorio);
    }

    [Fact]
    public async Task GetTiposEfetivos_MesclaOverrideComGlobal()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);

        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // RG obrigatório (global)
        SeedConfigGlobal(db, tipo: 1, configuracao: 0); // CPF obrigatório (global)

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 }],
        }, default);

        var r = await svc.GetTiposEfetivosAsync(nivelId, null, default);

        // RG continua vindo do global; CPF vem do override.
        Assert.Equal(2, r.Count);
        Assert.Contains(r, x => x.TipoDocumento == 0 && x.Obrigatorio); // global
        Assert.Contains(r, x => x.TipoDocumento == 1 && !x.Obrigatorio); // override
    }

    [Fact]
    public async Task GetByNivelCargo_DoisNiveis_NaoVazamOverrides()
    {
        var (db, svc) = CriarServico();
        var junior = SeedNivelCargo(db, "Junior", 10);
        var senior = SeedNivelCargo(db, "Sênior", 30);

        await svc.SaveByNivelCargoAsync(junior, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var rJunior = await svc.GetByNivelCargoAsync(junior, default);
        var rSenior = await svc.GetByNivelCargoAsync(senior, default);

        Assert.True(rJunior!.Documentos.Single(x => x.TipoDocumento == 0).OverrideAtivo);
        Assert.False(rSenior!.Documentos.Single(x => x.TipoDocumento == 0).OverrideAtivo);
    }
}
