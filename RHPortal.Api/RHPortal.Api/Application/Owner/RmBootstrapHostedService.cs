using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Contracts.Owner;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Owner;

public sealed class RmBootstrapHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RmBootstrapHostedService> _logger;

    public RmBootstrapHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<RmBootstrapHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = BootstrapRmSyncOptions.FromConfiguration(_configuration);
        if (!options.Enabled || options.Tenants.Count == 0)
            return;

        var delay = TimeSpan.FromSeconds(Math.Max(0, options.InitialDelaySeconds));
        if (delay > TimeSpan.Zero)
            await Task.Delay(delay, stoppingToken);

        foreach (var tenant in options.Tenants)
        {
            if (stoppingToken.IsCancellationRequested)
                return;

            try
            {
                await BootstrapTenantAsync(options, tenant, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bootstrap RM falhou para tenant {TenantId}.", tenant.TenantId);
            }
        }
    }

    private async Task BootstrapTenantAsync(
        BootstrapRmSyncOptions options,
        BootstrapRmTenantOptions tenant,
        CancellationToken ct)
    {
        var tenantId = tenant.TenantId.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(tenantId))
            return;

        var shouldRun = await ShouldRunAsync(tenantId, options.RunOnlyWhenNoRmRuns, ct);
        if (!shouldRun)
        {
            _logger.LogInformation("Bootstrap RM ignorado para tenant {TenantId}: tenant já possui runs RM.", tenantId);
            return;
        }

        await EnsureGestorSettingsAsync(tenant, ct);

        if (tenant.RunImport)
            await RunRmImportAsync(tenantId, tenant.ForceFullImport, options.RmSyncTimeoutMinutes, ct);

        if (tenant.RunGestoresRm)
            await RunGestoresRmAsync(tenantId, ct);
    }

    private async Task<bool> ShouldRunAsync(string tenantId, bool runOnlyWhenNoRmRuns, CancellationToken ct)
    {
        if (!runOnlyWhenNoRmRuns)
            return true;

        await using var scope = _scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ITenantContext>().SetTenantId(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return !await db.RmSyncRuns.AsNoTracking().AnyAsync(ct);
    }

    private async Task EnsureGestorSettingsAsync(BootstrapRmTenantOptions tenant, CancellationToken ct)
    {
        if (!tenant.RunGestoresRm)
            return;

        if (string.IsNullOrWhiteSpace(tenant.GestoresRmUrlTemplate)
            || string.IsNullOrWhiteSpace(tenant.GestoresRmUser)
            || string.IsNullOrWhiteSpace(tenant.GestoresRmPassword))
        {
            _logger.LogWarning(
                "Bootstrap RM Gestores ignorado para tenant {TenantId}: URL, usuario ou senha nao configurados.",
                tenant.TenantId);
            tenant.RunGestoresRm = false;
            return;
        }

        await using var scope = _scopeFactory.CreateAsyncScope();
        var svc = scope.ServiceProvider.GetRequiredService<ITotvsGestorHierarchyOwnerService>();
        await svc.SaveSettingsAsync(new TotvsGestorHierarchySettingsSaveRequest
        {
            TenantId = tenant.TenantId,
            ConsultaUrlTemplate = tenant.GestoresRmUrlTemplate,
            HttpUser = tenant.GestoresRmUser,
            HttpPassword = tenant.GestoresRmPassword,
            DefaultCodColigada = tenant.GestoresRmDefaultCodColigada,
            DelayMsBetweenRequests = tenant.GestoresRmDelayMsBetweenRequests
        }, ct);
    }

    private async Task RunRmImportAsync(
        string tenantId,
        bool forceFull,
        int timeoutMinutes,
        CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ITenantContext>().SetTenantId(tenantId);
        var rmSync = scope.ServiceProvider.GetRequiredService<IRmSyncRunService>();

        var pid = await rmSync.TriggerRunNowAsync(ct, forceFull);
        if (pid is null)
        {
            _logger.LogWarning("Bootstrap RM importacao nao iniciou para tenant {TenantId}: ja existe processo em execucao.", tenantId);
            return;
        }

        _logger.LogInformation("Bootstrap RM importacao iniciada para tenant {TenantId} (PID={Pid}, full={Full}).", tenantId, pid, forceFull);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromMinutes(Math.Max(1, timeoutMinutes)));

        try
        {
            var process = Process.GetProcessById(pid.Value);
            await process.WaitForExitAsync(timeoutCts.Token);
            if (process.ExitCode == 0)
            {
                _logger.LogInformation("Bootstrap RM importacao concluida para tenant {TenantId}.", tenantId);
                return;
            }

            _logger.LogWarning("Bootstrap RM importacao terminou com exit code {ExitCode} para tenant {TenantId}.", process.ExitCode, tenantId);
        }
        catch (ArgumentException)
        {
            _logger.LogInformation("Bootstrap RM importacao para tenant {TenantId}: processo PID={Pid} ja terminou.", tenantId, pid);
        }
    }

    private async Task RunGestoresRmAsync(string tenantId, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ITenantContext>().SetTenantId(tenantId);
        var runner = scope.ServiceProvider.GetRequiredService<TotvsGestorHierarchySyncRunner>();
        var handle = new TotvsGestorHierarchyRunHandle
        {
            RunId = Guid.NewGuid(),
            TenantId = tenantId
        };

        _logger.LogInformation("Bootstrap Gestores RM iniciado para tenant {TenantId}.", tenantId);
        await runner.RunAsync(handle, ct);
        if (handle.Status == TotvsGestorHierarchyRunUiStatus.Completed)
        {
            _logger.LogInformation("Bootstrap Gestores RM concluido para tenant {TenantId}.", tenantId);
            return;
        }

        _logger.LogWarning(
            "Bootstrap Gestores RM terminou com status {Status} para tenant {TenantId}: {Error}",
            handle.Status,
            tenantId,
            handle.ErrorMessage);
    }

    private sealed class BootstrapRmSyncOptions
    {
        public bool Enabled { get; init; }
        public int InitialDelaySeconds { get; init; } = 60;
        public bool RunOnlyWhenNoRmRuns { get; init; } = true;
        public int RmSyncTimeoutMinutes { get; init; } = 240;
        public IReadOnlyList<BootstrapRmTenantOptions> Tenants { get; init; } = Array.Empty<BootstrapRmTenantOptions>();

        public static BootstrapRmSyncOptions FromConfiguration(IConfiguration configuration)
        {
            var section = configuration.GetSection("BootstrapRmSync");
            var tenants = section.GetSection("Tenants")
                .GetChildren()
                .Select(BootstrapRmTenantOptions.FromConfiguration)
                .Where(x => x.Enabled && !string.IsNullOrWhiteSpace(x.TenantId))
                .ToList();

            return new BootstrapRmSyncOptions
            {
                Enabled = section.GetValue("Enabled", false),
                InitialDelaySeconds = section.GetValue("InitialDelaySeconds", 60),
                RunOnlyWhenNoRmRuns = section.GetValue("RunOnlyWhenNoRmRuns", true),
                RmSyncTimeoutMinutes = section.GetValue("RmSyncTimeoutMinutes", 240),
                Tenants = tenants
            };
        }
    }

    private sealed class BootstrapRmTenantOptions
    {
        public bool Enabled { get; init; } = true;
        public string TenantId { get; init; } = string.Empty;
        public bool RunImport { get; init; } = true;
        public bool ForceFullImport { get; init; } = true;
        public bool RunGestoresRm { get; set; } = true;
        public string GestoresRmUrlTemplate { get; init; } = string.Empty;
        public string GestoresRmUser { get; init; } = string.Empty;
        public string GestoresRmPassword { get; init; } = string.Empty;
        public int GestoresRmDefaultCodColigada { get; init; } = 1;
        public int GestoresRmDelayMsBetweenRequests { get; init; } = 250;

        public static BootstrapRmTenantOptions FromConfiguration(IConfigurationSection section) => new()
        {
            Enabled = section.GetValue("Enabled", true),
            TenantId = section["TenantId"] ?? string.Empty,
            RunImport = section.GetValue("RunImport", true),
            ForceFullImport = section.GetValue("ForceFullImport", true),
            RunGestoresRm = section.GetValue("RunGestoresRm", true),
            GestoresRmUrlTemplate = section["GestoresRmUrlTemplate"] ?? string.Empty,
            GestoresRmUser = section["GestoresRmUser"] ?? string.Empty,
            GestoresRmPassword = section["GestoresRmPassword"] ?? string.Empty,
            GestoresRmDefaultCodColigada = section.GetValue("GestoresRmDefaultCodColigada", 1),
            GestoresRmDelayMsBetweenRequests = section.GetValue("GestoresRmDelayMsBetweenRequests", 250)
        };
    }
}
