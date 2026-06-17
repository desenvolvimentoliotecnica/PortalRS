using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LiotecnicaHub.Web.Controllers;

[ApiController]
[Route("api/auth")]
[Authorize]
public sealed class AuthApiController : ControllerBase
{
    private readonly IHubAccessService _access;

    public AuthApiController(IHubAccessService access) => _access = access;

    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        var email = ResolveEmail();
        if (email is null) return Unauthorized();

        var me = await _access.GetMeAsync(email, ct);
        return me is null ? NotFound() : Ok(me);
    }

    [HttpGet("minhas-permissoes")]
    public async Task<IActionResult> GetMinhasPermissoes(CancellationToken ct)
    {
        var email = ResolveEmail();
        if (email is null) return Unauthorized();

        var result = await _access.GetMinhasPermissoesAsync(email, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("verificar-permissao")]
    public async Task<IActionResult> VerificarPermissao([FromQuery] string codigo, CancellationToken ct)
    {
        var email = ResolveEmail();
        if (email is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(codigo))
            return BadRequest(new { message = "Informe o parâmetro codigo." });

        var result = await _access.VerificarPermissaoAsync(email, codigo, ct);
        return Ok(result);
    }

    private string? ResolveEmail() =>
        User.FindFirst(HubClaimTypes.Email)?.Value?.Trim().ToLowerInvariant();
}
