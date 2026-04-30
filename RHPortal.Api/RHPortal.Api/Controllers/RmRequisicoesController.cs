using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>Lista consolidada de requisições do RM (CORPORERM), somente leitura.</summary>
[ApiController]
[RequirePermission("access.manage")]
[Route("api/rm/requisicoes")]
public sealed class RmRequisicoesController : ControllerBase
{
    private readonly IRmRequisicoesReadService _read;
    private readonly RmConnectionOptions _rm;

    public RmRequisicoesController(IRmRequisicoesReadService read, IOptions<RmConnectionOptions> rm)
    {
        _read = read;
        _rm = rm.Value;
    }

    [HttpGet]
    [ProducesResponseType(typeof(RmRequisicaoListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<RmRequisicaoListResponse>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? tipoRequisicao = null,
        [FromQuery] DateOnly? dataAberturaDe = null,
        [FromQuery] DateOnly? dataAberturaAte = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        if (!_rm.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "Integração RM indisponível",
                Detail = "Configure Rm:ConnectionString (ou Server/Database/UserId/Password).",
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }

        try
        {
            var result = await _read.ListAsync(new RmRequisicaoListQuery
            {
                Page = page,
                PageSize = pageSize,
                TipoRequisicao = tipoRequisicao,
                DataAberturaDe = dataAberturaDe,
                DataAberturaAte = dataAberturaAte,
                Search = q
            }, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "Integração RM indisponível",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
        catch (SqlException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "Erro ao consultar o banco RM",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
    }
}
