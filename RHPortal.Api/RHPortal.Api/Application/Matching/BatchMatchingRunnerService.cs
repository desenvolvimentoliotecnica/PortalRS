using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Matching;

public sealed class BatchMatchingOptions
{
    public const string SectionName = "BatchMatching";
    public bool Enabled { get; set; }
    public int MaxCandidatesPerVaga { get; set; } = 100;
    public int TimeoutPerVagaMinutes { get; set; } = 30;
}

/// <summary>
/// Fila para disparar batch runs manualmente (via endpoint).
/// </summary>
public sealed class BatchMatchingQueue
{
    private readonly Channel<BatchMatchingRequest> _channel =
        Channel.CreateBounded<BatchMatchingRequest>(new BoundedChannelOptions(10)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });

    public ChannelWriter<BatchMatchingRequest> Writer => _channel.Writer;
    public ChannelReader<BatchMatchingRequest> Reader => _channel.Reader;
}

public sealed record BatchMatchingRequest(
    Guid RunId,
    string TenantId,
    List<Guid>? VagaIds,
    int MaxCandidatesPerVaga);

/// <summary>
/// BackgroundService que processa batch matching runs.
/// Escuta a fila e processa todas as vagas ativas do tenant.
/// </summary>
public sealed class BatchMatchingRunnerService : BackgroundService
{
    private readonly BatchMatchingQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BatchMatchingRunnerService> _logger;

    public BatchMatchingRunnerService(
        BatchMatchingQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<BatchMatchingRunnerService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BatchMatchingRunnerService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                while (await _queue.Reader.WaitToReadAsync(stoppingToken))
                {
                    while (_queue.Reader.TryRead(out var request))
                    {
                        await ProcessBatchRunAsync(request, stoppingToken);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "BatchMatchingRunnerService loop error.");
                await Task.Delay(5000, stoppingToken);
            }
        }

        _logger.LogInformation("BatchMatchingRunnerService stopped.");
    }

    private async Task ProcessBatchRunAsync(BatchMatchingRequest request, CancellationToken ct)
    {
        _logger.LogInformation(
            "Batch matching run starting. RunId={RunId} Tenant={TenantId}",
            request.RunId, request.TenantId);

        using var scope = _scopeFactory.CreateScope();
        var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantCtx.SetTenantId(request.TenantId);

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var aiClient = scope.ServiceProvider.GetService<IRHPortalAiMatchClient>();
        var scoreService = scope.ServiceProvider.GetRequiredService<ICandidatoVagaMatchingScoreService>();
        var rhAiOptions = scope.ServiceProvider.GetRequiredService<IOptions<RhAiOptions>>().Value;

        var run = await db.Set<BatchMatchingRun>()
            .FirstOrDefaultAsync(x => x.Id == request.RunId, ct);
        if (run is null) return;

        run.Status = BatchMatchingRunStatus.Running;
        run.StartedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        // Buscar vagas ativas
        var vagaStatuses = new[]
        {
            VagaStatus.Aberta, VagaStatus.EmTriagem,
            VagaStatus.EmEntrevistas, VagaStatus.EmOferta
        };

        List<Guid> vagaIds;
        if (request.VagaIds is { Count: > 0 })
        {
            vagaIds = await db.Vagas
                .AsNoTracking()
                .Where(v => request.VagaIds.Contains(v.Id) && vagaStatuses.Contains(v.Status))
                .Select(v => v.Id)
                .ToListAsync(ct);
        }
        else
        {
            vagaIds = await db.Vagas
                .AsNoTracking()
                .Where(v => vagaStatuses.Contains(v.Status))
                .Select(v => v.Id)
                .ToListAsync(ct);
        }

        run.TotalVagas = vagaIds.Count;
        await db.SaveChangesAsync(ct);

        if (aiClient is null)
        {
            run.Status = BatchMatchingRunStatus.Failed;
            run.LastError = "RHPortal.Ai não configurado.";
            run.CompletedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return;
        }

        var ruleVersion = rhAiOptions.ResolveRuleVersion(request.TenantId);

        // Resumabilidade: pular vagas já processadas neste run
        var processedVagaIds = await db.Set<BatchMatchingRunVaga>()
            .Where(x => x.RunId == request.RunId && x.Status == BatchMatchingRunStatus.Completed)
            .Select(x => x.VagaId)
            .ToListAsync(ct);
        var pendingVagaIds = vagaIds.Where(id => !processedVagaIds.Contains(id)).ToList();

        _logger.LogInformation(
            "Batch run {RunId}: {Total} vagas total, {Pending} pending, {Done} already done.",
            request.RunId, vagaIds.Count, pendingVagaIds.Count, processedVagaIds.Count);

        foreach (var vagaId in pendingVagaIds)
        {
            if (ct.IsCancellationRequested) break;

            var vagaRun = new BatchMatchingRunVaga
            {
                Id = Guid.NewGuid(),
                RunId = request.RunId,
                VagaId = vagaId,
                TenantId = request.TenantId,
                Status = BatchMatchingRunStatus.Running,
                StartedAtUtc = DateTimeOffset.UtcNow,
            };
            db.Set<BatchMatchingRunVaga>().Add(vagaRun);
            await db.SaveChangesAsync(ct);

            try
            {
                using var vagaCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                vagaCts.CancelAfter(TimeSpan.FromMinutes(30));

                var results = await aiClient.RunUnifiedMatchingAsync(
                    vagaId, request.TenantId, minScore: 0,
                    take: request.MaxCandidatesPerVaga, ct: vagaCts.Token);

                if (results is { Count: > 0 })
                {
                    await scoreService.ReplaceScoresForVagaAsync(
                        vagaId, results, request.TenantId, ct);
                    vagaRun.ScoresGenerated = results.Count;
                    run.TotalCandidatesScored += results.Count;
                }

                vagaRun.Status = BatchMatchingRunStatus.Completed;
                vagaRun.CompletedAtUtc = DateTimeOffset.UtcNow;

                _logger.LogInformation(
                    "Batch vaga done. RunId={RunId} VagaId={VagaId} Scores={Scores}",
                    request.RunId, vagaId, vagaRun.ScoresGenerated);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                vagaRun.Status = BatchMatchingRunStatus.Cancelled;
                vagaRun.ErrorMessage = "Batch run cancelled.";
                await db.SaveChangesAsync(CancellationToken.None);
                break;
            }
            catch (Exception ex)
            {
                vagaRun.Status = BatchMatchingRunStatus.Failed;
                vagaRun.ErrorMessage = ex.Message.Length > 2000
                    ? ex.Message[..2000]
                    : ex.Message;
                vagaRun.CompletedAtUtc = DateTimeOffset.UtcNow;
                run.FailedVagas++;

                _logger.LogWarning(ex,
                    "Batch vaga failed. RunId={RunId} VagaId={VagaId}",
                    request.RunId, vagaId);
            }

            run.ProcessedVagas++;
            run.LastProcessedVagaId = vagaId;
            await db.SaveChangesAsync(ct);
        }

        run.Status = run.FailedVagas == run.TotalVagas
            ? BatchMatchingRunStatus.Failed
            : BatchMatchingRunStatus.Completed;
        run.CompletedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Batch matching run completed. RunId={RunId} Processed={Processed}/{Total} Failed={Failed} Scored={Scored}",
            request.RunId, run.ProcessedVagas, run.TotalVagas, run.FailedVagas, run.TotalCandidatesScored);
    }
}
