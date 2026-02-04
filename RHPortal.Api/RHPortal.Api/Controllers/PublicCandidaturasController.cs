using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Candidatura pública do Portal de Vagas (envio de currículo).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/candidaturas")]
public sealed class PublicCandidaturasController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;
    private readonly IMatchingService _matchingService;

    public PublicCandidaturasController(
        IStringLocalizer<ControllerMessages> localizer,
        IMatchingService matchingService)
    {
        _localizer = localizer;
        _matchingService = matchingService;
    }

    /// <summary>
    /// Envia uma candidatura para uma vaga (com currículo opcional).
    /// </summary>
    /// <remarks>
    /// - Se o e-mail já existir, a candidatura é atualizada para a nova vaga.
    /// - Se o currículo for enviado, ele é anexado ao candidato.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<CandidateResponse>> Create(
        [FromForm] PortalCandidaturaRequest request,
        [FromServices] ICandidatoService service,
        [FromServices] ITalentoService talentoService,
        [FromServices] AppDbContext db,
        [FromServices] NotificationPublisher notificationPublisher,
        [FromServices] ITenantContext tenantContext,
        [FromServices] IEmailQueueService emailQueue,
        CancellationToken ct)
    {
        if (request.VagaId == Guid.Empty)
            return BadRequest(new { message = _localizer["ControllerErrors.VagaInvalid"] });

        var email = (request.Email ?? "").Trim();
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email é obrigatório." });

        // 1) Verifica se já existe candidato com este email (no tenant atual)
        //    IMPORTANTE: se você usa filtro global por tenant no DbContext, isso já respeita o tenant.
        var existing = await db.Candidatos
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Email == email && x.TenantId == "liotecnica", ct);

        var (cidade, uf) = ParseCidadeUf(request.CidadeUf);
        var obs = BuildObs(request);

        CandidateResponse result;
        var shouldNotify = false;
        var notifyCandidateId = Guid.Empty;
        var notifyTenantId = tenantContext.TenantId;

        try
        {
            if (existing is not null)
            {
                // 2) Se existe: atualiza a vaga + (opcional) dados básicos; garante Talento
                var (talentoExisting, _) = await talentoService.GetOrCreateByEmailAsync(
                    email,
                    string.IsNullOrWhiteSpace(request.Nome) ? existing.Nome : request.Nome,
                    string.IsNullOrWhiteSpace(request.Fone) ? existing.Fone : request.Fone,
                    cidade ?? existing.Cidade,
                    uf ?? existing.Uf,
                    null,
                    null,
                    obs ?? existing.Obs,
                    OrigemTalento.Candidatura,
                    ct);
                existing.TalentoId = talentoExisting.Id;

                existing.VagaId = request.VagaId;
                existing.Nome = string.IsNullOrWhiteSpace(request.Nome) ? existing.Nome : request.Nome;
                existing.Fone = string.IsNullOrWhiteSpace(request.Fone) ? existing.Fone : request.Fone;
                existing.Cidade = cidade ?? existing.Cidade;
                existing.Uf = uf ?? existing.Uf;
                existing.Obs = obs ?? existing.Obs;

                await db.SaveChangesAsync(ct);
                await _matchingService.CalculateAndStoreAsync(existing.Id, request.VagaId, ct);
                shouldNotify = true;
                notifyCandidateId = existing.Id;
                notifyTenantId = existing.TenantId;

                result = new CandidateResponse(
                    existing.Id,
                    existing.Nome,
                    existing.Email,
                    existing.Fone,
                    existing.Cidade,
                    existing.Uf,
                    existing.Fonte,
                    existing.Status,
                    existing.VagaId,
                    existing.Vaga?.Codigo,
                    existing.Vaga?.Titulo,
                    existing.Vaga?.AreaId,
                    existing.Vaga?.RecrutadorResponsavelUserId,
                    existing.Obs,
                    existing.CvText,
                    null,
                    Array.Empty<CandidateDocumentoResponse>(),
                    null,
                    null,
                    existing.CreatedAtUtc,
                    existing.UpdatedAtUtc
                );


                // Anexo (se quiser anexar ao candidato existente também)
                if (request.Arquivo is { Length: > 0 })
                {
                    await service.AddDocumentoAsync(
                        existing.Id,
                        CandidateDocumentType.Curriculo,
                        _localizer["ControllerLabels.CvEnviadoPeloPortal"],
                        request.Arquivo,
                        ct);
                }
            }
            else
            {
                // 3) Se não existe: cria Pessoa + Talento, depois Candidato com TalentoId
                var (talentoNew, _) = await talentoService.GetOrCreateByEmailAsync(
                    email,
                    request.Nome,
                    request.Fone,
                    cidade,
                    uf,
                    null,
                    null,
                    obs,
                    OrigemTalento.Candidatura,
                    ct);

                var create = new CandidateCreateRequest(
                    request.Nome,
                    email,
                    request.Fone,
                    cidade,
                    uf,
                    CandidateOrigin.Site,
                    CandidateStatus.Novo,
                    request.VagaId,
                    obs,
                    null,
                    null,
                    null,
                    null,
                    null,
                    talentoNew.Id
                );

                result = await service.CreateAsync(create, ct);
                shouldNotify = true;
                notifyCandidateId = result.Id;
                notifyTenantId = tenantContext.TenantId;

                if (request.Arquivo is { Length: > 0 })
                {
                    await service.AddDocumentoAsync(
                        result.Id,
                        CandidateDocumentType.Curriculo,
                        _localizer["ControllerLabels.CvEnviadoPeloPortal"],
                        request.Arquivo,
                        ct);
                }
            }

            // 4) Email (best effort) — pode manter como está
            try
            {
                var candidate = await db.Candidatos.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == result.Id, ct);

                if (candidate is not null && !string.IsNullOrWhiteSpace(candidate.PortalAccessKey))
                {
                    var tokens = new Dictionary<string, string?>
                    {
                        ["Nome"] = candidate.Nome,
                        ["VagaTitulo"] = result.VagaTitulo ?? "Vaga",
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
            catch { /* best-effort */ }

            if (shouldNotify)
            {
                await NotifyPortalCandidaturaAsync(
                    db,
                    notificationPublisher,
                    notifyTenantId,
                    notifyCandidateId,
                    ct);
            }

            return Ok(result);
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

    private static async Task NotifyPortalCandidaturaAsync(
        AppDbContext db,
        NotificationPublisher notificationPublisher,
        string tenantId,
        Guid candidateId,
        CancellationToken ct)
    {
        try
        {
            var data = await db.Candidatos
                .AsNoTracking()
                .Where(x => x.Id == candidateId)
                .Select(x => new { x.Nome, x.Email, x.Fone, x.VagaId })
                .FirstOrDefaultAsync(ct);

            if (data is null) return;

            var vagaInfo = await db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == data.VagaId)
                .Select(v => new { v.Codigo, v.Titulo })
                .FirstOrDefaultAsync(ct);

            var parts = new List<string>
            {
                $"Nome: {data.Nome}",
                $"Email: {data.Email}"
            };

            if (!string.IsNullOrWhiteSpace(data.Fone))
                parts.Add($"Fone: {data.Fone}");

            if (vagaInfo is not null)
            {
                var code = string.IsNullOrWhiteSpace(vagaInfo.Codigo) ? "—" : vagaInfo.Codigo;
                parts.Add($"Vaga: {vagaInfo.Titulo} ({code})");
            }

            var message = string.Join(" | ", parts);
            var request = new NotificationSendRequest(
                NotificationScope.Tenant,
                "Novo candidato cadastrado",
                message,
                "info",
                $"/Candidatos?open={candidateId}",
                tenantId,
                null);

            await notificationPublisher.PublishToTenantsAsync(new[] { tenantId }, request, ct);
        }
        catch
        {
            // best-effort
        }
    }
}
