namespace RhPortal.Api.Application.Ai;

/// <summary>Stub provider that records usage without calling an external API. Cost is 0. Replace with OpenAI/Azure implementation when integrating a real provider.</summary>
public sealed class StubAiProvider : IAiProvider
{
    public Task<(string Content, decimal Cost)> InvokeAsync(string decryptedKey, string providerName, string modelId, object? payload, CancellationToken ct)
    {
        var msg = payload is string s ? s : (payload?.ToString() ?? string.Empty);
        var content = string.IsNullOrEmpty(msg)
            ? "Stub AI response. Configure a real provider (OpenAI/Azure) to get actual AI responses."
            : $"Stub AI response. Request length: {msg.Length}. Configure a real provider for actual responses.";
        return Task.FromResult((content, 0m));
    }
}
