using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.SolicitacoesVaga;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/regras-aprovacao-vaga")]
public sealed class RegrasAprovacaoVagaController : ControllerBase
{
    private readonly IRegraAprovacaoVagaService _service;

    public RegrasAprovacaoVagaController(IRegraAprovacaoVagaService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] RegraAprovacaoVagaCreateRequest request, CancellationToken ct)
    {
        try
        {
            var created = await _service.CreateAsync(request, ct);
            return Created($"/api/regras-aprovacao-vaga/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] RegraAprovacaoVagaUpdateRequest request, CancellationToken ct)
    {
        var updated = await _service.UpdateAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _service.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
