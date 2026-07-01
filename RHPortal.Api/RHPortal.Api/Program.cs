using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RhPortal.Api.Application.ApiKeys;
using RhPortal.Api.Application.Authentication;
using RhPortal.Api.Application.Agenda;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Candidatos.Handlers;
using RhPortal.Api.Application.JobPositions;
using RhPortal.Api.Application.JobPositions.Handlers;
using RhPortal.Api.Application.Funcionarios;
using RhPortal.Api.Application.Funcionarios.Handlers;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Application.Hierarquia;
using RhPortal.Api.Application.ProjetosVaga;
using RhPortal.Api.Application.FasesProcesso;
using RhPortal.Api.Application.CamposPersonalizados;
using RhPortal.Api.Application.Comunicacao;
using RhPortal.Api.Application.AprovacoesFaixa;
using RhPortal.Api.Application.Colaborador;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Application.Menus;
using RhPortal.Api.Application.Navegacao;
using RhPortal.Api.Application.Portal;
using RhPortal.Api.Application.Roles;
using RhPortal.Api.Application.Units;
using RhPortal.Api.Application.Units.Handlers;
using RhPortal.Api.Application.Users;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Me;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Application.BloqueioPessoa;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.Vagas.Handlers;
using RhPortal.Api.Application.Localization;
using RhPortal.Api.Auditing.Context;
using RhPortal.Api.Auditing.EF;
using RhPortal.Api.Auditing.Middleware;
using RhPortal.Api.Auditing.Services;
using RhPortal.Api.Logging.Context;
using RhPortal.Api.Logging.Filters;
using RhPortal.Api.Logging.Logger;
using RhPortal.Api.Logging.Middleware;
using RhPortal.Api.Logging.Writer;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Inbox;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Infrastructure.Ai;
using RhPortal.Api.Infrastructure.Ops;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Scheduling;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Swagger;
using RhPortal.Api.Messaging.Email;
using RhPortal.Api.Contracts.Funcionarios;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionProblemDetailsHandler>();
builder.Services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromMinutes(2) };
    options.AddPolicy("RmConsulta", TimeSpan.FromMinutes(5));
});

// Response Compression (Brotli + Gzip)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat([
        "application/json", "text/json", "application/problem+json"
    ]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Optimal);
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var supportedCultures = new[]
        { "pt-BR", "en-US" }
        .Select(c => new CultureInfo(c))
        .ToList();

    options.DefaultRequestCulture = new RequestCulture("pt-BR");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;
    options.RequestCultureProviders.Insert(0, new TenantCultureProvider());
});

builder.Services
    .AddControllers(options => { options.Filters.Add<ProblemDetailsLoggingFilter>(); })
    .AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.JsonSerializerOptions.Converters.Add(new FuncionarioCreateRequestJsonConverter());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddMemoryCache();
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("lookup", b => b
        .Expire(TimeSpan.FromMinutes(5))
        .VaryByValue(ctx =>
        {
            var tenant = ctx.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? string.Empty;
            var qs = ctx.Request.QueryString.Value ?? string.Empty;
            return new KeyValuePair<string, string>("key", $"{tenant}:{qs}");
        }));
});
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        // Isentar requests de integração (API Key) do rate limiting
        if (ctx.Request.Headers.ContainsKey("X-Api-Key"))
            return RateLimitPartition.GetNoLimiter("apikey");

        return RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
    });
    options.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.StatusCode = 429;
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { error = "Too Many Requests" }, ct);
    };
});
builder.Services.AddSignalR();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("AzureAdGraph");
// Sessão 31.8 — Geocoding: Nominatim + Photon + BrasilAPI CEP (cadeia, best-effort)
builder.Services.AddHttpClient<RhPortal.Api.Application.Geocoding.NominatimGeocodingService>();
builder.Services.AddHttpClient<RhPortal.Api.Application.Geocoding.PhotonGeocodingService>();
builder.Services.AddHttpClient<RhPortal.Api.Application.Geocoding.BrasilApiCepGeocodingService>();
builder.Services.AddSingleton<RhPortal.Api.Application.Geocoding.IGeocodingService, RhPortal.Api.Application.Geocoding.CompositeGeocodingService>();
builder.Services.AddCors(options =>
{
    var allowAny = string.Equals(builder.Configuration["Cors:AllowAny"], "true", StringComparison.OrdinalIgnoreCase);
    var webOrigins = (builder.Configuration["Cors:WebOrigin"] ?? "https://localhost:7091")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    options.AddPolicy("WebApp", policy =>
    {
        if (allowAny)
            policy.AllowAnyOrigin();
        else
            policy.WithOrigins(webOrigins).AllowCredentials();

        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "RHPortal API",
        Version = "v1",
        Description = "API do RH Portal — recrutamento, matching, feedback e gestão."
    });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Informe o token JWT: Bearer {token}"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    c.CustomSchemaIds(type => type.FullName?.Replace("+", ".") ?? type.Name);

    c.MapType<DateOnly>(() => new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string", Format = "date" });
    c.MapType<DateOnly?>(() => new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string", Format = "date", Nullable = true });
    c.MapType<TimeOnly>(() => new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string", Format = "time" });
    c.MapType<TimeOnly?>(() => new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string", Format = "time", Nullable = true });

    c.OperationFilter<TenantHeaderOperationFilter>();

    var xmlName = $"{typeof(Program).Assembly.GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlName);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<MasterDbContext>("database_master")
    .AddDbContextCheck<AppDbContext>("database")
    // Fase 5 LLM-agnóstico — LUC-014: reporta status do serviço Python RHPortal.Ai.
    // Usa Degraded quando Python responde mas não está pronto (não tira o app do ar).
    .AddCheck<RhPortal.Api.Infrastructure.HealthChecks.RHPortalAiHealthCheck>(
        "rhportal_ai",
        failureStatus: HealthStatus.Degraded);

// Tenancy
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddScoped<ITenantConnectionResolver, TenantConnectionResolver>();
builder.Services.AddScoped<TenantMiddleware>();
builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();

// Auditing
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<RhPortal.Api.Infrastructure.Frontend.IFrontendPublicUrlBuilder, RhPortal.Api.Infrastructure.Frontend.FrontendPublicUrlBuilder>();
builder.Services.AddScoped<IAuditContextAccessor, AuditContextAccessor>();
builder.Services.AddScoped<AuditMiddleware>();
builder.Services.AddScoped<AuditSaveChangesInterceptor>();
builder.Services.AddSingleton<AuditWriter>();

// Logging (separate from audit)
builder.Services.AddSingleton<ILogContextAccessor, LogContextAccessor>();
builder.Services.AddScoped<RequestLogMiddleware>();
builder.Services.AddScoped<ExceptionLoggingMiddleware>();
builder.Services.AddSingleton(DbLogQueue.Create());
builder.Services.AddSingleton<DbLoggerProvider>();
builder.Services.AddSingleton<ILoggerProvider>(sp => sp.GetRequiredService<DbLoggerProvider>());
builder.Services.AddHostedService<DbLogWriterService>();
builder.Services.AddHostedService<VagaUnifiedMatchingCacheCleanupService>();
builder.Services.AddSingleton<MatchingRecomputeQueue>();
builder.Services.AddHostedService<MatchingRecomputeWorker>();
builder.Services.Configure<BatchMatchingOptions>(builder.Configuration.GetSection(BatchMatchingOptions.SectionName));
builder.Services.AddSingleton<BatchMatchingQueue>();
builder.Services.AddHostedService<BatchMatchingRunnerService>();
builder.Services.AddScoped<INdcgCalculationService, NdcgCalculationService>();

// Inbox folder watcher
builder.Services.Configure<InboxFolderOptions>(builder.Configuration.GetSection("InboxFolder"));
builder.Services.AddScoped<InboxFileProcessor>();
builder.Services.AddHostedService<InboxFolderWatcherService>();

builder.Services.AddSingleton<ResetState>();
builder.Services.AddScoped<NotificationPublisher>();

// Email messaging (queue + SMTP/IMAP)
builder.Services.AddSingleton<ISecretProtector, AesSecretProtector>();
builder.Services.AddSingleton<RhPortal.Api.Application.Owner.TotvsGestorHierarchyRunRegistry>();
builder.Services.AddScoped<RhPortal.Api.Application.Owner.TotvsGestorHierarchySyncRunner>();
builder.Services.AddScoped<RhPortal.Api.Application.Owner.ITotvsGestorHierarchyOwnerService,
    RhPortal.Api.Application.Owner.TotvsGestorHierarchyOwnerService>();
builder.Services.AddHostedService<RhPortal.Api.Application.Owner.RmBootstrapHostedService>();
builder.Services.AddHostedService<RhPortal.Api.Application.Owner.BootstrapUsersHostedService>();
builder.Services.AddHttpClient("totvsGestorHierarchy", client =>
{
    client.Timeout = TimeSpan.FromMinutes(3);
});

builder.Services.AddScoped<IEmailConfigService, EmailConfigService>();
builder.Services.AddScoped<IEntraIdConfigService, EntraIdConfigService>();
builder.Services.AddScoped<IApiKeyService, ApiKeyService>();
builder.Services.AddScoped<RhPortal.Api.Application.RmConfiguracao.ITenantRmConfiguracaoService,
    RhPortal.Api.Application.RmConfiguracao.TenantRmConfiguracaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.RmConfiguracao.GestorUsuarioProvisioningService>();
builder.Services.AddScoped<RhPortal.Api.Application.AprovadoresAlternativos.IAprovadorAlternativoService, RhPortal.Api.Application.AprovadoresAlternativos.AprovadorAlternativoService>();
builder.Services.AddScoped<RhPortal.Api.Application.DocumentacaoPadrao.IDocumentacaoPadraoService, RhPortal.Api.Application.DocumentacaoPadrao.DocumentacaoPadraoService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IOwnerAiService, RhPortal.Api.Application.Ai.OwnerAiService>();
// ── Providers de IA (Fase 2 LLM-agnóstico) ────────────────────────────────
// Cada provider concreto é registrado como IAiProvider — o IAiProviderFactory
// recebe a coleção e escolhe por nome em runtime (ver AiProviderFactory.cs).
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IAiProvider, RhPortal.Api.Application.Ai.OpenAiProvider>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IAiProvider, RhPortal.Api.Application.Ai.GeminiProvider>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IAiProvider, RhPortal.Api.Application.Ai.AnthropicProvider>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IAiProviderFactory, RhPortal.Api.Application.Ai.AiProviderFactory>();
// Fase 3 LLM-agnóstico — leitura de provider/modelo do tenant atual
builder.Services.AddScoped<RhPortal.Api.Application.Ai.ITenantAiSettingsResolver, RhPortal.Api.Application.Ai.TenantAiSettingsResolver>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IUnifiedAiService, RhPortal.Api.Application.Ai.UnifiedAiService>();
builder.Services.AddScoped<IEntraTokenValidator, EntraTokenValidator>();
builder.Services.AddScoped<IEntraChallengeService, EntraChallengeService>();
builder.Services.AddScoped<IEmailQueueService, EmailQueueService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<EmailDispatchWorker>();
builder.Services.AddHostedService<CvImportWorker>();
builder.Services.AddHostedService<RhPortal.Api.Infrastructure.Scheduling.ApprovalReminderService>();
builder.Services.AddHostedService<RhPortal.Api.Infrastructure.Scheduling.IntegracaoRetryService>();

// PostgreSQL + EF Core
builder.Services.AddDbContextPool<MasterDbContext>(options =>
{
    var conn = builder.Configuration.GetConnectionString("Master")
        ?? builder.Configuration.GetConnectionString("Default");
    options.UseNpgsql(conn, npgsql =>
    {
        npgsql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        npgsql.CommandTimeout(30);
    });
}, poolSize: 32);
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var resolver = sp.GetRequiredService<ITenantConnectionResolver>();
    var conn = resolver.GetConnectionString();
    options.UseNpgsql(conn, npgsql =>
    {
        npgsql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        npgsql.CommandTimeout(30);
        // Habilita tipo vector do pgvector (usado em DescricaoCargoItemEmbedding,
        // CandidatoEmbedding). Em bancos sem a extensão, o EF não gera DDL para
        // embeddings — migration é idempotente (CREATE EXTENSION IF NOT EXISTS).
        npgsql.UseVector();
    });
    options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
    // Fase 4.O — interceptor de reindexação automática de embeddings
    options.AddInterceptors(sp.GetRequiredService<RhPortal.Api.Application.Ai.EmbeddingReindexInterceptor>());
});

// Identity
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequireDigit = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
})
    .AddErrorDescriber<LocalizedIdentityErrorDescriber>()
    .AddRoles<ApplicationRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    // Tokens (reset de senha, confirmar e-mail, etc.). AddIdentityCore não registra o provider "Default";
    // sem isso, GeneratePasswordResetTokenAsync falha ao administrar usuários.
    .AddDefaultTokenProviders();

builder.Services.Configure<RmConnectionOptions>(builder.Configuration.GetSection(RmConnectionOptions.SectionName));
builder.Services.Configure<RmSolicitacaoStatusSyncOptions>(
    builder.Configuration.GetSection(RmSolicitacaoStatusSyncOptions.SectionName));
builder.Services.AddScoped<ISolicitacaoVagaRmCodStatusSyncService, SolicitacaoVagaRmCodStatusSyncService>();
builder.Services.AddScoped<ISolicitacaoVagaRmImportService, SolicitacaoVagaRmImportService>();
builder.Services.AddHostedService<RmSolicitacaoStatusSyncHostedService>();
builder.Services.AddScoped<IRmRequisicoesReadService, RmRequisicoesReadService>();
builder.Services.AddScoped<IRmRequisicaoParecerReadService, RmRequisicaoParecerReadService>();

builder.Services.Configure<RmRequisicaoCreateOptions>(builder.Configuration.GetSection(RmRequisicaoCreateOptions.SectionName));
builder.Services.AddHttpClient<IRmRequisicaoCreateClient, RmRequisicaoCreateRestClient>();
builder.Services.AddScoped<ISolicitacaoVagaRmIntegracaoService, SolicitacaoVagaRmIntegracaoService>();
builder.Services.AddHostedService<RmSolicitacaoCriacaoHostedService>();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<HubSsoOptions>(builder.Configuration.GetSection(HubSsoOptions.SectionName));
builder.Services.Configure<SlaVagaOptions>(builder.Configuration.GetSection(SlaVagaOptions.SectionName));
builder.Services.Configure<RhAiOptions>(builder.Configuration.GetSection(RhAiOptions.SectionName));
// Ollama/RAG (Fase 4): configuração local do stack IA aberto
builder.Services.Configure<RhPortal.Api.Application.Ai.AiOptions>(builder.Configuration.GetSection(RhPortal.Api.Application.Ai.AiOptions.SectionName));

// Cliente RHPortal.Ai (matching vetorial + LLM 80/20): só registra se RhAi:BaseUrl estiver configurado
var rhAiBaseUrl = builder.Configuration[$"{RhAiOptions.SectionName}:BaseUrl"]?.Trim();
if (!string.IsNullOrEmpty(rhAiBaseUrl))
{
    var baseUri = new Uri(rhAiBaseUrl.TrimEnd('/') + "/", UriKind.Absolute);
    builder.Services
        .AddHttpClient<IRHPortalAiMatchClient, RHPortalAiMatchClient>(client =>
        {
            client.BaseAddress = baseUri;
            client.Timeout = TimeSpan.FromSeconds(180);
        })
        .AddStandardResilienceHandler(options =>
        {
            options.Retry.MaxRetryAttempts = 3;
            options.Retry.Delay = TimeSpan.FromSeconds(2);
            options.CircuitBreaker.FailureRatio = 0.5;
            options.CircuitBreaker.MinimumThroughput = 5;
            options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(30);
            options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(120);
        });
}

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>();
if (jwtOptions is null || string.IsNullOrWhiteSpace(jwtOptions.SigningKey))
    throw new InvalidOperationException("[FATAL] Configuração JWT ausente. Defina 'Jwt:Secret' no appsettings ou variáveis de ambiente antes de iniciar a aplicação.");

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.ForwardDefaultSelector = context =>
            context.Request.Headers.ContainsKey(ApiKeyConstants.ApiKeyHeaderName) ? ApiKeyConstants.ApiKeyScheme : null;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = ClaimTypes.Role
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var tenantContext = context.HttpContext.RequestServices.GetRequiredService<ITenantContext>();
                var tenantClaim = context.Principal?.FindFirst("tenant")?.Value;
                var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<InfrastructureMessages>>();

                if (string.IsNullOrWhiteSpace(tenantClaim))
                {
                    context.Fail(localizer["InfrastructureErrors.TenantClaimRequired"]);
                    return Task.CompletedTask;
                }

                if (!string.Equals(tenantClaim, tenantContext.TenantId, StringComparison.OrdinalIgnoreCase))
                {
                    context.Fail(localizer["InfrastructureErrors.TenantDoesNotMatch"]);
                }

                return Task.CompletedTask;
            }
        };
    })
    .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(ApiKeyConstants.ApiKeyScheme, _ => { });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme, ApiKeyConstants.ApiKeyScheme)
        .RequireAuthenticatedUser()
        .Build();
    options.AddPolicy("Owner", policy => policy.RequireRole("Owner"));
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ModuleAuthorizationHandler>();

// Application services
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IJobPositionService, JobPositionService>();
builder.Services.AddScoped<IFuncionarioService, FuncionarioService>();
builder.Services.AddScoped<ISolicitacaoVagaRecrutadorNotifier, SolicitacaoVagaRecrutadorNotifier>();
builder.Services.AddScoped<ISolicitacaoVagaService, SolicitacaoVagaService>();
builder.Services.AddScoped<RhPortal.Api.Application.Vagas.IVagaPipelineService, RhPortal.Api.Application.Vagas.VagaPipelineService>();
builder.Services.AddScoped<RhPortal.Api.Application.PublicApproval.IMagicLinkService, RhPortal.Api.Application.PublicApproval.MagicLinkService>();
builder.Services.AddScoped<RhPortal.Api.Application.EntrevistasSaida.IEntrevistaSaidaService, RhPortal.Api.Application.EntrevistasSaida.EntrevistaSaidaService>();
builder.Services.AddScoped<RhPortal.Api.Application.WorkflowRH.IWorkflowRHService, RhPortal.Api.Application.WorkflowRH.WorkflowRHService>();
builder.Services.AddScoped<RhPortal.Api.Application.Common.ApprovalWorkflowHelper>();
builder.Services.AddScoped<RhPortal.Api.Application.Common.StatusHistoricoService>();
builder.Services.AddScoped<RhPortal.Api.Application.EtapasConfigAprovacao.IEtapaConfigAprovacaoService, RhPortal.Api.Application.EtapasConfigAprovacao.EtapaConfigAprovacaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.OcupacaoHistorico.IOcupacaoHistoricoService, RhPortal.Api.Application.OcupacaoHistorico.OcupacaoHistoricoService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesDesligamento.ISolicitacaoDesligamentoService, RhPortal.Api.Application.SolicitacoesDesligamento.SolicitacaoDesligamentoService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesPromocao.ISolicitacaoPromocaoService, RhPortal.Api.Application.SolicitacoesPromocao.SolicitacaoPromocaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesFerias.ISolicitacaoFeriasService, RhPortal.Api.Application.SolicitacoesFerias.SolicitacaoFeriasService>();
builder.Services.AddScoped<RhPortal.Api.Application.Cartas.ICartaService, RhPortal.Api.Application.Cartas.CartaService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesBeneficio.ISolicitacaoBeneficioService, RhPortal.Api.Application.SolicitacoesBeneficio.SolicitacaoBeneficioService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesDependente.ISolicitacaoDependenteService, RhPortal.Api.Application.SolicitacoesDependente.SolicitacaoDependenteService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesEndereco.ISolicitacaoEnderecoService, RhPortal.Api.Application.SolicitacoesEndereco.SolicitacaoEnderecoService>();
builder.Services.AddScoped<RhPortal.Api.Application.SolicitacoesPagamentoExtra.ISolicitacaoPagamentoExtraService, RhPortal.Api.Application.SolicitacoesPagamentoExtra.SolicitacaoPagamentoExtraService>();
builder.Services.AddScoped<INivelHierarquicoService, NivelHierarquicoService>();
builder.Services.AddScoped<IProjetoVagaService, ProjetoVagaService>();
builder.Services.AddScoped<IFaseProcessoService, FaseProcessoService>();
builder.Services.AddScoped<ICampoPersonalizadoService, CampoPersonalizadoService>();
builder.Services.AddScoped<IComunicacaoService, ComunicacaoService>();
builder.Services.AddScoped<IAprovacaoFaixaService, AprovacaoFaixaService>();
builder.Services.AddScoped<RhPortal.Api.Application.Dashboard.IDashboardAgregadoService, RhPortal.Api.Application.Dashboard.DashboardAgregadoService>();
builder.Services.AddScoped<RhPortal.Api.Application.TenantConfiguracao.ITenantConfiguracaoService, RhPortal.Api.Application.TenantConfiguracao.TenantConfiguracaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.MicrosoftGraph.IMicrosoftGraphCalendarService, RhPortal.Api.Application.MicrosoftGraph.MicrosoftGraphCalendarService>();
builder.Services.AddScoped<RhPortal.Api.Application.TenantBranding.ITenantBrandingService, RhPortal.Api.Application.TenantBranding.TenantBrandingService>();
builder.Services.AddScoped<RhPortal.Api.Application.NineBox.INineBoxService, RhPortal.Api.Application.NineBox.NineBoxService>();
builder.Services.AddScoped<RhPortal.Api.Application.Metas.IMetaService, RhPortal.Api.Application.Metas.MetaService>();
builder.Services.AddScoped<RhPortal.Api.Application.Avaliacao.IAvaliacaoService, RhPortal.Api.Application.Avaliacao.AvaliacaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.Avaliacao.IAvaliacaoConviteService, RhPortal.Api.Application.Avaliacao.AvaliacaoConviteService>();
builder.Services.AddScoped<RhPortal.Api.Application.Avaliacao.IAvaliacaoCalibragemService, RhPortal.Api.Application.Avaliacao.AvaliacaoCalibragemService>();
builder.Services.AddScoped<RhPortal.Api.Application.Avaliacao.IAvaliacaoTemplateService, RhPortal.Api.Application.Avaliacao.AvaliacaoTemplateService>();
builder.Services.AddScoped<RhPortal.Api.Application.Feedback.IOneOnOneTemplateService, RhPortal.Api.Application.Feedback.OneOnOneTemplateService>();
builder.Services.AddScoped<RhPortal.Api.Application.Feedback.IFeedbackTemplateService, RhPortal.Api.Application.Feedback.FeedbackTemplateService>();
builder.Services.AddScoped<RhPortal.Api.Application.Feedback.IPdiSuggesterService, RhPortal.Api.Application.Feedback.PdiSuggesterService>();
builder.Services.AddScoped<RhPortal.Api.Application.Feedback.ISurveyTemplateService, RhPortal.Api.Application.Feedback.SurveyTemplateService>();
builder.Services.AddScoped<RhPortal.Api.Application.Feedback.IRenderCoinRewardService, RhPortal.Api.Application.Feedback.RenderCoinRewardService>();
builder.Services.AddScoped<IColaboradorService, ColaboradorService>();
builder.Services.Configure<RhPortal.Api.Infrastructure.Storage.AwsOptions>(builder.Configuration.GetSection("Aws"));
builder.Services.AddScoped<RhPortal.Api.Application.AwsSettings.IAwsSettingsService, RhPortal.Api.Application.AwsSettings.AwsSettingsService>();
builder.Services.AddScoped<RhPortal.Api.Infrastructure.Storage.IS3StorageService, RhPortal.Api.Infrastructure.Storage.S3StorageService>();
builder.Services.AddScoped<IPreAdmissaoService, PreAdmissaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.IntegracaoTotvs.IIntegracaoTotvsService, RhPortal.Api.Application.IntegracaoTotvs.IntegracaoTotvsService>();
builder.Services.AddScoped<RhPortal.Api.Application.IntegracaoTotvs.IRmSyncRunService, RhPortal.Api.Application.IntegracaoTotvs.RmSyncRunService>();
builder.Services.AddScoped<RhPortal.Api.Application.AdmissaoPortal.DocumentAiExtractor>();
builder.Services.AddScoped<RhPortal.Api.Application.Blip.BlipDocumentoValidator>();
builder.Services.AddScoped<RhPortal.Api.Application.Blip.BlipMessagingService>();
builder.Services.AddScoped<RhPortal.Api.Application.AdmissaoPortal.IAdmissaoPortalRhNotificacaoService, RhPortal.Api.Application.AdmissaoPortal.AdmissaoPortalRhNotificacaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.AdmissaoPortal.IAdmissaoPortalService, RhPortal.Api.Application.AdmissaoPortal.AdmissaoPortalService>();
builder.Services.AddScoped<RhPortal.Api.Application.AdmissaoPortal.IAdmissaoPortalOtpService, RhPortal.Api.Application.AdmissaoPortal.AdmissaoPortalOtpService>();
builder.Services.AddHttpClient<IItaloIntegrationService, ItaloIntegrationService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<IVagaService, VagaService>();
builder.Services.AddScoped<RhPortal.Api.Application.PropostasVaga.IPropostaVagaService, RhPortal.Api.Application.PropostasVaga.PropostaVagaService>();
builder.Services.AddScoped<RhPortal.Api.Application.Candidaturas.ICandidaturaService, RhPortal.Api.Application.Candidaturas.CandidaturaService>();
builder.Services.AddScoped<RhPortal.Api.Application.Candidaturas.ICandidaturaNotificacaoService, RhPortal.Api.Application.Candidaturas.CandidaturaNotificacaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.Candidaturas.ICandidaturaResponsavelEmailNotifier, RhPortal.Api.Application.Candidaturas.CandidaturaResponsavelEmailNotifier>();
builder.Services.AddScoped<RhPortal.Api.Application.Candidaturas.INotificacaoTemplateService, RhPortal.Api.Application.Candidaturas.NotificacaoTemplateService>();
builder.Services.Configure<RhPortal.Api.Messaging.WhatsApp.WhatsAppOptions>(
    builder.Configuration.GetSection(RhPortal.Api.Messaging.WhatsApp.WhatsAppOptions.SectionName));

// HttpClients nomeados para os provedores reais (configurados sob demanda).
builder.Services.AddHttpClient(RhPortal.Api.Messaging.WhatsApp.TwilioWhatsAppMessageSender.HttpClientName,
    (sp, http) =>
    {
        var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<RhPortal.Api.Messaging.WhatsApp.WhatsAppOptions>>().CurrentValue;
        http.Timeout = TimeSpan.FromSeconds(20);
        if (!string.IsNullOrWhiteSpace(opts.Twilio.BaseUrl))
            http.BaseAddress = new Uri(opts.Twilio.BaseUrl.TrimEnd('/') + "/");
    });
builder.Services.AddHttpClient(RhPortal.Api.Messaging.WhatsApp.MetaCloudWhatsAppMessageSender.HttpClientName,
    (sp, http) =>
    {
        var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<RhPortal.Api.Messaging.WhatsApp.WhatsAppOptions>>().CurrentValue;
        http.Timeout = TimeSpan.FromSeconds(20);
        if (!string.IsNullOrWhiteSpace(opts.MetaCloud.BaseUrl))
            http.BaseAddress = new Uri(opts.MetaCloud.BaseUrl.TrimEnd('/') + "/");
    });

// Resolução do provider WhatsApp por configuração (Logging | Twilio | MetaCloud).
// Default = "Logging" (stub seguro). Mudança acontece via appsettings sem recompilar.
builder.Services.AddSingleton<RhPortal.Api.Messaging.WhatsApp.IWhatsAppMessageSender>(sp =>
{
    var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<RhPortal.Api.Messaging.WhatsApp.WhatsAppOptions>>().CurrentValue;
    var logger = sp.GetRequiredService<Microsoft.Extensions.Logging.ILoggerFactory>();
    var httpFactory = sp.GetRequiredService<IHttpClientFactory>();
    var monitor = sp.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<RhPortal.Api.Messaging.WhatsApp.WhatsAppOptions>>();

    var provider = (opts.Provider ?? "Logging").Trim();
    if (string.Equals(provider, "Twilio", StringComparison.OrdinalIgnoreCase))
    {
        return new RhPortal.Api.Messaging.WhatsApp.TwilioWhatsAppMessageSender(
            httpFactory.CreateClient(RhPortal.Api.Messaging.WhatsApp.TwilioWhatsAppMessageSender.HttpClientName),
            monitor,
            logger.CreateLogger<RhPortal.Api.Messaging.WhatsApp.TwilioWhatsAppMessageSender>());
    }
    if (string.Equals(provider, "MetaCloud", StringComparison.OrdinalIgnoreCase))
    {
        return new RhPortal.Api.Messaging.WhatsApp.MetaCloudWhatsAppMessageSender(
            httpFactory.CreateClient(RhPortal.Api.Messaging.WhatsApp.MetaCloudWhatsAppMessageSender.HttpClientName),
            monitor,
            logger.CreateLogger<RhPortal.Api.Messaging.WhatsApp.MetaCloudWhatsAppMessageSender>());
    }
    // Default seguro
    return new RhPortal.Api.Messaging.WhatsApp.LoggingWhatsAppMessageSender(
        logger.CreateLogger<RhPortal.Api.Messaging.WhatsApp.LoggingWhatsAppMessageSender>());
});
builder.Services.AddScoped<ICandidatoService, CandidatoService>();
builder.Services.AddScoped<ICandidatoPortalPerfilReader, CandidatoPortalPerfilReader>();
builder.Services.AddScoped<IPessoaService, PessoaService>();
builder.Services.AddScoped<ICvGptExtractor, CvGptExtractor>();
builder.Services.AddScoped<ITalentoService, TalentoService>();
builder.Services.AddScoped<IBloqueioPessoaService, BloqueioPessoaService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
// Sessão 31.8 — matching baseado em DescricaoCargo (template DNALIO) + pesos calibrados + distância
builder.Services.AddScoped<RhPortal.Api.Application.Matching.DescricaoCargoMatchingService>();
// Fase 4 — pipeline Ollama/RAG: cliente HTTP tipado + embedding + vector search + matching híbrido
builder.Services.AddHttpClient<RhPortal.Api.Application.Ai.IOllamaClient, RhPortal.Api.Application.Ai.OllamaClient>((sp, http) =>
{
    var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<RhPortal.Api.Application.Ai.AiOptions>>().Value.Ollama;
    if (!string.IsNullOrWhiteSpace(opts.Endpoint))
        http.BaseAddress = new Uri(opts.Endpoint);
    http.Timeout = TimeSpan.FromSeconds(opts.TimeoutSeconds);
});
builder.Services.AddScoped<RhPortal.Api.Application.Ai.ITenantEmbeddingGenerator, RhPortal.Api.Application.Ai.TenantEmbeddingGenerator>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IEmbeddingService, RhPortal.Api.Application.Ai.EmbeddingService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IVectorSearchService, RhPortal.Api.Application.Ai.VectorSearchService>();
builder.Services.AddScoped<RhPortal.Api.Application.Matching.HybridMatchingService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.ILlmAssistantService, RhPortal.Api.Application.Ai.LlmAssistantService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IDescricaoCargoGeneratorService, RhPortal.Api.Application.Ai.DescricaoCargoGeneratorService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.ICvResumoService, RhPortal.Api.Application.Ai.CvResumoService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.ISalarioSuggesterService, RhPortal.Api.Application.Ai.SalarioSuggesterService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.ILlmMatchingService, RhPortal.Api.Application.Ai.LlmMatchingService>();
// Fase 5 — Agent Tools (Function Calling do Qwen)
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentToolRegistry, RhPortal.Api.Application.Ai.Agent.AgentToolRegistry>();
// Registra cada tool concreta como IAgentTool scoped — o registry consome via IEnumerable<IAgentTool>
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.VagasListarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.VagasContarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.VagasInfoTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.VagasCandidatosTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CandidatosListarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CandidatosInfoTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CandidatosContarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CandidaturasPorEtapaTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CandidaturasSlaAtrasadasTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CandidaturasPorFonteTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.PropostasListarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.PropostasEstatisticasTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.CentrosCustoListarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.DescricoesCargoListarTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.DescricaoCargoInfoTool>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.Agent.IAgentTool, RhPortal.Api.Application.Ai.Agent.Tools.EmpresasListarTool>();
// Reindexação automática (Fase 4.O): fila singleton + interceptor no SaveChanges + worker background
builder.Services.AddSingleton<RhPortal.Api.Application.Ai.IEmbeddingIndexQueue, RhPortal.Api.Application.Ai.EmbeddingIndexQueue>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.EmbeddingReindexInterceptor>();
builder.Services.AddHostedService<RhPortal.Api.Application.Ai.EmbeddingIndexerHostedService>();
builder.Services.AddScoped<IVagaUnifiedMatchingCacheService, VagaUnifiedMatchingCacheService>();
builder.Services.AddScoped<AgendaService>();
builder.Services.AddScoped<CelebrationService>();
builder.Services.AddScoped<FeedbackService>();
builder.Services.AddScoped<DevelopmentPlanService>();
builder.Services.AddScoped<OneOnOneService>();
builder.Services.AddScoped<GamificationService>();
builder.Services.AddScoped<AwardPointsService>();
builder.Services.AddScoped<IPortalCandidateAuthService, PortalCandidateAuthService>();
builder.Services.AddScoped<IPasswordHasher<Candidato>, PasswordHasher<Candidato>>();
builder.Services.AddScoped<ILocalizationConfigService, LocalizationConfigService>();

builder.Services.AddScoped<AuthenticationService>();
builder.Services.AddScoped<OwnerAuthService>();
builder.Services.AddScoped<MeService>();
builder.Services.AddScoped<ITenantProvisioningService, TenantProvisioningService>();
builder.Services.AddScoped<UserAdministrationService>();
builder.Services.AddScoped<RoleAdministrationService>();
builder.Services.AddScoped<MenuAdministrationService>();
builder.Services.AddScoped<TenantPackageService>();
builder.Services.AddScoped<TenantScreenService>();
builder.Services.AddScoped<TenantModuleService>();
builder.Services.AddScoped<NavegacaoSidebarService>();

// Departamentos: removidos em 31.2 — consolidados em CentroCusto.

// Unidades|Filiais
builder.Services.AddScoped<IListUnitsHandler, ListUnitsHandler>();
builder.Services.AddScoped<IGetUnitByIdHandler, GetUnitByIdHandler>();
builder.Services.AddScoped<ICreateUnitHandler, CreateUnitHandler>();
builder.Services.AddScoped<IUpdateUnitHandler, UpdateUnitHandler>();
builder.Services.AddScoped<IDeleteUnitHandler, DeleteUnitHandler>();

// Cargos
builder.Services.AddScoped<IListJobPositionsHandler, ListJobPositionsHandler>();
builder.Services.AddScoped<IGetJobPositionByIdHandler, GetJobPositionByIdHandler>();
builder.Services.AddScoped<ICreateJobPositionHandler, CreateJobPositionHandler>();
builder.Services.AddScoped<IUpdateJobPositionHandler, UpdateJobPositionHandler>();
builder.Services.AddScoped<IDeleteJobPositionHandler, DeleteJobPositionHandler>();

// Funcionários
builder.Services.AddScoped<IListFuncionariosHandler, ListFuncionariosHandler>();
builder.Services.AddScoped<IListUsersWithoutFuncionarioHandler, ListUsersWithoutFuncionarioHandler>();
builder.Services.AddScoped<IGetFuncionarioByIdHandler, GetFuncionarioByIdHandler>();
builder.Services.AddScoped<ICreateFuncionarioHandler, CreateFuncionarioHandler>();
builder.Services.AddScoped<IUpdateFuncionarioHandler, UpdateFuncionarioHandler>();
builder.Services.AddScoped<IDeleteFuncionarioHandler, DeleteFuncionarioHandler>();

// Vagas
builder.Services.AddScoped<IListVagasHandler, ListVagasHandler>();
builder.Services.AddScoped<IListVagasPendenciasRhHandler, ListVagasPendenciasRhHandler>();
builder.Services.AddScoped<IGetVagaByIdHandler, GetVagaByIdHandler>();
builder.Services.AddScoped<ICreateVagaHandler, CreateVagaHandler>();
builder.Services.AddScoped<IUpdateVagaHandler, UpdateVagaHandler>();
builder.Services.AddScoped<IDeleteVagaHandler, DeleteVagaHandler>();
builder.Services.AddScoped<IUpdateVagaMatchingFiltrosHandler, UpdateVagaMatchingFiltrosHandler>();
builder.Services.AddScoped<ICandidatoVagaMatchingScoreService, CandidatoVagaMatchingScoreService>();

// Candidatos
builder.Services.AddScoped<IListCandidatosHandler, ListCandidatosHandler>();
builder.Services.AddScoped<IGetCandidatoByIdHandler, GetCandidatoByIdHandler>();
builder.Services.AddScoped<ICreateCandidatoHandler, CreateCandidatoHandler>();
builder.Services.AddScoped<IUpdateCandidatoHandler, UpdateCandidatoHandler>();
builder.Services.AddScoped<IDeleteCandidatoHandler, DeleteCandidatoHandler>();

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "App_Data"));
await DbSeeder.MigrateAndSeedAsync(app.Services, app.Configuration, app.Environment);

// Modo "migrate": aplica migrations (incluindo tenants) e encerra sem subir o servidor.
var runMigrateOnly = args.Length > 0 && string.Equals(args[0], "migrate", StringComparison.OrdinalIgnoreCase);
if (runMigrateOnly)
    return;

var localizationOptions = app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>();

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "RHPortal API v1");
        c.DocumentTitle = "RHPortal API — Swagger";
        c.ConfigObject.AdditionalItems["operationsSorter"] = "alpha";
        c.ConfigObject.AdditionalItems["tagsSorter"] = "alpha";
        c.ConfigObject.AdditionalItems["persistAuthorization"] = true;
    });
}

app.UseExceptionHandler();
app.UseRequestTimeouts();
app.UseResponseCompression();

app.UseHttpsRedirection();

app.UseCors("WebApp");
app.UseRateLimiter();
app.UseMiddleware<TenantMiddleware>();
app.UseRequestLocalization(localizationOptions.Value);

app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();
app.UseMiddleware<RequestLogMiddleware>();
app.UseMiddleware<ExceptionLoggingMiddleware>();
app.UseMiddleware<AuditMiddleware>();

var healthOptions = new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var payload = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                description = entry.Value.Description
            })
        };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
};
app.MapHealthChecks("/health", healthOptions).AllowAnonymous();
app.MapHealthChecks("/api/health", healthOptions).AllowAnonymous();

app.MapControllers();
// SignalR hub usado pela Inbox para push em tempo real.
app.MapHub<InboxHub>("/hubs/inbox");
app.MapHub<ResetProgressHub>("/hubs/ops-reset");
app.MapHub<NotificationsHub>("/hubs/notifications");
app.Run();
