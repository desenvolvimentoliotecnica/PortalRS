using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Application.Ai;

public interface IUnifiedAiService
{
    /// <summary>
    /// Versão simplificada — retorna a resposta ou <c>null</c> sem distinguir motivo.
    /// Usada por callers programáticos (CV extract, doc validation) que tratam
    /// "sem IA" gracefully sem precisar do motivo.
    /// </summary>
    Task<AiInvokeResponse?> InvokeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct);

    /// <summary>
    /// Versão estruturada — devolve <see cref="AiInvokeOutcome"/> com
    /// <see cref="AiUnavailableReason"/> quando a IA não está disponível.
    /// Usada pelos controllers para mapear corretamente para HTTP 503/422
    /// (Fase 5 LLM-agnóstico, LUC-117).
    /// </summary>
    Task<AiInvokeOutcome> InvokeWithOutcomeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct);
}

/// <summary>
/// Orquestra a invocação de provedores de IA (OpenAI / Gemini / Anthropic / ...)
/// a partir de:
/// <list type="number">
///   <item><b>(Fase 3)</b> <c>TenantConfiguracao.LlmProvider</c> do tenant atual — se preenchido, vence.</item>
///   <item><b>(Fase 2)</b> <c>AiProviderKey</c> ativo no Master DB.</item>
///   <item><b>(Fase 2)</b> Fallback por <c>appsettings.Ai.*</c>, respeitando <c>Ai.DefaultProvider</c>.</item>
/// </list>
/// Sem nada configurado, retorna <c>null</c>. O provider concreto é resolvido
/// pelo <see cref="IAiProviderFactory"/>.
/// </summary>
public sealed class UnifiedAiService : IUnifiedAiService
{
    private readonly MasterDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly IAiProviderFactory _factory;
    private readonly AiOptions _aiOptions;
    private readonly ITenantAiSettingsResolver _tenantSettings;
    private readonly ILogger<UnifiedAiService> _logger;

    public UnifiedAiService(
        MasterDbContext db,
        ISecretProtector protector,
        IAiProviderFactory factory,
        IOptions<AiOptions> aiOptions,
        ITenantAiSettingsResolver tenantSettings,
        ILogger<UnifiedAiService> logger)
    {
        _db = db;
        _protector = protector;
        _factory = factory;
        _aiOptions = aiOptions?.Value ?? new AiOptions();
        _tenantSettings = tenantSettings;
        _logger = logger;
    }

    public async Task<AiInvokeResponse?> InvokeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct)
    {
        var outcome = await InvokeWithOutcomeAsync(tenantId, userId, userName, request, ct);
        return outcome.Response;
    }

    public async Task<AiInvokeOutcome> InvokeWithOutcomeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct)
    {
        var startedAt = DateTimeOffset.UtcNow;

        // Fase 4: gating por TenantModule. Se o owner desligou o módulo "ai",
        // a IA não está disponível — mesmo havendo chave configurada.
        if (!await _tenantSettings.IsAiEnabledAsync(ct))
        {
            _logger.LogInformation(
                "ai.invoke tenant={Tenant} status=blocked reason=ModuleDisabled module={Module}",
                tenantId, request.Module);
            return new AiInvokeOutcome(null, AiUnavailableReason.ModuleDisabled,
                $"O módulo de IA está desabilitado para o tenant '{tenantId}'. Contate o owner da plataforma.");
        }

        var resolution = await ResolveProviderAsync(request, ct);
        if (resolution is null)
        {
            _logger.LogWarning(
                "ai.invoke tenant={Tenant} status=blocked reason=NoProviderConfigured module={Module} known={Known}",
                tenantId, request.Module, string.Join(",", _factory.KnownProviders));
            return new AiInvokeOutcome(null, AiUnavailableReason.NoProviderConfigured,
                "Nenhum provider de IA tem chave configurada. O owner precisa cadastrar uma chave em /Owner/IA ou no appsettings.Ai.");
        }

        var (providerName, decryptedKey, modelIdToUse, fromConfig, aiModelIdForUsage) = resolution;

        var provider = _factory.Resolve(providerName);
        if (provider is null)
        {
            _logger.LogWarning(
                "ai.invoke tenant={Tenant} status=blocked reason=ProviderResolutionFailed provider={Provider}",
                tenantId, providerName);
            return new AiInvokeOutcome(null, AiUnavailableReason.ProviderResolutionFailed,
                $"O provider '{providerName}' não foi reconhecido pelo factory.");
        }

        var (content, cost) = await provider.InvokeAsync(decryptedKey, providerName, modelIdToUse, request.Payload, ct);
        var elapsed = (DateTimeOffset.UtcNow - startedAt).TotalMilliseconds;

        // Log estruturado — Fase 5 (observabilidade).
        _logger.LogInformation(
            "ai.invoke tenant={Tenant} user={User} provider={Provider} model={Model} module={Module} latency_ms={LatencyMs:F0} cost_usd={Cost:F8} from_config={FromConfig} content_len={ContentLen}",
            tenantId, userName ?? "?", providerName, modelIdToUse, request.Module, elapsed, cost, fromConfig, content?.Length ?? 0);

        if (!fromConfig && aiModelIdForUsage.HasValue && !string.IsNullOrEmpty(content))
        {
            var record = new AiUsageRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                UserName = userName ?? string.Empty,
                Module = request.Module.Trim(),
                AiModelId = aiModelIdForUsage.Value,
                Cost = cost,
                ActionDescription = request.ActionDescription?.Trim(),
                RequestMessage = request.RequestMessage?.Trim(),
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _db.AiUsageRecords.Add(record);
            await _db.SaveChangesAsync(ct);
        }

        return new AiInvokeOutcome(new AiInvokeResponse(content, cost), null);
    }

    // ──────────────────────────── resolução ────────────────────────────

    private record ProviderResolution(
        string ProviderName,
        string DecryptedKey,
        string ModelId,
        bool FromConfig,
        Guid? AiModelIdForUsage);

    private async Task<ProviderResolution?> ResolveProviderAsync(AiInvokeRequest request, CancellationToken ct)
    {
        // 0. Override do TENANT (Fase 3): se TenantConfiguracao.LlmProvider preenchido,
        //    força o provider escolhido pelo admin do tenant.
        var tenantOverride = await _tenantSettings.GetCurrentAsync(ct);
        var tenantProviderOverride = tenantOverride?.LlmProvider;
        var tenantModelOverride = tenantOverride?.LlmModel;

        // 1. Prioridade máxima: chave ativa no Master DB.
        //    Se tenant escolheu um provider específico, filtra por ele; senão pega "primeiro ativo".
        var dbKeyQuery = _db.AiProviderKeys.AsNoTracking().Where(x => x.IsActive);
        if (!string.IsNullOrWhiteSpace(tenantProviderOverride))
        {
            dbKeyQuery = dbKeyQuery.Where(x => x.Provider != null && x.Provider.ToLower() == tenantProviderOverride);
        }
        var dbKey = await dbKeyQuery
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (dbKey is not null)
        {
            var providerName = string.IsNullOrWhiteSpace(dbKey.Provider) ? "OpenAI" : dbKey.Provider.Trim();

            AiModel? model;
            if (request.ModelId.HasValue)
            {
                model = await _db.AiModels
                    .AsNoTracking()
                    .Include(x => x.AiProviderKey)
                    .FirstOrDefaultAsync(x => x.Id == request.ModelId.Value && x.AiProviderKeyId == dbKey.Id, ct);
            }
            else
            {
                model = await _db.AiModels
                    .AsNoTracking()
                    .Include(x => x.AiProviderKey)
                    .FirstOrDefaultAsync(x => x.AiProviderKeyId == dbKey.Id && x.IsDefault, ct);
                if (model is null)
                {
                    model = await _db.AiModels
                        .AsNoTracking()
                        .Include(x => x.AiProviderKey)
                        .Where(x => x.AiProviderKeyId == dbKey.Id)
                        .OrderBy(x => x.Id)
                        .FirstOrDefaultAsync(ct);
                }
            }

            var decryptedKey = _protector.Decrypt(dbKey.EncryptedKey);
            // Modelo: tenant override > AiModel.IsDefault > DefaultModelFor
            var modelId = !string.IsNullOrWhiteSpace(tenantModelOverride)
                ? tenantModelOverride!
                : (model?.ModelId ?? DefaultModelFor(providerName));

            return new ProviderResolution(
                ProviderName: providerName,
                DecryptedKey: decryptedKey ?? string.Empty,
                ModelId: modelId,
                FromConfig: false,
                AiModelIdForUsage: model?.Id);
        }

        // 2. Fallback: appsettings.Ai.*
        //    Tenant override (se houver) ganha prioridade sobre Ai.DefaultProvider.
        var preferred = (tenantProviderOverride ?? _aiOptions.DefaultProvider ?? "openai").Trim().ToLowerInvariant();
        var openAiKey = _aiOptions.OpenAI?.ApiKey?.Trim();
        var geminiKey = _aiOptions.Gemini?.ApiKey?.Trim();
        var anthropicKey = _aiOptions.Anthropic?.ApiKey?.Trim();

        string? ordered1 = preferred switch
        {
            "gemini" => "Gemini",
            "anthropic" => "Anthropic",
            _ => "OpenAI"
        };

        foreach (var providerName in new[] { ordered1, "OpenAI", "Gemini", "Anthropic" }.Distinct())
        {
            string? key;
            string modelId;
            switch (providerName)
            {
                case "OpenAI":
                    key = openAiKey;
                    modelId = _aiOptions.OpenAI?.DefaultModel ?? "gpt-4o-mini";
                    break;
                case "Gemini":
                    key = geminiKey;
                    modelId = _aiOptions.Gemini?.DefaultModel ?? "gemini-2.5-flash";
                    break;
                case "Anthropic":
                    key = anthropicKey;
                    modelId = _aiOptions.Anthropic?.DefaultModel ?? "claude-3-5-sonnet-20241022";
                    break;
                default:
                    continue;
            }

            if (!string.IsNullOrEmpty(key))
            {
                // Se tenant tem override de modelo E o provider que estamos prestes a usar
                // bate com o que o tenant pediu, respeita o LlmModel do tenant.
                var effectiveModel = (!string.IsNullOrWhiteSpace(tenantModelOverride)
                                      && string.Equals(providerName, tenantProviderOverride, StringComparison.OrdinalIgnoreCase))
                    ? tenantModelOverride!
                    : modelId;

                return new ProviderResolution(
                    ProviderName: providerName!,
                    DecryptedKey: key,
                    ModelId: effectiveModel,
                    FromConfig: true,
                    AiModelIdForUsage: null);
            }
        }

        return null;
    }

    private static string DefaultModelFor(string providerName) => providerName?.ToLowerInvariant() switch
    {
        "gemini" => "gemini-2.5-flash",
        "google" => "gemini-2.5-flash",
        "anthropic" => "claude-3-5-sonnet-20241022",
        "claude" => "claude-3-5-sonnet-20241022",
        _ => "gpt-4o-mini"
    };
}
