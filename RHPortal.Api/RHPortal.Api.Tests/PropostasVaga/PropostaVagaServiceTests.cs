using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Application.PropostasVaga;
using RhPortal.Api.Contracts.PropostaVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.PropostasVaga;

/// <summary>
/// Testes de Fase 3D — fluxo de carta de oferta digital, state machine e captura de evidência.
/// </summary>
public sealed class PropostaVagaServiceTests
{
    private const string TenantTeste = "tenant-proposta";

    private static (AppDbContext Db, PropostaVagaService Service, Guid UserId) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(options, tenantMock.Object);

        var userId = Guid.NewGuid();
        var userContext = new Mock<ICurrentUserContext>();
        userContext.Setup(x => x.UserId).Returns(userId);

        var notificacaoMock = new Mock<ICandidaturaNotificacaoService>();
        var candidaturaService = new CandidaturaService(
            db, tenantMock.Object, userContext.Object,
            notificacaoMock.Object,
            NullLogger<CandidaturaService>.Instance);

        var service = new PropostaVagaService(db, tenantMock.Object, userContext.Object, candidaturaService);
        return (db, service, userId);
    }

    private static Guid SeedVaga(AppDbContext db, string titulo = "Dev .NET")
    {
        var v = new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = titulo,
            Status = VagaStatus.Rascunho,
        };
        db.Vagas.Add(v);
        db.SaveChanges();
        return v.Id;
    }

    private static Guid SeedCandidato(AppDbContext db, string nome = "Fulano de Tal", string email = "fulano@ex.com")
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

    private static PropostaVagaCreateRequest Request(Guid vagaId, Guid candidatoId) =>
        new(
            VagaId: vagaId,
            CandidatoId: candidatoId,
            Moeda: "BRL",
            SalarioOferecido: 12000m,
            DescricaoBeneficios: "VR + VT",
            DataPrevistaInicio: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            MensagemPersonalizada: "Bem-vindo!",
            ObservacaoInternaRh: "alçada ok");

    // ── create / update / delete ────────────────────────────────────

    [Fact]
    public async Task Create_SemVagaOuCandidato_LancaErro()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CreateAsync(Request(vagaId, Guid.NewGuid()), CancellationToken.None));
    }

    [Fact]
    public async Task Create_CamposEcoam_EStatusInicialRascunho()
    {
        var (db, svc, userId) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);

        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);

        Assert.Equal(PropostaVagaStatus.Rascunho, r.Status);
        Assert.Equal(12000m, r.SalarioOferecido);
        Assert.Equal("BRL", r.Moeda);
        Assert.Null(r.AccessToken);
        Assert.Null(r.EnviadaEmUtc);

        var entity = await db.Set<PropostaVaga>().FirstAsync();
        Assert.Equal(userId, entity.CriadaPorUserId);
    }

    [Fact]
    public async Task Update_PropostaJaRespondida_LancaErro()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);

        var entity = await db.Set<PropostaVaga>().FirstAsync();
        entity.Status = PropostaVagaStatus.Aceita;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.UpdateAsync(r.Id, new PropostaVagaUpdateRequest("BRL", 15000m, null, null, null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_SoPermiteEmRascunho()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);

        var ok = await svc.DeleteAsync(r.Id, CancellationToken.None);
        Assert.True(ok);

        // após Enviar não pode mais excluir
        var r2 = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        await svc.EnviarAsync(r2.Id, null, CancellationToken.None);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeleteAsync(r2.Id, CancellationToken.None));
    }

    // ── Enviar ──────────────────────────────────────────────────────

    [Fact]
    public async Task Enviar_GeraTokenUnicoEExpiracao()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);

        var sent = await svc.EnviarAsync(r.Id, prazoDiasResposta: 10, CancellationToken.None);

        Assert.NotNull(sent);
        Assert.Equal(PropostaVagaStatus.Enviada, sent!.Status);
        Assert.False(string.IsNullOrWhiteSpace(sent.AccessToken));
        Assert.NotNull(sent.EnviadaEmUtc);
        Assert.NotNull(sent.ExpiraEmUtc);
        var diff = (sent.ExpiraEmUtc!.Value - sent.EnviadaEmUtc!.Value).TotalDays;
        Assert.InRange(diff, 9.9, 10.1);
    }

    [Fact]
    public async Task Enviar_PrazoNulo_UsaPadraoDe7Dias()
    {
        var (_, svc, _) = CriarServico();
        var (db2, svc2, _) = CriarServico();
        var vagaId = SeedVaga(db2);
        var candId = SeedCandidato(db2);
        var r = await svc2.CreateAsync(Request(vagaId, candId), CancellationToken.None);

        var sent = await svc2.EnviarAsync(r.Id, null, CancellationToken.None);
        var diff = (sent!.ExpiraEmUtc!.Value - sent.EnviadaEmUtc!.Value).TotalDays;
        Assert.InRange(diff, 6.9, 7.1);
    }

    [Fact]
    public async Task Enviar_ForaDeRascunho_LancaErro()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        await svc.EnviarAsync(r.Id, null, CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.EnviarAsync(r.Id, null, CancellationToken.None));
    }

    // ── Fluxo público via token ─────────────────────────────────────

    [Fact]
    public async Task GetPorToken_MarcaVisualizadaNoPrimeiroAcesso()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);

        var publica = await svc.GetPorTokenAsync(sent!.AccessToken!, CancellationToken.None);

        Assert.NotNull(publica);
        Assert.Equal(PropostaVagaStatus.Visualizada, publica!.Status);

        // segunda chamada não cria nova visualização nem altera status
        var publica2 = await svc.GetPorTokenAsync(sent.AccessToken!, CancellationToken.None);
        Assert.Equal(PropostaVagaStatus.Visualizada, publica2!.Status);
    }

    [Fact]
    public async Task AceitarPorToken_RegistraEvidencia()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);

        var aceita = await svc.AceitarPorTokenAsync(
            sent!.AccessToken!, "Fulano de Tal", "192.0.2.5", "Mozilla/5.0 test", CancellationToken.None);

        Assert.NotNull(aceita);
        Assert.Equal(PropostaVagaStatus.Aceita, aceita!.Status);
        Assert.NotNull(aceita.RespondidaEmUtc);

        var entity = await db.Set<PropostaVaga>().FirstAsync(p => p.Id == r.Id);
        Assert.Equal("Fulano de Tal", entity.NomeConfirmadoCandidato);
        Assert.Equal("192.0.2.5", entity.IpOrigemResposta);
        Assert.Equal("Mozilla/5.0 test", entity.UserAgentResposta);
    }

    [Fact]
    public async Task RecusarPorToken_CapturaMotivo()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);

        var recusa = await svc.RecusarPorTokenAsync(
            sent!.AccessToken!, "Fulano de Tal", "Aceitei outra oferta", null, null, CancellationToken.None);

        Assert.Equal(PropostaVagaStatus.Recusada, recusa!.Status);
        var entity = await db.Set<PropostaVaga>().FirstAsync();
        Assert.Equal("Aceitei outra oferta", entity.MotivoRecusa);
    }

    [Fact]
    public async Task AceitarDuasVezes_SegundaLancaErro()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);
        await svc.AceitarPorTokenAsync(sent!.AccessToken!, "Fulano", null, null, CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AceitarPorTokenAsync(sent.AccessToken!, "Fulano", null, null, CancellationToken.None));
    }

    [Fact]
    public async Task GetPorToken_Expirado_MarcaExpiradaERetornaStatus()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);

        // força expiração
        var entity = await db.Set<PropostaVaga>().FirstAsync(p => p.Id == r.Id);
        entity.ExpiraEmUtc = DateTimeOffset.UtcNow.AddDays(-1);
        await db.SaveChangesAsync();

        var publica = await svc.GetPorTokenAsync(sent!.AccessToken!, CancellationToken.None);
        Assert.Equal(PropostaVagaStatus.Expirada, publica!.Status);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AceitarPorTokenAsync(sent.AccessToken!, "Fulano", null, null, CancellationToken.None));
    }

    [Fact]
    public async Task GetPorToken_Inexistente_RetornaNull()
    {
        var (_, svc, _) = CriarServico();
        var publica = await svc.GetPorTokenAsync("token-que-nao-existe", CancellationToken.None);
        Assert.Null(publica);
    }

    // ── Cancelar ────────────────────────────────────────────────────

    [Fact]
    public async Task Cancelar_BloqueadaAposResposta()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);
        await svc.AceitarPorTokenAsync(sent!.AccessToken!, "Fulano", null, null, CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CancelarAsync(r.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Cancelar_EmRascunhoOuEnviada_FuncionaEBloqueiaTokens()
    {
        var (db, svc, _) = CriarServico();
        var vagaId = SeedVaga(db);
        var candId = SeedCandidato(db);
        var r = await svc.CreateAsync(Request(vagaId, candId), CancellationToken.None);
        var sent = await svc.EnviarAsync(r.Id, null, CancellationToken.None);
        var cancel = await svc.CancelarAsync(r.Id, CancellationToken.None);

        Assert.Equal(PropostaVagaStatus.Cancelada, cancel!.Status);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AceitarPorTokenAsync(sent!.AccessToken!, "Fulano", null, null, CancellationToken.None));
    }
}
