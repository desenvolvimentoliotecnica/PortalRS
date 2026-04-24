using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Alvo possível de indexação de embedding. Mais tipos podem ser adicionados
/// (ex.: Vaga, DescricaoCargo inteira agregada) sem breaking change.
/// </summary>
public enum EmbeddingTargetType
{
    DescricaoCargoItem = 1,
    Candidato = 2,
}

/// <summary>
/// Pedido na fila de reindexação: qual tenant + qual tipo de entidade + qual Id.
/// O worker processa em background sem bloquear o SaveChanges.
/// </summary>
public sealed record EmbeddingIndexRequest(
    string TenantId,
    EmbeddingTargetType Type,
    Guid EntityId);

/// <summary>
/// Fila in-memory (Channel) de pedidos de reindexação. Registrada como Singleton.
/// Produtor: <c>EmbeddingReindexInterceptor</c> (dispara em cada SaveChanges).
/// Consumidor: <c>EmbeddingIndexerHostedService</c> (background, chama Ollama + persiste).
///
/// <para><b>BoundedChannel com DropOldest</b>: se o worker ficar pra trás (ex.: Ollama
/// travado), novos pedidos entram descartando os mais antigos. Não há risco de perda
/// permanente — o hash SHA256 do texto-fonte garante que a próxima reindexação manual
/// ou reinício do worker eventualmente cobrirá tudo.</para>
/// </summary>
public interface IEmbeddingIndexQueue
{
    /// <summary>Enfileira pedido. Nunca lança; se canal cheio, descarta o mais antigo.</summary>
    void Enqueue(EmbeddingIndexRequest request);

    /// <summary>Consome pedidos em stream; o worker chama este em loop.</summary>
    IAsyncEnumerable<EmbeddingIndexRequest> ReadAllAsync(CancellationToken ct);

    /// <summary>Contador aproximado de itens na fila (diagnóstico).</summary>
    int ApproximateCount { get; }
}

public sealed class EmbeddingIndexQueue : IEmbeddingIndexQueue
{
    private readonly Channel<EmbeddingIndexRequest> _channel;
    private int _approxCount;

    public EmbeddingIndexQueue()
    {
        _channel = Channel.CreateBounded<EmbeddingIndexRequest>(new BoundedChannelOptions(capacity: 5000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
    }

    public void Enqueue(EmbeddingIndexRequest request)
    {
        if (request is null || string.IsNullOrEmpty(request.TenantId) || request.EntityId == Guid.Empty) return;
        if (_channel.Writer.TryWrite(request))
            Interlocked.Increment(ref _approxCount);
    }

    public async IAsyncEnumerable<EmbeddingIndexRequest> ReadAllAsync(
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var req in _channel.Reader.ReadAllAsync(ct))
        {
            Interlocked.Decrement(ref _approxCount);
            yield return req;
        }
    }

    public int ApproximateCount => _approxCount;
}
