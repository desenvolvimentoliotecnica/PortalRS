using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Contracts.Common;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/owner/ai")]
[Authorize(Policy = "Owner")]
public sealed class OwnerAiController : ControllerBase
{
    private readonly IOwnerAiService _service;

    public OwnerAiController(IOwnerAiService service)
    {
        _service = service;
    }

    // ----- Keys -----
    [HttpGet("keys")]
    [ProducesResponseType(typeof(IReadOnlyList<AiProviderKeyListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AiProviderKeyListItemResponse>>> ListKeys(CancellationToken ct)
    {
        var list = await _service.ListKeysAsync(ct);
        return Ok(list);
    }

    [HttpPost("keys")]
    [ProducesResponseType(typeof(AiProviderKeyListItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AiProviderKeyListItemResponse>> CreateKey([FromBody] AiProviderKeyCreateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var created = await _service.CreateKeyAsync(request, ct);
        if (created is null) return BadRequest();
        return CreatedAtAction(nameof(ListKeys), created);
    }

    [HttpPut("keys/{id:guid}")]
    [ProducesResponseType(typeof(AiProviderKeyListItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiProviderKeyListItemResponse>> UpdateKey(Guid id, [FromBody] AiProviderKeyUpdateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var updated = await _service.UpdateKeyAsync(id, request, ct);
        if (updated is null) return NotFound();
        return Ok(updated);
    }

    [HttpDelete("keys/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteKey(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteKeyAsync(id, ct);
        if (!deleted) return NotFound();
        return NoContent();
    }

    // ----- Models -----
    [HttpGet("models")]
    [ProducesResponseType(typeof(IReadOnlyList<AiModelListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AiModelListItemResponse>>> ListModels(CancellationToken ct)
    {
        var list = await _service.ListModelsAsync(ct);
        return Ok(list);
    }

    [HttpPost("models")]
    [ProducesResponseType(typeof(AiModelListItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiModelListItemResponse>> CreateModel([FromBody] AiModelCreateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var created = await _service.CreateModelAsync(request, ct);
        if (created is null) return NotFound();
        return CreatedAtAction(nameof(ListModels), created);
    }

    [HttpPut("models/{id:guid}")]
    [ProducesResponseType(typeof(AiModelListItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiModelListItemResponse>> UpdateModel(Guid id, [FromBody] AiModelUpdateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var updated = await _service.UpdateModelAsync(id, request, ct);
        if (updated is null) return NotFound();
        return Ok(updated);
    }

    [HttpDelete("models/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteModel(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteModelAsync(id, ct);
        if (!deleted) return NotFound();
        return NoContent();
    }

    // ----- Usage summary by tenant -----
    [HttpGet("usage/summary-by-tenant")]
    [ProducesResponseType(typeof(AiUsageSummaryByTenantResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AiUsageSummaryByTenantResponse>> GetUsageSummaryByTenant(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct)
    {
        var result = await _service.GetUsageSummaryByTenantAsync(from, to, ct);
        return Ok(result);
    }

    // ----- Usage summary by user -----
    [HttpGet("usage/summary-by-user")]
    [ProducesResponseType(typeof(AiUsageSummaryByUserResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AiUsageSummaryByUserResponse>> GetUsageSummaryByUser(
        [FromQuery] string? tenantId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct)
    {
        var result = await _service.GetUsageSummaryByUserAsync(tenantId, from, to, ct);
        return Ok(result);
    }

    // ----- Usage detail (per line) -----
    [HttpGet("usage/detail")]
    [ProducesResponseType(typeof(PagedResult<AiUsageDetailItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AiUsageDetailItem>>> GetUsageDetail(
        [FromQuery] string? tenantId,
        [FromQuery] Guid? userId,
        [FromQuery] string? module,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = new AiUsageDetailQuery(tenantId, userId, module, from, to, page, pageSize);
        var result = await _service.GetUsageDetailAsync(query, ct);
        return Ok(result);
    }
}
