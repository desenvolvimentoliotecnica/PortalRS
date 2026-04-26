using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Owner;
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

    /// <summary>
    /// Retorna <c>true</c> se o módulo <c>"ai"</c> está habilitado para o tenant atual.
    /// (Fase 4 LLM-agnóstico, 2026-04-26.) Quando <c>false</c>, todas as features
    /// que dependem de <see cref="UnifiedAiService"/> devem retornar como se IA
    /// estivesse indisponível (fallback léxico no matching, etc.).
    /// </summary>
    Task<bool> IsAiEnabledAsync(CancellationToken ct);
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

    public async Task<bool> IsAiEnabledAsync(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId)
            || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(tenantId, "system", StringComparison.OrdinalIgnoreCase))
        {
            // Owner/system: IA sempre disponível (não há "tenant" para gating).
            return true;
        }

        try
        {
            // TenantModuleService é Scoped — resolve lazy via IServiceProvider.
            var moduleService = _services.GetService<TenantModuleService>();
            if (moduleService is null)
            {
                // Sem o service, não dá para checar — degradar para "habilitado"
                // é mais seguro que bloquear features silenciosamente.
                return true;
            }

            var enabled = await moduleService.GetEnabledModuleKeysAsync(tenantId, ct);
            return enabled.Contains("ai");
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "TenantAiSettingsResolver.IsAiEnabledAsync: falha ao consultar TenantModule para '{Tenant}' — assumindo habilitado.", tenantId);
            return true;
        }
    }
}
