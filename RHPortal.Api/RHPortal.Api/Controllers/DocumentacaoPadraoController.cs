using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.DocumentacaoPadrao;
using RhPortal.Api.Contracts.DocumentacaoPadrao;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Configuração padrão de documentos solicitados na admissão.
/// O admin define, por tipo de documento, se é Obrigatório, Opcional ou Não será pedido.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Administrador,Owner")]
[Route("api/admin/documentacao-padrao")]
public sealed class DocumentacaoPadraoController : ControllerBase
{
    private readonly IDocumentacaoPadraoService _service;

    public DocumentacaoPadraoController(IDocumentacaoPadraoService service) => _service = service;

    /// <summary>Retorna a configuração atual de todos os tipos de documento.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentacaoPadraoItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DocumentacaoPadraoItemResponse>>> Get(CancellationToken ct)
        => Ok(await _service.GetAsync(ct));

    /// <summary>Salva a configuração completa de documentos padrão.</summary>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Save([FromBody] SalvarDocumentacaoPadraoRequest request, CancellationToken ct)
    {
        if (request.Documentos is null || request.Documentos.Count == 0)
            return BadRequest(new { message = "Nenhum documento informado." });

        await _service.SaveAsync(request, ct);
        return Ok(new { ok = true });
    }
}
