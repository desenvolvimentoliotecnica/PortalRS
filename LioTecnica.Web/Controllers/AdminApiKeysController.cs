using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[RequirePermission("api-keys.manage")]
public sealed class AdminApiKeysController : Controller
{
    private readonly ApiKeysApiClient _api;

    public AdminApiKeysController(ApiKeysApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/ApiKeys")]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("/Admin/ApiKeys/_api/keys")]
    public async Task<ActionResult<IReadOnlyList<ApiKeyViewModel>>> List(CancellationToken ct)
    {
        var list = await _api.ListAsync(ct);
        return Ok(list);
    }

    [HttpPost("/Admin/ApiKeys/_api/keys")]
    public async Task<ActionResult<ApiKeyCreateResponse>> Create([FromBody] ApiKeyCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request?.Name))
            return BadRequest(new { error = "Nome é obrigatório." });
        var result = await _api.CreateAsync(request, ct);
        if (result is null)
            return BadRequest(new { error = "Falha ao criar chave." });
        return Ok(result);
    }

    [HttpDelete("/Admin/ApiKeys/_api/keys/{id:guid}")]
    public async Task<ActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var ok = await _api.RevokeAsync(id, ct);
        if (!ok)
            return NotFound();
        return NoContent();
    }
}
