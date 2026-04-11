using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.TenantConfiguracao;

// ── DTOs ──

public sealed class TenantConfiguracaoDto
{
    public bool RhDeveAprovarAposGestor { get; set; }
    public Guid? AprovadorRhId { get; set; }
    public string? AprovadorRhNome { get; set; }
}

public sealed class TenantConfiguracaoUpsertRequest
{
    public bool RhDeveAprovarAposGestor { get; set; }
    public Guid? AprovadorRhId { get; set; }
}

// ── Service ──

public interface ITenantConfiguracaoService
{
    Task<TenantConfiguracaoDto> GetAsync(CancellationToken ct);
    Task<TenantConfiguracaoDto> UpsertAsync(TenantConfiguracaoUpsertRequest request, CancellationToken ct);
}

public sealed class TenantConfiguracaoService : ITenantConfiguracaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public TenantConfiguracaoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<TenantConfiguracaoDto> GetAsync(CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes
            .AsNoTracking()
            .Include(c => c.AprovadorRh)
            .FirstOrDefaultAsync(ct);

        if (config is null)
            return new TenantConfiguracaoDto();

        return MapToDto(config);
    }

    public async Task<TenantConfiguracaoDto> UpsertAsync(TenantConfiguracaoUpsertRequest request, CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes
            .Include(c => c.AprovadorRh)
            .FirstOrDefaultAsync(ct);

        if (config is null)
        {
            config = new Domain.Entities.TenantConfiguracao
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
            };
            _db.TenantConfiguracoes.Add(config);
        }

        config.RhDeveAprovarAposGestor = request.RhDeveAprovarAposGestor;
        config.AprovadorRhId = request.AprovadorRhId;
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Reload para trazer AprovadorRh navegado
        await _db.Entry(config).Reference(c => c.AprovadorRh).LoadAsync(ct);

        return MapToDto(config);
    }

    private static TenantConfiguracaoDto MapToDto(Domain.Entities.TenantConfiguracao c) => new()
    {
        RhDeveAprovarAposGestor = c.RhDeveAprovarAposGestor,
        AprovadorRhId = c.AprovadorRhId,
        AprovadorRhNome = c.AprovadorRh?.Name,
    };
}
