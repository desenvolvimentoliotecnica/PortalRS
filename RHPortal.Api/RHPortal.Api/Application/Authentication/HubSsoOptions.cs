namespace RhPortal.Api.Application.Authentication;

public sealed class HubSsoOptions
{
    public const string SectionName = "HubSso";

    /// <summary>Chave HMAC compartilhada com o Liotecnica Hub (≥ 32 caracteres).</summary>
    public string SigningKey { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;
}
