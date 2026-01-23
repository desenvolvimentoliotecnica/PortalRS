using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Contracts.Candidatos;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/candidaturas")]
public sealed class PublicCandidaturasController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public PublicCandidaturasController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpPost]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<CandidatoResponse>> Create(
        [FromForm] PortalCandidaturaRequest request,
        [FromServices] ICandidatoService service,
        [FromServices] AppDbContext db,
        [FromServices] IEmailQueueService emailQueue,
        CancellationToken ct)
    {
        if (request.VagaId == Guid.Empty)
            return BadRequest(new { message = _localizer["ControllerErrors.VagaInvalid"] });

        var (cidade, uf) = ParseCidadeUf(request.CidadeUf);
        var obs = BuildObs(request);

        var create = new CandidatoCreateRequest(
            request.Nome,
            request.Email,
            request.Fone,
            cidade,
            uf,
            CandidatoFonte.Site,
            CandidatoStatus.Novo,
            request.VagaId,
            obs,
            null,
            null,
            null
        );

        try
        {
            var created = await service.CreateAsync(create, ct);
            if (request.Arquivo is { Length: > 0 })
            {
                await service.AddDocumentoAsync(
                    created.Id,
                    CandidatoDocumentoTipo.Curriculo,
                    _localizer["ControllerLabels.CvEnviadoPeloPortal"],
                    request.Arquivo,
                    ct);
            }

            try
            {
                var candidate = await db.Candidatos.AsNoTracking().FirstOrDefaultAsync(x => x.Id == created.Id, ct);
                if (candidate is not null && !string.IsNullOrWhiteSpace(candidate.PortalAccessKey))
                {
                    var tokens = new Dictionary<string, string?>
                    {
                        ["Nome"] = candidate.Nome,
                        ["VagaTitulo"] = created.VagaTitulo ?? "Vaga",
                        ["PortalAccessKey"] = candidate.PortalAccessKey
                    };

                    await emailQueue.EnqueueTemplateAsync(
                        "CandidaturaConfirmacao",
                        candidate.Email,
                        tokens,
                        isSystem: true,
                        source: "PortalCandidatura",
                        ct);
                }
            }
            catch
            {
                // Best-effort: falha no envio nao impede a candidatura.
            }

            return CreatedAtAction(
                nameof(CandidatosController.GetById),
                "Candidatos",
                new { id = created.Id },
                created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    private static (string? cidade, string? uf) ParseCidadeUf(string? cidadeUf)
    {
        if (string.IsNullOrWhiteSpace(cidadeUf)) return (null, null);
        var parts = cidadeUf.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) return (null, null);
        var cidade = parts[0];
        var uf = parts.Length > 1 ? parts[1] : null;
        return (cidade, uf);
    }

    private static string? BuildObs(PortalCandidaturaRequest request)
    {
        var lines = new List<string>();
        if (!string.IsNullOrWhiteSpace(request.Linkedin))
            lines.Add($"LinkedIn: {request.Linkedin}");
        if (!string.IsNullOrWhiteSpace(request.Portfolio))
            lines.Add($"Portfolio: {request.Portfolio}");
        if (!string.IsNullOrWhiteSpace(request.CargoAtual))
            lines.Add($"Cargo atual: {request.CargoAtual}");
        if (request.AnosExperiencia.HasValue)
            lines.Add($"Anos de experiencia: {request.AnosExperiencia}");
        if (!string.IsNullOrWhiteSpace(request.Observacoes))
            lines.Add($"Observacoes: {request.Observacoes}");

        return lines.Count == 0 ? null : string.Join(Environment.NewLine, lines);
    }
}
