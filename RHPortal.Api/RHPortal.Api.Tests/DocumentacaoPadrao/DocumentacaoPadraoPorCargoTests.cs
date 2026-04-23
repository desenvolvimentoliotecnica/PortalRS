using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.DocumentacaoPadrao;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.DocumentacaoPadrao;

/// <summary>
/// Cobre a Onda 7 — override de documentos por Cargo específico (JobPosition).
/// Resolução hierárquica: Cargo (mais específico) → NivelCargo → Global.
/// </summary>
public sealed class DocumentacaoPadraoPorCargoTests
{
    private const string TenantTeste = "tenant-docs-cargo";

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
    }

    private static (AppDbContext Db, DocumentacaoPadraoService Service, FakeCurrentUser User) CriarServico()
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

    private static Guid SeedNivelCargo(AppDbContext db, string nome = "Sênior", int cdn = 30)
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

    private static Guid SeedJobPosition(AppDbContext db, string code = "CAR-001", string nome = "Engenheiro de Software", Guid? nivelCargoId = null)
    {
        var jp = new JobPosition
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = code,
            Name = nome,
            NivelCargoId = nivelCargoId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<JobPosition>().Add(jp);
        db.SaveChanges();
        return jp.Id;
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
    public async Task GetByCargo_CargoInexistente_RetornaNull()
    {
        var (_, svc, _) = CriarServico();
        var r = await svc.GetByCargoAsync(Guid.NewGuid(), default);
        Assert.Null(r);
    }

    [Fact]
    public async Task GetByCargo_SemOverride_UsaGlobal_OrigemGlobal()
    {
        var (db, svc, _) = CriarServico();
        var jp = SeedJobPosition(db);
        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // RG obrigatório

        var r = await svc.GetByCargoAsync(jp, default);

        Assert.NotNull(r);
        var rg = r!.Documentos.Single(x => x.TipoDocumento == 0);
        Assert.Equal((short)0, rg.Configuracao);
        Assert.False(rg.OverrideCargoAtivo);
        Assert.False(rg.OverrideNivelCargoAtivo);
        Assert.Equal("global", rg.Origem);
    }

    [Fact]
    public async Task GetByCargo_ApenasOverrideNivel_OrigemNivel()
    {
        var (db, svc, _) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jp = SeedJobPosition(db, nivelCargoId: nivelId);
        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // RG obrigatório global

        // Override por nível: RG opcional
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var r = await svc.GetByCargoAsync(jp, default);

        var rg = r!.Documentos.Single(x => x.TipoDocumento == 0);
        Assert.Equal((short)1, rg.Configuracao);
        Assert.False(rg.OverrideCargoAtivo);
        Assert.True(rg.OverrideNivelCargoAtivo);
        Assert.Equal("nivel", rg.Origem);
    }

    [Fact]
    public async Task GetByCargo_OverrideCargoVencesobreNivel_OrigemCargo()
    {
        var (db, svc, _) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jp = SeedJobPosition(db, nivelCargoId: nivelId);
        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // RG obrigatório global

        // Nível: RG opcional
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        // Cargo: RG não pedido (vence sobre nível)
        await svc.SaveByCargoAsync(jp, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 2 }],
        }, default);

        var r = await svc.GetByCargoAsync(jp, default);

        var rg = r!.Documentos.Single(x => x.TipoDocumento == 0);
        Assert.Equal((short)2, rg.Configuracao);
        Assert.True(rg.OverrideCargoAtivo);
        Assert.True(rg.OverrideNivelCargoAtivo);
        Assert.Equal("cargo", rg.Origem);
    }

    [Fact]
    public async Task SaveByCargo_RegistraHistoricoComEscopoPorCargo()
    {
        var (db, svc, user) = CriarServico();
        var jp = SeedJobPosition(db);

        await svc.SaveByCargoAsync(jp, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var entradas = db.DocumentacaoPadraoHistoricos.ToList();
        Assert.Single(entradas);
        var e = entradas[0];
        Assert.Equal(DocumentacaoPadraoEscopo.PorCargo, e.Escopo);
        Assert.Equal(jp, e.CargoId);
        Assert.Null(e.NivelCargoId);
        Assert.Equal(DocumentacaoPadraoAcao.Criado, e.Acao);
        Assert.Equal(user.UserId, e.UserId);
    }

    [Fact]
    public async Task SaveByCargo_RemoveOverrideAusente_RegistraAcaoRemovido()
    {
        var (db, svc, _) = CriarServico();
        var jp = SeedJobPosition(db);

        // Cria override
        await svc.SaveByCargoAsync(jp, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        // Salva sem o tipo 0 → deve remover (= voltar a herdar)
        await svc.SaveByCargoAsync(jp, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [],
        }, default);

        Assert.Empty(db.DocumentacaoPadraoPorCargoConfigs.ToList());
        var historicos = db.DocumentacaoPadraoHistoricos.OrderBy(x => x.CriadoEmUtc).ToList();
        Assert.Equal(2, historicos.Count);
        Assert.Equal(DocumentacaoPadraoAcao.Criado, historicos[0].Acao);
        Assert.Equal(DocumentacaoPadraoAcao.Removido, historicos[1].Acao);
    }

    [Fact]
    public async Task SaveByCargo_CargoInexistente_LancaInvalidOperationException()
    {
        var (_, svc, _) = CriarServico();
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await svc.SaveByCargoAsync(Guid.NewGuid(), new SalvarDocumentacaoPadraoPorCargoRequest
            {
                Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
            }, default));
    }

    [Fact]
    public async Task GetTiposEfetivos_ResolveCargoVenceNivelVenceGlobal()
    {
        var (db, svc, _) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jp = SeedJobPosition(db, nivelCargoId: nivelId);

        // Global: RG obrigatório, CPF obrigatório, CNH obrigatório
        SeedConfigGlobal(db, tipo: 0, configuracao: 0);
        SeedConfigGlobal(db, tipo: 1, configuracao: 0);
        SeedConfigGlobal(db, tipo: 2, configuracao: 0);

        // Nível sobrescreve CPF para opcional, CNH para não pedido
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos =
            [
                new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 },
                new DocumentacaoPadraoItemRequest { TipoDocumento = 2, Configuracao = 2 },
            ],
        }, default);

        // Cargo sobrescreve CPF de volta para obrigatório (vence sobre nível)
        await svc.SaveByCargoAsync(jp, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 0 }],
        }, default);

        var r = await svc.GetTiposEfetivosAsync(nivelId, jp, default);

        // RG = global (0=obrigatório); CPF = override cargo (0=obrigatório); CNH = override nível (2=excluído).
        Assert.Equal(2, r.Count);
        Assert.Contains(r, x => x.TipoDocumento == 0 && x.Obrigatorio);
        Assert.Contains(r, x => x.TipoDocumento == 1 && x.Obrigatorio);
        Assert.DoesNotContain(r, x => x.TipoDocumento == 2);
    }

    [Fact]
    public async Task ListarHistorico_FiltraPorCargo()
    {
        var (db, svc, _) = CriarServico();
        var jpA = SeedJobPosition(db, code: "CAR-A", nome: "A");
        var jpB = SeedJobPosition(db, code: "CAR-B", nome: "B");

        await svc.SaveByCargoAsync(jpA, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);
        await svc.SaveByCargoAsync(jpB, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 1, Configuracao = 1 }],
        }, default);

        var rA = await svc.ListarHistoricoAsync(null, null, jpA, 1, 50, default);

        Assert.Single(rA.Items);
        Assert.Equal(jpA, rA.Items[0].CargoId);
        Assert.Equal("A", rA.Items[0].CargoNome);
    }

    [Fact]
    public async Task GetByCargo_CargoSemNivelCargo_FuncionaSomenteComGlobalEOverride()
    {
        var (db, svc, _) = CriarServico();
        var jp = SeedJobPosition(db, nivelCargoId: null);
        SeedConfigGlobal(db, tipo: 0, configuracao: 0); // RG obrigatório global

        await svc.SaveByCargoAsync(jp, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var r = await svc.GetByCargoAsync(jp, default);

        Assert.NotNull(r);
        Assert.Null(r!.NivelCargoId);
        var rg = r.Documentos.Single(x => x.TipoDocumento == 0);
        Assert.Equal((short)1, rg.Configuracao);
        Assert.True(rg.OverrideCargoAtivo);
        Assert.False(rg.OverrideNivelCargoAtivo);
        Assert.Equal("cargo", rg.Origem);
    }
}
