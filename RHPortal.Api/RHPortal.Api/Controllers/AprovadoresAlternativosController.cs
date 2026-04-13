using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.AprovadoresAlternativos;
using RhPortal.Api.Contracts.AprovadoresAlternativos;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Gerencia aprovadores alternativos (substitutos) para gestores durante um período de vigência.
/// </summary>
[ApiController]
[Authorize]
[RequirePermission("aprovadores-alternativos.manage")]
[Route("api/admin/aprovadores-alternativos")]
public sealed class AprovadoresAlternativosController : ControllerBase
{
    private readonly IAprovadorAlternativoService _service;

    public AprovadoresAlternativosController(IAprovadorAlternativoService service)
    {
        _service = service;
    }

    /// <summary>
    /// Lista aprovadores alternativos com filtros opcionais.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<AprovadorAlternativoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AprovadorAlternativoResponse>>> List(
        [FromQuery] AprovadorAlternativoListQuery query,
        CancellationToken ct)
        => Ok(await _service.ListAsync(query, ct));

    /// <summary>
    /// Retorna um aprovador alternativo pelo id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AprovadorAlternativoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AprovadorAlternativoResponse>> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        if (item is null)
            return NotFound();
        return Ok(item);
    }

    /// <summary>
    /// Cria um novo aprovador alternativo.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(AprovadorAlternativoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AprovadorAlternativoResponse>> Create(
        [FromBody] AprovadorAlternativoSaveRequest request,
        CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Atualiza um aprovador alternativo existente.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AprovadorAlternativoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AprovadorAlternativoResponse>> Update(
        Guid id,
        [FromBody] AprovadorAlternativoSaveRequest request,
        CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        if (result is null)
            return NotFound();
        return Ok(result);
    }

    /// <summary>
    /// Remove um aprovador alternativo.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _service.DeleteAsync(id, ct);
        if (!ok)
            return NotFound();
        return NoContent();
    }
}
