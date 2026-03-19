using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.AprovacoesFaixa;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/aprovacoes-faixa")]
public sealed class AprovacaoFaixaController : ControllerBase
{
    private readonly IAprovacaoFaixaService _service;

    public AprovacaoFaixaController(IAprovacaoFaixaService service) => _service = service;

    [HttpGet("pendentes")]
    public async Task<IActionResult> ListPendentes(CancellationToken ct)
        => Ok(await _service.ListPendentesAsync(ct));

    [HttpGet]
    public async Task<IActionResult> ListTodas(CancellationToken ct)
        => Ok(await _service.ListTodasAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Solicitar([FromBody] SolicitarAprovacaoFaixaRequest request, CancellationToken ct)
        => Created("", await _service.SolicitarAsync(request, User, ct));

    [HttpPost("{id:guid}/aprovar")]
    public async Task<IActionResult> Aprovar(Guid id, [FromBody] AcaoAprovacaoFaixaRequest request, CancellationToken ct)
    {
        var r = await _service.AprovarAsync(id, request, User, ct);
        return r is null ? NotFound() : Ok(r);
    }

    [HttpPost("{id:guid}/reprovar")]
    public async Task<IActionResult> Reprovar(Guid id, [FromBody] AcaoAprovacaoFaixaRequest request, CancellationToken ct)
    {
        var r = await _service.ReprovarAsync(id, request, User, ct);
        return r is null ? NotFound() : Ok(r);
    }
}
