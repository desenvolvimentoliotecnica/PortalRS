using LiotecnicaHub.Web.Application.Applications;
using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Infrastructure.Authorization;
using LiotecnicaHub.Web.Infrastructure.Data;
using LiotecnicaHub.Web.Infrastructure.Options;
using LiotecnicaHub.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
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

builder.Services.AddDataProtection();
builder.Services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();
builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IHubEntraConfigService, HubEntraConfigService>();
builder.Services.AddScoped<IEntraChallengeService, EntraChallengeService>();
builder.Services.AddScoped<IEntraTokenValidator, EntraTokenValidator>();
builder.Services.AddScoped<IHubAuthService, HubAuthService>();
builder.Services.AddScoped<IHubApplicationService, HubApplicationService>();

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
builder.Services.AddScoped<IAuthorizationHandler, HubAdminAuthorizationHandler>();

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

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapHealthChecks("/health");

app.Run();
