using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
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
/// Cobertura Ondas 9 + 10 + 11 — rate limit por candidato, janela de silêncio
/// e seletor de idioma na preferência. Todos os cenários cruzam o
/// <see cref="CandidaturaNotificacaoService"/> ponta-a-ponta com EF InMemory.
///
/// Sessão 28 — janela de silêncio passa a valer também para o canal e-mail
/// (antes só bloqueava WhatsApp; agora o mesmo gate cobre ambos, controlado
/// pela flag <c>WhatsAppOptions.RespeitarSilencio</c>).
/// </summary>
public sealed class CandidaturaNotificacaoRateLimitTests
{
    private const string TenantTeste = "tenant-rate";

    private sealed class Harness
    {
        public required AppDbContext Db { get; init; }
        public required CandidaturaNotificacaoService Service { get; init; }
        public required Mock<IWhatsAppMessageSender> WhatsMock { get; init; }
        public required Mock<IEmailQueueService> EmailMock { get; init; }
    }

    private static Harness Build(WhatsAppOptions? options = null)
    {
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(dbOptions, tenantMock.Object);

        var emailMock = new Mock<IEmailQueueService>();
        emailMock
            .Setup(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantTeste });

        var whatsMock = new Mock<IWhatsAppMessageSender>();
        whatsMock
            .Setup(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WhatsAppSendResult(Accepted: true, ProviderMessageId: "stub-ok"));

        var svc = new CandidaturaNotificacaoService(
            db,
            tenantMock.Object,
            emailMock.Object,
            whatsMock.Object,
            NullLogger<CandidaturaNotificacaoService>.Instance,
            Options.Create(options ?? new WhatsAppOptions()),
            templateService: null);

        return new Harness { Db = db, Service = svc, WhatsMock = whatsMock, EmailMock = emailMock };
    }

    private static (Guid CandId, Guid CandidaturaId) Seed(
        AppDbContext db,
        CandidatoNotificacaoPreferencia pref,
        string fone = "11987654321")
    {
        var candidato = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "fulano@ex.com",
            Fone = fone,
        };
        db.Candidatos.Add(candidato);

        var vaga = new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = "Dev .NET",
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
            EtapaMacro = EtapaMacroCandidatura.Aplicada,
            AplicadaEmUtc = DateTimeOffset.UtcNow,
            EtapaAtualDesdeUtc = DateTimeOffset.UtcNow,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Candidaturas.Add(cand);

        pref.Id = Guid.NewGuid();
        pref.TenantId = TenantTeste;
        pref.CandidatoId = candidato.Id;
        db.Set<CandidatoNotificacaoPreferencia>().Add(pref);

        db.SaveChanges();
        return (candidato.Id, cand.Id);
    }

    private static void SeedLogEnviado(AppDbContext db, Guid candidatoId, Guid candidaturaId, DateTimeOffset emUtc)
    {
        db.NotificacoesCandidaturaLogs.Add(new NotificacaoCandidaturaLog
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CandidatoId = candidatoId,
            CandidaturaId = candidaturaId,
            Canal = CanalNotificacao.WhatsApp,
            Status = NotificacaoStatus.Enviado,
            EtapaMacro = EtapaMacroCandidatura.EmTriagem,
            Destino = "+5511987654321",
            CriadoEmUtc = emUtc,
        });
        db.SaveChanges();
    }

    // ── Onda 9 — Rate limit ────────────────────────────────────────────────

    [Fact]
    public async Task Onda9_RateLimit_AbaixoDoLimite_PermiteEnvio()
    {
        var h = Build(new WhatsAppOptions { RateLimitMaxMensagens = 3, RateLimitJanelaMinutos = 60 });
        var (candId, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia { CanalEmail = false, CanalWhatsapp = true });
        var now = DateTimeOffset.UtcNow;

        // 2 envios anteriores na janela — abaixo de 3
        SeedLogEnviado(h.Db, candId, cdId, now.AddMinutes(-30));
        SeedLogEnviado(h.Db, candId, cdId, now.AddMinutes(-10));

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        var ultimo = h.Db.NotificacoesCandidaturaLogs.OrderByDescending(l => l.CriadoEmUtc).First();
        Assert.Equal(NotificacaoStatus.Enviado, ultimo.Status);
    }

    [Fact]
    public async Task Onda9_RateLimit_AtingidoLimite_LogaIgnorado()
    {
        var h = Build(new WhatsAppOptions { RateLimitMaxMensagens = 2, RateLimitJanelaMinutos = 60 });
        var (candId, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia { CanalEmail = false, CanalWhatsapp = true });
        var now = DateTimeOffset.UtcNow;

        // 2 envios — atinge o limite
        SeedLogEnviado(h.Db, candId, cdId, now.AddMinutes(-30));
        SeedLogEnviado(h.Db, candId, cdId, now.AddMinutes(-10));

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        var ignorado = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Status == NotificacaoStatus.IgnoradoRateLimit);
        Assert.Contains("limit=2", ignorado.ErroMensagem);
        Assert.Contains("janela=60min", ignorado.ErroMensagem);
    }

    [Fact]
    public async Task Onda9_RateLimit_LogsForaDaJanela_NaoContam()
    {
        var h = Build(new WhatsAppOptions { RateLimitMaxMensagens = 2, RateLimitJanelaMinutos = 30 });
        var (candId, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia { CanalEmail = false, CanalWhatsapp = true });
        var now = DateTimeOffset.UtcNow;

        // Logs antigos fora da janela de 30min
        SeedLogEnviado(h.Db, candId, cdId, now.AddHours(-2));
        SeedLogEnviado(h.Db, candId, cdId, now.AddHours(-1));

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Onda9_RateLimit_OverrideNaPreferencia_PrevaleceSobreDefault()
    {
        // Default global = 100/60min, mas preferência override = 1/60min → bloqueia
        var h = Build(new WhatsAppOptions { RateLimitMaxMensagens = 100, RateLimitJanelaMinutos = 60 });
        var (candId, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = false,
            CanalWhatsapp = true,
            WhatsAppRateLimitMaxMensagens = 1,
            WhatsAppRateLimitJanelaMinutos = 60,
        });
        var now = DateTimeOffset.UtcNow;
        SeedLogEnviado(h.Db, candId, cdId, now.AddMinutes(-15));

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        var ignorado = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Status == NotificacaoStatus.IgnoradoRateLimit);
        Assert.Contains("limit=1", ignorado.ErroMensagem);
    }

    [Fact]
    public async Task Onda9_RateLimit_LimiteZero_DesabilitaContagem()
    {
        var h = Build(new WhatsAppOptions { RateLimitMaxMensagens = 0, RateLimitJanelaMinutos = 60 });
        var (candId, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia { CanalEmail = false, CanalWhatsapp = true });
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < 50; i++) SeedLogEnviado(h.Db, candId, cdId, now.AddMinutes(-i));

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── Onda 10 — Janela de silêncio ───────────────────────────────────────

    [Fact]
    public async Task Onda10_Silencio_AtivoEDentroDaJanela_LogaIgnorado()
    {
        var h = Build();
        var horaLocal = DateTimeOffset.Now.LocalDateTime.ToString("HH:mm");
        var inicio = (int.Parse(horaLocal[..2]) - 1 + 24) % 24;
        var fim = (int.Parse(horaLocal[..2]) + 1) % 24;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = false,
            CanalWhatsapp = true,
            SilencioAtivo = "true",
            SilencioInicio = $"{inicio:D2}:00",
            SilencioFim = $"{fim:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        var log = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.WhatsApp);
        Assert.Equal(NotificacaoStatus.IgnoradoSilencio, log.Status);
    }

    [Fact]
    public async Task Onda10_Silencio_ForaDaJanela_PermiteEnvio()
    {
        var h = Build();
        var hora = DateTimeOffset.Now.LocalDateTime.Hour;
        // Janela em horário oposto
        var inicio = (hora + 4) % 24;
        var fim = (hora + 6) % 24;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = false,
            CanalWhatsapp = true,
            SilencioAtivo = "true",
            SilencioInicio = $"{inicio:D2}:00",
            SilencioFim = $"{fim:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Onda10_Silencio_JanelaCruzandoMeiaNoite_FuncionaCorretamente()
    {
        // Janela 22:00 → 07:00 (cruza meia-noite). Testa hora 23:30 (dentro), 12:00 (fora), 06:00 (dentro).
        var pref = new CandidatoNotificacaoPreferencia
        {
            SilencioAtivo = "true",
            SilencioInicio = "22:00",
            SilencioFim = "07:00",
        };
        // O helper compara a hora LOCAL do servidor contra a janela. Para o teste
        // valer em qualquer máquina (CI em UTC, dev em UTC-3 etc.), construímos
        // o DateTimeOffset com o offset local — assim LocalDateTime.TimeOfDay
        // recupera exatamente as horas que queremos validar.
        var d = DateTime.SpecifyKind(DateTime.Today, DateTimeKind.Unspecified);
        DateTimeOffset At(double horas)
        {
            var instant = d.AddHours(horas);
            return new DateTimeOffset(instant, TimeZoneInfo.Local.GetUtcOffset(instant));
        }

        Assert.True(CandidaturaNotificacaoService.EstaDentroSilencio(pref, At(23.5), out _));
        Assert.False(CandidaturaNotificacaoService.EstaDentroSilencio(pref, At(12), out _));
        Assert.True(CandidaturaNotificacaoService.EstaDentroSilencio(pref, At(6), out _));
        Assert.False(CandidaturaNotificacaoService.EstaDentroSilencio(pref, At(7), out _));
    }

    [Fact]
    public void Onda10_Silencio_DesligadoQuandoSemValores_NaoBloqueia()
    {
        var pref = new CandidatoNotificacaoPreferencia
        {
            SilencioAtivo = "true",
            SilencioInicio = null,
            SilencioFim = null,
        };
        Assert.False(CandidaturaNotificacaoService.EstaDentroSilencio(pref, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public void Onda10_Silencio_SilencioAtivoFalse_NaoBloqueia()
    {
        var pref = new CandidatoNotificacaoPreferencia
        {
            SilencioAtivo = "false",
            SilencioInicio = "00:00",
            SilencioFim = "23:59",
        };
        Assert.False(CandidaturaNotificacaoService.EstaDentroSilencio(pref, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public async Task Onda10_Silencio_DesabilitadoNaOptions_NaoBloqueia()
    {
        var h = Build(new WhatsAppOptions { RespeitarSilencio = false });
        var hora = DateTimeOffset.Now.LocalDateTime.Hour;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = false,
            CanalWhatsapp = true,
            SilencioAtivo = "true",
            SilencioInicio = $"{hora:D2}:00",
            SilencioFim = $"{(hora + 1) % 24:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── Onda 11 — Idioma ───────────────────────────────────────────────────

    [Fact]
    public async Task Onda11_Idioma_PreferenciaEnUS_PassaIdiomaAoTemplate()
    {
        // Sem _templateService injetado, cai no fallback hardcoded — não há como verificar
        // o idioma propagado. Mas o caminho não-feliz (o sender é chamado mesmo sem idioma)
        // garante que o resolve não quebra o pipeline.
        var h = Build();
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = false,
            CanalWhatsapp = true,
            Idioma = "en-US",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Onda11_Idioma_TemplateServiceRecebeIdiomaDoCandidato()
    {
        // Configura um template service real e checa se ele recebe o idioma certo.
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(dbOptions, tenantMock.Object);
        var emailMock = new Mock<IEmailQueueService>();
        emailMock
            .Setup(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantTeste });
        var whatsMock = new Mock<IWhatsAppMessageSender>();
        whatsMock
            .Setup(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WhatsAppSendResult(Accepted: true));
        var tmplMock = new Mock<INotificacaoTemplateService>();
        tmplMock
            .Setup(x => x.GetEfetivoAsync(It.IsAny<EtapaMacroCandidatura>(), It.IsAny<CanalNotificacao>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NotificacaoTemplateEfetivo(EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email, "Subj EN", "Body EN", false));

        var svc = new CandidaturaNotificacaoService(
            db, tenantMock.Object, emailMock.Object, whatsMock.Object,
            NullLogger<CandidaturaNotificacaoService>.Instance,
            Options.Create(new WhatsAppOptions()),
            tmplMock.Object);

        var (_, cdId) = Seed(db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = false,
            Idioma = "en-US",
        });

        await svc.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        // Deve ter chamado a sobrecarga com idioma = "en-US"
        tmplMock.Verify(x => x.GetEfetivoAsync(EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email, "en-US", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Onda11_Idioma_SemPreferencia_UsaIdiomaDefaultDasOptions()
    {
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(dbOptions, tenantMock.Object);
        var emailMock = new Mock<IEmailQueueService>();
        emailMock
            .Setup(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantTeste });
        var whatsMock = new Mock<IWhatsAppMessageSender>();
        var tmplMock = new Mock<INotificacaoTemplateService>();
        tmplMock
            .Setup(x => x.GetEfetivoAsync(It.IsAny<EtapaMacroCandidatura>(), It.IsAny<CanalNotificacao>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NotificacaoTemplateEfetivo(EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email, "Subj", "Body", false));

        var svc = new CandidaturaNotificacaoService(
            db, tenantMock.Object, emailMock.Object, whatsMock.Object,
            NullLogger<CandidaturaNotificacaoService>.Instance,
            Options.Create(new WhatsAppOptions { IdiomaDefault = "es-ES" }),
            tmplMock.Object);

        // Sem preferência (Idioma null) → deve usar "es-ES" do options
        var candidato = new Candidato { Id = Guid.NewGuid(), TenantId = TenantTeste, Nome = "X", Email = "x@y.com" };
        db.Candidatos.Add(candidato);
        var vaga = new RHPortal.Api.Domain.Entities.Vaga { Id = Guid.NewGuid(), TenantId = TenantTeste, Titulo = "Job", Status = VagaStatus.Aberta };
        db.Vagas.Add(vaga);
        var cd = new Candidatura
        {
            Id = Guid.NewGuid(), TenantId = TenantTeste, CandidatoId = candidato.Id, VagaId = vaga.Id,
            Status = CandidaturaStatus.Ativa, EtapaMacro = EtapaMacroCandidatura.Aplicada,
            AplicadaEmUtc = DateTimeOffset.UtcNow, EtapaAtualDesdeUtc = DateTimeOffset.UtcNow,
            CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Candidaturas.Add(cd);
        db.SaveChanges();

        await svc.NotificarMudancaEtapaAsync(cd.Id, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        tmplMock.Verify(x => x.GetEfetivoAsync(EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email, "es-ES", It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── Sessão 28 — Silêncio aplicado ao canal e-mail ─────────────────────────
    // Antes o silêncio só cobria WhatsApp. Agora a flag WhatsAppOptions.RespeitarSilencio
    // (nome histórico) cobre ambos os canais; o enum NotificacaoStatus.IgnoradoSilencio
    // passa a ser canal-agnóstico de fato.

    [Fact]
    public async Task Sessao28_Silencio_Email_AtivoEDentroDaJanela_LogaIgnorado()
    {
        var h = Build();
        // Janela que contém a hora local atual (mesma técnica do teste Onda10 de WhatsApp).
        var hora = DateTimeOffset.Now.LocalDateTime.Hour;
        var inicio = (hora - 1 + 24) % 24;
        var fim = (hora + 1) % 24;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = false,
            SilencioAtivo = "true",
            SilencioInicio = $"{inicio:D2}:00",
            SilencioFim = $"{fim:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.EmailMock.Verify(
            x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
        var log = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.Email);
        Assert.Equal(NotificacaoStatus.IgnoradoSilencio, log.Status);
        Assert.NotNull(log.ErroMensagem);
        Assert.Contains("silencio=", log.ErroMensagem);
    }

    [Fact]
    public async Task Sessao28_Silencio_Email_ForaDaJanela_PermiteEnvio()
    {
        var h = Build();
        // Janela em horário oposto ao atual.
        var hora = DateTimeOffset.Now.LocalDateTime.Hour;
        var inicio = (hora + 4) % 24;
        var fim = (hora + 6) % 24;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = false,
            SilencioAtivo = "true",
            SilencioInicio = $"{inicio:D2}:00",
            SilencioFim = $"{fim:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.EmailMock.Verify(
            x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
        var log = h.Db.NotificacoesCandidaturaLogs.Single(l => l.Canal == CanalNotificacao.Email);
        Assert.Equal(NotificacaoStatus.Enviado, log.Status);
    }

    [Fact]
    public async Task Sessao28_Silencio_Email_DesabilitadoNaOptions_NaoBloqueia()
    {
        var h = Build(new WhatsAppOptions { RespeitarSilencio = false });
        var hora = DateTimeOffset.Now.LocalDateTime.Hour;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = false,
            SilencioAtivo = "true",
            SilencioInicio = $"{hora:D2}:00",
            SilencioFim = $"{(hora + 1) % 24:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Entrevista, CancellationToken.None);

        h.EmailMock.Verify(
            x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Sessao28_Silencio_AtivoEmJanela_BloqueiaAmbosOsCanais()
    {
        // Smoke: com opt-in em ambos os canais e silêncio vigente, deve logar
        // IgnoradoSilencio em e-mail e em WhatsApp — sem nenhuma entrega efetiva.
        var h = Build();
        var hora = DateTimeOffset.Now.LocalDateTime.Hour;
        var inicio = (hora - 1 + 24) % 24;
        var fim = (hora + 1) % 24;
        var (_, cdId) = Seed(h.Db, new CandidatoNotificacaoPreferencia
        {
            CanalEmail = true,
            CanalWhatsapp = true,
            SilencioAtivo = "true",
            SilencioInicio = $"{inicio:D2}:00",
            SilencioFim = $"{fim:D2}:00",
        });

        await h.Service.NotificarMudancaEtapaAsync(cdId, EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.Proposta, CancellationToken.None);

        h.EmailMock.Verify(x => x.EnqueueRawAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
        h.WhatsMock.Verify(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

        var logs = h.Db.NotificacoesCandidaturaLogs.ToList();
        Assert.Equal(2, logs.Count);
        Assert.All(logs, l => Assert.Equal(NotificacaoStatus.IgnoradoSilencio, l.Status));
    }
}
