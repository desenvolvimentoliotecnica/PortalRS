using System;
using Pgvector;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Embedding vetorial pré-computado de um item DNALIO de <see cref="DescricaoCargoItem"/>.
///
/// <para>Usado pelo matching híbrido (seção semântica) via busca kNN no pgvector:
/// o CV do candidato é convertido em embedding e comparado por similaridade
/// cosseno contra todos os itens indexados. Top-K é combinado com o score léxico
/// (TF-IDF + stems) para produzir o score final.</para>
///
/// <para><b>Modelo</b>: por padrão <c>bge-m3</c> (1024 dimensões, multilingual pt-br).
/// <c>ModelVersion</c> guarda o nome exato do modelo que gerou o vetor — se trocar
/// o modelo, indexação é re-feita seletivamente.</para>
///
/// <para>Relação 1:1 com <see cref="DescricaoCargoItem"/> via FK CASCADE: quando
/// o item é deletado, o embedding vai junto. Re-indexação é idempotente.</para>
/// </summary>
public sealed class DescricaoCargoItemEmbedding : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid DescricaoCargoItemId { get; set; }
    public DescricaoCargoItem? DescricaoCargoItem { get; set; }

    /// <summary>Versão do modelo que gerou o vetor (ex.: "bge-m3"). Muda → re-indexa.</summary>
    public string ModelVersion { get; set; } = "bge-m3";

    /// <summary>Dimensão do vetor. Redundante com o type pgvector mas ajuda validação.</summary>
    public int Dimensions { get; set; } = 1024;

    /// <summary>
    /// Vetor de embedding armazenado como tipo <c>Vector</c> do pacote Pgvector.Npgsql,
    /// mapeado para <c>vector(1024)</c> no Postgres. Null quando ainda não indexado
    /// (linha placeholder criada junto ao item; embedding é preenchido pelo worker).
    /// </summary>
    public Vector? Embedding { get; set; }

    /// <summary>Snapshot do texto que gerou o embedding — permite detectar drift vs item atual.</summary>
    public string TextoSource { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
