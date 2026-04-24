using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.PropostasVaga;
using RhPortal.Api.Contracts.PropostaVaga;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Propostas / cartas de oferta digitais. RH cria em rascunho, envia (gera token + expiração),
/// e acompanha o status. Candidato responde via `/api/public/propostas`.
/// </summary>
[ApiController]
[Route("api/propostas-vaga")]
[RequireModule("recrutamento")]
public sealed class PropostasVagaController : ControllerBase
{
    private readonly IPropostaVagaService _service;
    private readonly ICurrentUserContext _userContext;

    public PropostasVagaController(IPropostaVagaService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    private bool PodeGerenciar() => _userContext.IsAdmin || _userContext.IsOwner || _userContext.IsRH;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PropostaVagaResponse>>> List(
        [FromQuery] Guid? vagaId,
        [FromQuery] Guid? candidatoId,
        [FromQuery] PropostaVagaStatus? status,
        CancellationToken ct)
    {
        var items = await _service.ListAsync(vagaId, candidatoId, status, ct);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PropostaVagaResponse>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<PropostaVagaResponse>> Create([FromBody] PropostaVagaCreateRequest request, CancellationToken ct)
    {
        if (_userContext.IsReadOnly || !PodeGerenciar()) return Forbid();
        try
        {
            var created = await _service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PropostaVagaResponse>> Update(Guid id, [FromBody] PropostaVagaUpdateRequest request, CancellationToken ct)
    {
        if (_userContext.IsReadOnly || !PodeGerenciar()) return Forbid();
        try
        {
            var updated = await _service.UpdateAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (_userContext.IsReadOnly || !PodeGerenciar()) return Forbid();
        try
        {
            var ok = await _service.DeleteAsync(id, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/enviar")]
    public async Task<ActionResult<PropostaVagaResponse>> Enviar(
        Guid id, [FromBody] EnviarPropostaRequest? request, CancellationToken ct)
    {
        if (_userContext.IsReadOnly || !PodeGerenciar()) return Forbid();
        try
        {
            var sent = await _service.EnviarAsync(id, request?.PrazoDiasResposta, ct);
            return sent is null ? NotFound() : Ok(sent);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/cancelar")]
    public async Task<ActionResult<PropostaVagaResponse>> Cancelar(Guid id, CancellationToken ct)
    {
        if (_userContext.IsReadOnly || !PodeGerenciar()) return Forbid();
        try
        {
            var canceled = await _service.CancelarAsync(id, ct);
            return canceled is null ? NotFound() : Ok(canceled);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
