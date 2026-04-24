using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.ProjetosVaga;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Contracts.Portal;
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
    private readonly IRHPortalAiMatchClient? _aiMatchClient;
    private readonly ICandidatoVagaMatchingScoreService? _matchingScoreService;

    public PublicCandidaturasController(
        IStringLocalizer<ControllerMessages> localizer,
        IMatchingService matchingService,
        IRHPortalAiMatchClient? aiMatchClient = null,
        ICandidatoVagaMatchingScoreService? matchingScoreService = null)
    {
        _localizer = localizer;
        _matchingService = matchingService;
        _aiMatchClient = aiMatchClient;
        _matchingScoreService = matchingScoreService;
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
        [FromServices] IProjetoVagaService projetoVagaService,
        CancellationToken ct)
    {
        if (request.VagaId == Guid.Empty)
            return BadRequest(new { message = _localizer["ControllerErrors.VagaInvalid"] });

        var email = (request.Email ?? "").Trim();
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email é obrigatório." });

        // ── Validação de campos personalizados obrigatórios ──
        List<CampoPersonalizadoRespostaDto>? camposRespostas = null;
        if (!string.IsNullOrWhiteSpace(request.CamposPersonalizadosJson))
        {
            try
            {
                camposRespostas = JsonSerializer.Deserialize<List<CampoPersonalizadoRespostaDto>>(
                    request.CamposPersonalizadosJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch
            {
                return BadRequest(new { message = "Formato inválido para campos personalizados." });
            }
        }
        camposRespostas ??= new List<CampoPersonalizadoRespostaDto>();

        var camposConfig = await db.CamposPersonalizadosVaga
            .AsNoTracking()
            .Where(c => c.VagaId == request.VagaId)
            .ToListAsync(ct);

        foreach (var campo in camposConfig.Where(c => c.Obrigatorio))
        {
            var resposta = camposRespostas.FirstOrDefault(r => r.CampoId == campo.Id);
            if (resposta is null || string.IsNullOrWhiteSpace(resposta.Valor))
                return BadRequest(new { message = $"O campo \"{campo.Label}\" é obrigatório." });
        }

        // 1) Verifica se já existe candidato com este email (no tenant atual)
        var tenantId = tenantContext.TenantId ?? "";
        var existing = await db.Candidatos
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Email == email && x.TenantId == tenantId, ct);

        var (cidade, uf) = ParseCidadeUf(request.CidadeUf);
        var obs = BuildObs(request);

        CandidateResponse result;
        var shouldNotify = false;
        var notifyCandidateId = Guid.Empty;
        var notifyTenantId = tenantContext.TenantId;
        var talentoId = Guid.Empty;

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
                talentoId = talentoExisting.Id;
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
                    existing.LinkedinUrl,
                    existing.Fonte,
                    existing.Status,
                    existing.TrabalhandoAtualmente,
                    existing.PretensaoSalarial,
                    existing.VagaId,
                    existing.Vaga?.Codigo,
                    existing.Vaga?.Titulo,
                    existing.Vaga?.AreaId,
                    existing.Vaga?.RecrutadorResponsavelUserId,
                    existing.TalentoId,
                    existing.Obs,
                    existing.ResumoProfissional,
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
                talentoId = talentoNew.Id;

                var create = new CandidateCreateRequest(
                    request.Nome,
                    email,
                    request.Fone,
                    cidade,
                    uf,
                    null,                   // LinkedinUrl
                    CandidateOrigin.Site,
                    CandidateStatus.Novo,
                    request.VagaId,
                    null,                   // TrabalhandoAtualmente
                    null,                   // PretensaoSalarial
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

            // Enfileira extração GPT do currículo no talento (best-effort, apenas PDF)
            if (talentoId != Guid.Empty &&
                request.Arquivo is { Length: > 0 } &&
                request.Arquivo.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    await using var cvStream = request.Arquivo.OpenReadStream();
                    await talentoService.StartImportPdfAsync(talentoId, cvStream, request.Arquivo.FileName, enviarParaGpt: true, ct);
                }
                catch { /* best-effort: não falha a candidatura */ }
            }

            // ── Persistir respostas de campos personalizados ──
            if (camposRespostas.Count > 0)
            {
                // Limpar respostas anteriores do mesmo candidato+vaga (para re-candidatura)
                var existingRespostas = await db.RespostasCampoPersonalizadoVaga
                    .Where(r => r.CandidatoId == result.Id && r.VagaId == request.VagaId)
                    .ToListAsync(ct);
                if (existingRespostas.Count > 0)
                    db.RespostasCampoPersonalizadoVaga.RemoveRange(existingRespostas);

                var now = DateTimeOffset.UtcNow;
                foreach (var resp in camposRespostas)
                {
                    if (!camposConfig.Any(c => c.Id == resp.CampoId)) continue;
                    db.RespostasCampoPersonalizadoVaga.Add(new RespostaCampoPersonalizadoVaga
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        VagaId = request.VagaId,
                        CandidatoId = result.Id,
                        CampoId = resp.CampoId,
                        ValorTexto = resp.Valor?.Trim(),
                        CreatedAtUtc = now,
                    });
                }
                await db.SaveChangesAsync(ct);
            }

            // Calcular e persistir score de matching por IA (um candidato, uma vaga)
            if (_aiMatchClient != null && _matchingScoreService != null)
            {
                try
                {
                    var aiResult = await _aiMatchClient.GetScoreForOneAsync(request.VagaId, result.Id, tenantId, ct);
                    if (aiResult.HasValue)
                        await _matchingScoreService.SaveAiScoreAsync(result.Id, request.VagaId, aiResult.Value.Score, ct);
                }
                catch { /* best-effort: não falha a candidatura */ }
            }

            // Auto-assign à rodada ativa da vaga (best-effort — não falha a candidatura)
            try
            {
                var rodada = await projetoVagaService.GetActiveAsync(request.VagaId, ct);
                if (rodada is not null)
                {
                    var jaNoRodada = await db.Set<ProjetoCandidato>()
                        .AnyAsync(pc => pc.ProjetoId == rodada.Id && pc.CandidatoId == result.Id, ct);
                    if (!jaNoRodada)
                    {
                        db.Set<ProjetoCandidato>().Add(new ProjetoCandidato
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantContext.TenantId,
                            ProjetoId = rodada.Id,
                            CandidatoId = result.Id,
                            Status = StatusCandidatoProjeto.Ativo,
                            Observacoes = "Inscrito via Portal de Vagas.",
                            CreatedAtUtc = DateTimeOffset.UtcNow,
                            UpdatedAtUtc = DateTimeOffset.UtcNow,
                        });
                        await db.SaveChangesAsync(ct);
                    }
                }
            }
            catch { /* best-effort: não bloqueia a candidatura */ }

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
                    notifyTenantId ?? "",
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

/// <summary>DTO para deserializar cada resposta de campo personalizado vinda do form-data JSON.</summary>
public sealed record CampoPersonalizadoRespostaDto(Guid CampoId, string? Valor);
