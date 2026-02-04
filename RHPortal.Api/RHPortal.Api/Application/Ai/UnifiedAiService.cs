using Microsoft.EntityFrameworkCore;
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

    public UnifiedAiService(MasterDbContext db, ISecretProtector protector, IAiProvider provider)
    {
        _db = db;
        _protector = protector;
        _provider = provider;
    }

    public async Task<AiInvokeResponse?> InvokeAsync(string tenantId, Guid? userId, string? userName, AiInvokeRequest request, CancellationToken ct)
    {
        var key = await _db.AiProviderKeys.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
        if (key is null) return null;

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

        var decryptedKey = _protector.Decrypt(key.EncryptedKey);
        var modelIdToUse = model?.ModelId;
        var (content, cost) = await _provider.InvokeAsync(decryptedKey, key.Provider, modelIdToUse, request.Payload, ct);

        if (model is not null)
        {
            var record = new AiUsageRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                UserName = userName ?? string.Empty,
                Module = request.Module.Trim(),
                AiModelId = model.Id,
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
