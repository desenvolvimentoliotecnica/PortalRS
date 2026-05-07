using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Owner;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Application.Owner;

public sealed class TotvsGestorHierarchyOwnerService : ITotvsGestorHierarchyOwnerService
{
    private readonly MasterDbContext _masterDb;
    private readonly ISecretProtector _protector;
    private readonly TotvsGestorHierarchyRunRegistry _registry;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TotvsGestorHierarchyOwnerService> _logger;

    public TotvsGestorHierarchyOwnerService(
        MasterDbContext masterDb,
        ISecretProtector protector,
        TotvsGestorHierarchyRunRegistry registry,
        IServiceScopeFactory scopeFactory,
        ILogger<TotvsGestorHierarchyOwnerService> logger)
    {
        _masterDb = masterDb;
        _protector = protector;
        _registry = registry;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<TotvsGestorHierarchySettingsView?> GetSettingsAsync(string tenantId, CancellationToken ct)
    {
        var tid = tenantId.Trim();
        var row = await _masterDb.TenantTotvsGestorHierarchySettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tid, ct);
        if (row is null)
            return null;

        return MapView(row);
    }

    public async Task<TotvsGestorHierarchySettingsView> SaveSettingsAsync(TotvsGestorHierarchySettingsSaveRequest request, CancellationToken ct)
    {
        var tid = request.TenantId.Trim();
        var existsTenant = await _masterDb.Tenants.AsNoTracking().AnyAsync(t => t.TenantId == tid, ct);
        if (!existsTenant)
            throw new InvalidOperationException("Tenant não encontrado.");

        var tpl = (request.ConsultaUrlTemplate ?? "").Trim();
        if (!tpl.Contains("{CODCOLIGADA}", StringComparison.Ordinal) || !tpl.Contains("{CHAPA}", StringComparison.Ordinal))
            throw new InvalidOperationException("Informe a URL com {CODCOLIGADA} e {CHAPA}.");

        var delay = Math.Clamp(request.DelayMsBetweenRequests, 0, 60_000);
        var defCol = Math.Max(1, request.DefaultCodColigada);
        var user = (request.HttpUser ?? "").Trim();
        var now = DateTimeOffset.UtcNow;

        var entity = await _masterDb.TenantTotvsGestorHierarchySettings
            .FirstOrDefaultAsync(x => x.TenantId == tid, ct);

        if (entity is null)
        {
            entity = new TenantTotvsGestorHierarchySettings
            {
                TenantId = tid,
            };
            _masterDb.TenantTotvsGestorHierarchySettings.Add(entity);
        }

        entity.ConsultaUrlTemplate = tpl;
        entity.HttpUser = user.Length > 200 ? user[..200] : user;
        entity.DefaultCodColigada = defCol;
        entity.DelayMsBetweenRequests = delay;
        entity.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(request.HttpPassword))
        {
            try
            {
                entity.PasswordEncrypted = _protector.Encrypt(request.HttpPassword);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao criptografar senha Gestor Hierarchy");
                throw new InvalidOperationException("Falha ao armazenar senha.", ex);
            }
        }
        else if (string.IsNullOrWhiteSpace(entity.PasswordEncrypted))
        {
            throw new InvalidOperationException("Informe a senha HTTP na primeira configuração.");
        }

        if (string.IsNullOrWhiteSpace(entity.HttpUser))
            throw new InvalidOperationException("Informe o usuário HTTP.");

        await _masterDb.SaveChangesAsync(ct);
        return MapView(entity);
    }

    private static TotvsGestorHierarchySettingsView MapView(TenantTotvsGestorHierarchySettings row)
    {
        return new TotvsGestorHierarchySettingsView
        {
            TenantId = row.TenantId,
            ConsultaUrlTemplate = row.ConsultaUrlTemplate,
            HttpUser = row.HttpUser,
            PasswordConfigured = !string.IsNullOrWhiteSpace(row.PasswordEncrypted),
            DefaultCodColigada = row.DefaultCodColigada,
            DelayMsBetweenRequests = row.DelayMsBetweenRequests,
        };
    }

    public Task<TotvsGestorHierarchyRunStartResponse> StartSyncAsync(string tenantId, CancellationToken ct)
    {
        var tid = tenantId.Trim();

        var handle = _registry.Register(tid);

        _ = Task.Run(async () =>
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var runner = scope.ServiceProvider.GetRequiredService<TotvsGestorHierarchySyncRunner>();
            try
            {
                await runner.RunAsync(handle, handle.Cancellation.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                handle.AddLine("Execução cancelada.");
                handle.CompleteCancelled();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gestor Hierarchy sync falhou tenant {Tenant}", tid);
                handle.AddLine($"FATAL: {ex.Message}");
                handle.CompleteFailed(ex.Message);
            }
            finally
            {
                _registry.ForgetAfter(handle.RunId, TimeSpan.FromHours(3));
            }
        }, CancellationToken.None);

        return Task.FromResult(new TotvsGestorHierarchyRunStartResponse { RunId = handle.RunId });
    }

    public TotvsGestorHierarchyRunDto? GetRun(Guid runId)
    {
        if (!_registry.TryGet(runId, out var h) || h is null)
            return null;

        return new TotvsGestorHierarchyRunDto
        {
            RunId = h.RunId,
            TenantId = h.TenantId,
            Status = h.Status,
            ErrorMessage = h.ErrorMessage,
            StartedAtUtc = h.StartedAtUtc,
            EndedAtUtc = h.EndedAtUtc,
            ProgressCurrent = h.ProgressCurrent,
            ProgressTotal = h.ProgressTotal,
            LogLines = h.GetLogTail(650),
        };
    }

    public bool RequestCancel(Guid runId)
    {
        if (!_registry.TryGet(runId, out var h) || h is null)
            return false;
        if (h.Status != TotvsGestorHierarchyRunUiStatus.Running)
            return false;
        try
        {
            h.Cancellation.Cancel();
            return true;
        }
        catch
        {
            return false;
        }
    }
}
