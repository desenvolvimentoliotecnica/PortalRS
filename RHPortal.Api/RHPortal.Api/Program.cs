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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
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
using RhPortal.Api.Application.Departments;
using RhPortal.Api.Application.Departments.Handlers;
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
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Swagger;
using RhPortal.Api.Messaging.Email;
using RhPortal.Api.Contracts.Funcionarios;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DevelopmentExceptionDetailHandler>();

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
    .AddDbContextCheck<AppDbContext>("database");

// Tenancy
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddScoped<ITenantConnectionResolver, TenantConnectionResolver>();
builder.Services.AddScoped<TenantMiddleware>();
builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();

// Auditing
builder.Services.AddHttpContextAccessor();
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
builder.Services.AddScoped<IEmailConfigService, EmailConfigService>();
builder.Services.AddScoped<IEntraIdConfigService, EntraIdConfigService>();
builder.Services.AddScoped<IApiKeyService, ApiKeyService>();
builder.Services.AddScoped<RhPortal.Api.Application.AprovadoresAlternativos.IAprovadorAlternativoService, RhPortal.Api.Application.AprovadoresAlternativos.AprovadorAlternativoService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IOwnerAiService, RhPortal.Api.Application.Ai.OwnerAiService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IAiProvider, RhPortal.Api.Application.Ai.OpenAiProvider>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IUnifiedAiService, RhPortal.Api.Application.Ai.UnifiedAiService>();
builder.Services.AddScoped<IEntraTokenValidator, EntraTokenValidator>();
builder.Services.AddScoped<IEmailQueueService, EmailQueueService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<EmailDispatchWorker>();
builder.Services.AddHostedService<CvImportWorker>();

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
    });
    options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
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
    .AddSignInManager();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<SlaVagaOptions>(builder.Configuration.GetSection(SlaVagaOptions.SectionName));
builder.Services.Configure<RhAiOptions>(builder.Configuration.GetSection(RhAiOptions.SectionName));

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

// Application services
builder.Services.AddScoped<IDepartmentService, DepartmentService>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IJobPositionService, JobPositionService>();
builder.Services.AddScoped<IFuncionarioService, FuncionarioService>();
builder.Services.AddScoped<ISolicitacaoVagaService, SolicitacaoVagaService>();
builder.Services.AddScoped<RhPortal.Api.Application.WorkflowRH.IWorkflowRHService, RhPortal.Api.Application.WorkflowRH.WorkflowRHService>();
builder.Services.AddScoped<RhPortal.Api.Application.Common.ApprovalWorkflowHelper>();
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
builder.Services.AddScoped<RhPortal.Api.Application.TenantConfiguracao.ITenantConfiguracaoService, RhPortal.Api.Application.TenantConfiguracao.TenantConfiguracaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.NineBox.INineBoxService, RhPortal.Api.Application.NineBox.NineBoxService>();
builder.Services.AddScoped<RhPortal.Api.Application.Metas.IMetaService, RhPortal.Api.Application.Metas.MetaService>();
builder.Services.AddScoped<RhPortal.Api.Application.Avaliacao.IAvaliacaoService, RhPortal.Api.Application.Avaliacao.AvaliacaoService>();
builder.Services.AddScoped<IColaboradorService, ColaboradorService>();
builder.Services.Configure<RhPortal.Api.Infrastructure.Storage.AwsOptions>(builder.Configuration.GetSection("Aws"));
builder.Services.AddScoped<RhPortal.Api.Application.AwsSettings.IAwsSettingsService, RhPortal.Api.Application.AwsSettings.AwsSettingsService>();
builder.Services.AddScoped<RhPortal.Api.Infrastructure.Storage.IS3StorageService, RhPortal.Api.Infrastructure.Storage.S3StorageService>();
builder.Services.AddScoped<IPreAdmissaoService, PreAdmissaoService>();
builder.Services.AddScoped<RhPortal.Api.Application.IntegracaoTotvs.IIntegracaoTotvsService, RhPortal.Api.Application.IntegracaoTotvs.IntegracaoTotvsService>();
builder.Services.AddScoped<RhPortal.Api.Application.AdmissaoPortal.DocumentAiExtractor>();
builder.Services.AddScoped<RhPortal.Api.Application.AdmissaoPortal.IAdmissaoPortalService, RhPortal.Api.Application.AdmissaoPortal.AdmissaoPortalService>();
builder.Services.AddHttpClient<IItaloIntegrationService, ItaloIntegrationService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<IVagaService, VagaService>();
builder.Services.AddScoped<ICandidatoService, CandidatoService>();
builder.Services.AddScoped<IPessoaService, PessoaService>();
builder.Services.AddScoped<ICvGptExtractor, CvGptExtractor>();
builder.Services.AddScoped<ITalentoService, TalentoService>();
builder.Services.AddScoped<IBloqueioPessoaService, BloqueioPessoaService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
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

// Departamentos
builder.Services.AddScoped<IListDepartmentsHandler, ListDepartmentsHandler>();
builder.Services.AddScoped<IGetDepartmentByIdHandler, GetDepartmentByIdHandler>();
builder.Services.AddScoped<ICreateDepartmentHandler, CreateDepartmentHandler>();
builder.Services.AddScoped<IUpdateDepartmentHandler, UpdateDepartmentHandler>();
builder.Services.AddScoped<IDeleteDepartmentHandler, DeleteDepartmentHandler>();

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
