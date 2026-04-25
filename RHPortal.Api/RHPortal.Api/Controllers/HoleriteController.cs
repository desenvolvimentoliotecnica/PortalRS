using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Colaborador;
using RhPortal.Api.Contracts.Colaborador;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Gestão de holerites pelo RH — upload, listagem e exclusão para qualquer funcionário.
/// </summary>
[ApiController]
[Route("api/rh/holerites")]
public sealed class HoleriteController : ControllerBase
{
    private readonly IColaboradorService _service;
    private readonly ICurrentUserContext _userContext;

    public HoleriteController(IColaboradorService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista holerites de um funcionário específico.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<HoleriteResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid funcionarioId,
        [FromQuery] int? ano,
        CancellationToken ct)
    {
        return Ok(await _service.ListHoleritesAsync(funcionarioId, ano, ct));
    }

    /// <summary>Upload de holerite (PDF) para um funcionário — substitui se já existir o mesmo mês/ano.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(HoleriteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(20 * 1024 * 1024)] // 20 MB
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Upload(
        [FromForm] Guid funcionarioId,
        [FromForm] int mesReferencia,
        [FromForm] int anoReferencia,
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo não enviado." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".pdf")
            return BadRequest(new { message = "Apenas arquivos PDF são aceitos." });

        if (mesReferencia < 1 || mesReferencia > 12)
            return BadRequest(new { message = "Mês de referência inválido (1–12)." });

        var enviadoPorId = _userContext.FuncionarioId
            ?? throw new InvalidOperationException("Usuário não possui funcionário vinculado.");

        using var stream = file.OpenReadStream();
        var result = await _service.UploadHoleriteRhAsync(
            funcionarioId, enviadoPorId,
            mesReferencia, anoReferencia,
            file.FileName, file.ContentType, file.Length, stream, ct);

        return Created($"/api/colaborador/holerites/{result.Id}/download", result);
    }

    /// <summary>Remove um holerite.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _service.DeleteHoleriteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
