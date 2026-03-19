using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Funcionarios;
using RhPortal.Api.Application.Funcionarios.Handlers;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de funcionários.
/// </summary>
[ApiController]
[Route("api/funcionarios")]
public sealed class FuncionariosController : ControllerBase
{
    [HttpGet("users-without-funcionario")]
    [RequirePermission("funcionarios.view")]
    [ProducesResponseType(typeof(IReadOnlyList<UserWithoutFuncionarioItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<UserWithoutFuncionarioItemResponse>>> ListUsersWithoutFuncionario(
        [FromServices] IListUsersWithoutFuncionarioHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(ct));

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<FuncionarioGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<FuncionarioGridRowResponse>>> List(
        [FromQuery] FuncionarioListQuery query,
        [FromServices] IListFuncionariosHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FuncionarioResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FuncionarioResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetFuncionarioByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(FuncionarioResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<FuncionarioResponse>> Create(
        [FromBody] JsonElement body,
        [FromServices] ICreateFuncionarioHandler handler,
        CancellationToken ct)
    {
        FuncionarioCreateRequest request;
        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            options.Converters.Add(new JsonStringEnumConverter());
            request = JsonSerializer.Deserialize<FuncionarioCreateRequest>(body.GetRawText(), options)
                ?? new FuncionarioCreateRequest();
        }
        catch (JsonException ex)
        {
            return BadRequest(new { message = "Invalid JSON for FuncionarioCreateRequest.", detail = ex.Message });
        }

        try
        {
            var created = await handler.HandleAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(FuncionarioResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<FuncionarioResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] FuncionarioUpdateRequest request,
        [FromServices] IUpdateFuncionarioHandler handler,
        CancellationToken ct)
    {
        try
        {
            var updated = await handler.HandleAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}/hierarquia")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateHierarquia(
        [FromRoute] Guid id,
        [FromBody] FuncionarioHierarquiaRequest request,
        [FromServices] IFuncionarioService service,
        CancellationToken ct)
    {
        var ok = await service.UpdateHierarquiaAsync(id, request.GestorDiretoId, request.NivelHierarquicoId, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteFuncionarioHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
