using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Authentication;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Application.Users;
using RhPortal.Api.Contracts.Authentication;
using RhPortal.Api.Contracts.Owner;
using RhPortal.Api.Contracts.Users;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Autenticação e identidade do usuário do sistema (admin/operacional).
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public AuthController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Autentica com e-mail e senha e devolve token + dados do usuário.
    /// </summary>
    /// <remarks>
    /// Use este endpoint para login tradicional do usuário do sistema.
    /// </remarks>
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        [FromServices] AuthenticationService service,
        CancellationToken ct)
    {
        var response = await service.LoginAsync(request, ct);
        if (response is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.InvalidCredentialsTitle"],
                Detail = _localizer["ControllerErrors.InvalidCredentialsDetail"],
                Status = StatusCodes.Status401Unauthorized
            });
        }

        return Ok(response);
    }

    /// <summary>
    /// Autentica via Entra ID (Microsoft) e devolve token + dados do usuário.
    /// </summary>
    /// <remarks>
    /// Use quando o login é feito por SSO da Microsoft (Entra ID).
    /// </remarks>
    [AllowAnonymous]
    [HttpPost("entra-login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> EntraLogin(
        [FromBody] EntraLoginRequest request,
        [FromServices] AuthenticationService service,
        CancellationToken ct)
    {
        var response = await service.LoginWithEntraAsync(request, ct);
        if (response is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.InvalidEntraLoginTitle"],
                Detail = _localizer["ControllerErrors.InvalidEntraLoginDetail"],
                Status = StatusCodes.Status401Unauthorized
            });
        }

        return Ok(response);
    }

    /// <summary>
    /// Cria um novo usuário do sistema (administrativo/operacional).
    /// </summary>
    /// <remarks>
    /// Requer permissão <c>users.write</c>.
    /// </remarks>
    [RequirePermission("users.write")]
    [HttpPost("register")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> Register(
        [FromBody] UserCreateRequest request,
        [FromServices] UserAdministrationService service,
        CancellationToken ct)
    {
        try
        {
            var created = await service.CreateAsync(request, ct);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToCreateUserTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict
            });
        }
    }

    /// <summary>
    /// Autentica com e-mail e senha sem necessidade de informar o tenant.
    /// </summary>
    /// <remarks>
    /// Verifica primeiro se é um owner; caso contrário, busca o usuário em todos os tenants ativos.
    /// </remarks>
    [AllowAnonymous]
    [HttpPost("auto-login")]
    [ProducesResponseType(typeof(AutoLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> AutoLogin(
        [FromBody] AutoLoginRequest request,
        [FromServices] IServiceScopeFactory scopeFactory,
        [FromServices] MasterDbContext masterDb,
        [FromServices] OwnerAuthService ownerAuthService,
        CancellationToken ct)
    {
        // 1. Tenta owner primeiro
        var ownerRes = await ownerAuthService.LoginAsync(
            new OwnerLoginRequest(request.Email, request.Password), ct);
        if (ownerRes is not null)
            return Ok(new AutoLoginResponse(
                ownerRes.AccessToken,
                ownerRes.AccessTokenExpirationMinutes,
                "owner"));

        // 2. Itera todos os tenants ativos
        var tenantIds = await masterDb.Tenants
            .AsNoTracking()
            .Where(t => t.IsActive)
            .Select(t => t.TenantId)
            .ToListAsync(ct);

        foreach (var tenantId in tenantIds)
        {
            using var scope = scopeFactory.CreateScope();
            var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantCtx.SetTenantId(tenantId);
            var authSvc = scope.ServiceProvider.GetRequiredService<AuthenticationService>();
            var res = await authSvc.LoginAsync(
                new LoginRequest(request.Email, request.Password), ct);
            if (res is not null)
                return Ok(new AutoLoginResponse(
                    res.AccessToken,
                    res.AccessTokenExpirationMinutes,
                    res.TenantId));
        }

        return Unauthorized(new ProblemDetails
        {
            Title = _localizer["ControllerErrors.InvalidCredentialsTitle"],
            Detail = _localizer["ControllerErrors.InvalidCredentialsDetail"],
            Status = StatusCodes.Status401Unauthorized
        });
    }

    /// <summary>
    /// Retorna os dados do usuário autenticado (perfil atual).
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(CurrentUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CurrentUserResponse>> Me(
        [FromServices] AuthenticationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.InvalidTokenTitle"],
                Detail = _localizer["ControllerErrors.InvalidTokenDetail"],
                Status = StatusCodes.Status401Unauthorized
            });
        }

        var response = await service.GetCurrentUserAsync(userId, ct);
        return response is null ? NotFound() : Ok(response);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Entra ID (Microsoft SSO) — fluxo Authorization Code server-side
    // Substitui o middleware OIDC do antigo LioTecnica.Web (Fase 13.2, Sessão 25).
    // ════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Indica se o Entra ID está habilitado para um tenant (sem expor segredos).
    /// </summary>
    /// <remarks>
    /// Endpoint público consumido pelo Next.js para decidir se renderiza o botão
    /// "Entrar com Microsoft" na tela de login.
    /// </remarks>
    [AllowAnonymous]
    [HttpGet("entra/enabled")]
    [ProducesResponseType(typeof(EntraEnabledResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EntraEnabledResponse>> EntraEnabled(
        [FromQuery] string tenantId,
        [FromServices] IServiceScopeFactory scopeFactory,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return Ok(new EntraEnabledResponse(false, null));

        using var scope = scopeFactory.CreateScope();
        var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantCtx.SetTenantId(tenantId);
        var configService = scope.ServiceProvider.GetRequiredService<IEntraIdConfigService>();

        try
        {
            var cfg = await configService.GetAsync(ct);
            var enabled = cfg?.IsEnabled == true
                          && !string.IsNullOrWhiteSpace(cfg.EntraTenantId)
                          && !string.IsNullOrWhiteSpace(cfg.ClientId)
                          && cfg.HasClientSecret;
            return Ok(new EntraEnabledResponse(enabled, enabled ? cfg!.ClientId : null));
        }
        catch
        {
            // Tenant inexistente ou sem tabela migrada — tratar como não habilitado.
            return Ok(new EntraEnabledResponse(false, null));
        }
    }

    /// <summary>
    /// Inicia o fluxo OAuth 2.0 Authorization Code: redireciona para o endpoint
    /// de autorização do Microsoft com state assinado (HMAC-SHA256).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("entra/challenge")]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EntraChallenge(
        [FromQuery] string tenantId,
        [FromQuery] string? returnUrl,
        [FromServices] IServiceScopeFactory scopeFactory,
        [FromServices] IConfiguration configuration,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return BadRequest(new ProblemDetails { Title = "tenantId ausente", Status = 400 });

        var redirectUri = BuildEntraCallbackRedirectUri(configuration);

        using var scope = scopeFactory.CreateScope();
        var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantCtx.SetTenantId(tenantId);
        var challenge = scope.ServiceProvider.GetRequiredService<IEntraChallengeService>();

        var result = await challenge.BuildAuthorizationUrlAsync(tenantId, redirectUri, returnUrl ?? "/app/dashboard", ct);
        if (result is null)
        {
            var back = BuildFrontendUrl(configuration, "/app/login?entra_error=nao_configurado");
            return Redirect(back);
        }
        return Redirect(result.Url);
    }

    /// <summary>
    /// Callback de retorno do Microsoft: troca o <c>code</c> por <c>id_token</c>,
    /// emite o JWT do sistema e redireciona ao Next.js com o token no hash.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("entra/callback")]
    [ProducesResponseType(StatusCodes.Status302Found)]
    public async Task<IActionResult> EntraCallback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery(Name = "error")] string? errorCode,
        [FromServices] IServiceScopeFactory scopeFactory,
        [FromServices] IConfiguration configuration,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(errorCode))
            return Redirect(BuildFrontendUrl(configuration, $"/app/login?entra_error={Uri.EscapeDataString(errorCode)}"));

        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            return Redirect(BuildFrontendUrl(configuration, "/app/login?entra_error=parametros_invalidos"));

        using var scope = scopeFactory.CreateScope();
        var challenge = scope.ServiceProvider.GetRequiredService<IEntraChallengeService>();
        var payload = challenge.TryDecodeState(state);
        if (payload is null)
            return Redirect(BuildFrontendUrl(configuration, "/app/login?entra_error=state_invalido"));

        // Scope com tenant correto para troca de code + login.
        var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantCtx.SetTenantId(payload.TenantId);

        var redirectUri = BuildEntraCallbackRedirectUri(configuration);
        var idToken = await challenge.ExchangeCodeForIdTokenAsync(payload.TenantId, code, redirectUri, ct);
        if (string.IsNullOrWhiteSpace(idToken))
            return Redirect(BuildFrontendUrl(configuration, "/app/login?entra_error=troca_de_code_falhou"));

        var authService = scope.ServiceProvider.GetRequiredService<AuthenticationService>();
        var login = await authService.LoginWithEntraAsync(new EntraLoginRequest(idToken), ct);
        if (login is null)
            return Redirect(BuildFrontendUrl(configuration, "/app/login?entra_error=usuario_nao_autenticado"));

        // Token no fragmento da URL — não vai para logs do servidor.
        var fragment =
            $"#entra_token={Uri.EscapeDataString(login.AccessToken)}" +
            $"&tenant={Uri.EscapeDataString(login.TenantId ?? payload.TenantId)}" +
            $"&return={Uri.EscapeDataString(payload.ReturnUrl)}";

        return Redirect(BuildFrontendUrl(configuration, "/app/login") + fragment);
    }

    // ── helpers privados ────────────────────────────────────────────────────

    /// <summary>
    /// URL pública do front (Next.js). Segue a mesma estratégia de
    /// <c>PreAdmissaoService.BuildFrontendUrl</c> (Onda 15).
    /// </summary>
    private string BuildFrontendUrl(IConfiguration configuration, string pathAndQuery)
    {
        var baseOverride = configuration["Frontend:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(baseOverride))
            return $"{baseOverride.TrimEnd('/')}{pathAndQuery}";

        var port = configuration.GetValue<int?>("Frontend:Port") ?? 3000;
        var scheme = Request?.Scheme ?? "http";
        var host = Request?.Host.Host ?? "localhost";
        return $"{scheme}://{host}:{port}{pathAndQuery}";
    }

    /// <summary>
    /// URI de callback registrada no Azure AD. Corresponde ao endpoint
    /// <c>GET /api/auth/entra/callback</c> deste controller.
    /// </summary>
    private string BuildEntraCallbackRedirectUri(IConfiguration configuration)
    {
        var apiBase = configuration["Authentication:ApiBaseUrl"];
        if (!string.IsNullOrWhiteSpace(apiBase))
            return $"{apiBase.TrimEnd('/')}/api/auth/entra/callback";

        var scheme = Request?.Scheme ?? "https";
        var host = Request?.Host.Value ?? "localhost";
        return $"{scheme}://{host}/api/auth/entra/callback";
    }
}

/// <summary>Resposta do endpoint público <c>GET /api/auth/entra/enabled</c>.</summary>
public sealed record EntraEnabledResponse(bool Enabled, string? ClientId);
