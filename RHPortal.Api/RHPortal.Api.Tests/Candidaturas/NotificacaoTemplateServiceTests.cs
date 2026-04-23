using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Candidaturas;

/// <summary>
/// Cobertura do editor de templates por (etapa × canal). Garante que a matriz retorna
/// defaults quando não há override, que o save cria/atualiza overrides, que salvar o
/// default reverte para hardcoded, e que canal WhatsApp nunca carrega assunto.
/// </summary>
public sealed class NotificacaoTemplateServiceTests
{
    private const string TenantTeste = "tenant-templates";

    private static (AppDbContext Db, NotificacaoTemplateService Svc) Build()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);
        var db = new AppDbContext(options, tenantMock.Object);
        var svc = new NotificacaoTemplateService(db, tenantMock.Object);
        return (db, svc);
    }

    [Fact]
    public async Task ListarMatrizAsync_SemOverrides_RetornaDefaultsComAllUsaDefaultTrue()
    {
        var (_, svc) = Build();

        var matriz = await svc.ListarMatrizAsync(CancellationToken.None);

        // 7 etapas editáveis × 2 canais = 14 linhas
        Assert.Equal(14, matriz.Count);
        Assert.All(matriz, item => Assert.True(item.UsaDefault));
        Assert.All(matriz, item => Assert.Null(item.AtualizadoEmUtc));
        Assert.All(matriz, item => Assert.False(string.IsNullOrWhiteSpace(item.Corpo)));

        // Aplicada NUNCA aparece no editor (não dispara notificação automática)
        Assert.DoesNotContain(matriz, item => item.Etapa == EtapaMacroCandidatura.Aplicada);

        // WhatsApp sempre sem assunto
        Assert.All(matriz.Where(x => x.Canal == CanalNotificacao.WhatsApp), x => Assert.Null(x.Assunto));

        // Email sempre com assunto
        Assert.All(matriz.Where(x => x.Canal == CanalNotificacao.Email), x => Assert.False(string.IsNullOrWhiteSpace(x.Assunto)));
    }

    [Fact]
    public async Task SaveAsync_NovoRegistro_CriaOverrideERetornaUsaDefaultFalse()
    {
        var (db, svc) = Build();

        var item = await svc.SaveAsync(
            EtapaMacroCandidatura.Entrevista,
            CanalNotificacao.Email,
            "Assunto custom para {vagaTitulo}",
            "Corpo customizado {candidatoNome}",
            CancellationToken.None);

        Assert.False(item.UsaDefault);
        Assert.Equal("Assunto custom para {vagaTitulo}", item.Assunto);
        Assert.Equal("Corpo customizado {candidatoNome}", item.Corpo);
        Assert.NotNull(item.AtualizadoEmUtc);

        var persisted = await db.NotificacoesTemplates
            .IgnoreQueryFilters()
            .SingleAsync(t => t.Etapa == EtapaMacroCandidatura.Entrevista && t.Canal == CanalNotificacao.Email);
        Assert.Equal(TenantTeste, persisted.TenantId);
        Assert.Equal("Assunto custom para {vagaTitulo}", persisted.Assunto);
    }

    [Fact]
    public async Task SaveAsync_AtualizarExistente_AtualizaSemDuplicar()
    {
        var (db, svc) = Build();

        await svc.SaveAsync(
            EtapaMacroCandidatura.Proposta, CanalNotificacao.Email,
            "v1", "corpo v1", CancellationToken.None);

        await svc.SaveAsync(
            EtapaMacroCandidatura.Proposta, CanalNotificacao.Email,
            "v2", "corpo v2", CancellationToken.None);

        var count = await db.NotificacoesTemplates.CountAsync();
        Assert.Equal(1, count);

        var atual = await db.NotificacoesTemplates.SingleAsync();
        Assert.Equal("v2", atual.Assunto);
        Assert.Equal("corpo v2", atual.Corpo);
    }

    [Fact]
    public async Task SaveAsync_ValoresIguaisAoDefault_RemoveOverride()
    {
        var (db, svc) = Build();

        // Primeiro salva algo custom
        await svc.SaveAsync(
            EtapaMacroCandidatura.Contratado, CanalNotificacao.Email,
            "custom", "corpo custom", CancellationToken.None);
        Assert.Equal(1, await db.NotificacoesTemplates.CountAsync());

        // Recupera o default e salva com os mesmos valores → deve remover
        var def = svc.GetDefault(EtapaMacroCandidatura.Contratado, CanalNotificacao.Email);
        var item = await svc.SaveAsync(
            EtapaMacroCandidatura.Contratado, CanalNotificacao.Email,
            def.Assunto, def.Corpo, CancellationToken.None);

        Assert.True(item.UsaDefault);
        Assert.Equal(0, await db.NotificacoesTemplates.CountAsync());
    }

    [Fact]
    public async Task SaveAsync_WhatsApp_IgnoraAssunto()
    {
        var (db, svc) = Build();

        var item = await svc.SaveAsync(
            EtapaMacroCandidatura.Entrevista,
            CanalNotificacao.WhatsApp,
            "assunto que deve ser ignorado",
            "mensagem WhatsApp",
            CancellationToken.None);

        Assert.Null(item.Assunto);
        var persisted = await db.NotificacoesTemplates.SingleAsync();
        Assert.Null(persisted.Assunto);
    }

    [Fact]
    public async Task SaveAsync_CorpoVazio_LancaInvalidOperation()
    {
        var (_, svc) = Build();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SaveAsync(EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email,
                "x", "   ", CancellationToken.None));
    }

    [Fact]
    public async Task SaveAsync_CorpoExcede4000_LancaInvalidOperation()
    {
        var (_, svc) = Build();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SaveAsync(EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email,
                "x", new string('a', 4001), CancellationToken.None));
    }

    [Fact]
    public async Task GetEfetivoAsync_SemOverride_UsaDefault()
    {
        var (_, svc) = Build();

        var efetivo = await svc.GetEfetivoAsync(
            EtapaMacroCandidatura.EmTriagem, CanalNotificacao.Email, CancellationToken.None);

        Assert.True(efetivo.UsaDefault);
        Assert.False(string.IsNullOrWhiteSpace(efetivo.Assunto));
        Assert.False(string.IsNullOrWhiteSpace(efetivo.Corpo));
    }

    [Fact]
    public async Task GetEfetivoAsync_ComOverride_UsaOverride()
    {
        var (_, svc) = Build();
        await svc.SaveAsync(
            EtapaMacroCandidatura.Teste, CanalNotificacao.Email,
            "custom subj", "custom body", CancellationToken.None);

        var efetivo = await svc.GetEfetivoAsync(
            EtapaMacroCandidatura.Teste, CanalNotificacao.Email, CancellationToken.None);

        Assert.False(efetivo.UsaDefault);
        Assert.Equal("custom subj", efetivo.Assunto);
        Assert.Equal("custom body", efetivo.Corpo);
    }

    [Fact]
    public async Task RestoreDefaultAsync_RemoveOverrideExistente()
    {
        var (db, svc) = Build();
        await svc.SaveAsync(
            EtapaMacroCandidatura.Recusado, CanalNotificacao.Email,
            "s", "c", CancellationToken.None);
        Assert.Equal(1, await db.NotificacoesTemplates.CountAsync());

        await svc.RestoreDefaultAsync(
            EtapaMacroCandidatura.Recusado, CanalNotificacao.Email,
            CancellationToken.None);

        Assert.Equal(0, await db.NotificacoesTemplates.CountAsync());
    }

    [Fact]
    public async Task RestoreDefaultAsync_SemOverride_Idempotente()
    {
        var (_, svc) = Build();

        // Não deve lançar
        await svc.RestoreDefaultAsync(
            EtapaMacroCandidatura.Desistiu, CanalNotificacao.WhatsApp,
            CancellationToken.None);
    }

    [Fact]
    public void ResolverPlaceholders_SubstituiCandidatoNomeEVagaTitulo()
    {
        var resultado = NotificacaoTemplateService.ResolverPlaceholders(
            "Olá, {candidatoNome}, sobre {vagaTitulo}!", "Lucas", "Dev Senior");

        Assert.Equal("Olá, Lucas, sobre Dev Senior!", resultado);
    }

    [Fact]
    public void ResolverPlaceholders_CandidatoNomeNull_SubstituiPorVazio()
    {
        var resultado = NotificacaoTemplateService.ResolverPlaceholders(
            "{candidatoNome} / {vagaTitulo}", null, null);

        Assert.Equal(" / (vaga)", resultado);
    }

    [Fact]
    public async Task ListarMatrizAsync_ComOverrideMisto_MostraFlagsCorretos()
    {
        var (_, svc) = Build();

        await svc.SaveAsync(
            EtapaMacroCandidatura.Entrevista, CanalNotificacao.Email,
            "custom", "corpo", CancellationToken.None);

        var matriz = await svc.ListarMatrizAsync(CancellationToken.None);

        var custom = matriz.Single(x => x.Etapa == EtapaMacroCandidatura.Entrevista && x.Canal == CanalNotificacao.Email);
        Assert.False(custom.UsaDefault);
        Assert.Equal("corpo", custom.Corpo);
        Assert.NotNull(custom.AtualizadoEmUtc);

        var outro = matriz.Single(x => x.Etapa == EtapaMacroCandidatura.Entrevista && x.Canal == CanalNotificacao.WhatsApp);
        Assert.True(outro.UsaDefault);
    }
}
