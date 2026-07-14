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
    public bool EnviarEmailResponsavelNaCandidatura { get; set; }
    public bool RhDeveAprovarAposGestor { get; set; }
    public bool RequisicoesVagaOrigemRm { get; set; }
    public bool RmImportacaoAutomaticaAtiva { get; set; }
    public int RmImportacaoAutomaticaIntervaloMinutos { get; set; } = 15;
    public int RmImportacaoAutomaticaMaxPorExecucao { get; set; } = 50;
    public Guid? AprovadorRhId { get; set; }
    public string? AprovadorRhNome { get; set; }
}

public sealed class TenantConfiguracaoUpsertRequest
{
    public bool EnviarEmailResponsavelNaCandidatura { get; set; }
    public bool RhDeveAprovarAposGestor { get; set; }
    public bool RequisicoesVagaOrigemRm { get; set; }
    public bool RmImportacaoAutomaticaAtiva { get; set; }
    public int RmImportacaoAutomaticaIntervaloMinutos { get; set; } = 15;
    public int RmImportacaoAutomaticaMaxPorExecucao { get; set; } = 50;
    public Guid? AprovadorRhId { get; set; }
}

public sealed record RmImportacaoAutomaticaRunDto(
    Guid Id,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? FinishedAtUtc,
    string Status,
    int IntervalMinutes,
    int MaxPerRun,
    int TotalLidos,
    int Criados,
    int Atualizados,
    int VagasCriadas,
    int Ignorados,
    int Erros,
    int StatusSyncTotalLidos,
    int StatusSyncAtualizados,
    int StatusSyncIgnorados,
    int StatusSyncErros,
    string? Mensagem);

public sealed record RmImportacaoAutomaticaRunLogDto(Guid Id, string FileName, string Content);

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

// ── DTOs de integração RM (requisições/solicitações) ──

public sealed class ConfiguracaoRmRequisicaoDto
{
    public string? EndpointUrl { get; set; }
    public string? GetEndpointUrl { get; set; }
    public string? ParecerEndpointUrl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed class ConfiguracaoRmRequisicaoRequest
{
    public string? EndpointUrl { get; set; }
    public string? GetEndpointUrl { get; set; }
    public string? ParecerEndpointUrl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
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

    /// <summary>
    /// Quando <c>true</c>, o Novo Candidato tenta preencher o formulário via IA ao anexar CV.
    /// </summary>
    public bool UsarIaParseCurriculo { get; set; } = true;

    /// <summary>Lista de providers conhecidos pelo factory — para popular dropdowns na UI.</summary>
    public IReadOnlyList<string> KnownProviders { get; set; } = new List<string>();

    /// <summary>
    /// Lista de providers que têm chave **realmente cadastrada** (Master.AiProviderKey ativa
    /// OU appsettings.Ai.{Provider}.ApiKey preenchida). A UI tenant só deve mostrar esses
    /// no dropdown — providers sem chave levariam a erro.
    /// (Fase 4 LLM-agnóstico, 2026-04-26.)
    /// </summary>
    public IReadOnlyList<string> AvailableProviders { get; set; } = new List<string>();

    /// <summary>
    /// <c>true</c> se o módulo <c>"ai"</c> está habilitado pelo owner para este tenant.
    /// Quando <c>false</c>, todas as features IA estão indisponíveis e a UI deve mostrar
    /// um aviso "IA não habilitada — contate o suporte".
    /// </summary>
    public bool AiEnabled { get; set; } = true;

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
    public bool? UsarIaParseCurriculo { get; set; }
}

// ── Service ──

public interface ITenantConfiguracaoService
{
    Task<TenantConfiguracaoDto> GetAsync(CancellationToken ct);
    Task<TenantConfiguracaoDto> UpsertAsync(TenantConfiguracaoUpsertRequest request, CancellationToken ct);
    Task<IReadOnlyList<RmImportacaoAutomaticaRunDto>> ListRmImportacaoAutomaticaRunsAsync(int take, CancellationToken ct);
    Task<RmImportacaoAutomaticaRunLogDto?> GetRmImportacaoAutomaticaRunLogAsync(Guid? id, CancellationToken ct);
    Task<ConfiguracaoHeadcountDto> GetHeadcountConfigAsync(CancellationToken ct);
    Task<ConfiguracaoHeadcountDto> UpsertHeadcountConfigAsync(ConfiguracaoHeadcountRequest request, CancellationToken ct);
    Task<ConfiguracaoRmRequisicaoDto> GetRmRequisicaoConfigAsync(CancellationToken ct);
    Task<ConfiguracaoRmRequisicaoDto> UpsertRmRequisicaoConfigAsync(ConfiguracaoRmRequisicaoRequest request, CancellationToken ct);

    /// <summary>Retorna a configuração de IA do tenant, mais o "effective" depois de resolver fallbacks.</summary>
    Task<TenantAiConfigDto> GetAiConfigAsync(CancellationToken ct);

    /// <summary>
    /// Atualiza os 4 campos de provider/modelo de IA. Strings vazias ou whitespace viram <c>null</c>.
    /// </summary>
    Task<TenantAiConfigDto> UpsertAiConfigAsync(TenantAiConfigRequest request, CancellationToken ct);
}

public sealed class TenantConfiguracaoService : ITenantConfiguracaoService
{
    private const string DefaultRmRequisicaoParecerEndpointUrl =
        "http://172.19.30.37:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroParecerData?limit=50&filter=[\"IDREQ= :P1 AND CODCOLREQUISICAO=:P2\",\"{IDREQ}\",\"{COLIGADA}\"]";

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IAiProviderFactory _aiProviderFactory;
    private readonly AiOptions _aiOptions;
    private readonly MasterDbContext _masterDb;
    private readonly ITenantAiSettingsResolver _aiResolver;

    public TenantConfiguracaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IAiProviderFactory aiProviderFactory,
        IOptions<AiOptions> aiOptions,
        MasterDbContext masterDb,
        ITenantAiSettingsResolver aiResolver)
    {
        _db = db;
        _tenantContext = tenantContext;
        _aiProviderFactory = aiProviderFactory;
        _aiOptions = aiOptions?.Value ?? new AiOptions();
        _masterDb = masterDb;
        _aiResolver = aiResolver;
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

        config.EnviarEmailResponsavelNaCandidatura = request.EnviarEmailResponsavelNaCandidatura;
        config.RhDeveAprovarAposGestor = request.RhDeveAprovarAposGestor;
        config.RequisicoesVagaOrigemRm = request.RequisicoesVagaOrigemRm;
        config.RmImportacaoAutomaticaAtiva = request.RmImportacaoAutomaticaAtiva;
        config.RmImportacaoAutomaticaIntervaloMinutos = Math.Clamp(request.RmImportacaoAutomaticaIntervaloMinutos, 1, 1440);
        config.RmImportacaoAutomaticaMaxPorExecucao = Math.Clamp(request.RmImportacaoAutomaticaMaxPorExecucao, 1, 500);
        config.AprovadorRhId = request.AprovadorRhId;
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Reload para trazer AprovadorRh navegado
        await _db.Entry(config).Reference(c => c.AprovadorRh).LoadAsync(ct);

        return MapToDto(config);
    }

    public async Task<IReadOnlyList<RmImportacaoAutomaticaRunDto>> ListRmImportacaoAutomaticaRunsAsync(int take, CancellationToken ct)
    {
        var limit = Math.Clamp(take, 1, 200);
        return await _db.RmImportacaoAutomaticaRuns
            .AsNoTracking()
            .OrderByDescending(x => x.StartedAtUtc)
            .Take(limit)
            .Select(x => new RmImportacaoAutomaticaRunDto(
                x.Id,
                x.StartedAtUtc,
                x.FinishedAtUtc,
                x.Status,
                x.IntervalMinutes,
                x.MaxPerRun,
                x.TotalLidos,
                x.Criados,
                x.Atualizados,
                x.VagasCriadas,
                x.Ignorados,
                x.Erros,
                x.StatusSyncTotalLidos,
                x.StatusSyncAtualizados,
                x.StatusSyncIgnorados,
                x.StatusSyncErros,
                x.Mensagem))
            .ToListAsync(ct);
    }

    public async Task<RmImportacaoAutomaticaRunLogDto?> GetRmImportacaoAutomaticaRunLogAsync(Guid? id, CancellationToken ct)
    {
        var query = _db.RmImportacaoAutomaticaRuns.AsNoTracking();
        var run = id.HasValue
            ? await query.FirstOrDefaultAsync(x => x.Id == id.Value, ct)
            : await query.OrderByDescending(x => x.StartedAtUtc).FirstOrDefaultAsync(ct);

        if (run is null)
            return null;

        var started = run.StartedAtUtc.ToString("yyyyMMdd-HHmmss");
        return new RmImportacaoAutomaticaRunLogDto(
            run.Id,
            $"rm-importacao-automatica-{started}-{run.Id:N}.log",
            run.LogText);
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

    public async Task<ConfiguracaoRmRequisicaoDto> GetRmRequisicaoConfigAsync(CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.FirstOrDefaultAsync(ct);
        if (config is null)
        {
            config = new Domain.Entities.TenantConfiguracao
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
                RmRequisicaoParecerEndpointUrl = DefaultRmRequisicaoParecerEndpointUrl,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            };
            _db.TenantConfiguracoes.Add(config);
            await _db.SaveChangesAsync(ct);
        }
        else if (string.IsNullOrWhiteSpace(config.RmRequisicaoParecerEndpointUrl))
        {
            config.RmRequisicaoParecerEndpointUrl = DefaultRmRequisicaoParecerEndpointUrl;
            config.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return new ConfiguracaoRmRequisicaoDto
        {
            EndpointUrl = config.RmRequisicaoCreateEndpointUrl,
            GetEndpointUrl = config.RmRequisicaoGetEndpointUrl,
            ParecerEndpointUrl = config.RmRequisicaoParecerEndpointUrl,
            Username = config.RmRequisicaoCreateUsername,
            Password = config.RmRequisicaoCreatePassword,
        };
    }

    public async Task<ConfiguracaoRmRequisicaoDto> UpsertRmRequisicaoConfigAsync(ConfiguracaoRmRequisicaoRequest request, CancellationToken ct)
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

        config.RmRequisicaoCreateEndpointUrl = NullIfBlank(request.EndpointUrl);
        config.RmRequisicaoGetEndpointUrl = null;
        config.RmRequisicaoParecerEndpointUrl = NullIfBlank(request.ParecerEndpointUrl);
        config.RmRequisicaoCreateUsername = NullIfBlank(request.Username);
        config.RmRequisicaoCreatePassword = NullIfBlank(request.Password);
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new ConfiguracaoRmRequisicaoDto
        {
            EndpointUrl = config.RmRequisicaoCreateEndpointUrl,
            GetEndpointUrl = config.RmRequisicaoGetEndpointUrl,
            ParecerEndpointUrl = config.RmRequisicaoParecerEndpointUrl,
            Username = config.RmRequisicaoCreateUsername,
            Password = config.RmRequisicaoCreatePassword,
        };
    }

    private static TenantConfiguracaoDto MapToDto(Domain.Entities.TenantConfiguracao c) => new()
    {
        EnviarEmailResponsavelNaCandidatura = c.EnviarEmailResponsavelNaCandidatura,
        RhDeveAprovarAposGestor = c.RhDeveAprovarAposGestor,
        RequisicoesVagaOrigemRm = c.RequisicoesVagaOrigemRm,
        RmImportacaoAutomaticaAtiva = c.RmImportacaoAutomaticaAtiva,
        RmImportacaoAutomaticaIntervaloMinutos = c.RmImportacaoAutomaticaIntervaloMinutos,
        RmImportacaoAutomaticaMaxPorExecucao = c.RmImportacaoAutomaticaMaxPorExecucao,
        AprovadorRhId = c.AprovadorRhId,
        AprovadorRhNome = c.AprovadorRh?.Name,
    };

    // ────────── IA por tenant (Fase 3 LLM-agnóstico) ──────────

    public async Task<TenantAiConfigDto> GetAiConfigAsync(CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        return await BuildAiConfigDtoAsync(config, ct);
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
        if (request.UsarIaParseCurriculo.HasValue)
            config.UsarIaParseCurriculo = request.UsarIaParseCurriculo.Value;
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await BuildAiConfigDtoAsync(config, ct);
    }

    private async Task<TenantAiConfigDto> BuildAiConfigDtoAsync(Domain.Entities.TenantConfiguracao? config, CancellationToken ct)
    {
        var dto = new TenantAiConfigDto
        {
            LlmProvider = config?.LlmProvider,
            LlmModel = config?.LlmModel,
            EmbeddingProvider = config?.EmbeddingProvider,
            EmbeddingModel = config?.EmbeddingModel,
            UsarIaParseCurriculo = config?.UsarIaParseCurriculo ?? true,
            KnownProviders = _aiProviderFactory.KnownProviders,
            AvailableProviders = await ComputeAvailableProvidersAsync(ct),
            AiEnabled = await _aiResolver.IsAiEnabledAsync(ct),
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
        "gemini" => "gemini-embedding-001",
        "ollama" => _aiOptions.Ollama?.EmbeddingModel ?? "bge-m3",
        // Anthropic não fornece embeddings — cai em OpenAI no fallback do factory Python
        _ => "text-embedding-3-small",
    };

    /// <summary>
    /// Computa quais providers têm chave realmente cadastrada (Master.AiProviderKey
    /// ativa OU appsettings.Ai.{Provider}.ApiKey preenchida). Ollama é considerado
    /// "available" se <c>Ai.Ollama.Enabled = true</c> (não exige chave).
    /// </summary>
    private async Task<IReadOnlyList<string>> ComputeAvailableProvidersAsync(CancellationToken ct)
    {
        var available = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // 1. Master DB — AiProviderKey ativos
        var dbKeys = await _masterDb.AiProviderKeys
            .AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Provider)
            .ToListAsync(ct);
        foreach (var raw in dbKeys)
        {
            var norm = NormalizeProviderName(raw);
            if (norm is not null) available.Add(norm);
        }

        // 2. appsettings.Ai.* fallback
        if (!string.IsNullOrWhiteSpace(_aiOptions.OpenAI?.ApiKey)) available.Add("openai");
        if (!string.IsNullOrWhiteSpace(_aiOptions.Gemini?.ApiKey)) available.Add("gemini");
        if (!string.IsNullOrWhiteSpace(_aiOptions.Anthropic?.ApiKey)) available.Add("anthropic");

        // 3. Ollama: sem chave; considerado disponível quando Enabled = true
        if (_aiOptions.Ollama?.Enabled == true) available.Add("ollama");

        return available.ToList();
    }

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
