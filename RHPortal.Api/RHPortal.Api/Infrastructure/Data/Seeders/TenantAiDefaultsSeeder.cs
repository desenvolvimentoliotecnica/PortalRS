using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante defaults de IA do tenant: OpenAI/LiteLLM + Mistral + parse de CV por IA ligado.
/// Não sobrescreve LlmProvider/LlmModel se o admin já escolheu outro valor.
/// </summary>
public static class TenantAiDefaultsSeeder
{
    public const string DefaultLlmProvider = "openai";
    public const string DefaultLlmModel = "mistral-small-24b";

    public static async Task EnsureAsync(
        AppDbContext db,
        MasterDbContext masterDb,
        string tenantId,
        IHostEnvironment env,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("TenantAiDefaultsSeeder requer um tenantId.");

        var now = DateTimeOffset.UtcNow;
        var changed = false;

        var tenantConfig = await db.TenantConfiguracoes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);

        if (tenantConfig is null)
        {
            db.TenantConfiguracoes.Add(new TenantConfiguracao
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                LlmProvider = DefaultLlmProvider,
                LlmModel = DefaultLlmModel,
                UsarIaParseCurriculo = true,
                UpdatedAtUtc = now,
            });
            changed = true;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(tenantConfig.LlmProvider))
            {
                tenantConfig.LlmProvider = DefaultLlmProvider;
                changed = true;
            }

            if (string.IsNullOrWhiteSpace(tenantConfig.LlmModel))
            {
                tenantConfig.LlmModel = DefaultLlmModel;
                changed = true;
            }

            // UsarIaParseCurriculo: default true na migration/entidade.
            // Se o admin desligou (false), respeitamos — não forçar.

            if (changed)
                tenantConfig.UpdatedAtUtc = now;
        }

        if (changed)
            await db.SaveChangesAsync(ct);

        // Módulo "ai": EnsureDefaults já cria ligados; em Development força ON se estiver desligado.
        var moduleRow = await masterDb.TenantModules
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ModuleKey == "ai", ct);

        if (moduleRow is null)
        {
            masterDb.TenantModules.Add(new TenantModule
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ModuleKey = "ai",
                IsEnabled = true,
                UpdatedAtUtc = now,
            });
            await masterDb.SaveChangesAsync(ct);
        }
        else if (env.IsDevelopment() && !moduleRow.IsEnabled)
        {
            moduleRow.IsEnabled = true;
            moduleRow.UpdatedAtUtc = now;
            await masterDb.SaveChangesAsync(ct);
        }
    }
}
