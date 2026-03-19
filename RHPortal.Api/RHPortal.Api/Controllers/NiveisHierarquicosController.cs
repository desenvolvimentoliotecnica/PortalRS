using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Hierarquia;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/niveis-hierarquicos")]
[Authorize]
public sealed class NiveisHierarquicosController : ControllerBase
{
    private readonly INivelHierarquicoService _service;

    public NiveisHierarquicosController(INivelHierarquicoService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpPost]
    [Authorize(Roles = "Admin,Owner")]
    public async Task<IActionResult> Create([FromBody] NivelHierarquicoRequest request, CancellationToken ct)
        => Created("", await _service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Owner")]
    public async Task<IActionResult> Update(Guid id, [FromBody] NivelHierarquicoRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Owner")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPatch("reorder")]
    [Authorize(Roles = "Admin,Owner")]
    public async Task<IActionResult> Reorder([FromBody] List<Guid> orderedIds, CancellationToken ct)
    {
        await _service.ReorderAsync(orderedIds, ct);
        return NoContent();
    }
}
