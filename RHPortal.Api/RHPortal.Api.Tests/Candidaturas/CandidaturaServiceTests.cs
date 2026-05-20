using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Candidaturas;

/// <summary>
/// Testes de Fase 3E MVP — junction Candidatura (Candidato↔Vaga) com histórico.
/// </summary>
public sealed class CandidaturaServiceTests
{
    private const string TenantTeste = "tenant-candidatura";

    private static (AppDbContext Db, CandidaturaService Service) CriarServico(
        Guid? userId = null,
        bool isAdmin = false,
        bool isOwner = false)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(options, tenantMock.Object);

        var userContext = new Mock<ICurrentUserContext>();
        userContext.Setup(x => x.UserId).Returns(userId ?? Guid.NewGuid());
        userContext.Setup(x => x.IsAdmin).Returns(isAdmin);
        userContext.Setup(x => x.IsInRole(It.Is<string>(r => r == "Owner"))).Returns(isOwner);

        var notificacaoMock = new Mock<ICandidaturaNotificacaoService>();
        notificacaoMock
            .Setup(x => x.NotificarMudancaEtapaAsync(It.IsAny<Guid>(), It.IsAny<EtapaMacroCandidatura>(), It.IsAny<EtapaMacroCandidatura>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var service = new CandidaturaService(db, tenantMock.Object, userContext.Object, notificacaoMock.Object, NullLogger<CandidaturaService>.Instance);
        return (db, service);
    }

    private static Guid SeedVaga(AppDbContext db, string titulo = "Dev .NET", string? cidade = "SP", string? uf = "SP")
    {
        var v = new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = titulo,
            Cidade = cidade,
            Uf = uf,
            Status = VagaStatus.Rascunho,
        };
        db.Vagas.Add(v);
        db.SaveChanges();
        return v.Id;
    }

    private static Guid SeedCandidato(AppDbContext db, string nome = "Fulano", string email = "fulano@ex.com")
    {
        var c = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Nome = nome,
            Email = email,
        };
        db.Candidatos.Add(c);
        db.SaveChanges();
        return c.Id;
    }

    private static void SeedSolicitacaoVaga(AppDbContext db, Guid vagaId, Guid? analistaId)
    {
        db.SolicitacoesVaga.Add(new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitanteId = Guid.NewGuid(),
            VagaId = vagaId,
            Titulo = "Solicitação de vaga",
            AnalistaRhResponsavelUserId = analistaId,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task GetOrCreate_PrimeiraVez_CriaCandidaturaERegistraHistoricoInicial()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);

        var result = await svc.GetOrCreateAsync(candId, vagaId, "Portal", "obs1", default);

        Assert.NotNull(result);
        Assert.Equal(CandidaturaStatus.Ativa, result.Status);
        Assert.Equal(EtapaMacroCandidatura.Aplicada, result.EtapaMacro);
        Assert.Equal("Portal", result.Fonte);

        var hist = db.CandidaturaEtapaHistoricos.ToList();
        Assert.Single(hist);
        Assert.Equal(EtapaMacroCandidatura.Aplicada, hist[0].EtapaNova);
    }

    [Fact]
    public async Task GetOrCreate_MesmoCandidatoMesmaVaga_Reaproveita()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);

        var a = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);
        var b = await svc.GetOrCreateAsync(candId, vagaId, "Portal", "atualizei obs", default);

        Assert.Equal(a.Id, b.Id);
        Assert.Equal(1, db.Candidaturas.Count());
        Assert.Equal("atualizei obs", db.Candidaturas.First().Observacoes);
    }

    [Fact]
    public async Task GetOrCreate_MesmoCandidatoVagasDiferentes_CriaDois()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var v1 = SeedVaga(db, "Dev .NET");
        var v2 = SeedVaga(db, "Dev React");

        await svc.GetOrCreateAsync(candId, v1, "Portal", null, default);
        await svc.GetOrCreateAsync(candId, v2, "Portal", null, default);

        Assert.Equal(2, db.Candidaturas.Count());
    }

    [Fact]
    public async Task Listar_OrdenaDaMaisRecenteParaMaisAntiga()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var v1 = SeedVaga(db, "Antiga");
        var v2 = SeedVaga(db, "Nova");

        var primeira = await svc.GetOrCreateAsync(candId, v1, "Portal", null, default);

        // força datas determinísticas
        var e1 = db.Candidaturas.First(x => x.Id == primeira.Id);
        e1.AplicadaEmUtc = DateTimeOffset.UtcNow.AddDays(-10);
        db.SaveChanges();

        await svc.GetOrCreateAsync(candId, v2, "Portal", null, default);

        var list = await svc.ListarDoCandidatoAsync(candId, default);

        Assert.Equal(2, list.Count);
        Assert.Equal("Nova", list[0].VagaTitulo);
        Assert.Equal("Antiga", list[1].VagaTitulo);
    }

    [Fact]
    public async Task Listar_PreencheCampoVaga()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db, "Dev Sênior", "Campinas", "SP");

        await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);
        var list = await svc.ListarDoCandidatoAsync(candId, default);

        Assert.Single(list);
        Assert.Equal("Dev Sênior", list[0].VagaTitulo);
        Assert.Equal("Campinas - SP", list[0].VagaLocal);
    }

    [Fact]
    public async Task ListarKanban_AnalistaRh_RetornaSomenteVagasAtribuidasAoUsuario()
    {
        var analystId = Guid.NewGuid();
        var (db, svc) = CriarServico(userId: analystId);
        var candPermitido = SeedCandidato(db, "Permitido", "permitido@ex.com");
        var candOutro = SeedCandidato(db, "Outro", "outro@ex.com");
        var vagaPermitida = SeedVaga(db, "Vaga do analista");
        var vagaOutroAnalista = SeedVaga(db, "Vaga de outro analista");

        await svc.GetOrCreateAsync(candPermitido, vagaPermitida, "Portal", null, default);
        await svc.GetOrCreateAsync(candOutro, vagaOutroAnalista, "Portal", null, default);
        SeedSolicitacaoVaga(db, vagaPermitida, analystId);
        SeedSolicitacaoVaga(db, vagaOutroAnalista, Guid.NewGuid());

        var kanban = await svc.ListarKanbanAsync(null, default);
        var itens = kanban.Colunas.SelectMany(c => c.Itens).ToList();

        Assert.Equal(1, kanban.Total);
        var item = Assert.Single(itens);
        Assert.Equal(candPermitido, item.CandidatoId);
        Assert.Equal(vagaPermitida, item.VagaId);
    }

    [Fact]
    public async Task ListarKanban_Admin_RetornaTodasAsVagas()
    {
        var (db, svc) = CriarServico(isAdmin: true);
        var cand1 = SeedCandidato(db, "Um", "um@ex.com");
        var cand2 = SeedCandidato(db, "Dois", "dois@ex.com");
        var vaga1 = SeedVaga(db, "Vaga 1");
        var vaga2 = SeedVaga(db, "Vaga 2");

        await svc.GetOrCreateAsync(cand1, vaga1, "Portal", null, default);
        await svc.GetOrCreateAsync(cand2, vaga2, "Portal", null, default);

        var kanban = await svc.ListarKanbanAsync(null, default);

        Assert.Equal(2, kanban.Total);
        Assert.Equal(2, kanban.Colunas.Sum(c => c.Itens.Count));
    }

    [Fact]
    public async Task ListarVagasKanban_AnalistaRh_RetornaSomenteVagasVisiveisOuAtribuidas()
    {
        var analystId = Guid.NewGuid();
        var (db, svc) = CriarServico(userId: analystId);
        var candPermitido = SeedCandidato(db, "Permitido", "permitido@ex.com");
        var candOutro = SeedCandidato(db, "Outro", "outro@ex.com");
        var vagaPermitida = SeedVaga(db, "Vaga com candidatura");
        var vagaOutroAnalista = SeedVaga(db, "Vaga de outro analista");
        var vagaAtribuidaSemCandidatura = SeedVaga(db, "Vaga atribuida sem candidatura");

        await svc.GetOrCreateAsync(candPermitido, vagaPermitida, "Portal", null, default);
        await svc.GetOrCreateAsync(candOutro, vagaOutroAnalista, "Portal", null, default);
        SeedSolicitacaoVaga(db, vagaPermitida, analystId);
        SeedSolicitacaoVaga(db, vagaOutroAnalista, Guid.NewGuid());
        SeedSolicitacaoVaga(db, vagaAtribuidaSemCandidatura, analystId);

        var vagas = await svc.ListarVagasKanbanAsync(default);

        Assert.Equal(2, vagas.Count);
        Assert.Contains(vagas, v => v.Id == vagaPermitida && v.TotalCandidaturas == 1);
        Assert.Contains(vagas, v => v.Id == vagaAtribuidaSemCandidatura && v.TotalCandidaturas == 0);
        Assert.DoesNotContain(vagas, v => v.Id == vagaOutroAnalista);
    }

    [Fact]
    public async Task AvancarEtapa_RegistraHistoricoEAtualizaEtapaAtual()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);
        var c = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        var r = await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.EmTriagem, "passou pela IA", default);

        Assert.NotNull(r);
        Assert.Equal(EtapaMacroCandidatura.EmTriagem, r!.EtapaMacro);

        var hist = db.CandidaturaEtapaHistoricos.OrderBy(h => h.EmUtc).ToList();
        Assert.Equal(2, hist.Count);
        Assert.Equal(EtapaMacroCandidatura.Aplicada, hist[1].EtapaAnterior);
        Assert.Equal(EtapaMacroCandidatura.EmTriagem, hist[1].EtapaNova);
        Assert.Equal("passou pela IA", hist[1].Observacao);
    }

    [Fact]
    public async Task AvancarEtapa_MesmaEtapa_NaoDuplicaHistorico()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);
        var c = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.Aplicada, "noop", default);

        var hist = db.CandidaturaEtapaHistoricos.ToList();
        Assert.Single(hist);
    }

    [Fact]
    public async Task AvancarEtapa_Contratado_FechaStatus()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);
        var c = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        var r = await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.Contratado, null, default);

        Assert.Equal(CandidaturaStatus.Contratado, r!.Status);
    }

    [Fact]
    public async Task AvancarEtapa_AposEncerrada_LancaErro()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);
        var c = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.Recusado, null, default);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.Entrevista, null, default));
    }

    [Fact]
    public async Task AvancarEtapa_Inexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();
        var r = await svc.AvancarEtapaAsync(Guid.NewGuid(), EtapaMacroCandidatura.Entrevista, null, default);
        Assert.Null(r);
    }

    [Fact]
    public async Task Listar_IncluiHistoricoOrdenado()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);
        var c = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.EmTriagem, null, default);
        await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.Entrevista, null, default);

        var list = await svc.ListarDoCandidatoAsync(candId, default);
        var item = Assert.Single(list);

        Assert.Equal(3, item.Historico.Count);
        Assert.Equal(EtapaMacroCandidatura.Aplicada, item.Historico[0].EtapaNova);
        Assert.Equal(EtapaMacroCandidatura.EmTriagem, item.Historico[1].EtapaNova);
        Assert.Equal(EtapaMacroCandidatura.Entrevista, item.Historico[2].EtapaNova);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sessão 24 (Onda 3) — sync de Candidato.VagaId (cache) ↔ Candidaturas
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetOrCreate_AtualizaCacheCandidatoVagaId()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);

        var before = db.Candidatos.AsNoTracking().First(c => c.Id == candId);
        Assert.Null(before.VagaId);

        await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        db.ChangeTracker.Clear();
        var after = db.Candidatos.AsNoTracking().First(c => c.Id == candId);
        Assert.Equal(vagaId, after.VagaId);
    }

    [Fact]
    public async Task GetOrCreate_DuasCandidaturas_CachePontaParaMaisRecente()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vaga1 = SeedVaga(db, "Dev Jr");
        var vaga2 = SeedVaga(db, "Dev Pl");

        await svc.GetOrCreateAsync(candId, vaga1, "Portal", null, default);
        await Task.Delay(10); // garantir ordenação por AplicadaEmUtc
        await svc.GetOrCreateAsync(candId, vaga2, "Portal", null, default);

        db.ChangeTracker.Clear();
        var cand = db.Candidatos.AsNoTracking().First(c => c.Id == candId);
        Assert.Equal(vaga2, cand.VagaId);
    }

    [Fact]
    public async Task AvancarEtapa_QuandoEncerraUnica_PreservaCacheVagaId()
    {
        // Quando a única candidatura é encerrada e não há outra ativa, o cache
        // preserva o último VagaId (não zera) pra manter a referência útil.
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);

        var c = await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);
        await svc.AvancarEtapaAsync(c.Id, EtapaMacroCandidatura.Recusado, "reprovado no CV", default);

        db.ChangeTracker.Clear();
        var cand = db.Candidatos.AsNoTracking().First(x => x.Id == candId);
        Assert.Equal(vagaId, cand.VagaId); // ainda aponta para a única candidatura (fallback mais recente)
    }

    [Fact]
    public async Task AvancarEtapa_QuandoEncerraMasTemOutraAtiva_CacheMudaParaAtiva()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vaga1 = SeedVaga(db, "Dev A");
        var vaga2 = SeedVaga(db, "Dev B");

        var c1 = await svc.GetOrCreateAsync(candId, vaga1, "Portal", null, default);
        await Task.Delay(10);
        var c2 = await svc.GetOrCreateAsync(candId, vaga2, "Portal", null, default);

        db.ChangeTracker.Clear();
        var antes = db.Candidatos.AsNoTracking().First(x => x.Id == candId);
        Assert.Equal(vaga2, antes.VagaId);

        // Encerra a mais recente (vaga2): o cache deve cair pra vaga1 (única ativa restante).
        await svc.AvancarEtapaAsync(c2.Id, EtapaMacroCandidatura.Recusado, null, default);

        db.ChangeTracker.Clear();
        var depois = db.Candidatos.AsNoTracking().First(x => x.Id == candId);
        Assert.Equal(vaga1, depois.VagaId);
    }

    [Fact]
    public async Task RecalcularVagaPrincipal_CandidatoSemCandidatura_NaoAlteraCache()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaHardcoded = SeedVaga(db, "Vaga captação manual");

        // Simula candidato captado manualmente pelo admin: VagaId setado sem candidatura.
        var cand = db.Candidatos.First(x => x.Id == candId);
        cand.VagaId = vagaHardcoded;
        db.SaveChanges();

        await svc.RecalcularVagaPrincipalAsync(candId, default);

        db.ChangeTracker.Clear();
        var depois = db.Candidatos.AsNoTracking().First(x => x.Id == candId);
        Assert.Equal(vagaHardcoded, depois.VagaId); // preservado — não zera
    }

    [Fact]
    public async Task RecalcularVagaPrincipal_CandidatoInexistente_NaoFalha()
    {
        var (_, svc) = CriarServico();
        // Não deve lançar.
        await svc.RecalcularVagaPrincipalAsync(Guid.NewGuid(), default);
    }

    [Fact]
    public async Task RecalcularVagaPrincipal_Idempotente()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaId = SeedVaga(db);

        await svc.GetOrCreateAsync(candId, vagaId, "Portal", null, default);

        // Chamar N vezes não muda nada nem quebra.
        await svc.RecalcularVagaPrincipalAsync(candId, default);
        await svc.RecalcularVagaPrincipalAsync(candId, default);
        await svc.RecalcularVagaPrincipalAsync(candId, default);

        db.ChangeTracker.Clear();
        var cand = db.Candidatos.AsNoTracking().First(x => x.Id == candId);
        Assert.Equal(vagaId, cand.VagaId);
    }

    [Fact]
    public async Task RecalcularVagaPrincipal_PreferenciaAtivaSobreEncerrada()
    {
        var (db, svc) = CriarServico();
        var candId = SeedCandidato(db);
        var vagaAtiva = SeedVaga(db, "Ativa");
        var vagaEncerrada = SeedVaga(db, "Encerrada");

        // Cria candidatura ativa primeiro, depois outra que será encerrada DEPOIS.
        var cAtiva = await svc.GetOrCreateAsync(candId, vagaAtiva, "Portal", null, default);
        await Task.Delay(10);
        var cEnc = await svc.GetOrCreateAsync(candId, vagaEncerrada, "Portal", null, default);

        // Encerra a mais recente (vagaEncerrada); o cache deve cair pra vagaAtiva.
        await svc.AvancarEtapaAsync(cEnc.Id, EtapaMacroCandidatura.Desistiu, null, default);

        db.ChangeTracker.Clear();
        var cand = db.Candidatos.AsNoTracking().First(x => x.Id == candId);
        Assert.Equal(vagaAtiva, cand.VagaId);
    }
}
