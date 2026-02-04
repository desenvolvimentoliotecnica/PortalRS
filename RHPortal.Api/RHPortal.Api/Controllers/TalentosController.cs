using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Contracts.Talentos;

namespace RhPortal.Api.Controllers;

public sealed class TalentoImportPdfInput
{
    public IFormFile? Arquivo { get; set; }
    public bool EnviarParaGpt { get; set; }
    public Guid? TalentoId { get; set; }
}

/// <summary>
/// Base de talentos — listagem e CRUD de talentos (pessoa na base de talentos).
/// </summary>
[ApiController]
[Route("api/talentos")]
[Authorize]
public sealed class TalentosController : ControllerBase
{
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
}
