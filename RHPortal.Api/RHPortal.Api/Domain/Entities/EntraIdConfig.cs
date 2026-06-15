namespace RhPortal.Api.Domain.Entities;

public sealed class EntraIdConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecretEncrypted { get; set; }
    public bool IsEnabled { get; set; }
    /// <summary>Redirect URI completa registrada no Azure (ex.: https://host:5000/api/auth/entra/callback).</summary>
    public string? CallbackPath { get; set; }
    /// <summary>URL pública do Portal Admin para retorno pós-login Entra (ex.: http://host:3000).</summary>
    public string? FrontendBaseUrl { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
