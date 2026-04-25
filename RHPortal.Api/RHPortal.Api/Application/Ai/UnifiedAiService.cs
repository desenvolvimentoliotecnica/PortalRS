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
    Task<AiInvokeResponse?> InvokeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct);
}

/// <summary>
/// Orquestra a invocação de provedores de IA (OpenAI / Gemini / Anthropic / ...)
/// a partir de config (appsettings.Ai.*) OU do Master DB (AiProviderKey + AiModel).
///
/// <para><b>Ordem de resolução</b> (Fase 2 LLM-agnóstico):</para>
/// <list type="number">
///   <item>Se há <c>AiProviderKey</c> ativo no Master DB → usa (prioridade máxima).</item>
///   <item>Senão, tenta fallback por config: <c>Ai:OpenAI</c>, <c>Ai:Gemini</c>, <c>Ai:Anthropic</c>,
///   respeitando <c>Ai:DefaultProvider</c> quando múltiplas seções têm chave preenchida.</item>
///   <item>Se nada está configurado, retorna <c>null</c>.</item>
/// </list>
///
/// O provider concreto é resolvido pelo <see cref="IAiProviderFactory"/>, o que
/// permite adicionar novos providers sem mexer aqui.
/// </summary>
public sealed class UnifiedAiService : IUnifiedAiService
{
    private readonly MasterDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly IAiProviderFactory _factory;
    private readonly AiOptions _aiOptions;
    private readonly ILogger<UnifiedAiService> _logger;

    public UnifiedAiService(
        MasterDbContext db,
        ISecretProtector protector,
        IAiProviderFactory factory,
        IOptions<AiOptions> aiOptions,
        ILogger<UnifiedAiService> logger)
    {
        _db = db;
        _protector = protector;
        _factory = factory;
        _aiOptions = aiOptions?.Value ?? new AiOptions();
        _logger = logger;
    }

    public async Task<AiInvokeResponse?> InvokeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct)
    {
        var resolution = await ResolveProviderAsync(request, ct);
        if (resolution is null)
        {
            _logger.LogWarning(
                "UnifiedAiService: nenhum provider configurado. Conhecidos pelo factory: {Known}",
                string.Join(", ", _factory.KnownProviders));
            return null;
        }

        var (providerName, decryptedKey, modelIdToUse, fromConfig, aiModelIdForUsage) = resolution;

        var provider = _factory.Resolve(providerName);
        if (provider is null)
            return null;

        var (content, cost) = await provider.InvokeAsync(decryptedKey, providerName, modelIdToUse, request.Payload, ct);

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

        return new AiInvokeResponse(content, cost);
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
        // 1. Prioridade máxima: chave ativa no Master DB
        var dbKey = await _db.AiProviderKeys
            .AsNoTracking()
            .Where(x => x.IsActive)
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
            var modelId = model?.ModelId ?? DefaultModelFor(providerName);

            return new ProviderResolution(
                ProviderName: providerName,
                DecryptedKey: decryptedKey ?? string.Empty,
                ModelId: modelId,
                FromConfig: false,
                AiModelIdForUsage: model?.Id);
        }

        // 2. Fallback: appsettings.Ai.*
        var preferred = (_aiOptions.DefaultProvider ?? "openai").Trim().ToLowerInvariant();
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
                return new ProviderResolution(
                    ProviderName: providerName!,
                    DecryptedKey: key,
                    ModelId: modelId,
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
