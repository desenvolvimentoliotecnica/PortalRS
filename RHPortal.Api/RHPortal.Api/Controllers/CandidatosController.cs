using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Candidatos.Handlers;
using RhPortal.Api.Contracts.Candidatos;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Candidatos (admin/RH): cadastro, atualização, documentos e histórico.
/// </summary>
[ApiController]
[Route("api/candidatos")]
[RequireModule("candidatos")]
public sealed class CandidatosController : ControllerBase
{
    private const int MaxMensagemAnexos = 5;
    private const long MaxMensagemAnexoBytes = 10 * 1024 * 1024;
    private const long MaxMensagemAnexosTotalBytes = 20 * 1024 * 1024;

    private readonly IStringLocalizer<ControllerMessages> _localizer;
    private readonly ICurrentUserContext _userContext;

    public CandidatosController(IStringLocalizer<ControllerMessages> localizer, ICurrentUserContext userContext)
    {
        _localizer = localizer;
        _userContext = userContext;
    }

    /// <summary>
    /// Lista candidatos com filtros (busca, status(es), vaga(s)) e paginação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CandidatePagedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CandidatePagedResponse>> List(
        [FromQuery] string? q,
        [FromQuery] CandidateStatus? status,
        [FromQuery] CandidateStatus[]? statuses,
        [FromQuery] Guid? vagaId,
        [FromQuery] Guid[]? vagaIds,
        [FromQuery] CandidateOrigin? fonte,
        [FromServices] IListCandidatosHandler handler,
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        Guid? areaId = null;
        Guid? recrutadorUserId = null;

        // Hub da vaga filtra por vagaId; o acesso já segue a mesma regra de GET /api/vagas/{id}.
        // Não reaplicar carteira (RecrutadorResponsavel na Vaga) em cima de Candidato — senão
        // analista distribuído só em SolicitacaoVaga.AnalistaRh (vaga com Recrutador null/desatualizado)
        // via de regra vê 0 candidatos apesar do portal ter registrado Candidatura.
        var singleVaga =
            vagaId.HasValue && vagaId.Value != Guid.Empty
            && (vagaIds is null || vagaIds.Length == 0);

        if (singleVaga
            && !_userContext.IsAdmin
            && !_userContext.IsInRole("Owner"))
        {
            var vid = vagaId!.Value;
            var vagaRow = await db.Vagas.AsNoTracking()
                .Where(v => v.Id == vid)
                .Select(v => new { v.CentroCustoId, v.RecrutadorResponsavelUserId })
                .FirstOrDefaultAsync(ct);
            if (vagaRow is null)
                return NotFound();

            var uid = _userContext.UserId;
            var assignedToCurrentAnalyst = uid.HasValue && await db.SolicitacoesVaga.AsNoTracking()
                .AnyAsync(s => s.VagaId == vid && s.AnalistaRhResponsavelUserId == uid.Value, ct);

            if (!assignedToCurrentAnalyst
                && IsAnalistaRhRestrito()
                && uid.HasValue
                && vagaRow.RecrutadorResponsavelUserId != uid.Value)
                return NotFound();

            if (!assignedToCurrentAnalyst
                && _userContext.VagasDataScope == VagasDataScope.ByArea
                && _userContext.CentroCustoId.HasValue
                && vagaRow.CentroCustoId != _userContext.CentroCustoId)
                return NotFound();

            if (!assignedToCurrentAnalyst
                && _userContext.VagasDataScope == VagasDataScope.ByRecrutador
                && uid.HasValue
                && vagaRow.RecrutadorResponsavelUserId != uid.Value)
                return NotFound();
        }
        else if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
        {
            if (IsAnalistaRhRestrito() && _userContext.UserId.HasValue)
                recrutadorUserId = _userContext.UserId;
            else if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.CentroCustoId.HasValue)
                areaId = _userContext.CentroCustoId;
            else if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue)
                recrutadorUserId = _userContext.UserId;
        }

        var statusList = statuses is { Length: > 0 } ? statuses.ToList() : null;
        var vagaIdList = vagaIds is { Length: > 0 } ? vagaIds.ToList() : null;
        var query = new CandidateListQuery(q, status, statusList, vagaId, vagaIdList, fonte, areaId, recrutadorUserId, page, pageSize);
        var result = await handler.HandleAsync(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Obtém um candidato pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidateResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetCandidatoByIdHandler handler,
        [FromServices] AppDbContext db,
        [FromQuery(Name = "vagaId")] Guid? documentosVagaId,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, documentosVagaId, ct);
        if (item is null)
            return NotFound();
        var denied = await AuthorizeCandidatoDetailAsync(
            item.VagaId,
            item.VagaAreaId,
            item.VagaRecrutadorResponsavelUserId,
            db,
            ct);
        if (denied != null)
            return denied;
        return Ok(item);
    }

    /// <summary>
    /// Perfil completo (read-only) como no Portal de Candidatos — skills, formação, experiências, etc.
    /// </summary>
    [HttpGet("{id:guid}/perfil-portal")]
    [ProducesResponseType(typeof(CandidatoPortalPerfilCompletoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidatoPortalPerfilCompletoResponse>> GetPerfilPortal(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] ICandidatoPortalPerfilReader reader,
        [FromServices] IGetCandidatoByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, null, ct);
        if (item is null)
            return NotFound();

        var denied = await AuthorizeCandidatoDetailAsync(
            item.VagaId,
            item.VagaAreaId,
            item.VagaRecrutadorResponsavelUserId,
            db,
            ct);
        if (denied != null)
            return denied;

        var payload = await reader.GetCompletoAsync(id, ct);
        if (payload is null)
            return NotFound();

        if (!_userContext.CanViewCandidatoContato)
        {
            payload = payload with
            {
                PerfilBasico = payload.PerfilBasico with
                {
                    Email = string.Empty,
                    Fone = null,
                    Celular = null,
                },
            };
        }

        return Ok(payload);
    }

    /// <summary>
    /// Solicita que o candidato complete dados no Portal de Vagas (mensagem interna).
    /// </summary>
    [HttpPost("{id:guid}/portal-notificacoes/solicitar-dados")]
    [ProducesResponseType(typeof(PortalCandidateInternalNotificationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateInternalNotificationDto>> SolicitarAtualizacaoDadosPortal(
        [FromRoute] Guid id,
        [FromBody] SolicitarAtualizacaoDadosCandidatoRequest request,
        [FromServices] AppDbContext db,
        [FromServices] IEmailQueueService emailQueue,
        [FromServices] IEmailConfigService emailConfig,
        [FromServices] ILogger<CandidatosController> logger,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var campos = request.CamposPendentes
            .Select(c => (c ?? string.Empty).Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList();
        if (campos.Count == 0)
            return BadRequest(new { message = "Informe ao menos um campo pendente." });

        var candidate = await db.Candidatos
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new { c.Id, c.TenantId, c.Nome, c.Email, c.VagaId })
            .FirstOrDefaultAsync(ct);
        if (candidate is null)
            return NotFound();

        var vagaId = request.VagaId ?? candidate.VagaId;
        Guid? candidaturaId = request.CandidaturaId;
        if (candidaturaId.HasValue)
        {
            var candidaturaOk = await db.Candidaturas
                .AsNoTracking()
                .AnyAsync(c => c.Id == candidaturaId.Value && c.CandidatoId == candidate.Id
                    && (!vagaId.HasValue || c.VagaId == vagaId.Value), ct);
            if (!candidaturaOk)
                return BadRequest(new { message = "Candidatura informada não pertence ao candidato/vaga." });
        }

        Guid? vagaAreaId = null;
        Guid? vagaRecrutadorUserId = null;
        string? vagaTitulo = null;
        if (vagaId.HasValue)
        {
            var vaga = await db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == vagaId.Value)
                .Select(v => new { v.Id, v.CentroCustoId, v.RecrutadorResponsavelUserId, v.Titulo })
                .FirstOrDefaultAsync(ct);
            if (vaga is null)
                return BadRequest(new { message = "Vaga informada não encontrada." });
            vagaAreaId = vaga.CentroCustoId;
            vagaRecrutadorUserId = vaga.RecrutadorResponsavelUserId;
            vagaTitulo = vaga.Titulo;
        }

        var denied = await AuthorizeCandidatoDetailAsync(vagaId, vagaAreaId, vagaRecrutadorUserId, db, ct);
        if (denied != null)
            return denied;

        var titulo = string.IsNullOrWhiteSpace(request.Titulo)
            ? "Ação necessária: complete seus dados"
            : request.Titulo.Trim();
        var camposTexto = string.Join(", ", campos);
        var mensagem = string.IsNullOrWhiteSpace(request.Mensagem)
            ? $"O RH solicitou a atualização dos seguintes dados para seguir com sua candidatura: {camposTexto}. Acesse a seção Perfil e complete as informações."
            : request.Mensagem.Trim();

        var entity = new CandidatoPortalNotificacao
        {
            Id = Guid.NewGuid(),
            TenantId = candidate.TenantId,
            CandidatoId = candidate.Id,
            VagaId = vagaId,
            CandidaturaId = candidaturaId,
            Tipo = "CompletarDados",
            Titulo = titulo,
            Mensagem = mensagem,
            CamposPendentesJson = JsonSerializer.Serialize(campos),
            CriadaPorUserId = _userContext.UserId,
            CriadaPorNome = _userContext.Email,
        };
        db.CandidatoPortalNotificacoes.Add(entity);
        await db.SaveChangesAsync(ct);

        await TryEnqueueSolicitacaoAtualizacaoEmailAsync(
            candidate.Nome,
            candidate.Email,
            vagaTitulo,
            titulo,
            mensagem,
            campos,
            emailQueue,
            emailConfig,
            logger,
            ct);

        return CreatedAtAction(
            nameof(SolicitarAtualizacaoDadosPortal),
            new { id = candidate.Id },
            MapPortalNotificacao(entity, vagaTitulo));
    }

    /// <summary>
    /// Envia uma mensagem livre do RH ao candidato por e-mail e como notificação interna no portal.
    /// </summary>
    [HttpPost("{id:guid}/portal-notificacoes/enviar-mensagem")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    [ProducesResponseType(typeof(PortalCandidateInternalNotificationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateInternalNotificationDto>> EnviarMensagemPortal(
        [FromRoute] Guid id,
        [FromForm] EnviarMensagemCandidatoFormRequest request,
        [FromServices] AppDbContext db,
        [FromServices] IEmailQueueService emailQueue,
        [FromServices] IEmailConfigService emailConfig,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var assunto = (request.Assunto ?? string.Empty).Trim();
        var corpo = (request.Corpo ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(assunto) || string.IsNullOrWhiteSpace(corpo))
            return BadRequest(new { message = "Informe assunto e corpo da mensagem." });

        var candidate = await db.Candidatos
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new { c.Id, c.TenantId, c.Nome, c.Email, c.VagaId })
            .FirstOrDefaultAsync(ct);
        if (candidate is null)
            return NotFound();

        var vagaId = request.VagaId ?? candidate.VagaId;
        Guid? candidaturaId = request.CandidaturaId;
        if (candidaturaId.HasValue)
        {
            var candidaturaOk = await db.Candidaturas
                .AsNoTracking()
                .AnyAsync(c => c.Id == candidaturaId.Value && c.CandidatoId == candidate.Id
                    && (!vagaId.HasValue || c.VagaId == vagaId.Value), ct);
            if (!candidaturaOk)
                return BadRequest(new { message = "Candidatura informada não pertence ao candidato/vaga." });
        }

        Guid? vagaAreaId = null;
        Guid? vagaRecrutadorUserId = null;
        string? vagaTitulo = null;
        if (vagaId.HasValue)
        {
            var vaga = await db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == vagaId.Value)
                .Select(v => new { v.Id, v.CentroCustoId, v.RecrutadorResponsavelUserId, v.Titulo })
                .FirstOrDefaultAsync(ct);
            if (vaga is null)
                return BadRequest(new { message = "Vaga informada não encontrada." });
            vagaAreaId = vaga.CentroCustoId;
            vagaRecrutadorUserId = vaga.RecrutadorResponsavelUserId;
            vagaTitulo = vaga.Titulo;
        }

        var denied = await AuthorizeCandidatoDetailAsync(vagaId, vagaAreaId, vagaRecrutadorUserId, db, ct);
        if (denied != null)
            return denied;

        var attachmentsResult = await BuildEmailAttachmentsAsync(request.Anexos, ct);
        if (attachmentsResult.Error is not null)
            return BadRequest(new { message = attachmentsResult.Error });

        var to = NormalizeEmailDestination(candidate.Email);
        if (to is null)
        {
            var cfg = await emailConfig.GetDecryptedAsync(ct);
            if (cfg?.SmtpUseTestRedirect == true && !string.IsNullOrWhiteSpace(cfg.SmtpTestRedirectAddress))
                to = "candidato-sem-email@renderrh.local";
        }
        if (to is null)
            return BadRequest(new { message = "O candidato não possui e-mail cadastrado." });

        var entity = new CandidatoPortalNotificacao
        {
            Id = Guid.NewGuid(),
            TenantId = candidate.TenantId,
            CandidatoId = candidate.Id,
            VagaId = vagaId,
            CandidaturaId = candidaturaId,
            Tipo = "MensagemRh",
            Titulo = assunto,
            Mensagem = corpo,
            CamposPendentesJson = JsonSerializer.Serialize(Array.Empty<string>()),
            CriadaPorUserId = _userContext.UserId,
            CriadaPorNome = _userContext.Email,
        };

        db.CandidatoPortalNotificacoes.Add(entity);

        var bodyHtml = BuildMensagemRhEmailHtml(candidate.Nome, vagaTitulo, corpo);
        var bodyText = BuildMensagemRhEmailText(candidate.Nome, vagaTitulo, corpo);
        await emailQueue.EnqueueRawAsync(
            to,
            assunto,
            bodyHtml,
            bodyText,
            attachmentsResult.Attachments,
            isSystem: false,
            source: "portal-candidato-mensagem-rh",
            ct);

        await db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(EnviarMensagemPortal),
            new { id = candidate.Id },
            MapPortalNotificacao(entity, vagaTitulo));
    }

    /// <summary>
    /// Mesmas regras de visibilidade que <see cref="GetById"/> (área / recrutador / analista em SolicitacaoVaga).
    /// </summary>
    private async Task<ActionResult?> AuthorizeCandidatoDetailAsync(
        Guid? vagaId,
        Guid? vagaAreaId,
        Guid? vagaRecrutadorResponsavelUserId,
        AppDbContext db,
        CancellationToken ct)
    {
        if (_userContext.IsAdmin || _userContext.IsInRole("Owner"))
            return null;

        var vid = vagaId;
        var assignedToCurrentAnalyst =
            vid.HasValue
            && _userContext.UserId.HasValue
            && await db.SolicitacoesVaga.AsNoTracking()
                .AnyAsync(s => s.VagaId == vid.Value && s.AnalistaRhResponsavelUserId == _userContext.UserId!.Value, ct);

        if (!assignedToCurrentAnalyst
            && IsAnalistaRhRestrito()
            && _userContext.UserId.HasValue
            && vagaRecrutadorResponsavelUserId != _userContext.UserId)
            return NotFound();

        if (!assignedToCurrentAnalyst
            && _userContext.VagasDataScope == VagasDataScope.ByArea
            && _userContext.CentroCustoId.HasValue
            && vagaAreaId.HasValue
            && vagaAreaId != _userContext.CentroCustoId)
            return NotFound();

        if (!assignedToCurrentAnalyst
            && _userContext.VagasDataScope == VagasDataScope.ByRecrutador
            && _userContext.UserId.HasValue
            && vagaRecrutadorResponsavelUserId != _userContext.UserId)
            return NotFound();

        return null;
    }

    private bool IsAnalistaRhRestrito()
        => _userContext.IsInRole("Analista de RH") && !_userContext.IsInRole("Especialista de RH");

    private static PortalCandidateInternalNotificationDto MapPortalNotificacao(
        CandidatoPortalNotificacao n,
        string? vagaTitulo)
    {
        var campos = string.IsNullOrWhiteSpace(n.CamposPendentesJson)
            ? Array.Empty<string>()
            : JsonSerializer.Deserialize<string[]>(n.CamposPendentesJson) ?? Array.Empty<string>();
        return new PortalCandidateInternalNotificationDto(
            n.Id,
            n.CandidatoId,
            n.VagaId,
            vagaTitulo,
            n.CandidaturaId,
            n.Tipo,
            n.Titulo,
            n.Mensagem,
            campos,
            n.LidaEmUtc,
            n.ResolvidaEmUtc,
            n.CriadaPorNome,
            n.CreatedAtUtc,
            n.UpdatedAtUtc);
    }

    private static async Task TryEnqueueSolicitacaoAtualizacaoEmailAsync(
        string candidatoNome,
        string? candidatoEmail,
        string? vagaTitulo,
        string titulo,
        string mensagem,
        IReadOnlyList<string> campos,
        IEmailQueueService emailQueue,
        IEmailConfigService emailConfig,
        ILogger logger,
        CancellationToken ct)
    {
        var to = NormalizeEmailDestination(candidatoEmail);
        if (to is null)
        {
            var cfg = await emailConfig.GetDecryptedAsync(ct);
            if (cfg?.SmtpUseTestRedirect == true && !string.IsNullOrWhiteSpace(cfg.SmtpTestRedirectAddress))
                to = "candidato-sem-email@renderrh.local";
        }

        if (to is null)
            return;

        try
        {
            var camposTexto = string.Join(", ", campos);
            await emailQueue.EnqueueTemplateAsync(
                CandidateEmailTemplateCodes.SolicitarCompletarDados,
                to,
                new Dictionary<string, string?>
                {
                    ["CandidatoNome"] = candidatoNome,
                    ["EmpresaNome"] = "Portal de RH",
                    ["VagaTitulo"] = vagaTitulo,
                    ["CamposSolicitados"] = camposTexto,
                },
                isSystem: true,
                source: "portal-candidato-completar-dados",
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao enfileirar e-mail de solicitação de atualização de dados do candidato.");
        }
    }

    private static string? NormalizeEmailDestination(string? email)
    {
        var trimmed = (email ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static async Task<(IReadOnlyList<EmailAttachmentPayload> Attachments, string? Error)> BuildEmailAttachmentsAsync(
        IReadOnlyList<IFormFile>? files,
        CancellationToken ct)
    {
        if (files is null || files.Count == 0)
            return (Array.Empty<EmailAttachmentPayload>(), null);

        if (files.Count > MaxMensagemAnexos)
            return (Array.Empty<EmailAttachmentPayload>(), $"Envie no máximo {MaxMensagemAnexos} anexos.");

        var total = files.Sum(f => f.Length);
        if (total > MaxMensagemAnexosTotalBytes)
            return (Array.Empty<EmailAttachmentPayload>(), "O tamanho total dos anexos deve ser de até 20 MB.");

        var attachments = new List<EmailAttachmentPayload>();
        foreach (var file in files)
        {
            if (file.Length <= 0)
                continue;

            if (file.Length > MaxMensagemAnexoBytes)
                return (Array.Empty<EmailAttachmentPayload>(), $"O arquivo {file.FileName} excede 10 MB.");

            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            attachments.Add(new EmailAttachmentPayload(
                Path.GetFileName(file.FileName),
                file.ContentType,
                ms.ToArray()));
        }

        return (attachments, null);
    }

    private static string BuildMensagemRhEmailHtml(string candidatoNome, string? vagaTitulo, string corpo)
    {
        var nome = WebUtility.HtmlEncode(candidatoNome);
        var vaga = string.IsNullOrWhiteSpace(vagaTitulo)
            ? ""
            : $"<p><strong>Vaga:</strong> {WebUtility.HtmlEncode(vagaTitulo)}</p>";
        var mensagem = WebUtility.HtmlEncode(corpo).Replace("\n", "<br />");
        return $"""
            <p>Olá {nome},</p>
            {vaga}
            <p>{mensagem}</p>
            """;
    }

    private static string BuildMensagemRhEmailText(string candidatoNome, string? vagaTitulo, string corpo)
        => $"""
            Olá {candidatoNome},

            {(string.IsNullOrWhiteSpace(vagaTitulo) ? "" : $"Vaga: {vagaTitulo}\n")}
            {corpo}
            """;

    /// <summary>
    /// Cria um novo candidato.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidateResponse>> Create(
        [FromBody] CandidateCreateRequest request,
        [FromServices] ICreateCandidatoHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
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

    /// <summary>
    /// Analisa um currículo (PDF/DOCX/TXT) de forma determinística, sem criar candidato nem persistir arquivo.
    /// Usado pelo modal Novo Candidato para pré-preencher campos.
    /// </summary>
    [HttpPost("curriculo-parse")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CandidatoCurriculoParseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CandidatoCurriculoParseResponse>> ParseCurriculo(
        [FromForm] IFormFile arquivo,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();

        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo de currículo é obrigatório." });

        var ext = Path.GetExtension(arquivo.FileName)?.ToLowerInvariant() ?? string.Empty;
        if (ext is not (".pdf" or ".docx" or ".txt"))
            return BadRequest(new { message = "Apenas arquivos PDF, DOCX ou TXT são aceitos." });

        try
        {
            var result = await service.ParseCurriculoAsync(arquivo, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Atualiza um candidato existente.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidateResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CandidateUpdateRequest request,
        [FromServices] IUpdateCandidatoHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
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

    /// <summary>
    /// Remove um candidato.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteCandidatoHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();

        try
        {
            var deleted = await handler.HandleAsync(id, ct);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            // Pre-check no CandidatoService.DeleteAsync lança InvalidOperationException
            // quando há vínculos que bloqueiam o delete (PropostaVaga, ProjetoCandidato).
            // Mensagem já vem formatada em PT: "Não é possível excluir ... — há vínculos: ...".
            return Conflict(new { message = ex.Message });
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23503")
        {
            // Safety net: FK nova com Restrict que o service ainda não sabe contar.
            return Conflict(new
            {
                message = "Não é possível excluir este candidato — existe um vínculo em outra tabela que não foi detectado. Contate o suporte.",
                detail = pg.ConstraintName,
            });
        }
    }

    /// <summary>
    /// Desvincula todos os candidatos de uma vaga (VagaId → null), mantendo os dados na base como talentos.
    /// </summary>
    [HttpPost("desvincular-da-vaga/{vagaId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DesvincularDaVaga(
        [FromRoute] Guid vagaId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
            return Forbid();
        var count = await service.DesvincularDaVagaAsync(vagaId, ct);
        return Ok(new { count });
    }

    /// <summary>
    /// Envia um documento do candidato (upload).
    /// </summary>
    [HttpPost("{id:guid}/documentos")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ApiExplorerSettings(IgnoreApi = true)]
    [ProducesResponseType(typeof(CandidateDocumentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidateDocumentoResponse>> UploadDocumento(
        [FromRoute] Guid id,
        [FromForm] CandidateDocumentoUploadRequest request,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        if (request.Arquivo is null || request.Arquivo.Length == 0)
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoFileInvalid"] });

        if (string.IsNullOrWhiteSpace(request.Tipo))
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoTypeRequired"] });

        if (!Enum.TryParse<CandidateDocumentType>(request.Tipo, true, out var tipo))
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoTypeInvalid"] });

        try
        {
            var created = await service.AddDocumentoAsync(id, tipo, request.Descricao, request.Arquivo, ct, request.VagaId);
            return created is null ? NotFound() : Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return Problem(statusCode: StatusCodes.Status500InternalServerError, detail: ex.InnerException?.Message ?? ex.Message);
        }
        catch (IOException ex)
        {
            return Problem(statusCode: StatusCodes.Status500InternalServerError, detail: ex.Message);
        }
    }

    /// <summary>
    /// Upload de currículo (PDF), extração de texto e dados sugeridos pela LLM para revisar na tela e aplicar no candidato/talento.
    /// </summary>
    [HttpPost("{id:guid}/documentos/curriculo-extrair")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CandidatoCurriculoExtrairResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidatoCurriculoExtrairResponse>> UploadCurriculoEExtrair(
        [FromRoute] Guid id,
        [FromForm] CandidateCurriculoUploadRequest request,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var arquivo = request.Arquivo;
        var enviarParaGpt = request.EnviarParaGpt;

        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo PDF é obrigatório." });

        var ext = Path.GetExtension(arquivo.FileName)?.ToLowerInvariant() ?? string.Empty;
        if (ext != ".pdf")
            return BadRequest(new { message = "Apenas arquivos PDF são aceitos." });

        try
        {
            var result = await service.UploadCurriculoEExtrairAsync(id, arquivo, enviarParaGpt, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Faz download de um documento do candidato.
    /// </summary>
    [HttpGet("{id:guid}/documentos/{documentoId:guid}/download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadDocumento(
        [FromRoute] Guid id,
        [FromRoute] Guid documentoId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var file = await service.GetDocumentoFileAsync(id, documentoId, ct);
        if (file is null) return NotFound();

        var contentType = string.IsNullOrWhiteSpace(file.ContentType)
            ? "application/octet-stream"
            : file.ContentType;

        return PhysicalFile(file.FilePath, contentType, file.FileName);
    }

    /// <summary>
    /// Remove um documento do candidato.
    /// </summary>
    [HttpDelete("{id:guid}/documentos/{documentoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocumento(
        [FromRoute] Guid id,
        [FromRoute] Guid documentoId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteDocumentoAsync(id, documentoId, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Lista o histórico de status do candidato.
    /// </summary>
    [HttpGet("{id:guid}/status-history")]
    [ProducesResponseType(typeof(IReadOnlyList<CandidateStatusHistoryItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CandidateStatusHistoryItemResponse>>> GetStatusHistory(
        [FromRoute] Guid id,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var items = await service.ListStatusHistoryAsync(id, ct);
        return Ok(items);
    }
}
