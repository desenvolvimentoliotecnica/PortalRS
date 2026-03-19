using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.FasesProcesso;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
public sealed class FaseProcessoController : ControllerBase
{
    private readonly IFaseProcessoService _service;

    public FaseProcessoController(IFaseProcessoService service) => _service = service;

    [HttpGet("api/projetos/{projetoId:guid}/fases")]
    public async Task<IActionResult> List(Guid projetoId, CancellationToken ct)
        => Ok(await _service.ListAsync(projetoId, ct));

    [HttpPost("api/projetos/{projetoId:guid}/fases")]
    public async Task<IActionResult> Create(Guid projetoId, [FromBody] FaseProcessoRequest request, CancellationToken ct)
        => Created("", await _service.CreateAsync(projetoId, request, ct));

    [HttpPut("api/fases/{faseId:guid}")]
    public async Task<IActionResult> Update(Guid faseId, [FromBody] FaseProcessoRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(faseId, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("api/fases/{faseId:guid}")]
    public async Task<IActionResult> Delete(Guid faseId, CancellationToken ct)
        => await _service.DeleteAsync(faseId, ct) ? NoContent() : NotFound();

    [HttpPatch("api/projetos/{projetoId:guid}/fases/reorder")]
    public async Task<IActionResult> Reorder(Guid projetoId, [FromBody] List<Guid> orderedIds, CancellationToken ct)
    {
        await _service.ReorderAsync(projetoId, orderedIds, ct);
        return NoContent();
    }

    [HttpPatch("api/projeto-candidatos/{pcId:guid}/mover")]
    public async Task<IActionResult> MoverCandidato(Guid pcId, [FromBody] MoverCandidatoRequest request, CancellationToken ct)
        => await _service.MoverCandidatoAsync(pcId, request, ct) ? NoContent() : NotFound();
}
