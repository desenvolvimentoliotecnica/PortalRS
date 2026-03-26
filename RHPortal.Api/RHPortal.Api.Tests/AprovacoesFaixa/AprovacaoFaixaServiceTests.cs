using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.AprovacoesFaixa;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.AprovacoesFaixa;

/// <summary>
/// Testes do AprovacaoFaixaService — Solicitar, Aprovar, Reprovar e listagens.
/// </summary>
public sealed class AprovacaoFaixaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, AprovacaoFaixaService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new AprovacaoFaixaService(db, tenantMock.Object);
        return (db, service);
    }

    /// <summary>
    /// Semeia uma FaixaSalarial — obrigatório pois SolicitarAsync valida a existência
    /// e BaseQuery faz Include com FK não-nulável (InMemory inner join).
    /// </summary>
    private static Guid SeedFaixa(AppDbContext db, decimal min = 5000m, decimal max = 10000m)
    {
        var faixa = new FaixaSalarial
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SalarioMinimo = min,
            SalarioMaximo = max,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.FaixasSalariais.Add(faixa);
        db.SaveChanges();
        return faixa.Id;
    }

    private static ClaimsPrincipal UserSemId() =>
        new(new ClaimsIdentity([]));

    // ── Solicitar ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Solicitar_FaixaExistente_RetornaSolicitacaoPendente()
    {
        var (db, svc) = CriarServico();
        var faixaId = SeedFaixa(db);

        var request = new SolicitarAprovacaoFaixaRequest(faixaId, 12000m, "Promoção merecida");

        var result = await svc.SolicitarAsync(request, UserSemId(), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(faixaId, result.FaixaSalarialId);
        Assert.Equal(12000m, result.ValorProposto);
        Assert.Equal("Promoção merecida", result.Justificativa);
        Assert.Equal(StatusAprovacaoFaixa.Pendente, result.Status);
    }

    [Fact]
    public async Task Solicitar_FaixaInexistente_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        var request = new SolicitarAprovacaoFaixaRequest(Guid.NewGuid(), 10000m, null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SolicitarAsync(request, UserSemId(), CancellationToken.None));
    }

    // ── Aprovar ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Aprovar_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.AprovarAsync(Guid.NewGuid(), new AcaoAprovacaoFaixaRequest(null), UserSemId(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Aprovar_SolicitacaoPendente_MudaParaAprovada()
    {
        var (db, svc) = CriarServico();
        var faixaId = SeedFaixa(db, 5000m, 8000m);

        var solicitacao = await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 9000m, null),
            UserSemId(), CancellationToken.None);

        var result = await svc.AprovarAsync(
            solicitacao.Id,
            new AcaoAprovacaoFaixaRequest("Aprovado pelo gestor"),
            UserSemId(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(StatusAprovacaoFaixa.Aprovada, result.Status);
        Assert.Equal("Aprovado pelo gestor", result.ObservacaoAprovador);
        Assert.NotNull(result.AprovadoEmUtc);
    }

    [Fact]
    public async Task Aprovar_AtualizaSalarioMaximoDaFaixa()
    {
        var (db, svc) = CriarServico();
        var faixaId = SeedFaixa(db, 5000m, 8000m);

        var solicitacao = await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 9500m, null),
            UserSemId(), CancellationToken.None);

        await svc.AprovarAsync(solicitacao.Id, new AcaoAprovacaoFaixaRequest(null), UserSemId(), CancellationToken.None);

        // Verifica que o salário máximo da faixa foi atualizado
        var faixaAtualizada = await db.FaixasSalariais.FindAsync(faixaId);
        Assert.NotNull(faixaAtualizada);
        Assert.Equal(9500m, faixaAtualizada.SalarioMaximo);
    }

    // ── Reprovar ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Reprovar_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ReprovarAsync(Guid.NewGuid(), new AcaoAprovacaoFaixaRequest(null), UserSemId(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Reprovar_SolicitacaoPendente_MudaParaReprovada()
    {
        var (db, svc) = CriarServico();
        var faixaId = SeedFaixa(db);

        var solicitacao = await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 15000m, null),
            UserSemId(), CancellationToken.None);

        var result = await svc.ReprovarAsync(
            solicitacao.Id,
            new AcaoAprovacaoFaixaRequest("Fora do budget"),
            UserSemId(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(StatusAprovacaoFaixa.Reprovada, result.Status);
        Assert.Equal("Fora do budget", result.ObservacaoAprovador);
    }

    // ── Listagens ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListPendentes_SemSolicitacoes_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ListPendentesAsync(CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ListPendentes_ComSolicitacoes_RetornaApenasPendentes()
    {
        var (db, svc) = CriarServico();
        var faixaId = SeedFaixa(db);

        var s1 = await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 10000m, null),
            UserSemId(), CancellationToken.None);
        var s2 = await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 12000m, null),
            UserSemId(), CancellationToken.None);

        // Aprova uma
        await svc.AprovarAsync(s1.Id, new AcaoAprovacaoFaixaRequest(null), UserSemId(), CancellationToken.None);

        var pendentes = await svc.ListPendentesAsync(CancellationToken.None);

        Assert.Single(pendentes);
        Assert.Equal(StatusAprovacaoFaixa.Pendente, pendentes[0].Status);
    }

    [Fact]
    public async Task ListTodas_RetornaTodasIndependenteDeStatus()
    {
        var (db, svc) = CriarServico();
        var faixaId = SeedFaixa(db);

        var s1 = await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 10000m, null),
            UserSemId(), CancellationToken.None);
        await svc.SolicitarAsync(
            new SolicitarAprovacaoFaixaRequest(faixaId, 12000m, null),
            UserSemId(), CancellationToken.None);

        await svc.ReprovarAsync(s1.Id, new AcaoAprovacaoFaixaRequest(null), UserSemId(), CancellationToken.None);

        var todas = await svc.ListTodasAsync(CancellationToken.None);

        Assert.Equal(2, todas.Count);
    }
}
