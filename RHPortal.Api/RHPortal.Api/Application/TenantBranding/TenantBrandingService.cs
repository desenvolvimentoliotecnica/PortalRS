using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.TenantBranding;

// ── DTOs ──

/// <summary>
/// Versão pública do branding — sem metadados, só o que o frontend precisa para renderizar.
/// Qualquer campo null significa "usar default da plataforma" (fallback no front).
/// </summary>
public sealed class TenantBrandingPublicDto
{
    public string? NomePortal { get; set; }
    public string? Subtitulo { get; set; }
    public string? RodapeTexto { get; set; }
    public string? CorPrimariaHex { get; set; }
    public string? CorSecundariaHex { get; set; }
    public string? LogoUrl { get; set; }
    public string? VersaoExibida { get; set; }
}

/// <summary>Versão completa (admin) — inclui timestamp de última atualização.</summary>
public sealed class TenantBrandingDto
{
    public string? NomePortal { get; set; }
    public string? Subtitulo { get; set; }
    public string? RodapeTexto { get; set; }
    public string? CorPrimariaHex { get; set; }
    public string? CorSecundariaHex { get; set; }
    public string? LogoUrl { get; set; }
    public string? VersaoExibida { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }
}

public sealed class TenantBrandingUpsertRequest
{
    public string? NomePortal { get; set; }
    public string? Subtitulo { get; set; }
    public string? RodapeTexto { get; set; }
    public string? CorPrimariaHex { get; set; }
    public string? CorSecundariaHex { get; set; }
    public string? LogoUrl { get; set; }
    public string? VersaoExibida { get; set; }
}

// ── Service ──

public interface ITenantBrandingService
{
    /// <summary>Retorna branding do tenant corrente (todos os campos, inclusive metadados).</summary>
    Task<TenantBrandingDto> GetAsync(CancellationToken ct);

    /// <summary>Upsert (Admin). Strings vazias são tratadas como null → "usar default".</summary>
    Task<TenantBrandingDto> UpsertAsync(TenantBrandingUpsertRequest request, CancellationToken ct);

    /// <summary>
    /// Reset — remove o registro, fazendo o tenant voltar aos defaults da plataforma.
    /// Idempotente (no-op se não houver registro).
    /// </summary>
    Task ResetAsync(CancellationToken ct);

    /// <summary>
    /// Versão pública: retorna só os campos renderizáveis. Usado pelo endpoint anônimo
    /// de pré-login. Sempre retorna um DTO (nunca null) — tenant inexistente resolve
    /// como "todos os campos null" (defaults).
    /// </summary>
    Task<TenantBrandingPublicDto> GetPublicAsync(CancellationToken ct);
}

public sealed class TenantBrandingService : ITenantBrandingService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    // Limites defensivos de tamanho; servem como guarda contra payload inflado.
    public const int MaxNomePortal = 80;
    public const int MaxSubtitulo = 160;
    public const int MaxRodape = 160;
    public const int MaxCor = 7;          // "#RRGGBB"
    public const int MaxLogoUrl = 512;
    public const int MaxVersao = 32;

    public TenantBrandingService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<TenantBrandingDto> GetAsync(CancellationToken ct)
    {
        var entity = await _db.TenantBrandings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null) return new TenantBrandingDto();

        return new TenantBrandingDto
        {
            NomePortal = entity.NomePortal,
            Subtitulo = entity.Subtitulo,
            RodapeTexto = entity.RodapeTexto,
            CorPrimariaHex = entity.CorPrimariaHex,
            CorSecundariaHex = entity.CorSecundariaHex,
            LogoUrl = entity.LogoUrl,
            VersaoExibida = entity.VersaoExibida,
            UpdatedAtUtc = entity.UpdatedAtUtc,
        };
    }

    public async Task<TenantBrandingDto> UpsertAsync(TenantBrandingUpsertRequest request, CancellationToken ct)
    {
        var entity = await _db.TenantBrandings.FirstOrDefaultAsync(ct);
        if (entity is null)
        {
            entity = new Domain.Entities.TenantBranding
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
            };
            _db.TenantBrandings.Add(entity);
        }

        entity.NomePortal = NormalizeText(request.NomePortal, MaxNomePortal);
        entity.Subtitulo = NormalizeText(request.Subtitulo, MaxSubtitulo);
        entity.RodapeTexto = NormalizeText(request.RodapeTexto, MaxRodape);
        entity.CorPrimariaHex = NormalizeColor(request.CorPrimariaHex);
        entity.CorSecundariaHex = NormalizeColor(request.CorSecundariaHex);
        entity.LogoUrl = NormalizeText(request.LogoUrl, MaxLogoUrl);
        entity.VersaoExibida = NormalizeText(request.VersaoExibida, MaxVersao);
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return await GetAsync(ct);
    }

    public async Task ResetAsync(CancellationToken ct)
    {
        var entity = await _db.TenantBrandings.FirstOrDefaultAsync(ct);
        if (entity is null) return;
        _db.TenantBrandings.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<TenantBrandingPublicDto> GetPublicAsync(CancellationToken ct)
    {
        var entity = await _db.TenantBrandings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null) return new TenantBrandingPublicDto();

        return new TenantBrandingPublicDto
        {
            NomePortal = entity.NomePortal,
            Subtitulo = entity.Subtitulo,
            RodapeTexto = entity.RodapeTexto,
            CorPrimariaHex = entity.CorPrimariaHex,
            CorSecundariaHex = entity.CorSecundariaHex,
            LogoUrl = entity.LogoUrl,
            VersaoExibida = entity.VersaoExibida,
        };
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /// <summary>
    /// String vazia / whitespace vira null (significa "usar default"). Trim e clamp
    /// por segurança — o frontend não pode estourar a coluna.
    /// </summary>
    public static string? NormalizeText(string? raw, int maxLen)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        return trimmed.Length > maxLen ? trimmed[..maxLen] : trimmed;
    }

    /// <summary>
    /// Aceita "#RRGGBB" (case-insensitive) ou null. Qualquer outro formato resolve null
    /// em vez de lançar — um override mal-escrito não deve quebrar a UI, só ser ignorado.
    /// </summary>
    public static string? NormalizeColor(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var t = raw.Trim();
        if (t.Length != 7 || t[0] != '#') return null;
        for (int i = 1; i < 7; i++)
        {
            var c = t[i];
            var ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!ok) return null;
        }
        return t.ToUpperInvariant();
    }
}
