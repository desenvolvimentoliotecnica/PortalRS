using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.DocumentacaoPadrao;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.DocumentacaoPadrao;

/// <summary>
/// Cobre a Onda 8 — sincronização das pré-admissões ativas após mudança no padrão global,
/// respeitando os overrides por NivelCargo e por Cargo específico.
/// O comportamento esperado: o admin altera o global; cada preadmissão tem sua configuração
/// efetiva recalculada (cargo → nível → global) sem perder os overrides.
///
/// Extensão da Sessão 28 — a sincronização agora também é disparada por
/// <c>SaveByNivelCargoAsync</c> e <c>SaveByCargoAsync</c> (antes só rodava após
/// <c>SaveAsync</c> global, o que exigia re-salvar o global pra propagar overrides).
/// Veja os testes <c>SaveByNivelCargo_PropagaParaPreAdmisoes_*</c> e <c>SaveByCargo_PropagaParaPreAdmisoes_*</c>.
/// </summary>
public sealed class DocumentacaoPadraoSincronizacaoTests
{
    private const string TenantTeste = "tenant-docs-sync";

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

    private static Guid SeedJobPosition(AppDbContext db, Guid? nivelCargoId = null)
    {
        var jp = new JobPosition
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "CAR-001",
            Name = "Cargo Teste",
            NivelCargoId = nivelCargoId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<JobPosition>().Add(jp);
        db.SaveChanges();
        return jp.Id;
    }

    private static Guid SeedPreAdmissaoAtiva(AppDbContext db, Guid? jobPositionId = null, PreAdmissaoStatus status = PreAdmissaoStatus.Rascunho)
    {
        var pa = new RhPortal.Api.Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Nome = "João Silva",
            Status = status,
            PreenchidoPor = PreenchidoPor.RH,
            JobPositionId = jobPositionId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<RhPortal.Api.Domain.Entities.PreAdmissao>().Add(pa);
        db.SaveChanges();
        return pa.Id;
    }

    [Fact]
    public async Task SaveGlobal_PropagaParaPreAdmissoesSemOverride()
    {
        var (db, svc) = CriarServico();
        var paId = SeedPreAdmissaoAtiva(db);

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>()
            .Where(d => d.PreAdmissaoId == paId)
            .ToList();
        Assert.Single(docs);
        Assert.Equal(TipoDocumento.RG, docs[0].TipoDocumento);
        Assert.True(docs[0].Obrigatorio);
    }

    [Fact]
    public async Task SaveGlobal_NaoSobrescreveOverridePorNivelCargo()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        // Override por nível: tipo 0 OPCIONAL.
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        // Admin agora altera o global para OBRIGATÓRIO. O override por nível deve continuar mandando.
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>()
            .Where(d => d.PreAdmissaoId == paId)
            .ToList();
        Assert.Single(docs);
        Assert.Equal(TipoDocumento.RG, docs[0].TipoDocumento);
        Assert.False(docs[0].Obrigatorio); // ← OPCIONAL veio do override por nível, não do global recém-salvo
    }

    [Fact]
    public async Task SaveGlobal_NaoSobrescreveOverridePorCargoEspecifico()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        // Override por cargo: tipo 0 OPCIONAL (vence sobre nível e global).
        await svc.SaveByCargoAsync(jpId, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        // Admin altera global para OBRIGATÓRIO.
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>()
            .Where(d => d.PreAdmissaoId == paId)
            .ToList();
        Assert.Single(docs);
        Assert.False(docs[0].Obrigatorio); // override por cargo continua mandando
    }

    [Fact]
    public async Task SaveGlobal_RemoveDocumentoQuandoEfetivoVira_NaoPedido()
    {
        var (db, svc) = CriarServico();
        var paId = SeedPreAdmissaoAtiva(db);

        // Cria doc na preadmissão como obrigatório
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        // Agora muda para "Não será pedido"
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 2 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>()
            .Where(d => d.PreAdmissaoId == paId)
            .ToList();
        Assert.Empty(docs);
    }

    [Fact]
    public async Task SaveGlobal_NaoTocaPreAdmissoesConcluidas()
    {
        var (db, svc) = CriarServico();
        var paAtiva = SeedPreAdmissaoAtiva(db);
        var paConcluida = SeedPreAdmissaoAtiva(db, status: PreAdmissaoStatus.Integrada);

        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docsAtiva = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paAtiva).ToList();
        var docsConcluida = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paConcluida).ToList();

        Assert.Single(docsAtiva);
        Assert.Empty(docsConcluida);
    }

    [Fact]
    public async Task SaveGlobal_HierarquiaCompletaPorPreadmissao()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpComOverrideCargo = SeedJobPosition(db, nivelCargoId: nivelId);
        var jpSemOverride = SeedJobPosition(db, nivelCargoId: nivelId);

        var paComCargo = SeedPreAdmissaoAtiva(db, jobPositionId: jpComOverrideCargo);
        var paSemCargo = SeedPreAdmissaoAtiva(db, jobPositionId: jpSemOverride);

        // Override de nível: tipo 0 = OPCIONAL
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        // Override de cargo no jpComOverrideCargo: tipo 0 = NÃO PEDIDO (vence)
        await svc.SaveByCargoAsync(jpComOverrideCargo, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 2 }],
        }, default);

        // Salva global como OBRIGATÓRIO. Deve respeitar overrides individuais.
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docsComCargo = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paComCargo).ToList();
        var docsSemCargo = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paSemCargo).ToList();

        // paComCargo: cargo diz "não pedido" → não deve ter o doc.
        Assert.Empty(docsComCargo);

        // paSemCargo: nível diz "opcional" → deve ter, mas não obrigatório.
        Assert.Single(docsSemCargo);
        Assert.False(docsSemCargo[0].Obrigatorio);
    }

    [Fact]
    public async Task SaveGlobal_AtualizaObrigatorioDeDocumentoExistenteRespeitandoOverride()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        // Doc inicial: global obrigatório
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        // Override por nível torna OPCIONAL — desde a Sessão 28 essa chamada já dispara sync,
        // então o doc já fica OPCIONAL aqui. A re-gravação do global abaixo continua sendo idempotente.
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        // Re-salva global (mesmo valor): a sync deve atualizar o doc para OPCIONAL (override venceu).
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paId).ToList();
        Assert.Single(docs);
        Assert.False(docs[0].Obrigatorio);
    }

    // ── Sessão 28 — sincronização disparada por SaveByNivelCargo / SaveByCargo ───────────────
    // Antes, só o SaveAsync global propagava mudanças para as pré-admissões ativas. Alterar um
    // override por NivelCargo ou por Cargo específico ficava "preso" até alguém re-salvar o global.
    // Agora ambos disparam SincronizarPreAdmisoesAtivasAsync (mesma lógica hierárquica).

    [Fact]
    public async Task SaveByNivelCargo_PropagaParaPreAdmisoesDoNivel()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        // Apenas override por nível — sem global antes (config padrão = "Não será pedido").
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paId).ToList();
        var rg = Assert.Single(docs);
        Assert.Equal(TipoDocumento.RG, rg.TipoDocumento);
        Assert.True(rg.Obrigatorio); // vindo do override por nível
    }

    [Fact]
    public async Task SaveByCargo_PropagaParaPreAdmisoesDoCargo()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        await svc.SaveByCargoAsync(jpId, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paId).ToList();
        var rg = Assert.Single(docs);
        Assert.True(rg.Obrigatorio); // vindo do override por cargo
    }

    [Fact]
    public async Task SaveByNivelCargo_NaoAfetaPreAdmisoesDeOutroNivel()
    {
        var (db, svc) = CriarServico();
        var nivelA = SeedNivelCargo(db, nome: "Sênior", cdn: 30);
        var nivelB = SeedNivelCargo(db, nome: "Pleno", cdn: 20);
        var jpA = SeedJobPosition(db, nivelCargoId: nivelA);
        var jpB = SeedJobPosition(db, nivelCargoId: nivelB);
        var paA = SeedPreAdmissaoAtiva(db, jobPositionId: jpA);
        var paB = SeedPreAdmissaoAtiva(db, jobPositionId: jpB);

        // Global: tipo 0 OBRIGATÓRIO (já propaga para ambos via SaveAsync)
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);

        // Override apenas no nivelA: tipo 0 OPCIONAL. PA do nivelB deve continuar OBRIGATÓRIO (vem do global).
        await svc.SaveByNivelCargoAsync(nivelA, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        var docsA = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paA).ToList();
        var docsB = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paB).ToList();

        Assert.False(Assert.Single(docsA).Obrigatorio); // nivelA opcional
        Assert.True(Assert.Single(docsB).Obrigatorio);  // nivelB continua obrigatório (global)
    }

    [Fact]
    public async Task SaveByCargo_RemocaoDeOverride_ReverteParaNivelOuGlobal()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        // Global: OBRIGATÓRIO. Nível: OPCIONAL. Cargo: NÃO-PEDIDO.
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);
        await svc.SaveByCargoAsync(jpId, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 2 }],
        }, default);

        // Depois dos três steps acima, cargo vence → doc removido na preadmissão.
        Assert.Empty(db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paId).ToList());

        // Remove override por cargo (payload vazio) → sync rebate → hierarquia cai no nível (OPCIONAL) → doc volta.
        await svc.SaveByCargoAsync(jpId, new SalvarDocumentacaoPadraoPorCargoRequest
        {
            Documentos = [],
        }, default);

        var docs = db.Set<PreAdmissaoDocumentoSolicitado>().Where(d => d.PreAdmissaoId == paId).ToList();
        var rg = Assert.Single(docs);
        Assert.False(rg.Obrigatorio); // vindo do nível (opcional)
    }

    [Fact]
    public async Task SaveByNivelCargo_RemocaoDeOverride_ReverteParaGlobal()
    {
        var (db, svc) = CriarServico();
        var nivelId = SeedNivelCargo(db);
        var jpId = SeedJobPosition(db, nivelCargoId: nivelId);
        var paId = SeedPreAdmissaoAtiva(db, jobPositionId: jpId);

        // Global: OBRIGATÓRIO; nível: OPCIONAL.
        await svc.SaveAsync(new SalvarDocumentacaoPadraoRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 0 }],
        }, default);
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [new DocumentacaoPadraoItemRequest { TipoDocumento = 0, Configuracao = 1 }],
        }, default);

        // Preadmissão deve estar OPCIONAL neste ponto.
        Assert.False(db.Set<PreAdmissaoDocumentoSolicitado>().Single(d => d.PreAdmissaoId == paId).Obrigatorio);

        // Remove o override por nível → sync rebate → cai no global → doc volta a OBRIGATÓRIO.
        await svc.SaveByNivelCargoAsync(nivelId, new SalvarDocumentacaoPadraoPorNivelRequest
        {
            Documentos = [],
        }, default);

        Assert.True(db.Set<PreAdmissaoDocumentoSolicitado>().Single(d => d.PreAdmissaoId == paId).Obrigatorio);
    }
}
