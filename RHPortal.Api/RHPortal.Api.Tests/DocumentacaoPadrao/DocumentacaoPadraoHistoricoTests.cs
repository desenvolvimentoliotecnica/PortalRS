using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.DocumentacaoPadrao;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.DocumentacaoPadrao;

/// <summary>
/// Cobre a Onda 6 — histórico de alterações da documentação padrão.
/// Garante que SaveAsync (global) e SaveByNivelCargoAsync (por nível)
/// registram entradas em <see cref="DocumentacaoPadraoHistorico"/> com UserId/UserNome
/// e que <c>ListarHistoricoAsync</c> filtra e pagina corretamente.
/// </summary>
public sealed class DocumentacaoPadraoHistoricoTests
{
    private const string TenantTeste = "tenant-docs-historico";

    private sealed class FakeCurrentUser : ICurrentUserContext
    {
        public Guid? UserId { get; init; }
        public string? Email { get; init; }
        public bool IsAuthenticated => UserId is not null;
        public bool IsInRole(string role) => false;
        public bool IsAdmin => false;
        public bool IsRH => false;
        public bool IsOwner => false;
        public Guid? FuncionarioId => null;
        // 31.2: Area foi absorvido por CentroCusto; o mesmo escopo organizacional que
        // antes era "área" agora é representado pelo Centro de Custo do funcionário.
        public Guid? CentroCustoId => null;
        public bool IsGestorWithCentroCusto => false;
        public IReadOnlyList<Guid> UnitIds => [];
        public ProfileVisibilityScope VisibilityScope => ProfileVisibilityScope.FullStructure;
        public VagasDataScope VagasDataScope => VagasDataScope.All;
        public bool IsReadOnly => false;
        public bool HasPermission(string permissionKey) => false;
    }

    private static (AppDbContext Db, DocumentacaoPadraoService Service, FakeCurrentUser User) CriarServicoComUser()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(options, tenantMock.Object);

        var user = new FakeCurrentUser
        {
            UserId = Guid.NewGuid(),
            Email = "admin@teste.com",
        };

        var service = new DocumentacaoPadraoService(db, tenantMock.Object, user);
        return (db, service, user);
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

    [Fact]
    public async Task SaveGlobal_NovaConfig_RegistraAcaoCriado()
    {
        var (db, svc, user) = CriarServicoComUser();

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var entradas = db.DocumentacaoPadraoHistoricos.ToList();
        Assert.Single(entradas);
        var e = entradas[0];
        Assert.Equal(DocumentacaoPadraoEscopo.Global, e.Escopo);
        Assert.Null(e.NivelCargoId);
        Assert.Equal((short)0, e.TipoDocumento);
        Assert.Null(e.ConfiguracaoAnterior);
        Assert.Equal((short)0, e.ConfiguracaoNova);
        Assert.Equal(DocumentacaoPadraoAcao.Criado, e.Acao);
        Assert.Equal(user.UserId, e.UserId);
        Assert.Equal("admin@teste.com", e.UserNome);
    }

    [Fact]
    public async Task SaveGlobal_AlteraValorExistente_RegistraAcaoAlterado()
    {
        var (db, svc, _) = CriarServicoComUser();

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var entradas = db.DocumentacaoPadraoHistoricos
            .OrderBy(x => x.CriadoEmUtc)
            .ToList();
        Assert.Equal(2, entradas.Count);
        Assert.Equal(DocumentacaoPadraoAcao.Criado, entradas[0].Acao);
        Assert.Equal(DocumentacaoPadraoAcao.Alterado, entradas[1].Acao);
        Assert.Equal((short)0, entradas[1].ConfiguracaoAnterior);
        Assert.Equal((short)1, entradas[1].ConfiguracaoNova);
    }

    [Fact]
    public async Task SaveGlobal_ValorIgualAoExistente_NaoRegistraHistorico()
    {
        var (db, svc, _) = CriarServicoComUser();

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        // 1 Criado + nenhum Alterado (valor não mudou).
        Assert.Single(db.DocumentacaoPadraoHistoricos.ToList());
    }

    [Fact]
    public async Task SavePorNivel_NovoOverride_RegistraAcaoCriado()
    {
        var (db, svc, user) = CriarServicoComUser();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var entradas = db.DocumentacaoPadraoHistoricos.ToList();
        Assert.Single(entradas);
        var e = entradas[0];
        Assert.Equal(DocumentacaoPadraoEscopo.PorNivelCargo, e.Escopo);
        Assert.Equal(nivelId, e.NivelCargoId);
        Assert.Equal(DocumentacaoPadraoAcao.Criado, e.Acao);
        Assert.Null(e.ConfiguracaoAnterior);
        Assert.Equal((short)1, e.ConfiguracaoNova);
        Assert.Equal(user.UserId, e.UserId);
    }

    [Fact]
    public async Task SavePorNivel_RemoveOverrideAusente_RegistraAcaoRemovido()
    {
        var (db, svc, _) = CriarServicoComUser();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos =
            [
                new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 },
                new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 },
            ],
        }, default);

        // Segundo save mantém só o tipo 0 → tipo 1 é removido.
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var removidos = db.DocumentacaoPadraoHistoricos
            .Where(x => x.Acao == DocumentacaoPadraoAcao.Removido)
            .ToList();
        Assert.Single(removidos);
        var r = removidos[0];
        Assert.Equal((short)1, r.TipoDocumento);
        Assert.Equal((short)1, r.ConfiguracaoAnterior);
        Assert.Null(r.ConfiguracaoNova);
    }

    [Fact]
    public async Task SavePorNivel_AlteraValorOverride_RegistraAcaoAlterado()
    {
        var (db, svc, _) = CriarServicoComUser();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var alterados = db.DocumentacaoPadraoHistoricos
            .Where(x => x.Acao == DocumentacaoPadraoAcao.Alterado)
            .ToList();
        Assert.Single(alterados);
        Assert.Equal((short)0, alterados[0].ConfiguracaoAnterior);
        Assert.Equal((short)1, alterados[0].ConfiguracaoNova);
    }

    [Fact]
    public async Task ListarHistorico_FiltraEscopo()
    {
        var (db, svc, _) = CriarServicoComUser();
        var nivelId = SeedNivelCargo(db);

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 }],
        }, default);

        var resGlobal = await svc.ListarHistoricoAsync(DocumentacaoPadraoEscopo.Global, null, null, 1, 50, default);
        var resNivel = await svc.ListarHistoricoAsync(DocumentacaoPadraoEscopo.PorNivelCargo, null, null, 1, 50, default);

        Assert.Single(resGlobal.Items);
        Assert.Equal(DocumentacaoPadraoEscopo.Global, resGlobal.Items[0].Escopo);

        Assert.Single(resNivel.Items);
        Assert.Equal(DocumentacaoPadraoEscopo.PorNivelCargo, resNivel.Items[0].Escopo);
        Assert.Equal(nivelId, resNivel.Items[0].NivelCargoId);
    }

    [Fact]
    public async Task ListarHistorico_FiltraNivelCargo()
    {
        var (db, svc, _) = CriarServicoComUser();
        var junior = SeedNivelCargo(db, "Júnior", 10);
        var senior = SeedNivelCargo(db, "Sênior", 30);

        await svc.SaveByNivelCargoAsync(junior, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await svc.SaveByNivelCargoAsync(senior, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 }],
        }, default);

        var r = await svc.ListarHistoricoAsync(null, junior, null, 1, 50, default);

        Assert.Single(r.Items);
        Assert.Equal(junior, r.Items[0].NivelCargoId);
    }

    [Fact]
    public async Task ListarHistorico_Paginacao_ClampaPageSize()
    {
        var (db, svc, _) = CriarServicoComUser();

        for (short t = 0; t < 3; t++)
        {
            await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
            {
                Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = t, Configuracao = 0 }],
            }, default);
        }

        var r = await svc.ListarHistoricoAsync(null, null, null, page: 1, pageSize: 2, default);

        Assert.Equal(3, r.Total);
        Assert.Equal(2, r.Items.Count);
        Assert.Equal(1, r.Page);
        Assert.Equal(2, r.PageSize);
        Assert.Equal(2, r.TotalPages);
    }

    [Fact]
    public async Task ListarHistorico_OrdenaPorCriadoEmUtcDesc()
    {
        var (db, svc, _) = CriarServicoComUser();

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        await Task.Delay(5);

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 0 }],
        }, default);

        var r = await svc.ListarHistoricoAsync(null, null, null, 1, 50, default);

        Assert.Equal(2, r.Items.Count);
        // Mais recente primeiro
        Assert.True(r.Items[0].CriadoEmUtc >= r.Items[1].CriadoEmUtc);
    }

    [Fact]
    public async Task ListarHistorico_TrazLabelDoTipoDocumento()
    {
        var (db, svc, _) = CriarServicoComUser();

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var r = await svc.ListarHistoricoAsync(null, null, null, 1, 50, default);

        Assert.Equal("RG", r.Items[0].TipoDocumentoLabel);
    }

    [Fact]
    public async Task ListarHistorico_TrazNomeDoNivelCargo()
    {
        var (db, svc, _) = CriarServicoComUser();
        var nivelId = SeedNivelCargo(db, "Gerente", 50);

        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var r = await svc.ListarHistoricoAsync(null, null, null, 1, 50, default);

        Assert.Single(r.Items);
        Assert.Equal("Gerente", r.Items[0].NivelCargoNome);
    }
}
