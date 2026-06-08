using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Contracts.Talentos;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Controllers;

public sealed class TalentoImportPdfInput
{
    public IFormFile? Arquivo { get; set; }
    public bool EnviarParaGpt { get; set; }
    public Guid? TalentoId { get; set; }
}

public sealed class TalentoCurriculoExtrairInput
{
    public IFormFile? Arquivo { get; set; }
    public bool EnviarParaGpt { get; set; } = true;
}

public sealed class TalentoEnviarEmailInput
{
    public string? Assunto { get; set; }
    public string? Corpo { get; set; }
    public List<IFormFile>? Anexos { get; set; }
}

/// <summary>
/// Base de talentos — listagem e CRUD de talentos (pessoa na base de talentos).
/// </summary>
[ApiController]
[Route("api/talentos")]
[Authorize]
public sealed class TalentosController : ControllerBase
{
    private const int MaxMensagemAnexos = 5;
    private const long MaxMensagemAnexoBytes = 10 * 1024 * 1024;
    private const long MaxMensagemAnexosTotalBytes = 20 * 1024 * 1024;

    /// <summary>
    /// Lista talentos com filtros (busca, origem) e paginação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(TalentoPagedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<TalentoPagedResponse>> List(
        [FromQuery] TalentoListQuery query,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var result = await service.ListAsync(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Obtém um talento pelo ID (com dados da pessoa).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TalentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TalentoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo talento (cria ou localiza pessoa por email e associa como talento). Se CPF informado e existir, atualiza o cadastro existente. Se similar encontrado e não ForceCreate, retorna 409.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TalentoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TalentoResponse>> Create(
        [FromBody] TalentoCreateRequest request,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(request, ct);
        if (result.SimilarFound)
            return Conflict(new CreateTalentoConflictResponse(result.SimilarFound, result.SimilarTalentoId, result.SimilarPessoaSummary));
        return CreatedAtAction(nameof(GetById), new { id = result.Created!.Id }, result.Created);
    }

    /// <summary>
    /// Atualiza um talento e os dados da pessoa vinculada.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TalentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TalentoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] TalentoUpdateRequest request,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Envia uma mensagem livre do RH por e-mail ao talento.
    /// </summary>
    [HttpPost("{id:guid}/email")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    [ProducesResponseType(typeof(TalentoEnviarEmailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TalentoEnviarEmailResponse>> EnviarEmail(
        [FromRoute] Guid id,
        [FromForm] TalentoEnviarEmailInput request,
        [FromServices] AppDbContext db,
        [FromServices] IEmailQueueService emailQueue,
        [FromServices] IEmailConfigService emailConfig,
        [FromServices] ICurrentUserContext userContext,
        CancellationToken ct)
    {
        if (!userContext.IsAdmin && !userContext.IsInRole("Owner") && userContext.IsReadOnly)
            return Forbid();

        var assunto = (request.Assunto ?? string.Empty).Trim();
        var corpo = (request.Corpo ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(assunto) || string.IsNullOrWhiteSpace(corpo))
            return BadRequest(new { message = "Informe assunto e corpo da mensagem." });

        var talento = await db.Talentos
            .AsNoTracking()
            .Include(t => t.Pessoa)
            .Where(t => t.Id == id)
            .Select(t => new { t.Id, t.TenantId, Nome = t.Pessoa != null ? t.Pessoa.Nome : "", Email = t.Pessoa != null ? t.Pessoa.Email : "" })
            .FirstOrDefaultAsync(ct);
        if (talento is null)
            return NotFound();

        var attachmentsResult = await BuildEmailAttachmentsAsync(request.Anexos, ct);
        if (attachmentsResult.Error is not null)
            return BadRequest(new { message = attachmentsResult.Error });

        var to = NormalizeEmailDestination(talento.Email);
        if (to is null)
        {
            var cfg = await emailConfig.GetDecryptedAsync(ct);
            if (cfg?.SmtpUseTestRedirect == true && !string.IsNullOrWhiteSpace(cfg.SmtpTestRedirectAddress))
                to = "talento-sem-email@renderrh.local";
        }

        if (to is null)
            return BadRequest(new { message = "O talento não possui e-mail cadastrado." });

        var bodyHtml = BuildTalentoEmailHtml(talento.Nome, corpo);
        var bodyText = BuildTalentoEmailText(talento.Nome, corpo);
        var message = await emailQueue.EnqueueRawAsync(
            to,
            assunto,
            bodyHtml,
            bodyText,
            attachmentsResult.Attachments,
            isSystem: false,
            source: "talento-mensagem-rh",
            ct);

        return Ok(new TalentoEnviarEmailResponse(
            message.Id,
            talento.Id,
            talento.Nome,
            to,
            assunto,
            attachmentsResult.Attachments.Count,
            message.CreatedAtUtc));
    }

    /// <summary>
    /// Remove um talento (não remove a pessoa).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Inicia importação de PDF em background: cria Talento + Documento + Job (Pendente) e retorna imediatamente. O processamento (extração de texto, GPT, duplicado/similar) é feito pelo worker.
    /// </summary>
    [HttpPost("import-pdf")]
    [ProducesResponseType(typeof(TalentoStartImportPdfResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<TalentoStartImportPdfResponse>> ImportPdf(
        [FromForm] TalentoImportPdfInput input,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var file = input?.Arquivo;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo PDF é obrigatório." });

        var fileName = file.FileName ?? "curriculo.pdf";
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext != ".pdf")
            return BadRequest(new { message = "Apenas arquivos PDF são aceitos." });

        try
        {
            await using var stream = file.OpenReadStream();
            var result = await service.StartImportPdfAsync(input!.TalentoId, stream, fileName, input.EnviarParaGpt, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Upload de currículo (PDF) no talento existente: salva documento, extrai texto e dados sugeridos pela LLM para revisar na tela e aplicar.
    /// </summary>
    [HttpPost("{id:guid}/documentos/curriculo-extrair")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(TalentoCurriculoExtrairResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TalentoCurriculoExtrairResponse>> UploadCurriculoEExtrair(
        [FromRoute] Guid id,
        [FromForm] TalentoCurriculoExtrairInput input,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var arquivo = input.Arquivo;
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo PDF é obrigatório." });

        var fileName = arquivo.FileName ?? "curriculo.pdf";
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext != ".pdf")
            return BadRequest(new { message = "Apenas arquivos PDF são aceitos." });

        try
        {
            await using var stream = arquivo.OpenReadStream();
            var result = await service.UploadCurriculoEExtrairAsync(id, stream, fileName, input.EnviarParaGpt, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Detalhe do job em PendenteValidacao: CV extraído + talento similar existente para comparação na UI.
    /// </summary>
    [HttpGet("import-jobs/{id:guid}")]
    [ProducesResponseType(typeof(CvImportJobValidationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CvImportJobValidationResponse>> GetImportJob(
        [FromRoute] Guid id,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var item = await service.GetCvImportJobAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Aprova a aplicação dos dados do CV no cadastro similar (job em PendenteValidacao).
    /// </summary>
    [HttpPost("import-jobs/{id:guid}/aprovar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AprovarImportJob(
        [FromRoute] Guid id,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        try
        {
            await service.AprovarCvImportJobAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Recusa a aplicação no similar; mantém o talento atual como está.
    /// </summary>
    [HttpPost("import-jobs/{id:guid}/recusar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecusarImportJob(
        [FromRoute] Guid id,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        try
        {
            await service.RecusarCvImportJobAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Baixa um documento (ex.: PDF do currículo) do talento.
    /// </summary>
    [HttpGet("{id:guid}/documentos/{docId:guid}/download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadDocumento(
        [FromRoute] Guid id,
        [FromRoute] Guid docId,
        [FromServices] ITalentoService service,
        CancellationToken ct)
    {
        var file = await service.GetDocumentoFileAsync(id, docId, ct);
        if (file is null)
            return NotFound();
        return PhysicalFile(file.FilePath, file.ContentType ?? "application/octet-stream", file.FileName);
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

    private static string BuildTalentoEmailHtml(string talentoNome, string corpo)
    {
        var nome = WebUtility.HtmlEncode(talentoNome);
        var mensagem = WebUtility.HtmlEncode(corpo).Replace("\n", "<br />");
        return $"""
            <p>Olá {nome},</p>
            <p>{mensagem}</p>
            """;
    }

    private static string BuildTalentoEmailText(string talentoNome, string corpo)
        => $"""
            Olá {talentoNome},

            {corpo}
            """;
}
