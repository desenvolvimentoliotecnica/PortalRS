using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.Extensions.Hosting;

namespace LioTecnica.Web.Services;

public interface IEntraIdLocalConfigStore
{
    Task<EntraIdConfigViewModel?> GetAsync(CancellationToken ct);
    Task SaveAsync(EntraIdConfigRequest request, CancellationToken ct);
}

public sealed class EntraIdLocalConfigStore : IEntraIdLocalConfigStore
{
    private readonly IWebHostEnvironment _env;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    public EntraIdLocalConfigStore(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async Task<EntraIdConfigViewModel?> GetAsync(CancellationToken ct)
    {
        var file = GetConfigPath();
        if (!File.Exists(file))
            return null;

        await using var stream = File.OpenRead(file);
        var data = await JsonSerializer.DeserializeAsync<EntraIdConfigFile>(stream, JsonOptions, ct);
        if (data?.EntraId is null)
            return null;

        return new EntraIdConfigViewModel
        {
            IsEnabled = data.EntraId.Enabled,
            EntraTenantId = data.EntraId.EntraTenantId,
            ClientId = data.EntraId.ClientId,
            HasClientSecret = !string.IsNullOrWhiteSpace(data.EntraId.ClientSecret),
            CallbackPath = data.EntraId.CallbackPath
        };
    }

    public async Task SaveAsync(EntraIdConfigRequest request, CancellationToken ct)
    {
        var existing = await LoadFileAsync(ct);
        var existingSection = existing?.EntraId;
        var clientSecret = !string.IsNullOrWhiteSpace(request.ClientSecret)
            ? request.ClientSecret
            : existingSection?.ClientSecret;

        var data = new EntraIdConfigFile
        {
            EntraId = new EntraIdConfigSection
            {
                Enabled = request.IsEnabled,
                Authority = existingSection?.Authority ?? "https://login.microsoftonline.com/common/v2.0",
                ClientId = request.ClientId?.Trim(),
                ClientSecret = clientSecret,
                CallbackPath = string.IsNullOrWhiteSpace(request.CallbackPath) ? "/signin-entra" : request.CallbackPath,
                EntraTenantId = request.EntraTenantId?.Trim()
            }
        };

        var file = GetConfigPath();
        await using var stream = File.Create(file);
        await JsonSerializer.SerializeAsync(stream, data, JsonOptions, ct);
    }

    private async Task<EntraIdConfigFile?> LoadFileAsync(CancellationToken ct)
    {
        var file = GetConfigPath();
        if (!File.Exists(file))
            return null;

        await using var stream = File.OpenRead(file);
        return await JsonSerializer.DeserializeAsync<EntraIdConfigFile>(stream, JsonOptions, ct);
    }

    private string GetConfigPath()
    {
        return Path.Combine(_env.ContentRootPath, "entra-config.json");
    }

    private sealed class EntraIdConfigFile
    {
        public EntraIdConfigSection EntraId { get; set; } = new();
    }

    private sealed class EntraIdConfigSection
    {
        public bool Enabled { get; set; }
        public string? Authority { get; set; }
        public string? ClientId { get; set; }
        public string? ClientSecret { get; set; }
        public string? CallbackPath { get; set; }
        public string? EntraTenantId { get; set; }
    }
}
