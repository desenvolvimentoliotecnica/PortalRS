using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.Services;
using RhPortal.Web.Infrastructure.ApiClients;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/Login";
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
    });

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
