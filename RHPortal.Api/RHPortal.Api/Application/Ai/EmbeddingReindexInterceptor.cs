using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// <c>SaveChangesInterceptor</c> que detecta mudanças em <see cref="DescricaoCargoItem"/>
/// e <see cref="Candidato"/> e enfileira pedidos de reindexação de embeddings.
///
/// <para><b>Estratégia</b>: no hook <c>SavingChangesAsync</c> (antes do commit)
/// lê o <c>ChangeTracker</c> e coleta IDs a indexar. No <c>SavedChangesAsync</c>
/// (depois do commit bem-sucedido) enfileira na <see cref="IEmbeddingIndexQueue"/>.
/// Se ocorrer rollback, as mudanças ficam nada.</para>
///
/// <para><b>Precisão</b>: só reenfileira <c>Candidato</c> quando o texto-fonte muda
/// (CvText, ResumoProfissional). Alterações cosméticas (Status, UpdatedAtUtc) não
/// disparam embedding novo — economiza CPU/GPU do Ollama.</para>
/// </summary>
public sealed class EmbeddingReindexInterceptor : SaveChangesInterceptor
{
    private readonly IEmbeddingIndexQueue _queue;
    private readonly ITenantContext _tenant;
    private readonly ILogger<EmbeddingReindexInterceptor> _logger;

    public EmbeddingReindexInterceptor(IEmbeddingIndexQueue queue, ITenantContext tenant, ILogger<EmbeddingReindexInterceptor> logger)
    {
        _queue = queue;
        _tenant = tenant;
        _logger = logger;
    }

    /// <summary>
    /// Detecta entidades relevantes (DescricaoCargoItem, Candidato com texto-fonte alterado)
    /// e enfileira pedidos de reindexação na fila in-memory.
    ///
    /// <para><b>Por que enfileirar no SavingChanges e não no SavedChanges</b>: se houver
    /// rollback depois (exceção em outro interceptor, falha de commit, etc), o worker
    /// tentará indexar e vai ler do banco o estado atual (pre-save) — que é funcionalmente
    /// equivalente, só gasta uma chamada Ollama a mais em casos raros.</para>
    /// </summary>
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken ct = default)
    {
        var tenantId = _tenant.TenantId;
        var ctx = eventData.Context;
        if (ctx is null || string.IsNullOrEmpty(tenantId)) return base.SavingChangesAsync(eventData, result, ct);

        int enfileirados = 0;

        foreach (var entry in ctx.ChangeTracker.Entries())
        {
            if (entry.State != EntityState.Added && entry.State != EntityState.Modified)
                continue;

            if (entry.Entity is DescricaoCargoItem item)
            {
                _queue.Enqueue(new EmbeddingIndexRequest(tenantId, EmbeddingTargetType.DescricaoCargoItem, item.Id));
                enfileirados++;
            }
            else if (entry.Entity is Candidato cand)
            {
                if (entry.State == EntityState.Added || IsTextoFonteChanged(entry))
                {
                    _queue.Enqueue(new EmbeddingIndexRequest(tenantId, EmbeddingTargetType.Candidato, cand.Id));
                    enfileirados++;
                }
            }
        }

        if (enfileirados > 0)
            _logger.LogInformation("[EmbeddingReindex] Enfileirados {Count} pedido(s) (tenant={Tenant})",
                enfileirados, tenantId);

        return base.SavingChangesAsync(eventData, result, ct);
    }

    /// <summary>
    /// Verifica se algum campo que entra no "texto-fonte" do embedding do candidato
    /// foi modificado. Evita reembedar quando só UpdatedAtUtc ou Status mudaram.
    /// </summary>
    private static bool IsTextoFonteChanged(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        foreach (var prop in entry.Properties)
        {
            if (!prop.IsModified) continue;
            var name = prop.Metadata.Name;
            if (name == nameof(Candidato.CvText)
             || name == nameof(Candidato.ResumoProfissional)
             || name == nameof(Candidato.Nome))
                return true;
        }
        return false;
    }
}
