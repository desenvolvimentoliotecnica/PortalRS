using System;
using Pgvector;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Embedding vetorial do perfil de um <see cref="Candidato"/> (CV + resumo +
/// competências). Usado como query vector na busca semântica contra os embeddings
/// de itens DNALIO.
///
/// <para>Relação 1:1 com <c>Candidato</c> via FK CASCADE. Re-gerado quando o CV
/// muda — idempotente, mesmo candidato = mesmo registro atualizado.</para>
///
/// <para>Modelo padrão <c>bge-m3</c> (1024 dims). <c>ConteudoHash</c> armazena
/// hash SHA256 do texto-fonte — se hash mudar, re-embedding é disparado.</para>
/// </summary>
public sealed class CandidatoEmbedding : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public string ModelVersion { get; set; } = "bge-m3";
    public int Dimensions { get; set; } = 1024;

    public Vector? Embedding { get; set; }

    /// <summary>Snapshot do texto vetorizado (CV + resumo + competências).</summary>
    public string TextoSource { get; set; } = string.Empty;

    /// <summary>Hash SHA256 do TextoSource — evita re-computar se não mudou.</summary>
    public string ConteudoHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
