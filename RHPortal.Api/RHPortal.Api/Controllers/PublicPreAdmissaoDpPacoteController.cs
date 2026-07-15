using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;

namespace RhPortal.Api.Controllers;

/// <summary>Pacote público para o Departamento Pessoal (link mágico, sem login).</summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/pre-admissao/pacote-dp")]
public sealed class PublicPreAdmissaoDpPacoteController : ControllerBase
{
    private readonly IPreAdmissaoDpPacoteService _service;

    public PublicPreAdmissaoDpPacoteController(IPreAdmissaoDpPacoteService service)
    {
        _service = service;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PacoteDpPublicResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    public async Task<IActionResult> Get([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Token obrigatório." });

        var result = await _service.GetPublicAsync(token, ct);
        if (result is null)
            return StatusCode(StatusCodes.Status410Gone, new { message = "Link inválido ou expirado. Peça ao RH um novo envio do pacote." });

        return Ok(result);
    }

    [HttpGet("documentos/{docId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    public async Task<IActionResult> DownloadDocumento(Guid docId, [FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Token obrigatório." });

        var result = await _service.GetDocumentoPublicAsync(token, docId, ct);
        if (result is null)
        {
            // Distinguir token inválido vs doc inexistente
            var pack = await _service.GetPublicAsync(token, ct);
            if (pack is null)
                return StatusCode(StatusCodes.Status410Gone, new { message = "Link inválido ou expirado." });
            return NotFound(new { message = "Documento não encontrado." });
        }

        return File(result.Stream, result.ContentType, result.FileName);
    }

    [HttpGet("zip")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    public async Task<IActionResult> DownloadZip([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Token obrigatório." });

        var zip = await _service.BuildZipPublicAsync(token, ct);
        if (zip is null)
            return StatusCode(StatusCodes.Status410Gone, new { message = "Link inválido ou expirado. Peça ao RH um novo envio do pacote." });

        return File(zip.Value.Stream, "application/zip", zip.Value.FileName);
    }
}
