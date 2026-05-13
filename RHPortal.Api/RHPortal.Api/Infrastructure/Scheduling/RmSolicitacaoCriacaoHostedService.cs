using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Scheduling;

/// <summary>
/// Despacha assíncronamente a criação de requisições RM enfileiradas no portal.
/// </summary>
public sealed class RmSolicitacaoCriacaoHostedService : BackgroundService
{
    private static readonly TimeSpan[] BackoffSchedule =
    [
        TimeSpan.Zero,
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(6),
    ];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptionsMonitor<RmRequisicaoCreateOptions> _options;
    private readonly ILogger<RmSolicitacaoCriacaoHostedService> _logger;

    public RmSolicitacaoCriacaoHostedService(
        IServiceScopeFactory scopeFactory,
        IOptionsMonitor<RmRequisicaoCreateOptions> options,
        ILogger<RmSolicitacaoCriacaoHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var options = _options.CurrentValue;
            var interval = TimeSpan.FromSeconds(Math.Clamp(options.WorkerIntervalSeconds, 5, 3600));

            try
            {
                if (options.WorkerEnabled && !string.Equals(options.Mode, "disabled", StringComparison.OrdinalIgnoreCase))
                    await ProcessAllTenantsAsync(Math.Clamp(options.WorkerMaxPerTenant, 1, 200), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (ObjectDisposedException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RmSolicitacaoCriacaoHostedService batch failed.");
            }

            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessAllTenantsAsync(int maxPerTenant, CancellationToken ct)
    {
        List<string> tenantIds;
        using (var masterScope = _scopeFactory.CreateScope())
        {
            var masterDb = masterScope.ServiceProvider.GetRequiredService<MasterDbContext>();
            tenantIds = await masterDb.Tenants
                .AsNoTracking()
                .Where(t => t.IsActive)
                .Select(t => t.TenantId)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            try
            {
                await ProcessTenantAsync(tenantId, maxPerTenant, ct);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                _logger.LogWarning("Tenant {TenantId}: schema missing. Run migrations.", tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Rm request creation failed for tenant {TenantId}.", tenantId);
            }
        }
    }

    private async Task ProcessTenantAsync(string tenantId, int maxPerTenant, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tenantId);

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var integracao = scope.ServiceProvider.GetRequiredService<ISolicitacaoVagaRmIntegracaoService>();
        var now = DateTimeOffset.UtcNow;

        var ids = await db.SolicitacoesVaga
            .AsNoTracking()
            .Where(s =>
                s.TipoSolicitacao == TipoSolicitacaoVaga.AumentoQuadro
                && s.RmCriacaoSolicitadaEmUtc != null
                && string.IsNullOrWhiteSpace(s.RmRequisicaoCodigo)
                && s.IntegracaoResultado != IntegracaoResultado.FalhaDefinitiva
                && s.Status != SolicitacaoStatus.Reprovada
                && s.Status != SolicitacaoStatus.Cancelada)
            .OrderBy(s => s.RmCriacaoSolicitadaEmUtc)
            .ThenBy(s => s.CreatedAtUtc)
            .Select(s => new
            {
                s.Id,
                s.IntegracaoResultado,
                s.TentativasIntegracao,
                s.UltimaTentativaUtc
            })
            .Take(maxPerTenant * 4)
            .ToListAsync(ct);

        var dueIds = ids
            .Where(x => ShouldProcessNow(x.IntegracaoResultado, x.TentativasIntegracao, x.UltimaTentativaUtc, now))
            .Take(maxPerTenant)
            .Select(x => x.Id)
            .ToList();

        foreach (var id in dueIds)
        {
            try
            {
                await integracao.ExecutarCriacaoRequisicaoRmAsync(id, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao despachar criação RM da solicitação {SolicitacaoId} no tenant {TenantId}.", id, tenantId);
            }
        }
    }

    private static bool ShouldProcessNow(
        IntegracaoResultado? resultado,
        int tentativas,
        DateTimeOffset? ultimaTentativaUtc,
        DateTimeOffset now)
    {
        if (resultado is null)
            return tentativas == 0 || ultimaTentativaUtc is null;

        if (resultado != IntegracaoResultado.Falha)
            return false;

        if (ultimaTentativaUtc is null)
            return true;

        var backoff = BackoffSchedule[Math.Min(tentativas, BackoffSchedule.Length - 1)];
        return now - ultimaTentativaUtc.Value >= backoff;
    }
}
