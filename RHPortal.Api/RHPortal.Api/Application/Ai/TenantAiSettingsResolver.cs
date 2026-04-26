using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Lê a configuração de IA do tenant atual (tabela <c>TenantConfiguracoes</c>
/// no banco do tenant). Isolado em um service próprio para que
/// <see cref="UnifiedAiService"/> não precise injetar <c>AppDbContext</c>
/// diretamente — o que ajuda em cenários onde a request não tem tenant
/// válido (ex.: endpoints owner-level).
///
/// <para>Parte da Fase 3 do épico LLM-agnóstico (2026-04-25).</para>
/// </summary>
public interface ITenantAiSettingsResolver
{
    /// <summary>
    /// Retorna a configuração de IA do tenant atual ou <c>null</c> se não
    /// houver tenant válido / não houver registro / falha ao consultar.
    /// Nunca lança — falhas são engolidas e logadas (resolution cai no fallback global).
    /// </summary>
    Task<TenantAiSettings?> GetCurrentAsync(CancellationToken ct);
}

/// <summary>Snapshot imutável da escolha de provider/modelo do tenant.</summary>
public sealed record TenantAiSettings(
    string? LlmProvider,
    string? LlmModel,
    string? EmbeddingProvider,
    string? EmbeddingModel
);

public sealed class TenantAiSettingsResolver : ITenantAiSettingsResolver
{
    private readonly IServiceProvider _services;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<TenantAiSettingsResolver> _logger;

    public TenantAiSettingsResolver(
        IServiceProvider services,
        ITenantContext tenantContext,
        ILogger<TenantAiSettingsResolver> logger)
    {
        _services = services;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    public async Task<TenantAiSettings?> GetCurrentAsync(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId)
            || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(tenantId, "system", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            // Resolve AppDbContext lazy para não falhar quando o tenant não está
            // setado ou a connection string falha — a chamada deve degradar para
            // o fallback global, não quebrar o request.
            var db = _services.GetService<AppDbContext>();
            if (db is null) return null;

            var config = await db.TenantConfiguracoes
                .AsNoTracking()
                .Select(c => new TenantAiSettings(c.LlmProvider, c.LlmModel, c.EmbeddingProvider, c.EmbeddingModel))
                .FirstOrDefaultAsync(ct);

            return config; // pode ser null se não houver registro
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "TenantAiSettingsResolver: falha ao ler config do tenant '{Tenant}' — caindo no fallback global.", tenantId);
            return null;
        }
    }
}
