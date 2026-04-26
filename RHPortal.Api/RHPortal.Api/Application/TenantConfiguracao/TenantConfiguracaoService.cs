using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.Ai;
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

// ── DTOs de IA por tenant (Fase 3 LLM-agnóstico) ──

/// <summary>
/// Configuração de provider de IA por tenant.
/// Quando algum campo é <c>null</c>, o sistema cai no default global (<c>appsettings.Ai.*</c>).
/// </summary>
public sealed class TenantAiConfigDto
{
    public string? LlmProvider { get; set; }
    public string? LlmModel { get; set; }
    public string? EmbeddingProvider { get; set; }
    public string? EmbeddingModel { get; set; }

    /// <summary>Lista de providers conhecidos pelo factory — para popular dropdowns na UI.</summary>
    public IReadOnlyList<string> KnownProviders { get; set; } = new List<string>();

    /// <summary>Provider que está sendo efetivamente usado AGORA neste tenant (após resolução override + global).</summary>
    public string EffectiveLlmProvider { get; set; } = "openai";
    public string EffectiveLlmModel { get; set; } = "";
    public string EffectiveEmbeddingProvider { get; set; } = "openai";
    public string EffectiveEmbeddingModel { get; set; } = "";
}

public sealed class TenantAiConfigRequest
{
    public string? LlmProvider { get; set; }
    public string? LlmModel { get; set; }
    public string? EmbeddingProvider { get; set; }
    public string? EmbeddingModel { get; set; }
}

// ── Service ──

public interface ITenantConfiguracaoService
{
    Task<TenantConfiguracaoDto> GetAsync(CancellationToken ct);
    Task<TenantConfiguracaoDto> UpsertAsync(TenantConfiguracaoUpsertRequest request, CancellationToken ct);
    Task<ConfiguracaoHeadcountDto> GetHeadcountConfigAsync(CancellationToken ct);
    Task<ConfiguracaoHeadcountDto> UpsertHeadcountConfigAsync(ConfiguracaoHeadcountRequest request, CancellationToken ct);

    /// <summary>Retorna a configuração de IA do tenant, mais o "effective" depois de resolver fallbacks.</summary>
    Task<TenantAiConfigDto> GetAiConfigAsync(CancellationToken ct);

    /// <summary>Atualiza os 4 campos de provider/modelo de IA. Strings vazias ou whitespace viram <c>null</c>.</summary>
    Task<TenantAiConfigDto> UpsertAiConfigAsync(TenantAiConfigRequest request, CancellationToken ct);
}

public sealed class TenantConfiguracaoService : ITenantConfiguracaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IAiProviderFactory _aiProviderFactory;
    private readonly AiOptions _aiOptions;

    public TenantConfiguracaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IAiProviderFactory aiProviderFactory,
        IOptions<AiOptions> aiOptions)
    {
        _db = db;
        _tenantContext = tenantContext;
        _aiProviderFactory = aiProviderFactory;
        _aiOptions = aiOptions?.Value ?? new AiOptions();
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

    // ────────── IA por tenant (Fase 3 LLM-agnóstico) ──────────

    public async Task<TenantAiConfigDto> GetAiConfigAsync(CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        return BuildAiConfigDto(config);
    }

    public async Task<TenantAiConfigDto> UpsertAiConfigAsync(TenantAiConfigRequest request, CancellationToken ct)
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

        config.LlmProvider = NormalizeProviderName(request.LlmProvider);
        config.LlmModel = NullIfBlank(request.LlmModel);
        config.EmbeddingProvider = NormalizeProviderName(request.EmbeddingProvider);
        config.EmbeddingModel = NullIfBlank(request.EmbeddingModel);
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return BuildAiConfigDto(config);
    }

    private TenantAiConfigDto BuildAiConfigDto(Domain.Entities.TenantConfiguracao? config)
    {
        var dto = new TenantAiConfigDto
        {
            LlmProvider = config?.LlmProvider,
            LlmModel = config?.LlmModel,
            EmbeddingProvider = config?.EmbeddingProvider,
            EmbeddingModel = config?.EmbeddingModel,
            KnownProviders = _aiProviderFactory.KnownProviders,
        };

        // "Effective" = depois de resolver fallbacks. Mostra ao usuário o que vai
        // realmente acontecer ao chamar IA agora.
        var defaultProvider = string.IsNullOrWhiteSpace(_aiOptions.DefaultProvider)
            ? "openai"
            : _aiOptions.DefaultProvider.Trim().ToLowerInvariant();
        var llmProvider = (config?.LlmProvider ?? defaultProvider).ToLowerInvariant();
        var embeddingProvider = (config?.EmbeddingProvider ?? defaultProvider).ToLowerInvariant();

        dto.EffectiveLlmProvider = llmProvider;
        dto.EffectiveLlmModel = !string.IsNullOrWhiteSpace(config?.LlmModel)
            ? config!.LlmModel!
            : DefaultChatModelFor(llmProvider);
        dto.EffectiveEmbeddingProvider = embeddingProvider;
        dto.EffectiveEmbeddingModel = !string.IsNullOrWhiteSpace(config?.EmbeddingModel)
            ? config!.EmbeddingModel!
            : DefaultEmbeddingModelFor(embeddingProvider);

        return dto;
    }

    private string DefaultChatModelFor(string provider) => provider switch
    {
        "gemini" => _aiOptions.Gemini?.DefaultModel ?? "gemini-2.5-flash",
        "anthropic" => _aiOptions.Anthropic?.DefaultModel ?? "claude-3-5-sonnet-20241022",
        "ollama" => _aiOptions.Ollama?.ChatModel ?? "qwen2.5:7b",
        _ => _aiOptions.OpenAI?.DefaultModel ?? "gpt-4o-mini",
    };

    private string DefaultEmbeddingModelFor(string provider) => provider switch
    {
        "gemini" => "models/gemini-embedding-001",
        "ollama" => _aiOptions.Ollama?.EmbeddingModel ?? "bge-m3",
        // Anthropic não fornece embeddings — cai em OpenAI no fallback do factory Python
        _ => "text-embedding-3-small",
    };

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string? NormalizeProviderName(string? raw)
    {
        var v = NullIfBlank(raw);
        if (v is null) return null;
        var lower = v.ToLowerInvariant();
        // Whitelist defensiva — evita gravar valores estranhos.
        return lower switch
        {
            "openai" or "gpt" or "azure" => "openai",
            "gemini" or "google" => "gemini",
            "anthropic" or "claude" => "anthropic",
            "ollama" or "local" => "ollama",
            _ => null, // unknown → trata como "use default"
        };
    }
}
