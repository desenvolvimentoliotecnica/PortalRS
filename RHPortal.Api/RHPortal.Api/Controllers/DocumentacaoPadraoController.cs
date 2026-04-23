using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.DocumentacaoPadrao;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;

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

    /// <summary>
    /// Retorna a configuração efetiva (override por NivelCargo + fallback global)
    /// para um NivelCargo específico. Útil para a UI de templates de onboarding por cargo macro.
    /// </summary>
    [HttpGet("por-nivel-cargo/{nivelCargoId:guid}")]
    [ProducesResponseType(typeof(DocumentacaoPadraoPorNivelResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocumentacaoPadraoPorNivelResponse>> GetByNivelCargo(Guid nivelCargoId, CancellationToken ct)
    {
        var resp = await _service.GetByNivelCargoAsync(nivelCargoId, ct);
        return resp is null ? NotFound(new { message = "NivelCargo não encontrado." }) : Ok(resp);
    }

    /// <summary>
    /// Persiste o override por NivelCargo. Tipos ausentes no payload voltam a herdar do padrão global.
    /// </summary>
    [HttpPut("por-nivel-cargo/{nivelCargoId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SaveByNivelCargo(
        Guid nivelCargoId,
        [FromBody] SalvarDocumentacaoPadraoPorNivelRequest request,
        CancellationToken ct)
    {
        if (request.Documentos is null)
            return BadRequest(new { message = "Payload inválido." });

        try
        {
            await _service.SaveByNivelCargoAsync(nivelCargoId, request, ct);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        return Ok(new { ok = true });
    }

    /// <summary>
    /// Retorna a configuração efetiva para um Cargo específico com hierarquia Cargo → NivelCargo → Global.
    /// Cada item indica a origem do valor.
    /// </summary>
    [HttpGet("por-cargo/{cargoId:guid}")]
    [ProducesResponseType(typeof(DocumentacaoPadraoPorCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocumentacaoPadraoPorCargoResponse>> GetByCargo(Guid cargoId, CancellationToken ct)
    {
        var resp = await _service.GetByCargoAsync(cargoId, ct);
        return resp is null ? NotFound(new { message = "Cargo não encontrado." }) : Ok(resp);
    }

    /// <summary>
    /// Persiste overrides por Cargo específico. Tipos ausentes no payload são removidos
    /// (voltam a herdar de NivelCargo ou Global).
    /// </summary>
    [HttpPut("por-cargo/{cargoId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SaveByCargo(
        Guid cargoId,
        [FromBody] SalvarDocumentacaoPadraoPorCargoRequest request,
        CancellationToken ct)
    {
        if (request.Documentos is null)
            return BadRequest(new { message = "Payload inválido." });

        try
        {
            await _service.SaveByCargoAsync(cargoId, request, ct);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        return Ok(new { ok = true });
    }

    /// <summary>
    /// Histórico de alterações. Filtra opcionalmente por escopo (Global / PorNivelCargo / PorCargo)
    /// e por <paramref name="nivelCargoId"/> ou <paramref name="cargoId"/>. Ordenação fixa
    /// <c>CriadoEmUtc</c> desc. Paginação server-side (pageSize clampado em [1,200]).
    /// </summary>
    [HttpGet("historico")]
    [ProducesResponseType(typeof(DocumentacaoPadraoHistoricoResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DocumentacaoPadraoHistoricoResponse>> Historico(
        [FromQuery] DocumentacaoPadraoEscopo? escopo,
        [FromQuery] Guid? nivelCargoId,
        [FromQuery] Guid? cargoId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var resp = await _service.ListarHistoricoAsync(escopo, nivelCargoId, cargoId, page, pageSize, ct);
        return Ok(resp);
    }
}
