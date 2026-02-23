using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Contracts.Feedback;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/feedback/surveys")]
public sealed class SurveysController : ControllerBase
{
    [RequirePermission("feedback.pesquisas.view")]
    [HttpGet]
    [ProducesResponseType(typeof(SurveyListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<SurveyListResponse>> List(
        [FromServices] AppDbContext db,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.Surveys
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAtUtc);

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(s => new SurveySummaryResponse(s.Id, s.Title, s.Type, s.CreatedAtUtc, s.StartAtUtc, s.EndAtUtc, s.Responses.Count))
            .ToListAsync(ct);

        return Ok(new SurveyListResponse(items, total, page, pageSize));
    }

    [RequirePermission("feedback.pesquisas.manage")]
    [HttpPost]
    [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
    public async Task<ActionResult<Guid>> Create(
        [FromServices] AppDbContext db,
        [FromBody] SurveyCreateRequest request,
        CancellationToken ct = default)
    {
        var s = new Survey
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Type = request.Type,
            StartAtUtc = request.StartAtUtc,
            EndAtUtc = request.EndAtUtc,
            DepartmentsJson = request.DepartmentsJson,
            CreatedByUserId = null,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        db.Surveys.Add(s);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = s.Id }, s.Id);
    }

    [RequirePermission("feedback.pesquisas.view")]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SurveySummaryResponse>> GetById([FromServices] AppDbContext db, Guid id, CancellationToken ct = default)
    {
        var s = await db.Surveys.AsNoTracking().Include(x => x.Responses).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s == null) return NotFound();
        return Ok(new SurveySummaryResponse(s.Id, s.Title, s.Type, s.CreatedAtUtc, s.StartAtUtc, s.EndAtUtc, s.Responses?.Count ?? 0));
    }

    [RequirePermission("feedback.pesquisas.respond")]
    [HttpPost("{id:guid}/responses")]
    public async Task<IActionResult> SubmitResponse([FromServices] AppDbContext db, Guid id, [FromBody] SurveyResponseRequest request, CancellationToken ct = default)
    {
        var survey = await db.Surveys.Include(s => s.Questions).FirstOrDefaultAsync(s => s.Id == id, ct);
        if (survey == null) return NotFound();

        // prevent duplicate responses by same user for same survey
        var already = await db.SurveyResponses.AnyAsync(r => r.SurveyId == id && r.UserId == request.UserId, ct);
        if (already) return BadRequest("User already responded");

        var resp = new SurveyResponse
        {
            Id = Guid.NewGuid(),
            SurveyId = id,
            UserId = request.UserId,
            SubmittedAtUtc = DateTimeOffset.UtcNow
        };

        foreach (var a in request.Answers ?? Array.Empty<SurveyAnswerDto>())
        {
            resp.Answers.Add(new SurveyAnswer
            {
                Id = Guid.NewGuid(),
                QuestionId = a.QuestionId,
                OptionId = a.OptionId,
                TextAnswer = a.TextAnswer
            });
        }

        db.SurveyResponses.Add(resp);

        // award points for Rapid or Super survey types (500)
        var t = survey.Type ?? "";
        if (!string.IsNullOrWhiteSpace(t))
        {
            var lower = t.ToLowerInvariant();
            if (lower.Contains("rapida") || lower.Contains("rápida") || lower.Contains("super"))
            {
                const decimal amount = 500m;
                // add transaction
                db.RenderCoinTransactions.Add(new RenderCoinTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = request.UserId,
                    Amount = amount,
                    Reason = $"Responder {survey.Type}",
                    SourceType = "survey",
                    SourceId = survey.Id.ToString(),
                    CreatedAtUtc = DateTimeOffset.UtcNow
                });

                // update or create balance
                var balance = await db.RenderCoinBalances.FirstOrDefaultAsync(b => b.UserId == request.UserId, ct);
                if (balance == null)
                {
                    db.RenderCoinBalances.Add(new RenderCoinBalance
                    {
                        UserId = request.UserId,
                        Balance = amount,
                        UpdatedAtUtc = DateTimeOffset.UtcNow
                    });
                }
                else
                {
                    balance.Balance += amount;
                    balance.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    db.RenderCoinBalances.Update(balance);
                }
            }
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

