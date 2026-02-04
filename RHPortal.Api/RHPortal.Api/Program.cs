using System.Security.Claims;
using System.Text;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
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
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Inbox;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Infrastructure.Ops;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Swagger;
using RhPortal.Api.Messaging.Email;
using RhPortal.Api.Contracts.Funcionarios;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
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
builder.Services.AddSignalR();
builder.Services.AddHttpClient();
builder.Services.AddCors(options =>
{
    // Necessario para o SignalR funcionar quando o front roda em outro host/porta.
    var webOrigin = builder.Configuration["Cors:WebOrigin"] ?? "https://localhost:7091";
    options.AddPolicy("WebApp", policy =>
        policy.WithOrigins(webOrigin)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddSwaggerGen(c =>
{
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
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IOwnerAiService, RhPortal.Api.Application.Ai.OwnerAiService>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IAiProvider, RhPortal.Api.Application.Ai.OpenAiProvider>();
builder.Services.AddScoped<RhPortal.Api.Application.Ai.IUnifiedAiService, RhPortal.Api.Application.Ai.UnifiedAiService>();
builder.Services.AddScoped<IEntraTokenValidator, EntraTokenValidator>();
builder.Services.AddScoped<IEmailQueueService, EmailQueueService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<EmailDispatchWorker>();
builder.Services.AddHostedService<CvImportWorker>();

// PostgreSQL + EF Core
builder.Services.AddDbContext<MasterDbContext>(options =>
{
    var conn = builder.Configuration.GetConnectionString("Master")
        ?? builder.Configuration.GetConnectionString("Default");
    options.UseNpgsql(conn);
});
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var resolver = sp.GetRequiredService<ITenantConnectionResolver>();
    var conn = resolver.GetConnectionString();
    options.UseNpgsql(conn);
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

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>();
if (jwtOptions is null || string.IsNullOrWhiteSpace(jwtOptions.SigningKey))
{
    using var tempProvider = builder.Services.BuildServiceProvider();
    var localizer = tempProvider.GetRequiredService<IStringLocalizer<InfrastructureMessages>>();
    throw new InvalidOperationException(localizer["InfrastructureErrors.JwtSettingsRequired"]);
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
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
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
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
builder.Services.AddScoped<IVagaService, VagaService>();
builder.Services.AddScoped<ICandidatoService, CandidatoService>();
builder.Services.AddScoped<IPessoaService, PessoaService>();
builder.Services.AddScoped<ICvGptExtractor, CvGptExtractor>();
builder.Services.AddScoped<ITalentoService, TalentoService>();
builder.Services.AddScoped<IBloqueioPessoaService, BloqueioPessoaService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<AgendaService>();
builder.Services.AddScoped<CelebrationService>();
builder.Services.AddScoped<FeedbackService>();
builder.Services.AddScoped<DevelopmentPlanService>();
builder.Services.AddScoped<OneOnOneService>();
builder.Services.AddScoped<GamificationService>();
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
builder.Services.AddScoped<IGetVagaByIdHandler, GetVagaByIdHandler>();
builder.Services.AddScoped<ICreateVagaHandler, CreateVagaHandler>();
builder.Services.AddScoped<IUpdateVagaHandler, UpdateVagaHandler>();
builder.Services.AddScoped<IDeleteVagaHandler, DeleteVagaHandler>();

// Candidatos
builder.Services.AddScoped<IListCandidatosHandler, ListCandidatosHandler>();
builder.Services.AddScoped<IGetCandidatoByIdHandler, GetCandidatoByIdHandler>();
builder.Services.AddScoped<ICreateCandidatoHandler, CreateCandidatoHandler>();
builder.Services.AddScoped<IUpdateCandidatoHandler, UpdateCandidatoHandler>();
builder.Services.AddScoped<IDeleteCandidatoHandler, DeleteCandidatoHandler>();

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "App_Data"));
await DbSeeder.MigrateAndSeedAsync(app.Services, app.Configuration, app.Environment);

var localizationOptions = app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        // Ordena operações dentro do controller (normalmente existe em versões antigas)
        var opSorterProp = c.ConfigObject.GetType().GetProperty("OperationsSorter");
        opSorterProp?.SetValue(c.ConfigObject, "alpha"); // ou "method"

        // Ordena controllers/tags (em versões novas existe; em antigas não — por isso reflection)
        var tagsSorterProp = c.ConfigObject.GetType().GetProperty("TagsSorter");
        tagsSorterProp?.SetValue(c.ConfigObject, "alpha");
    });
}

app.UseExceptionHandler();

app.UseHttpsRedirection();

app.UseCors("WebApp");
app.UseMiddleware<TenantMiddleware>();
app.UseRequestLocalization(localizationOptions.Value);

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<RequestLogMiddleware>();
app.UseMiddleware<ExceptionLoggingMiddleware>();
app.UseMiddleware<AuditMiddleware>();

app.MapHealthChecks("/health", new HealthCheckOptions
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
}).AllowAnonymous();

app.MapControllers();
// SignalR hub usado pela Inbox para push em tempo real.
app.MapHub<InboxHub>("/hubs/inbox");
app.MapHub<ResetProgressHub>("/hubs/ops-reset");
app.MapHub<NotificationsHub>("/hubs/notifications");
app.Run();
