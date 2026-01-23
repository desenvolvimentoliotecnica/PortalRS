using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.Services;
using RhPortal.Web.Infrastructure.ApiClients;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("entra-config.json", optional: true, reloadOnChange: true);

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AuthorizeFilter());
});
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

                context.Principal = AuthClaimsFactory.CreatePrincipal(response);
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
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<PortalTenantContext>();
builder.Services.AddTransient<ApiAuthenticationHandler>();
builder.Services.AddSingleton<IEntraIdLocalConfigStore, EntraIdLocalConfigStore>();

builder.Services.AddHttpClient<IGestoresLookupService, GestoresLookupService>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<UnitsApiClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<ManagersApiClient>(c =>
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

builder.Services.AddHttpClient<CostCentersApiClient>(c =>
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

builder.Services.AddHttpClient<AuthApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
}).AddHttpMessageHandler<ApiAuthenticationHandler>();

builder.Services.AddHttpClient<PortalAuthApiClient>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Endpoints:RhApi"]!);
});

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

var app = builder.Build();

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
app.UseMiddleware<ApiUnauthorizedMiddleware>();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
