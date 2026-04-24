using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Worker de background que consome <see cref="IEmbeddingIndexQueue"/> e indexa
/// embeddings chamando <see cref="IEmbeddingService"/>. Roda durante toda a vida
/// do processo (IHostedService).
///
/// <para><b>Loop resiliente</b>: se Ollama estiver offline, <see cref="IEmbeddingService"/>
/// retorna false sem lançar. Itens não indexados ficam pendentes — próxima modificação
/// (ou reindexação manual via UI) cobre. Isso permite operar o sistema sem IA
/// sem travar a fila.</para>
///
/// <para><b>Concorrência</b>: SingleReader = true — não há race condition entre
/// múltiplas instâncias do worker; é 1 só que processa sequencialmente. Para escalar,
/// aumentar workers dá pra ser feito no futuro.</para>
/// </summary>
public sealed class EmbeddingIndexerHostedService : BackgroundService
{
    private readonly IEmbeddingIndexQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmbeddingIndexerHostedService> _logger;

    public EmbeddingIndexerHostedService(
        IEmbeddingIndexQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<EmbeddingIndexerHostedService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[EmbeddingIndexer] Worker iniciado — aguardando fila");
        try
        {
            await foreach (var req in _queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await ProcessOneAsync(req, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[EmbeddingIndexer] Falha ao indexar {Type} {Id} no tenant {Tenant}",
                        req.Type, req.EntityId, req.TenantId);
                }
            }
        }
        finally
        {
            _logger.LogInformation("[EmbeddingIndexer] Worker finalizado");
        }
    }

    private async Task ProcessOneAsync(EmbeddingIndexRequest req, CancellationToken ct)
    {
        // Cada pedido cria seu próprio scope — AppDbContext + ITenantContext isolados
        using var scope = _scopeFactory.CreateScope();

        // "Entra" no tenant do request (ITenantContext é Scoped, válido só neste escopo)
        var tenant = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenant.SetTenantId(req.TenantId);

        var svc = scope.ServiceProvider.GetRequiredService<IEmbeddingService>();

        bool changed = req.Type switch
        {
            EmbeddingTargetType.DescricaoCargoItem
                => await svc.IndexDescricaoCargoItemAsync(req.EntityId, force: false, ct),
            EmbeddingTargetType.Candidato
                => await svc.IndexCandidatoAsync(req.EntityId, force: false, ct),
            _ => false,
        };

        if (changed)
            _logger.LogInformation("[EmbeddingIndexer] ✓ Reindexado {Type} {Id} (tenant {Tenant})",
                req.Type, req.EntityId, req.TenantId);
        else
            _logger.LogDebug("[EmbeddingIndexer] — Skipped {Type} {Id} (sem mudança real)",
                req.Type, req.EntityId);
    }
}
