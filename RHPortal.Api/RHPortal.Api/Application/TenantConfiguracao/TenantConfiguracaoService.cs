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

// ── DTOs de Headcount ──

public sealed class ConfiguracaoHeadcountDto
{
    public int DiasProvisaoSubstituicao { get; set; } = 30;
    public int DiasAlertaVagaSemFill { get; set; } = 60;
    public string? BlipNumeroHospedeiro { get; set; }
    public string? BlipApiUrl { get; set; }
    public string? BlipApiKey { get; set; }
}

public sealed class ConfiguracaoHeadcountRequest
{
    public int DiasProvisaoSubstituicao { get; set; } = 30;
    public int DiasAlertaVagaSemFill { get; set; } = 60;
    public string? BlipNumeroHospedeiro { get; set; }
    public string? BlipApiUrl { get; set; }
    public string? BlipApiKey { get; set; }
}

// ── Service ──

public interface ITenantConfiguracaoService
{
    Task<TenantConfiguracaoDto> GetAsync(CancellationToken ct);
    Task<TenantConfiguracaoDto> UpsertAsync(TenantConfiguracaoUpsertRequest request, CancellationToken ct);
    Task<ConfiguracaoHeadcountDto> GetHeadcountConfigAsync(CancellationToken ct);
    Task<ConfiguracaoHeadcountDto> UpsertHeadcountConfigAsync(ConfiguracaoHeadcountRequest request, CancellationToken ct);
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

    public async Task<ConfiguracaoHeadcountDto> GetHeadcountConfigAsync(CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (config is null) return new ConfiguracaoHeadcountDto();
        return new ConfiguracaoHeadcountDto
        {
            DiasProvisaoSubstituicao = config.DiasProvisaoSubstituicao,
            DiasAlertaVagaSemFill = config.DiasAlertaVagaSemFill,
            BlipNumeroHospedeiro = config.BlipNumeroHospedeiro,
            BlipApiUrl = config.BlipApiUrl,
            BlipApiKey = config.BlipApiKey,
        };
    }

    public async Task<ConfiguracaoHeadcountDto> UpsertHeadcountConfigAsync(ConfiguracaoHeadcountRequest request, CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.FirstOrDefaultAsync(ct);
        if (config is null)
        {
            config = new Domain.Entities.TenantConfiguracao
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
            };
            _db.TenantConfiguracoes.Add(config);
        }

        config.DiasProvisaoSubstituicao = Math.Max(1, request.DiasProvisaoSubstituicao);
        config.DiasAlertaVagaSemFill = Math.Max(1, request.DiasAlertaVagaSemFill);
        config.BlipNumeroHospedeiro = string.IsNullOrWhiteSpace(request.BlipNumeroHospedeiro) ? null : request.BlipNumeroHospedeiro.Trim();
        config.BlipApiUrl = string.IsNullOrWhiteSpace(request.BlipApiUrl) ? null : request.BlipApiUrl.Trim();
        config.BlipApiKey = string.IsNullOrWhiteSpace(request.BlipApiKey) ? null : request.BlipApiKey.Trim();
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new ConfiguracaoHeadcountDto
        {
            DiasProvisaoSubstituicao = config.DiasProvisaoSubstituicao,
            DiasAlertaVagaSemFill = config.DiasAlertaVagaSemFill,
            BlipNumeroHospedeiro = config.BlipNumeroHospedeiro,
            BlipApiUrl = config.BlipApiUrl,
            BlipApiKey = config.BlipApiKey,
        };
    }

    private static TenantConfiguracaoDto MapToDto(Domain.Entities.TenantConfiguracao c) => new()
    {
        RhDeveAprovarAposGestor = c.RhDeveAprovarAposGestor,
        AprovadorRhId = c.AprovadorRhId,
        AprovadorRhNome = c.AprovadorRh?.Name,
    };
}
