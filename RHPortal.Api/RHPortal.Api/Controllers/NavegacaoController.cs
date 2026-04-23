using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Navegacao;
using RhPortal.Api.Contracts.Navegacao;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint único de navegação (sidebar) do app. Substitui a lógica code-first
/// duplicada no frontend (<c>permissionManifest.ts</c> + <c>LOCKED_NAV_HREFS</c> +
/// <c>HIDDEN_ROUTES</c>): o backend passa a ser a autoridade sobre quais itens
/// aparecem, em qual bucket, e quais estão bloqueados (com motivo).
/// </summary>
[ApiController]
[Route("api/navegacao")]
[Authorize]
public sealed class NavegacaoController : ControllerBase
{
    private readonly NavegacaoSidebarService _service;
    private readonly ITenantContext _tenantContext;

    public NavegacaoController(
        NavegacaoSidebarService service,
        ITenantContext tenantContext)
    {
        _service = service;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Retorna a árvore de navegação agrupada por bucket de UI, com gating de
    /// módulo/pacote resolvido. Itens sem permissão não são emitidos;
    /// itens com permissão mas módulo/pacote desativado vêm com <c>Acessivel=false</c>
    /// e <c>MotivoBloqueio</c> preenchido.
    /// </summary>
    [HttpGet("sidebar")]
    [ProducesResponseType(typeof(NavegacaoSidebarResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<NavegacaoSidebarResponse>> GetSidebar(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return Unauthorized();

        // Owner: pode estar em contexto "owner" (sem bd real) ou em tenant real.
        if (User.IsInRole("Owner"))
        {
            if (string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
            {
                // Owner context puro — frontend injeta itens próprios (synthetic OWNER_NAV_ITEMS).
                return Ok(new NavegacaoSidebarResponse(
                    Grupos: Array.Empty<NavGrupoResponse>(),
                    ContextoEspecial: "owner-root"));
            }

            var ownerResp = await _service.BuildForOwnerInTenantAsync(tenantId, ct);
            return Ok(ownerResp);
        }

        // Usuário comum: permissões vêm do JWT (claim "permission").
        var permissions = User.FindAll(PermissionConstants.ClaimType)
            .Select(x => x.Value)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToList();

        var resp = await _service.BuildAsync(tenantId, permissions, ct);
        return Ok(resp);
    }
}
