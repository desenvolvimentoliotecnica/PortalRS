using Microsoft.EntityFrameworkCore;
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

public sealed class UnifiedAiService : IUnifiedAiService
{
    private readonly MasterDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly IAiProvider _provider;
    private readonly AiOptions _aiOptions;

    public UnifiedAiService(
        MasterDbContext db,
        ISecretProtector protector,
        IAiProvider provider,
        IOptions<AiOptions> aiOptions)
    {
        _db = db;
        _protector = protector;
        _provider = provider;
        _aiOptions = aiOptions?.Value ?? new AiOptions();
    }

    public async Task<AiInvokeResponse?> InvokeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct)
    {
        string? decryptedKey = null;
        string? modelIdToUse = null;
        string providerName = "OpenAI";
        bool fromConfig = false;
        Guid? aiModelIdForUsage = null;

        var configKey = _aiOptions.OpenAI?.ApiKey?.Trim();
        if (!string.IsNullOrEmpty(configKey))
        {
            decryptedKey = configKey;
            modelIdToUse = string.IsNullOrWhiteSpace(_aiOptions.OpenAI?.DefaultModel)
                ? "gpt-4o-mini"
                : _aiOptions.OpenAI.DefaultModel.Trim();
            fromConfig = true;
        }
        else
        {
            var key = await _db.AiProviderKeys.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
            if (key is null) return null;

            providerName = key.Provider ?? "OpenAI";

            AiModel? model;
            if (request.ModelId.HasValue)
            {
                model = await _db.AiModels.AsNoTracking().Include(x => x.AiProviderKey)
                    .FirstOrDefaultAsync(x => x.Id == request.ModelId.Value && x.AiProviderKeyId == key.Id, ct);
            }
            else
            {
                model = await _db.AiModels.AsNoTracking().Include(x => x.AiProviderKey)
                    .FirstOrDefaultAsync(x => x.AiProviderKeyId == key.Id && x.IsDefault, ct);
                if (model is null)
                    model = await _db.AiModels.AsNoTracking().Include(x => x.AiProviderKey)
                        .Where(x => x.AiProviderKeyId == key.Id)
                        .OrderBy(x => x.Id)
                        .FirstOrDefaultAsync(ct);
            }

            decryptedKey = _protector.Decrypt(key.EncryptedKey);
            modelIdToUse = model?.ModelId;
            if (model is not null)
                aiModelIdForUsage = model.Id;
        }

        var (content, cost) = await _provider.InvokeAsync(decryptedKey!, providerName, modelIdToUse, request.Payload, ct);

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
}
