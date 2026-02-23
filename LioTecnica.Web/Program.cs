using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using LioTecnica.Web.Controllers;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Logging;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
using RhPortal.Web.Infrastructure.ApiClients;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("entra-config.json", optional: true, reloadOnChange: true);

// Use safe exception console formatter to avoid TypeLoadException when logging exceptions
// whose stack trace contains Razor-generated view types (AspNetCoreGeneratedDocument.Views_*).
builder.Logging.AddConsoleFormatter<SafeExceptionConsoleFormatter, SimpleConsoleFormatterOptions>();

// =========================
// Localization (i18n)
// =========================
builder.Services.AddLocalization(o => o.ResourcesPath = "Resources");

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AuthorizeFilter());
    options.Filters.Add<LioTecnica.Web.Infrastructure.Filters.ApiConnectionExceptionFilter>();
})
.AddViewLocalization()
.AddDataAnnotationsLocalization()
.AddRazorOptions(options =>
{
    options.ViewLocationFormats.Add("/Views/Shared/Components/{1}/{0}.cshtml");
    options.ViewLocationFormats.Add("/Views/Shared/Components/MainMenu/{0}.cshtml");
})
.AddControllersAsServices();

// Replace default IControllerActivatorProvider so OwnerController/UnidadesController are resolved from DI when building the cache (avoids ActivatorUtilities.TryFindMatchingConstructor).
var activatorDescriptor = builder.Services.FirstOrDefault(d => d.ServiceType == typeof(Microsoft.AspNetCore.Mvc.Controllers.IControllerActivatorProvider));
if (activatorDescriptor is not null)
    builder.Services.Remove(activatorDescriptor);
builder.Services.AddSingleton<Microsoft.AspNetCore.Mvc.Controllers.IControllerActivatorProvider, LioTecnica.Web.Infrastructure.Controllers.ServiceBasedControllerActivatorProvider>();

builder.Services.AddHttpContextAccessor();

var entraEnabled = builder.Configuration.GetValue<bool?>("EntraId:Enabled") ?? false;
var entraClientId = builder.Configuration["EntraId:ClientId"];

var authBuilder = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/Login";
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
    })
    .AddCookie(CandidateAuthDefaults.Scheme, options =>
    {
        options.LoginPath = "/PortalVagas/Acesso";
        options.AccessDeniedPath = "/PortalVagas/Acesso";
        options.SlidingExpiration = true;
        options.Cookie.Name = "PortalCandidato";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
    });

if (entraEnabled && !string.IsNullOrWhiteSpace(entraClientId))
{
    authBuilder.AddOpenIdConnect(EntraIdDefaults.Scheme, options =>
    {
        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.Authority = builder.Configuration["EntraId:Authority"] ?? "https://login.microsoftonline.com/common/v2.0";
        options.ClientId = entraClientId;
        options.ClientSecret = builder.Configuration["EntraId:ClientSecret"] ?? string.Empty;
        options.CallbackPath = builder.Configuration["EntraId:CallbackPath"] ?? "/signin-entra";
        options.ResponseType = OpenIdConnectResponseType.Code;
        options.SaveTokens = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false
        };
        options.Scope.Clear();
        options.Scope.Add("openid");
        options.Scope.Add("profile");
        options.Scope.Add("email");
        options.Events = new OpenIdConnectEvents
        {
            OnTokenValidated = async context =>
            {
                var tenantId = context.Properties.Items.TryGetValue("tenant", out var tenantValue)
                    ? tenantValue
                    : null;

                if (string.IsNullOrWhiteSpace(tenantId))
                {
                    context.Fail("Tenant missing.");
                    return;
                }

                var idToken = (context.SecurityToken as JwtSecurityToken)?.RawData;
                if (string.IsNullOrWhiteSpace(idToken))
                {
                    context.Fail("Missing id_token.");
                    return;
                }

                var authApi = context.HttpContext.RequestServices.GetRequiredService<AuthApiClient>();
                var response = await authApi.LoginWithEntraAsync(tenantId, idToken, context.HttpContext.RequestAborted);
                if (response is null)
                {
                    context.Fail("User not allowed.");
                    return;
                }

                context.Principal = AuthClaimsFactory.CreatePrincipal(response, tenantId);
            },
            OnRemoteFailure = context =>
            {
                context.Response.Redirect("/Account/Login?error=entra");
                context.HandleResponse();
                return Task.CompletedTask;
            }
        };
    });
}

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.AddPolicy("OwnerOrCookie", policy =>
        policy.Requirements.Add(new LioTecnica.Web.Infrastructure.Security.OwnerOrCookieRequirement()));
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, LioTecnica.Web.Infrastructure.Security.OwnerOrCookieAuthorizationHandler>();
builder.Services.AddScoped<PortalTenantContext>();
builder.Services.AddTransient<ApiAuthenticationHandler>();
builder.Services.AddSingleton<IEntraIdLocalConfigStore, EntraIdLocalConfigStore>();

builder.Services.AddHttpClient<UnitsApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<FuncionariosApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<DepartmentsApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<AreasApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<JobPositionsApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<RequisitoCategoriasApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<VagasApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<CandidatosApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<TalentosApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<BloqueioPessoaApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<PessoasApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<MatchingApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<DashboardApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<ReportsApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<InboxApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<NotificationsApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<AuthApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<PortalAuthApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
});

builder.Services.AddHttpClient<OwnerAuthApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
});

builder.Services.AddHttpClient<OwnerTenantsApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<OwnerAiApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<OwnerTenantUsersApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<MeApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<PortalCandidatesApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
});

builder.Services.AddHttpClient<PortalLocationApiClient>(http =>
{
    http.BaseAddress = new Uri("https://brasilapi.com.br/");
});

builder.Services.AddHttpClient<UsersApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<RolesApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<FeedbackApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();
builder.Services.AddHttpClient<MenusApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<AuditLogsApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<OperationalLogsApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<EmailTemplatesApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<EmailMessagesApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<EmailConfigApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<EntraIdConfigApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<ApiKeysApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<LocalizationConfigApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<AgendasApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<HealthApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<OpsApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
    http.Timeout = TimeSpan.FromMinutes(10);
})
.AddHttpMessageHandler<ApiAuthenticationHandler>();

// UnidadesController: registro explícito para evitar "Multiple constructors" no ActivatorUtilities
builder.Services.AddTransient<UnidadesController>(sp => new UnidadesController(
    sp.GetRequiredService<UnitsApiClient>(),
    sp.GetRequiredService<FuncionariosApiClient>(),
    sp.GetRequiredService<OwnerTenantsApiClient>(),
    sp.GetRequiredService<PortalTenantContext>()));

// OwnerController: registro explícito para evitar "Multiple constructors" no ActivatorUtilities
builder.Services.AddTransient<OwnerController>(sp => new OwnerController(
    sp.GetRequiredService<OwnerTenantsApiClient>(),
    sp.GetRequiredService<OwnerTenantUsersApiClient>(),
    sp.GetRequiredService<RolesApiClient>(),
    sp.GetRequiredService<MenusApiClient>(),
    sp.GetRequiredService<AuditLogsApiClient>(),
    sp.GetRequiredService<OperationalLogsApiClient>(),
    sp.GetRequiredService<EmailTemplatesApiClient>(),
    sp.GetRequiredService<EmailMessagesApiClient>(),
    sp.GetRequiredService<EmailConfigApiClient>(),
    sp.GetRequiredService<EntraIdConfigApiClient>(),
    sp.GetRequiredService<LocalizationConfigApiClient>(),
    sp.GetRequiredService<OwnerAiApiClient>()));

var app = builder.Build();

// =========================
// Request Localization (middleware)
// (coloque antes de Routing/Auth)
// =========================
var supportedCultures = new[]
{
    new CultureInfo("pt-BR"),
    new CultureInfo("en-US"),
    // se quiser já deixar pronto:
    // new CultureInfo("es-ES")
};

var localizationOptions = new RequestLocalizationOptions
{
    DefaultRequestCulture = new RequestCulture("pt-BR"),
    SupportedCultures = supportedCultures,
    SupportedUICultures = supportedCultures,
    RequestCultureProviders = new IRequestCultureProvider[]
    {
        new QueryStringRequestCultureProvider { QueryStringKey = "culture", UIQueryStringKey = "ui-culture" },
        new CookieRequestCultureProvider(),
        new AcceptLanguageHeaderRequestCultureProvider()
    }
};
app.UseRequestLocalization(localizationOptions);

app.UseMiddleware<LioTecnica.Web.Infrastructure.Middleware.DebugExceptionLoggingMiddleware>();
app.UseExceptionHandler("/Home/Error");
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseMiddleware<TenantValidationMiddleware>();
app.UseAuthorization();
app.UseMiddleware<OwnerRedirectMiddleware>();
app.UseMiddleware<ApiUnauthorizedMiddleware>();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}");

app.Run();
