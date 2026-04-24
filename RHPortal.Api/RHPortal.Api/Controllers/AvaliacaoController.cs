using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Avaliacao;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>Ciclos de avaliação de desempenho formal.</summary>
[ApiController]
[Route("api/avaliacao")]
[Authorize]
[RequireModule("desempenho")]
public sealed class AvaliacaoController : ControllerBase
{
    private readonly IAvaliacaoService _service;
    private readonly IAvaliacaoConviteService _conviteService;
    private readonly IAvaliacaoCalibragemService _calibragemService;
    private readonly ICurrentUserContext _userContext;

    public AvaliacaoController(
        IAvaliacaoService service,
        IAvaliacaoConviteService conviteService,
        IAvaliacaoCalibragemService calibragemService,
        ICurrentUserContext userContext)
    {
        _service = service;
        _conviteService = conviteService;
        _calibragemService = calibragemService;
        _userContext = userContext;
    }

    /// <summary>Lista todos os ciclos do tenant.</summary>
    [HttpGet("ciclos")]
    [RequirePermission("desempenho.view")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoCicloResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCiclos(CancellationToken ct) =>
        Ok(await _service.ListCiclosAsync(ct));

    /// <summary>Detalhe de um ciclo com perguntas.</summary>
    [HttpGet("ciclos/{id:guid}")]
    [RequirePermission("desempenho.view")]
    [ProducesResponseType(typeof(AvaliacaoCicloResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCiclo(Guid id, CancellationToken ct)
    {
        var result = await _service.GetCicloAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Cria um novo ciclo de avaliação. [Admin/RH]</summary>
    [HttpPost("ciclos")]
    [RequirePermission("desempenho.ciclos.manage")]
    [ProducesResponseType(typeof(AvaliacaoCicloResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CriarCiclo([FromBody] AvaliacaoCicloCreateRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } criadoPorId)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { message = "Nome é obrigatório." });

        if (request.Perguntas is null || request.Perguntas.Count == 0)
            return BadRequest(new { message = "O ciclo deve ter ao menos uma pergunta." });

        try
        {
            var result = await _service.CriarCicloAsync(request, criadoPorId, ct);
            return CreatedAtAction(nameof(GetCiclo), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Ativa um ciclo em rascunho, abrindo para respostas. Idempotente.</summary>
    [HttpPost("ciclos/{id:guid}/ativar")]
    [RequirePermission("desempenho.ciclos.manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AtivarCiclo(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.AtivarCicloAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Registra respostas de avaliação. Faz upsert se o avaliador já respondeu sobre o mesmo avaliando.</summary>
    [HttpPost("ciclos/{id:guid}/responder")]
    [RequirePermission("desempenho.view")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Responder(Guid id, [FromBody] AvaliacaoResponderRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } avaliadorId)
            return Forbid();

        if (request.Respostas is null || request.Respostas.Count == 0)
            return BadRequest(new { message = "Informe ao menos uma resposta." });

        try
        {
            await _service.ResponderAsync(id, avaliadorId, request, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Fecha o ciclo. Após isso não é possível mais responder.</summary>
    [HttpPost("ciclos/{id:guid}/fechar")]
    [RequirePermission("desempenho.ciclos.manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> FecharCiclo(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.FecharCicloAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Resultados do ciclo: score médio por avaliando.</summary>
    [HttpGet("ciclos/{id:guid}/resultados")]
    [RequirePermission("desempenho.view")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoResultadoRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Resultados(Guid id, CancellationToken ct) =>
        Ok(await _service.ListResultadosAsync(id, ct));

    /// <summary>Exporta os resultados do ciclo em CSV (inclui calibragem quando disponível).</summary>
    [HttpGet("ciclos/{id:guid}/resultados/export")]
    [RequirePermission("desempenho.export")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportResultados(Guid id, CancellationToken ct)
    {
        var bytes = await _service.ExportarResultadosCsvAsync(id, ct);
        return File(bytes, "text/csv; charset=utf-8", $"ciclo_{id}_resultados.csv");
    }

    // ── Convites ──

    /// <summary>Lista os convites do ciclo.</summary>
    [HttpGet("ciclos/{id:guid}/convites")]
    [RequirePermission("desempenho.view")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoConviteResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarConvites(Guid id, CancellationToken ct) =>
        Ok(await _conviteService.ListarPorCicloAsync(id, ct));

    /// <summary>Gera convites de avaliação para um ciclo seguindo a hierarquia. Opcionalmente envia e-mail. Idempotente.</summary>
    [HttpPost("ciclos/{id:guid}/convites/gerar")]
    [RequirePermission("desempenho.convites.manage")]
    [ProducesResponseType(typeof(AvaliacaoGerarConvitesResultado), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GerarConvites(Guid id, [FromBody] AvaliacaoGerarConvitesRequest? request, CancellationToken ct)
    {
        try
        {
            var result = await _conviteService.GerarConvitesAsync(id, request ?? new AvaliacaoGerarConvitesRequest(), ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Lista os convites pendentes do avaliador logado em ciclos abertos.</summary>
    [HttpGet("convites/meus-pendentes")]
    [RequirePermission("desempenho.view")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoConviteResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> MeusConvitesPendentes(CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } avaliadorId)
            return Forbid();

        return Ok(await _conviteService.ListarPendentesDoAvaliadorAsync(avaliadorId, ct));
    }

    // ── Calibragem ──

    /// <summary>Inicia a calibragem do ciclo (gera linhas a partir das respostas). Idempotente.</summary>
    [HttpPost("ciclos/{id:guid}/calibragem/iniciar")]
    [RequirePermission("desempenho.calibragem.manage")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> IniciarCalibragem(Guid id, CancellationToken ct)
    {
        try
        {
            var criadas = await _calibragemService.IniciarCalibragemAsync(id, ct);
            return Ok(new { linhasCriadas = criadas });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Lista as linhas de calibragem do ciclo.</summary>
    [HttpGet("ciclos/{id:guid}/calibragem")]
    [RequirePermission("desempenho.calibragem.manage")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoCalibragemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarCalibragem(Guid id, CancellationToken ct) =>
        Ok(await _calibragemService.ListarAsync(id, ct));

    /// <summary>Comitê ajusta nota/categoria de um avaliando, mantendo rastreio paralelo à nota do gestor.</summary>
    [HttpPut("ciclos/{id:guid}/calibragem/ajustar")]
    [RequirePermission("desempenho.calibragem.manage")]
    [ProducesResponseType(typeof(AvaliacaoCalibragemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AjustarCalibragem(Guid id, [FromBody] AvaliacaoCalibragemAjusteRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _calibragemService.AjustarAsync(id, request, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Gestor (palavra final) decide qual versão prevalece e, opcionalmente, gera o Nine Box amarrado ao ciclo.</summary>
    [HttpPost("ciclos/{id:guid}/calibragem/decidir")]
    [RequirePermission("desempenho.calibragem.decidir")]
    [ProducesResponseType(typeof(AvaliacaoCalibragemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DecidirCalibragem(Guid id, [FromBody] AvaliacaoCalibragemDecisaoRequest request, CancellationToken ct)
    {
        if (_userContext.UserId is not { } userId)
            return Forbid();

        try
        {
            var result = await _calibragemService.DecidirAsync(id, userId, request, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
