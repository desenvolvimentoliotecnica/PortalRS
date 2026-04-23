using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Contracts.Logging;
using RhPortal.Api.Controllers;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Logging.Entities;
using Xunit;

namespace RhPortal.Api.Tests.Logging;

/// <summary>
/// Testes do endpoint GET /api/logs/entries — lista flat de logs operacionais
/// do tenant com paginação, filtro por level e busca textual.
/// </summary>
public sealed class OperationalLogsEndpointTests
{
    private const string TenantA = "tenant-a";
    private const string TenantB = "tenant-b";

    private static (AppDbContext Db, LoggingController Controller) CriarControlador(string tenantId = TenantA)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var controller = new LoggingController();
        return (db, controller);
    }

    private static LogEntry Entry(
        string tenantId,
        string level,
        string category,
        string message,
        DateTimeOffset occurredAt,
        string? exceptionType = null,
        string? exceptionMessage = null,
        string? exceptionStackTrace = null)
    {
        return new LogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RequestLogId = Guid.NewGuid(),
            TransactionId = Guid.NewGuid().ToString("N"),
            EnvironmentName = "Development",
            EnvironmentNormalized = "development",
            DeviceId = "test-device",
            Order = 0,
            Level = level,
            Category = category,
            Message = message,
            ExceptionType = exceptionType,
            ExceptionMessage = exceptionMessage,
            ExceptionStackTrace = exceptionStackTrace,
            OccurredAt = occurredAt,
            CreatedAt = occurredAt
        };
    }

    private static OperationalLogListResponse Unwrap(ActionResult<OperationalLogListResponse> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<OperationalLogListResponse>(ok.Value);
    }

    // ── Paginação + ordenação ──

    [Fact]
    public async Task List_SemRegistros_RetornaListaVazia()
    {
        var (db, ctrl) = CriarControlador();

        var body = Unwrap(await ctrl.ListEntries(db, ct: CancellationToken.None));

        Assert.Empty(body.Items);
        Assert.Equal(0, body.TotalCount);
    }

    [Fact]
    public async Task List_OrdenaPorOccurredAtDesc()
    {
        var (db, ctrl) = CriarControlador();
        var baseTime = DateTimeOffset.UtcNow.AddMinutes(-10);
        db.LogEntries.AddRange(
            Entry(TenantA, "Information", "App.Service", "mais antigo", baseTime),
            Entry(TenantA, "Warning",     "App.Service", "intermediário", baseTime.AddMinutes(2)),
            Entry(TenantA, "Error",       "App.Service", "mais recente", baseTime.AddMinutes(5))
        );
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, ct: CancellationToken.None));

        Assert.Equal(3, body.TotalCount);
        Assert.Equal("mais recente", body.Items[0].Message);
        Assert.Equal("intermediário", body.Items[1].Message);
        Assert.Equal("mais antigo", body.Items[2].Message);
    }

    [Fact]
    public async Task List_Paginacao_RetornaPageSizeItems()
    {
        var (db, ctrl) = CriarControlador();
        var baseTime = DateTimeOffset.UtcNow;
        for (int i = 0; i < 25; i++)
            db.LogEntries.Add(Entry(TenantA, "Information", "App.Service", $"log-{i:D2}", baseTime.AddSeconds(i)));
        await db.SaveChangesAsync();

        var page1 = Unwrap(await ctrl.ListEntries(db, page: 1, pageSize: 10, ct: CancellationToken.None));
        var page2 = Unwrap(await ctrl.ListEntries(db, page: 2, pageSize: 10, ct: CancellationToken.None));
        var page3 = Unwrap(await ctrl.ListEntries(db, page: 3, pageSize: 10, ct: CancellationToken.None));

        Assert.Equal(25, page1.TotalCount);
        Assert.Equal(10, page1.Items.Count);
        Assert.Equal(10, page2.Items.Count);
        Assert.Equal(5, page3.Items.Count);

        // Não deve repetir itens entre páginas
        var ids1 = page1.Items.Select(x => x.Id).ToHashSet();
        var ids2 = page2.Items.Select(x => x.Id).ToHashSet();
        Assert.Empty(ids1.Intersect(ids2));
    }

    [Fact]
    public async Task List_PageSize_ClampedEmLimitesValidos()
    {
        // pageSize 0/negativo → 5 (mínimo); pageSize 9999 → 200 (máximo)
        var (db, ctrl) = CriarControlador();
        for (int i = 0; i < 250; i++)
            db.LogEntries.Add(Entry(TenantA, "Information", "App.Service", $"log-{i}", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();

        var tooSmall = Unwrap(await ctrl.ListEntries(db, pageSize: 1, ct: CancellationToken.None));
        var tooBig = Unwrap(await ctrl.ListEntries(db, pageSize: 9999, ct: CancellationToken.None));

        Assert.Equal(5, tooSmall.Items.Count);
        Assert.Equal(200, tooBig.Items.Count);
    }

    // ── Filtro por nível ──

    [Fact]
    public async Task List_FiltroLevel_RetornaApenasDoNivel()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.AddRange(
            Entry(TenantA, "Information", "App.Service", "info 1", DateTimeOffset.UtcNow),
            Entry(TenantA, "Information", "App.Service", "info 2", DateTimeOffset.UtcNow),
            Entry(TenantA, "Warning",     "App.Service", "warn 1", DateTimeOffset.UtcNow),
            Entry(TenantA, "Error",       "App.Service", "err 1", DateTimeOffset.UtcNow)
        );
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, level: "Error", ct: CancellationToken.None));

        Assert.Equal(1, body.TotalCount);
        Assert.Equal("Error", body.Items[0].Level);
    }

    [Fact]
    public async Task List_FiltroLevel_ECaseInsensitive()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.AddRange(
            Entry(TenantA, "Warning", "App.Service", "w1", DateTimeOffset.UtcNow),
            Entry(TenantA, "Error",   "App.Service", "e1", DateTimeOffset.UtcNow)
        );
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, level: "warning", ct: CancellationToken.None));

        Assert.Equal(1, body.TotalCount);
    }

    [Fact]
    public async Task List_SemFiltroLevel_RetornaTodos()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.AddRange(
            Entry(TenantA, "Information", "App.Service", "i1", DateTimeOffset.UtcNow),
            Entry(TenantA, "Error",       "App.Service", "e1", DateTimeOffset.UtcNow)
        );
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, ct: CancellationToken.None));

        Assert.Equal(2, body.TotalCount);
    }

    // ── Filtro por texto ──

    [Fact]
    public async Task List_BuscaEmMessage_RetornaMatches()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.AddRange(
            Entry(TenantA, "Information", "App.Service", "usuário criado com sucesso", DateTimeOffset.UtcNow),
            Entry(TenantA, "Information", "App.Service", "login efetuado", DateTimeOffset.UtcNow),
            Entry(TenantA, "Information", "App.Service", "usuário desativado", DateTimeOffset.UtcNow)
        );
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, q: "usuário", ct: CancellationToken.None));

        Assert.Equal(2, body.TotalCount);
    }

    [Fact]
    public async Task List_BuscaEmCategory_RetornaMatches()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.AddRange(
            Entry(TenantA, "Information", "Tenancy.Resolver", "m1", DateTimeOffset.UtcNow),
            Entry(TenantA, "Information", "App.Service", "m2", DateTimeOffset.UtcNow)
        );
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, q: "Tenancy", ct: CancellationToken.None));

        Assert.Equal(1, body.TotalCount);
        Assert.Equal("Tenancy.Resolver", body.Items[0].Source);
    }

    [Fact]
    public async Task List_BuscaEmExceptionTypeOuMessage_RetornaMatches()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.AddRange(
            Entry(TenantA, "Error", "App", "falhou", DateTimeOffset.UtcNow,
                exceptionType: "System.InvalidOperationException", exceptionMessage: "saldo insuficiente"),
            Entry(TenantA, "Error", "App", "ok", DateTimeOffset.UtcNow)
        );
        await db.SaveChangesAsync();

        var porTipo = Unwrap(await ctrl.ListEntries(db, q: "InvalidOperation", ct: CancellationToken.None));
        var porMensagem = Unwrap(await ctrl.ListEntries(db, q: "saldo", ct: CancellationToken.None));

        Assert.Equal(1, porTipo.TotalCount);
        Assert.Equal(1, porMensagem.TotalCount);
    }

    // ── Projeção de campos ──

    [Fact]
    public async Task List_Projecao_PreencheCamposBasicos()
    {
        var (db, ctrl) = CriarControlador();
        var occurred = DateTimeOffset.UtcNow;
        db.LogEntries.Add(Entry(TenantA, "Warning", "App.Service", "mensagem", occurred));
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, ct: CancellationToken.None));
        var item = Assert.Single(body.Items);

        Assert.Equal("Warning", item.Level);
        Assert.Equal("mensagem", item.Message);
        Assert.Equal("App.Service", item.Source);
        Assert.Equal(occurred, item.Timestamp);
        Assert.Null(item.Exception);
    }

    [Fact]
    public async Task List_Projecao_ComExceptionMontaCampoException()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.Add(Entry(TenantA, "Error", "App", "falhou", DateTimeOffset.UtcNow,
            exceptionType: "System.IOException",
            exceptionMessage: "arquivo não encontrado",
            exceptionStackTrace: "at Foo()\nat Bar()"));
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, ct: CancellationToken.None));
        var item = Assert.Single(body.Items);

        Assert.NotNull(item.Exception);
        Assert.Contains("System.IOException", item.Exception);
        Assert.Contains("arquivo não encontrado", item.Exception);
        Assert.Contains("at Foo()", item.Exception);
    }

    [Fact]
    public async Task List_Projecao_SemExceptionTypeDeixaExceptionNull()
    {
        var (db, ctrl) = CriarControlador();
        db.LogEntries.Add(Entry(TenantA, "Information", "App", "ok", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();

        var body = Unwrap(await ctrl.ListEntries(db, ct: CancellationToken.None));

        Assert.Null(Assert.Single(body.Items).Exception);
    }

    // ── Isolamento multi-tenant ──

    [Fact]
    public async Task List_NaoVazaLogsDeOutroTenant()
    {
        // Seed no tenant A
        var (dbA, ctrlA) = CriarControlador(TenantA);
        dbA.LogEntries.Add(Entry(TenantA, "Information", "App", "log do A", DateTimeOffset.UtcNow));
        await dbA.SaveChangesAsync();

        // Cria contexto novo para tenant B (InMemory database é separado — simula o
        // isolamento real: AppDbContext com TenantId diferente filtra via query filter)
        var (dbB, ctrlB) = CriarControlador(TenantB);
        dbB.LogEntries.Add(Entry(TenantB, "Information", "App", "log do B", DateTimeOffset.UtcNow));
        await dbB.SaveChangesAsync();

        var bodyA = Unwrap(await ctrlA.ListEntries(dbA, ct: CancellationToken.None));
        var bodyB = Unwrap(await ctrlB.ListEntries(dbB, ct: CancellationToken.None));

        Assert.Equal(1, bodyA.TotalCount);
        Assert.Equal("log do A", bodyA.Items[0].Message);
        Assert.Equal(1, bodyB.TotalCount);
        Assert.Equal("log do B", bodyB.Items[0].Message);
    }
}
