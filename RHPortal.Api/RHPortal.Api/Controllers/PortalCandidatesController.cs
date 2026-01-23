using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/portal-candidates")]
public sealed class PortalCandidatesController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public PortalCandidatesController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PortalCandidateProfileResponse>> GetProfile(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var candidate = await db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        return Ok(new PortalCandidateProfileResponse(
            candidate.Id,
            candidate.Nome,
            candidate.Email,
            candidate.Fone,
            candidate.Cidade,
            candidate.Uf
        ));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PortalCandidateProfileResponse>> UpdateProfile(
        Guid id,
        [FromBody] PortalCandidateProfileUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        candidate.Nome = (request.Nome ?? string.Empty).Trim();
        candidate.Fone = NormalizeRequired(request.Fone);
        candidate.Cidade = NormalizeRequired(request.Cidade);
        candidate.Uf = NormalizeUfRequired(request.Uf);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateProfileResponse(
            candidate.Id,
            candidate.Nome,
            candidate.Email,
            candidate.Fone,
            candidate.Cidade,
            candidate.Uf
        ));
    }

    private static string NormalizeUfRequired(string? uf)
        => (uf ?? string.Empty).Trim().ToUpperInvariant();

    private static string NormalizeRequired(string? value)
        => (value ?? string.Empty).Trim();
}
