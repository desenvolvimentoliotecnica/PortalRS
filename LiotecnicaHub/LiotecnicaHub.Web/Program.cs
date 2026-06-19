using System.IO;
using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Infrastructure.Authorization;
using LiotecnicaHub.Web.Infrastructure.Data;
using LiotecnicaHub.Web.Infrastructure.Options;
using LiotecnicaHub.Web.Infrastructure.Security;
using LiotecnicaHub.Web.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var hubSigningKey = builder.Configuration["Hub:StateSigningKey"]
    ?? builder.Configuration["HUB_STATE_SIGNING_KEY"]
    ?? builder.Configuration["ConnectionStrings:DefaultConnection"]
    ?? Guid.NewGuid().ToString("N");

builder.Services.Configure<HubOptions>(builder.Configuration.GetSection(HubOptions.SectionName));
builder.Services.Configure<HubOptions>(options =>
{
    options.StateSigningKey = hubSigningKey;
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["HUB_DB_CONNECTION"]
    ?? throw new InvalidOperationException("Connection string não configurada (ConnectionStrings:DefaultConnection).");

builder.Services.AddDbContext<HubDbContext>(options =>
    HubDatabaseSetup.ConfigureDbContext(options, connectionString));

var dataProtectionKeysPath = builder.Configuration["Hub:DataProtectionKeysPath"]
    ?? builder.Configuration["HUB_DP_KEYS_PATH"]
    ?? Path.Combine(builder.Environment.ContentRootPath, "dpkeys");
Directory.CreateDirectory(dataProtectionKeysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("LiotecnicaHub");
builder.Services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();
builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IHubEntraConfigService, HubEntraConfigService>();
builder.Services.AddScoped<IEntraChallengeService, EntraChallengeService>();
builder.Services.AddScoped<IEntraTokenValidator, EntraTokenValidator>();
builder.Services.AddScoped<IHubAuthService, HubAuthService>();
builder.Services.AddScoped<IHubLaunchService, HubLaunchService>();
builder.Services.AddScoped<IHubApplicationService, HubApplicationService>();
builder.Services.AddScoped<IHubAccessCatalogService, HubAccessCatalogService>();
builder.Services.AddScoped<IHubAccessAdminService, HubAccessAdminService>();
builder.Services.AddScoped<IHubUserProvisioningService, HubUserProvisioningService>();
builder.Services.AddScoped<IHubAccessService, HubAccessService>();
builder.Services.AddSingleton<IHubAppIconStorage, HubAppIconStorage>();

builder.Services.AddControllers();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = ".LiotecnicaHub.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.LoginPath = "/Login";
        options.AccessDeniedPath = "/Login";
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("HubAdmin", policy =>
        policy.Requirements.Add(new HubAdminRequirement()));
});
builder.Services.AddSingleton<IAuthorizationPolicyProvider, HubPermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, HubAdminAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, HubPermissionAuthorizationHandler>();

builder.Services.AddRazorPages(options =>
{
    options.Conventions.AuthorizeFolder("/Apps");
    options.Conventions.AuthorizeFolder("/Admin", "HubAdmin");
    options.Conventions.AllowAnonymousToPage("/Login");
    options.Conventions.AllowAnonymousToPage("/Auth/EntraCallback");
    options.Conventions.AllowAnonymousToPage("/Index");
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<HubDbContext>("hub-db");

var app = builder.Build();

HubAppIconStorageSetup.EnsureUploadDirectory(app.Environment, app.Configuration);

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HubDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("HubDbSeeder");
    await HubDbSeeder.MigrateAndSeedAsync(db, app.Configuration, logger);
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
