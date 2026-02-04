namespace RhPortal.Api.Application.Ai;

/// <summary>Abstraction for calling an external AI provider (OpenAI, Azure OpenAI, etc.).</summary>
public interface IAiProvider
{
    /// <summary>Invokes the provider with the given key, model and payload. Returns response content and cost (as returned by the provider API).</summary>
    Task<(string Content, decimal Cost)> InvokeAsync(string decryptedKey, string providerName, string modelId, object? payload, CancellationToken ct);
}
