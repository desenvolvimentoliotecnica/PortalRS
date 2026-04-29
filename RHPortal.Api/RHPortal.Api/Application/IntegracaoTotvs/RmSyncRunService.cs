using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.IntegracaoTotvs;

public sealed class RmSyncRunService : IRmSyncRunService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IConfiguration _config;
    private readonly ILogger<RmSyncRunService> _logger;
    private static readonly object _runNowLock = new();
    private static int? _activeManualRunPid;
    private static DateTimeOffset _activeManualRunStartedAt;

    public RmSyncRunService(
        AppDbContext db,
        ITenantContext tenantContext,
        IConfiguration config,
        ILogger<RmSyncRunService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _config = config;
        _logger = logger;
    }

    public async Task<Guid> StartAsync(StartRmSyncRunRequest request, CancellationToken ct)
    {
        var run = new RmSyncRun
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Entidade = (request.Entidade ?? string.Empty).Trim(),
            Operacao = string.IsNullOrWhiteSpace(request.Operacao) ? "full" : request.Operacao.Trim(),
            StartedAtUtc = DateTimeOffset.UtcNow,
            Status = RmSyncStatus.InProgress,
            WatermarkAplicadoUtc = request.WatermarkAplicadoUtc,
        };
        _db.RmSyncRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        return run.Id;
    }

    public async Task FinishAsync(Guid id, FinishRmSyncRunRequest request, CancellationToken ct)
    {
        var run = await _db.RmSyncRuns.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException($"RmSyncRun {id} não encontrado para o tenant atual.");

        run.EndedAtUtc = DateTimeOffset.UtcNow;
        run.Status = request.Status;
        run.TotalLidos = request.TotalLidos;
        run.Criados = request.Criados;
        run.Atualizados = request.Atualizados;
        run.Ignorados = request.Ignorados;
        run.ErroMensagem = string.IsNullOrWhiteSpace(request.ErroMensagem)
            ? null
            : request.ErroMensagem.Length > 2000 ? request.ErroMensagem[..2000] : request.ErroMensagem;
        run.WatermarkNovoUtc = request.WatermarkNovoUtc;

        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<OwnerPainelSyncRmRow>> OwnerListAsync(
        string? tenantId,
        string? entidade,
        RmSyncStatus? status,
        DateTimeOffset? desde,
        int limit,
        CancellationToken ct)
    {
        var q = _db.Set<RmSyncRun>()
            .AsNoTracking()
            .IgnoreQueryFilters();   // cross-tenant: Owner vê todos os tenants

        if (!string.IsNullOrWhiteSpace(tenantId))
            q = q.Where(x => x.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(entidade))
            q = q.Where(x => x.Entidade == entidade);

        if (status.HasValue)
            q = q.Where(x => x.Status == status.Value);

        if (desde.HasValue)
            q = q.Where(x => x.StartedAtUtc >= desde.Value);

        var safeLimit = limit <= 0 ? 200 : Math.Min(limit, 1000);

        return await q
            .OrderByDescending(x => x.StartedAtUtc)
            .Take(safeLimit)
            .Select(x => new OwnerPainelSyncRmRow(
                x.TenantId,
                x.Id,
                x.Entidade,
                x.Operacao,
                x.Status,
                x.TotalLidos,
                x.Criados,
                x.Atualizados,
                x.Ignorados,
                x.StartedAtUtc,
                x.EndedAtUtc,
                x.ErroMensagem,
                x.WatermarkAplicadoUtc,
                x.WatermarkNovoUtc))
            .ToListAsync(ct);
    }

    public async Task<RmSyncCheckpointResponse> GetCheckpointAsync(string entidade, CancellationToken ct)
    {
        var key = (entidade ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(key))
            throw new ArgumentException("Entidade é obrigatória.", nameof(entidade));

        var existing = await _db.RmSyncCheckpoints
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Entidade == key, ct);

        return existing is null
            ? new RmSyncCheckpointResponse(key, null, null, null)
            : new RmSyncCheckpointResponse(existing.Entidade, existing.LastRecModifiedOn, existing.LastRunAtUtc, existing.LastRunStatus);
    }

    public async Task UpdateCheckpointAsync(UpdateRmSyncCheckpointRequest request, CancellationToken ct)
    {
        var key = (request.Entidade ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(key))
            throw new ArgumentException("Entidade é obrigatória.", nameof(request));

        var existing = await _db.RmSyncCheckpoints.FirstOrDefaultAsync(x => x.Entidade == key, ct);
        if (existing is null)
        {
            existing = new RmSyncCheckpoint
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                Entidade = key,
            };
            _db.RmSyncCheckpoints.Add(existing);
        }

        existing.LastRecModifiedOn = request.LastRecModifiedOn;
        existing.LastRunAtUtc = DateTimeOffset.UtcNow;
        existing.LastRunStatus = request.LastRunStatus;

        await _db.SaveChangesAsync(ct);
    }

    public async Task ResetCheckpointAsync(string entidade, CancellationToken ct)
    {
        var key = (entidade ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(key)) return;
        var existing = await _db.RmSyncCheckpoints.FirstOrDefaultAsync(x => x.Entidade == key, ct);
        if (existing is null) return;
        existing.LastRecModifiedOn = null;
        existing.Notes = $"Reset em {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC";
        await _db.SaveChangesAsync(ct);
    }

    public async Task ResetAllCheckpointsAsync(CancellationToken ct)
    {
        var all = await _db.RmSyncCheckpoints.ToListAsync(ct);
        var stamp = $"Reset (full) em {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC";
        foreach (var cp in all)
        {
            cp.LastRecModifiedOn = null;
            cp.Notes = stamp;
        }
        if (all.Count > 0)
            await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<OwnerPainelAlertaRmRow>> OwnerListAlertasAsync(
        string? tenantId,
        bool incluirResolvidos,
        int limit,
        CancellationToken ct)
    {
        var q = _db.Set<RmSyncAlerta>()
            .AsNoTracking()
            .IgnoreQueryFilters();

        if (!string.IsNullOrWhiteSpace(tenantId))
            q = q.Where(x => x.TenantId == tenantId);

        if (!incluirResolvidos)
            q = q.Where(x => x.ResolvidoEmUtc == null);

        var safeLimit = limit <= 0 ? 200 : Math.Min(limit, 1000);

        return await q
            .OrderByDescending(x => x.DetectadoEmUtc)
            .Take(safeLimit)
            .Select(x => new OwnerPainelAlertaRmRow(
                x.TenantId,
                x.Id,
                x.Tipo,
                x.EntidadeNome,
                x.EntidadeId,
                x.ChaveRm,
                x.DetectadoEmUtc,
                x.CiclosAusente,
                x.ResolvidoEmUtc,
                x.Acao))
            .ToListAsync(ct);
    }

    public async Task ResolverAlertaAsync(Guid alertaId, ResolverAlertaRequest request, CancellationToken ct)
    {
        var alerta = await _db.Set<RmSyncAlerta>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == alertaId, ct)
            ?? throw new KeyNotFoundException($"Alerta {alertaId} não encontrado.");

        if (alerta.ResolvidoEmUtc is not null)
            return; // já resolvido — idempotente

        alerta.ResolvidoEmUtc = DateTimeOffset.UtcNow;
        alerta.Acao = string.IsNullOrWhiteSpace(request.Acao) ? "Resolvido manualmente pelo Owner" : request.Acao.Trim();
        await _db.SaveChangesAsync(ct);
    }

    public Task<int?> TriggerRunNowAsync(CancellationToken ct)
    {
        // Resolve o caminho do worker. Em container ele é publicado junto da API; no dev local
        // mantemos fallback para o projeto fonte.
        var workerDir = ResolveWorkerDirectory(_config["RmSync:WorkerProjectPath"]);

        if (!Directory.Exists(workerDir))
        {
            _logger.LogWarning("TriggerRunNow: diretório do worker não encontrado: {Dir}", workerDir);
            throw new DirectoryNotFoundException($"Diretório do worker não encontrado: {workerDir}");
        }

        var workerDll = Path.Combine(workerDir, "Liotecnica.Integration.RM.dll");
        var workerProject = Path.Combine(workerDir, "Liotecnica.Integration.RM.csproj");
        ClearCancelRequest();

        lock (_runNowLock)
        {
            // Se há um manual run vivo recente (<5 min), não dispara outro.
            if (_activeManualRunPid.HasValue)
            {
                var stillAlive = false;
                try
                {
                    var p = Process.GetProcessById(_activeManualRunPid.Value);
                    stillAlive = !p.HasExited;
                }
                catch { stillAlive = false; }

                if (stillAlive && DateTimeOffset.UtcNow - _activeManualRunStartedAt < TimeSpan.FromMinutes(15))
                {
                    _logger.LogInformation("TriggerRunNow: já existe ciclo manual rodando (PID={Pid}).", _activeManualRunPid);
                    return Task.FromResult<int?>(null);
                }
                _activeManualRunPid = null;
            }

            var psi = new ProcessStartInfo
            {
                FileName = "dotnet",
                WorkingDirectory = workerDir,
                UseShellExecute = false,
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                CreateNoWindow = true,
            };

            if (File.Exists(workerDll))
            {
                psi.ArgumentList.Add("Liotecnica.Integration.RM.dll");
                psi.ArgumentList.Add("sync");
            }
            else if (File.Exists(workerProject))
            {
                psi.ArgumentList.Add("run");
                psi.ArgumentList.Add("--project");
                psi.ArgumentList.Add(workerProject);
                psi.ArgumentList.Add("--");
                psi.ArgumentList.Add("sync");
            }
            else
            {
                throw new FileNotFoundException(
                    $"Worker RM não encontrado em {workerDir}. Esperado Liotecnica.Integration.RM.dll ou Liotecnica.Integration.RM.csproj.");
            }

            psi.Environment["DOTNET_ENVIRONMENT"] = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Development";
            psi.Environment["ASPNETCORE_ENVIRONMENT"] = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

            var proc = Process.Start(psi)
                ?? throw new InvalidOperationException("Process.Start retornou null.");

            _activeManualRunPid = proc.Id;
            _activeManualRunStartedAt = DateTimeOffset.UtcNow;
            _logger.LogInformation("TriggerRunNow: worker disparado em {Dir} (PID={Pid}).", workerDir, proc.Id);
            return Task.FromResult<int?>(proc.Id);
        }
    }

    public Task<OwnerRmSyncCancelResponse> RequestCancelAsync(CancellationToken ct)
    {
        var requestedAt = DateTimeOffset.UtcNow;
        var path = ResolveCancelRequestPath();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, $"requestedAtUtc={requestedAt:O}{Environment.NewLine}");
        _logger.LogInformation("RequestCancel: solicitacao de interrupcao RM registrada em {Path}.", path);

        return Task.FromResult(new OwnerRmSyncCancelResponse(
            true,
            requestedAt,
            "Interrupcao solicitada. O worker vai parar no proximo ponto seguro."));
    }

    private static string ResolveWorkerDirectory(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(configured);
        }

        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Liotecnica.Integration.RM"),
            "/app/Liotecnica.Integration.RM",
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "Liotecnica.Integration.RM")
        };

        return candidates
            .Select(Path.GetFullPath)
            .FirstOrDefault(Directory.Exists)
            ?? Path.GetFullPath(candidates[^1]);
    }

    private void ClearCancelRequest()
    {
        var path = ResolveCancelRequestPath();
        if (File.Exists(path))
            File.Delete(path);
    }

    private string ResolveCancelRequestPath()
    {
        var configured = _config["RmSync:WorkerCancelPath"];
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(configured);

        return Path.Combine(ResolveRmSyncLogsDirectory(), "cancel.request");
    }

    private string ResolveRmSyncLogsDirectory()
    {
        var configuredLogPath = _config["RmSync:WorkerLogPath"];
        if (!string.IsNullOrWhiteSpace(configuredLogPath))
        {
            var fullLogPath = Path.GetFullPath(configuredLogPath);
            return Path.GetDirectoryName(fullLogPath) ?? AppContext.BaseDirectory;
        }

        var workerPath = _config["RmSync:WorkerProjectPath"];
        var baseDir = !string.IsNullOrWhiteSpace(workerPath)
            ? Directory.GetParent(Path.GetFullPath(workerPath))?.FullName
            : null;

        return Path.Combine(baseDir ?? AppContext.BaseDirectory, "Liotecnica.Integration.RM.Logs");
    }
}
