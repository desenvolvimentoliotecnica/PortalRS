using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.CamposPersonalizados;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
public sealed class CampoPersonalizadoController : ControllerBase
{
    private readonly ICampoPersonalizadoService _service;

    public CampoPersonalizadoController(ICampoPersonalizadoService service) => _service = service;

    [HttpGet("api/vagas/{vagaId:guid}/campos-personalizados")]
    public async Task<IActionResult> List(Guid vagaId, CancellationToken ct)
        => Ok(await _service.ListAsync(vagaId, ct));

    [HttpPost("api/vagas/{vagaId:guid}/campos-personalizados")]
    public async Task<IActionResult> Create(Guid vagaId, [FromBody] CampoPersonalizadoRequest request, CancellationToken ct)
        => Created("", await _service.CreateAsync(vagaId, request, ct));

    [HttpPut("api/campos-personalizados/{campoId:guid}")]
    public async Task<IActionResult> Update(Guid campoId, [FromBody] CampoPersonalizadoRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(campoId, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("api/campos-personalizados/{campoId:guid}")]
    public async Task<IActionResult> Delete(Guid campoId, CancellationToken ct)
        => await _service.DeleteAsync(campoId, ct) ? NoContent() : NotFound();

    [HttpPatch("api/vagas/{vagaId:guid}/campos-personalizados/reorder")]
    public async Task<IActionResult> Reorder(Guid vagaId, [FromBody] List<Guid> orderedIds, CancellationToken ct)
    {
        await _service.ReorderAsync(vagaId, orderedIds, ct);
        return NoContent();
    }

    /// <summary>Gera link público compartilhável para a vaga (para LinkedIn, etc.).</summary>
    [HttpGet("api/vagas/{vagaId:guid}/link-publico")]
    [AllowAnonymous]
    public IActionResult GetLinkPublico(Guid vagaId)
    {
        // O link público é simplesmente a URL do portal + vagaId
        var baseUrl = HttpContext.Request.Scheme + "://" + HttpContext.Request.Host;
        var link = $"{baseUrl}/portal/vagas/{vagaId}";
        return Ok(new { link });
    }
}
