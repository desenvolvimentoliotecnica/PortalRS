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
using RhPortal.Api.Application.Managers;
using RhPortal.Api.Application.Managers.Handlers;
using RhPortal.Api.Application.Menus;
using RhPortal.Api.Application.Portal;
using RhPortal.Api.Application.Roles;
using RhPortal.Api.Application.Units;
using RhPortal.Api.Application.Units.Handlers;
using RhPortal.Api.Application.Users;
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
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Inbox;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Infrastructure.Ops;
using RhPortal.Api.Swagger;
using RhPortal.Api.Messaging.Email;

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
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

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
    .AddDbContextCheck<AppDbContext>("database");

// Tenancy
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddScoped<TenantMiddleware>();

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

// Email messaging (queue + SMTP/IMAP)
builder.Services.AddSingleton<ISecretProtector, AesSecretProtector>();
builder.Services.AddScoped<IEmailConfigService, EmailConfigService>();
builder.Services.AddScoped<IEntraIdConfigService, EntraIdConfigService>();
builder.Services.AddScoped<IEntraTokenValidator, EntraTokenValidator>();
builder.Services.AddScoped<IEmailQueueService, EmailQueueService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<EmailDispatchWorker>();

// PostgreSQL + EF Core
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var conn = builder.Configuration.GetConnectionString("Default");
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
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        options.Events = new JwtBearerEvents
        {
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
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

// Application services
builder.Services.AddScoped<IDepartmentService, DepartmentService>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IJobPositionService, JobPositionService>();
builder.Services.AddScoped<IManagerService, ManagerService>();
builder.Services.AddScoped<IVagaService, VagaService>();
builder.Services.AddScoped<ICandidatoService, CandidatoService>();
builder.Services.AddScoped<AgendaService>();
builder.Services.AddScoped<IPortalCandidateAuthService, PortalCandidateAuthService>();
builder.Services.AddScoped<IPasswordHasher<Candidato>, PasswordHasher<Candidato>>();
builder.Services.AddScoped<ILocalizationConfigService, LocalizationConfigService>();

builder.Services.AddScoped<AuthenticationService>();
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

// Gestores
builder.Services.AddScoped<IListManagersHandler, ListManagersHandler>();
builder.Services.AddScoped<IGetManagerByIdHandler, GetManagerByIdHandler>();
builder.Services.AddScoped<ICreateManagerHandler, CreateManagerHandler>();
builder.Services.AddScoped<IUpdateManagerHandler, UpdateManagerHandler>();
builder.Services.AddScoped<IDeleteManagerHandler, DeleteManagerHandler>();

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
app.Run();
