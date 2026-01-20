using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
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
using RhPortal.Api.Application.Roles;
using RhPortal.Api.Application.Units;
using RhPortal.Api.Application.Units.Handlers;
using RhPortal.Api.Application.Users;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.Vagas.Handlers;
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
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Swagger;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();

builder.Services
    .AddControllers(options => { options.Filters.Add<ProblemDetailsLoggingFilter>(); })
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.OperationFilter<TenantHeaderOperationFilter>();
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
    .AddRoles<ApplicationRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>();
if (jwtOptions is null || string.IsNullOrWhiteSpace(jwtOptions.SigningKey))
    throw new InvalidOperationException("Jwt settings are required.");

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

                if (string.IsNullOrWhiteSpace(tenantClaim))
                {
                    context.Fail("Tenant claim is required.");
                    return Task.CompletedTask;
                }

                if (!string.Equals(tenantClaim, tenantContext.TenantId, StringComparison.OrdinalIgnoreCase))
                {
                    context.Fail("Tenant does not match.");
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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();

app.UseHttpsRedirection();

app.UseMiddleware<TenantMiddleware>();

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
app.Run();
