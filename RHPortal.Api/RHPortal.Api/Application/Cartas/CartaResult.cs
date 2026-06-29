namespace RhPortal.Api.Application.Cartas;

/// <summary>
/// Resultado da geração de carta: URL presigned (S3) ou conteúdo para download direto.
/// </summary>
public sealed class CartaResult
{
    public string? Url { get; init; }
    public byte[]? Content { get; init; }
    public string? FileName { get; init; }

    public bool IsDirectDownload => Content is { Length: > 0 };

    public static CartaResult FromUrl(string url) => new() { Url = url };

    public static CartaResult FromContent(byte[] content, string fileName)
        => new() { Content = content, FileName = fileName };
}
