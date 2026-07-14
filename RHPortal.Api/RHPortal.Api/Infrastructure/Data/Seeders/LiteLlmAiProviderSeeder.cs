using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante chave OpenAI-compatible apontando ao LiteLLM interno + modelo default Mistral.
/// Idempotente: cria se não existir; em Development atualiza chave a partir do appsettings.
/// </summary>
public static class LiteLlmAiProviderSeeder
{
    public const string ProviderName = "openai";
    public const string KeyDisplayName = "LiteLLM (svr-ai-01)";
    public const string ModelId = "mistral-small-24b";
    public const string ModelDisplayName = "Mistral Small 24B (LiteLLM)";

    public static async Task EnsureAsync(
        MasterDbContext masterDb,
        ISecretProtector protector,
        IConfiguration config,
        IHostEnvironment env,
        CancellationToken ct)
    {
        var apiKey = config["Ai:OpenAI:ApiKey"]?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
            return;

        var now = DateTimeOffset.UtcNow;
        var existing = await masterDb.AiProviderKeys
            .FirstOrDefaultAsync(x =>
                x.Provider == ProviderName && x.Name == KeyDisplayName, ct);

        if (existing is null)
        {
            // Desmarca outros defaults do mesmo provider
            await masterDb.AiProviderKeys
                .Where(x => x.Provider == ProviderName && x.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(k => k.IsDefault, false), ct);

            existing = new AiProviderKey
            {
                Id = Guid.NewGuid(),
                Provider = ProviderName,
                Name = KeyDisplayName,
                EncryptedKey = protector.Encrypt(apiKey),
                IsActive = true,
                IsDefault = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            };
            masterDb.AiProviderKeys.Add(existing);
            await masterDb.SaveChangesAsync(ct);
        }
        else
        {
            var changed = false;
            if (!existing.IsActive)
            {
                existing.IsActive = true;
                changed = true;
            }

            if (!existing.IsDefault)
            {
                await masterDb.AiProviderKeys
                    .Where(x => x.Provider == ProviderName && x.Id != existing.Id && x.IsDefault)
                    .ExecuteUpdateAsync(s => s.SetProperty(k => k.IsDefault, false), ct);
                existing.IsDefault = true;
                changed = true;
            }

            // Em Development sincroniza a chave do appsettings (LiteLLM local).
            if (env.IsDevelopment())
            {
                existing.EncryptedKey = protector.Encrypt(apiKey);
                changed = true;
            }

            if (changed)
            {
                existing.UpdatedAtUtc = now;
                await masterDb.SaveChangesAsync(ct);
            }
        }

        var model = await masterDb.AiModels
            .FirstOrDefaultAsync(x => x.AiProviderKeyId == existing.Id && x.ModelId == ModelId, ct);

        if (model is null)
        {
            await masterDb.AiModels
                .Where(x => x.AiProviderKeyId == existing.Id && x.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsDefault, false), ct);

            masterDb.AiModels.Add(new AiModel
            {
                Id = Guid.NewGuid(),
                AiProviderKeyId = existing.Id,
                ModelId = ModelId,
                DisplayName = ModelDisplayName,
                IsDefault = true,
            });
            await masterDb.SaveChangesAsync(ct);
        }
        else if (!model.IsDefault)
        {
            await masterDb.AiModels
                .Where(x => x.AiProviderKeyId == existing.Id && x.Id != model.Id && x.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsDefault, false), ct);
            model.IsDefault = true;
            await masterDb.SaveChangesAsync(ct);
        }
    }
}
