using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Agenda;
using RhPortal.Api.Contracts.Schedule;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/interviews")]
public sealed class PublicInterviewController : ControllerBase
{
    private readonly AgendaService _agendaService;

    public PublicInterviewController(AgendaService agendaService)
    {
        _agendaService = agendaService;
    }

    [HttpGet("{token}")]
    [ProducesResponseType(typeof(PublicInterviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicInterviewResponse>> Get(string token, CancellationToken ct)
    {
        var result = await _agendaService.GetPublicInterviewAsync(token, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{token}/confirm")]
    [ProducesResponseType(typeof(PublicInterviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicInterviewResponse>> Confirm(string token, CancellationToken ct)
    {
        var result = await _agendaService.ConfirmPublicInterviewAsync(token, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{token}/suggest")]
    [ProducesResponseType(typeof(PublicInterviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicInterviewResponse>> Suggest(
        string token,
        [FromBody] SuggestInterviewTimeRequest request,
        CancellationToken ct)
    {
        var result = await _agendaService.SuggestPublicInterviewTimeAsync(token, request, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
