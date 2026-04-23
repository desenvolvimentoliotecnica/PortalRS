using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RhPortal.Api.Messaging.WhatsApp;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Candidaturas;

/// <summary>
/// Cobertura Fase 3G — orquestrador de notificações por mudança de etapa.
/// Valida opt-in padrão, fallbacks de destino, normalização E.164 e auditoria em log.
/// </summary>
public sealed class CandidaturaNotificacaoServiceTests
{
    private const string TenantTeste = "tenant-notif";

    private sealed class Harness
    {
        public required AppDbContext Db { get; init; }
        public required CandidaturaNotificacaoService Service { get; init; }
        public required Mock<IEmailQueueService> EmailMock { get; init; }
        public required Mock<IWhatsAppMessageSender> WhatsMock { get; init; }
    }

    private static Harness Build(
        Action<Mock<IWhatsAppMessageSender>>? configureWhats = null,
        Action<Mock<IEmailQueueService>>? configureEmail = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(options, tenantMock.Object);

        var emailMock = new Mock<IEmailQueueService>();
        emailMock
            .Setup(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantTeste });
        configureEmail?.Invoke(emailMock);

        var whatsMock = new Mock<IWhatsAppMessageSender>();
        whatsMock
            .Setup(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WhatsAppSendResult(Accepted: true, ProviderMessageId: "stub-ok"));
        configureWhats?.Invoke(whatsMock);

        var svc = new CandidaturaNotificacaoService(
            db,
            tenantMock.Object,
            emailMock.Object,
            whatsMock.Object,
            NullLogger<CandidaturaNotificacaoService>.Instance);

        return new Harness { Db = db, Service = svc, EmailMock = emailMock, WhatsMock = whatsMock };
    }

    private static (Guid CandId, Guid CandidaturaId) Seed(
        AppDbContext db,
        string nome = "Fulano",
        string? email = "fulano@ex.com",
        string? fone = "11987654321",
        CandidatoNotificacaoPreferencia? pref = null,
        string vagaTitulo = "Dev .NET",
        EtapaMacroCandidatura etapa = EtapaMacroCandidatura.Aplicada)
    {
        var candidato = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Nome = nome,
            Email = email,
            Fone = fone,
        };
        db.Candidatos.Add(candidato);

        var vaga = new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = vagaTitulo,
            Status = VagaStatus.Aberta,
        };
        db.Vagas.Add(vaga);

        var cand = new Candidatura
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CandidatoId = candidato.Id,
            VagaId = vaga.Id,
            Status = CandidaturaStatus.Ativa,
            EtapaMacro = etapa,
            AplicadaEmUtc = DateTimeOffset.UtcNow,
            EtapaAtualDesdeUtc = DateTimeOffset.UtcNow,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Candidaturas.Add(cand);

        if (pref is not null)
        {
            pref.CandidatoId = candidato.Id;
            pref.TenantId = TenantTeste;
            pref.Id = Guid.NewGuid();
            db.Set<CandidatoNotificacaoPreferencia>().Add(pref);
        }

        db.SaveChanges();
        return (candidato.Id, cand.Id);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_MesmaEtapa_NaoFazNada()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db);

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.EmTriagem, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(h.Db.NotificacoesCandidaturaLogs);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_CandidaturaInexistente_NaoLancaNemLoga()
    {
        var h = Build();

        await h.Service.NotificarMudancaEtapaAsync(Guid.NewGuid(), EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        Assert.Empty(h.Db.NotificacoesCandidaturaLogs);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_SemPreferencia_EmailDefaultOptIn_Enviado()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, email: "destino@ex.com");

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync(
                "destino@ex.com",
                It.Is<string>(s => s.Contains("triagem", StringComparison.OrdinalIgnoreCase)),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                true,
                "candidatura-etapa",
                It.IsAny<CancellationToken>()),
            Times.Once);

        var logEmail = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.Email);
        Assert.Equal(NotificacaoStatus.Enviado, logEmail.Status);
        Assert.Equal("destino@ex.com", logEmail.Destino);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_SemPreferencia_WhatsAppDefaultOptOut_Ignorado()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, fone: "11987654321");

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

        var logWa = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.WhatsApp);
        Assert.Equal(NotificacaoStatus.IgnoradoSemOptIn, logWa.Status);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_EmailOptOut_NaoEnviaELoga()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, email: "a@b.com", pref: new CandidatoNotificacaoPreferencia
        {
            CanalEmail = false,
            CanalWhatsapp = false,
        });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        var logEmail = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.Email);
        Assert.Equal(NotificacaoStatus.IgnoradoSemOptIn, logEmail.Status);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_EmailSemDestino_LogaIgnorado()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, email: "   ");

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        var logEmail = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.Email);
        Assert.Equal(NotificacaoStatus.IgnoradoSemDestino, logEmail.Status);
        Assert.Null(logEmail.Destino);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_WhatsAppOptIn_Envia_NormalizaFone()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, fone: "11987654321", pref: new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = true,
        });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync("+5511987654321", It.Is<string>(s => s.Contains("entrevista", StringComparison.OrdinalIgnoreCase)), It.IsAny<CancellationToken>()), Times.Once);

        var logWa = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.WhatsApp);
        Assert.Equal(NotificacaoStatus.Enviado, logWa.Status);
        Assert.Equal("+5511987654321", logWa.Destino);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_WhatsAppOptIn_FoneComDDI_PreservaFormato()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, fone: "+15551234567", pref: new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = true,
        });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Teste, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync("+15551234567", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_WhatsAppOptIn_SemFone_IgnoraSemDestino()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, fone: null, pref: new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = true,
        });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        var logWa = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.WhatsApp);
        Assert.Equal(NotificacaoStatus.IgnoradoSemDestino, logWa.Status);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_EmailEWhatsAppAmbosOptIn_GeraDoisLogsEnviado()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, email: "x@y.com", fone: "11987654321", pref: new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = true,
        });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.EmTriagem, EtapaMacroCandidatura.Proposta, CancellationToken.None);

        Assert.Equal(2, h.Db.NotificacoesCandidaturaLogs.Count());
        Assert.All(h.Db.NotificacoesCandidaturaLogs, l => Assert.Equal(NotificacaoStatus.Enviado, l.Status));
    }

    [Fact]
    public async Task NotificarMudancaEtapa_EmailComFalhaNoEnqueue_LogaFalhou()
    {
        var h = Build(configureEmail: m => m
            .Setup(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("queue indisponível")));
        var (_, candId) = Seed(h.Db, email: "x@y.com");

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        var logEmail = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.Email);
        Assert.Equal(NotificacaoStatus.Falhou, logEmail.Status);
        Assert.Equal("queue indisponível", logEmail.ErroMensagem);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_WhatsAppProviderNaoAceita_LogaFalhou()
    {
        var h = Build(configureWhats: m => m
            .Setup(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WhatsAppSendResult(Accepted: false, ErrorMessage: "número inválido")));
        var (_, candId) = Seed(h.Db, fone: "11987654321", pref: new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = true,
        });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem, CancellationToken.None);

        var logWa = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.WhatsApp);
        Assert.Equal(NotificacaoStatus.Falhou, logWa.Status);
        Assert.Equal("número inválido", logWa.ErroMensagem);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_PreferenciaOverrideEmailETelefone_UsaDestinosDaPreferencia()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db,
            email: "candidato-original@ex.com",
            fone: "11911111111",
            pref: new CandidatoNotificacaoPreferencia
            {
                CanalEmail = true,
                CanalWhatsapp = true,
                Email = "pref-override@ex.com",
                Telefone = "21922222222",
            });

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Contratado, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync("pref-override@ex.com", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        h.WhatsMock.Verify(x => x.SendAsync("+5521922222222", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotificarMudancaEtapa_TemplatePorEtapa_UsaTextoCorretoPorEtapa()
    {
        var h = Build();
        var (_, candId) = Seed(h.Db, email: "x@y.com", vagaTitulo: "Analista Fiscal");

        await h.Service.NotificarMudancaEtapaAsync(candId, EtapaMacroCandidatura.EmTriagem, EtapaMacroCandidatura.Recusado, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync(
                "x@y.com",
                It.Is<string>(s => s.Contains("Analista Fiscal")),
                It.Is<string>(html => html.Contains("Analista Fiscal")),
                It.Is<string?>(text => text != null && text.Contains("Analista Fiscal")),
                true,
                "candidatura-etapa",
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ── ListarLogsAsync — auditoria admin ─────────────────────────────────────

    private static NotificacaoCandidaturaLog NovoLogSeed(
        AppDbContext db,
        Guid candidatoId,
        Guid candidaturaId,
        CanalNotificacao canal,
        NotificacaoStatus status,
        EtapaMacroCandidatura etapa,
        DateTimeOffset emUtc)
    {
        var log = new NotificacaoCandidaturaLog
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CandidaturaId = candidaturaId,
            CandidatoId = candidatoId,
            Canal = canal,
            Status = status,
            EtapaMacro = etapa,
            Destino = canal == CanalNotificacao.Email ? "x@y.com" : "+5511987654321",
            Mensagem = "texto da notificação",
            ErroMensagem = status == NotificacaoStatus.Falhou ? "erro simulado" : null,
            CriadoEmUtc = emUtc,
        };
        db.NotificacoesCandidaturaLogs.Add(log);
        return log;
    }

    [Fact]
    public async Task Listar_SemFiltros_RetornaTodosOrdenadoDesc()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db, email: "a@b.com");
        var t0 = DateTimeOffset.UtcNow;
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.EmTriagem, t0.AddMinutes(-10));
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.WhatsApp, NotificacaoStatus.Falhou, EtapaMacroCandidatura.Entrevista, t0.AddMinutes(-5));
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Proposta, t0.AddMinutes(-1));
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, page: 1, pageSize: 50, CancellationToken.None);

        Assert.Equal(3, resp.Total);
        Assert.Equal(3, resp.Items.Count);
        Assert.Equal(1, resp.Page);
        Assert.Equal(50, resp.PageSize);
        Assert.Equal(1, resp.TotalPages);
        // Ordem desc: Proposta (t-1) > Entrevista (t-5) > EmTriagem (t-10)
        Assert.Equal(EtapaMacroCandidatura.Proposta, resp.Items[0].EtapaMacro);
        Assert.Equal(EtapaMacroCandidatura.Entrevista, resp.Items[1].EtapaMacro);
        Assert.Equal(EtapaMacroCandidatura.EmTriagem, resp.Items[2].EtapaMacro);
    }

    [Fact]
    public async Task Listar_EnriqueceCandidatoEVaga()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db, nome: "Maria Silva", email: "maria@ex.com", fone: "11999999999", vagaTitulo: "Analista RH Pleno");
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, 1, 50, CancellationToken.None);

        var item = Assert.Single(resp.Items);
        Assert.Equal("Maria Silva", item.CandidatoNome);
        Assert.Equal("maria@ex.com", item.CandidatoEmail);
        Assert.Equal("11999999999", item.CandidatoFone);
        Assert.Equal("Analista RH Pleno", item.VagaTitulo);
        Assert.NotNull(item.VagaId);
    }

    [Fact]
    public async Task Listar_FiltraPorCanal()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.WhatsApp, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow.AddSeconds(-1));
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, CanalNotificacao.WhatsApp, null, null, null, null, 1, 50, CancellationToken.None);

        var item = Assert.Single(resp.Items);
        Assert.Equal(CanalNotificacao.WhatsApp, item.Canal);
    }

    [Fact]
    public async Task Listar_FiltraPorStatus()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Falhou, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow.AddSeconds(-1));
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, NotificacaoStatus.Falhou, null, null, null, 1, 50, CancellationToken.None);

        var item = Assert.Single(resp.Items);
        Assert.Equal(NotificacaoStatus.Falhou, item.Status);
        Assert.Equal("erro simulado", item.ErroMensagem);
    }

    [Fact]
    public async Task Listar_FiltraPorEtapa()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Proposta, DateTimeOffset.UtcNow.AddSeconds(-1));
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, null, EtapaMacroCandidatura.Proposta, null, null, 1, 50, CancellationToken.None);

        var item = Assert.Single(resp.Items);
        Assert.Equal(EtapaMacroCandidatura.Proposta, item.EtapaMacro);
    }

    [Fact]
    public async Task Listar_FiltraPorCandidatoECandidatura()
    {
        var h = Build();
        var (c1, cd1) = Seed(h.Db, nome: "Candidato 1", email: "c1@x.com");
        var (c2, cd2) = Seed(h.Db, nome: "Candidato 2", email: "c2@x.com");
        NovoLogSeed(h.Db, c1, cd1, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);
        NovoLogSeed(h.Db, c2, cd2, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow.AddSeconds(-1));
        h.Db.SaveChanges();

        var porCandidato = await h.Service.ListarLogsAsync(c2, null, null, null, null, null, null, 1, 50, CancellationToken.None);
        var item1 = Assert.Single(porCandidato.Items);
        Assert.Equal(c2, item1.CandidatoId);

        var porCandidatura = await h.Service.ListarLogsAsync(null, cd1, null, null, null, null, null, 1, 50, CancellationToken.None);
        var item2 = Assert.Single(porCandidatura.Items);
        Assert.Equal(cd1, item2.CandidaturaId);
    }

    [Fact]
    public async Task Listar_FiltraPorIntervaloDeData()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        var t0 = DateTimeOffset.UtcNow;
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.EmTriagem, t0.AddHours(-5));
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, t0.AddHours(-3));
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Proposta, t0.AddHours(-1));
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, null, null, t0.AddHours(-4), t0.AddHours(-2), 1, 50, CancellationToken.None);

        var item = Assert.Single(resp.Items);
        Assert.Equal(EtapaMacroCandidatura.Entrevista, item.EtapaMacro);
    }

    [Fact]
    public async Task Listar_Paginacao_RespeitaPageEPageSize()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        var t0 = DateTimeOffset.UtcNow;
        for (int i = 0; i < 5; i++)
            NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.EmTriagem, t0.AddMinutes(-i));
        h.Db.SaveChanges();

        var page1 = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, 1, 2, CancellationToken.None);
        var page2 = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, 2, 2, CancellationToken.None);
        var page3 = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, 3, 2, CancellationToken.None);

        Assert.Equal(5, page1.Total);
        Assert.Equal(3, page1.TotalPages);
        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(2, page2.Items.Count);
        Assert.Single(page3.Items);

        // IDs não se repetem entre páginas
        var ids = page1.Items.Select(i => i.Id)
            .Concat(page2.Items.Select(i => i.Id))
            .Concat(page3.Items.Select(i => i.Id))
            .ToList();
        Assert.Equal(5, ids.Distinct().Count());
    }

    [Fact]
    public async Task Listar_PageSize_Acima200_Clampa200()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, 1, 9999, CancellationToken.None);

        Assert.Equal(200, resp.PageSize);
    }

    [Fact]
    public async Task Listar_TenantDiferente_NaoVazaLogs()
    {
        var h = Build();
        var (candidatoId, candidaturaId) = Seed(h.Db);
        NovoLogSeed(h.Db, candidatoId, candidaturaId, CanalNotificacao.Email, NotificacaoStatus.Enviado, EtapaMacroCandidatura.Entrevista, DateTimeOffset.UtcNow);

        // Log de outro tenant — não pode aparecer
        h.Db.NotificacoesCandidaturaLogs.Add(new NotificacaoCandidaturaLog
        {
            Id = Guid.NewGuid(),
            TenantId = "OUTRO_TENANT",
            CandidaturaId = Guid.NewGuid(),
            CandidatoId = Guid.NewGuid(),
            Canal = CanalNotificacao.Email,
            Status = NotificacaoStatus.Enviado,
            EtapaMacro = EtapaMacroCandidatura.Proposta,
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });
        h.Db.SaveChanges();

        var resp = await h.Service.ListarLogsAsync(null, null, null, null, null, null, null, 1, 50, CancellationToken.None);

        var item = Assert.Single(resp.Items);
        Assert.Equal(TenantTeste, h.Db.NotificacoesCandidaturaLogs.IgnoreQueryFilters().First(l => l.Id == item.Id).TenantId);
    }
}
