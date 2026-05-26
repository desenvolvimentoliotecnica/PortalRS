using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Painel unificado de integração TOTVS — consolida todas as solicitações aprovadas
/// para acompanhamento de envio ao Progress Datasul.
/// </summary>
[ApiController]
[Route("api/integracao-totvs")]
[Authorize]
public sealed class IntegracaoTotvsController : ControllerBase
{
    private readonly IIntegracaoTotvsService _service;
    private readonly ITenantConfiguracaoService _tenantConfiguracaoService;
    private readonly ICurrentUserContext _userContext;

    public IntegracaoTotvsController(
        IIntegracaoTotvsService service,
        ITenantConfiguracaoService tenantConfiguracaoService,
        ICurrentUserContext userContext)
    {
        _service = service;
        _tenantConfiguracaoService = tenantConfiguracaoService;
        _userContext = userContext;
    }

    /// <summary>Lista o painel unificado de integração com filtros e paginação.</summary>
    /// <remarks>
    /// Usado pelo portal — retorna TUDO (Pendente, Sucesso, Falha, FalhaDefinitiva).
    /// Para consumo pelo integrador TOTVS, use o endpoint dedicado <c>GET /pendentes</c>.
    /// </remarks>
    [HttpGet("painel")]
    [ProducesResponseType(typeof(IntegracaoTotvsPainelResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPainel(
        [FromQuery] TipoIntegracao? tipo,
        [FromQuery] IntegracaoResultado? resultado,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var query = new IntegracaoTotvsPainelQuery(tipo, resultado, search, skip, take);
        return Ok(await _service.ListPainelAsync(query, ct));
    }

    /// <summary>Dashboard agregado das requisições de pessoal integradas ao RM.</summary>
    [HttpGet("requisicoes-rm/dashboard")]
    [ProducesResponseType(typeof(RmRequisicoesDashboardResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> RmRequisicoesDashboard(
        [FromQuery] DateOnly? dataDe,
        [FromQuery] DateOnly? dataAte,
        CancellationToken ct)
    {
        return Ok(await _service.GetRmRequisicoesDashboardAsync(
            new RmRequisicoesDashboardQuery(dataDe, dataAte),
            ct));
    }

    /// <summary>
    /// Configuração por tenant da integração RM para criação de requisições de pessoal.
    /// </summary>
    [HttpGet("configuracao-rm-requisicao")]
    [ProducesResponseType(typeof(ConfiguracaoRmRequisicaoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetConfiguracaoRmRequisicao(CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        return Ok(await _tenantConfiguracaoService.GetRmRequisicaoConfigAsync(ct));
    }

    /// <summary>
    /// Salva a URL completa do endpoint RM e as credenciais BasicAuth por tenant.
    /// </summary>
    [HttpPut("configuracao-rm-requisicao")]
    [ProducesResponseType(typeof(ConfiguracaoRmRequisicaoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpsertConfiguracaoRmRequisicao(
        [FromBody] ConfiguracaoRmRequisicaoRequest request,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        if (!string.IsNullOrWhiteSpace(request.EndpointUrl)
            && !Uri.TryCreate(request.EndpointUrl.Trim(), UriKind.Absolute, out _))
        {
            return BadRequest(new { message = "Informe uma URL absoluta válida para o endpoint RM." });
        }

        return Ok(await _tenantConfiguracaoService.UpsertRmRequisicaoConfigAsync(request, ct));
    }

    /// <summary>
    /// Fila de integrações ainda não reportadas ao TOTVS (<c>integracaoResultado == null</c>).
    /// </summary>
    /// <remarks>
    /// Endpoint dedicado ao integrador Node.js. Não retorna registros com Sucesso nem Falha —
    /// quando o ERP já reportou resultado, o item só reaparece aqui após retry manual
    /// (<c>POST /{tipo}/{id}/retry</c>).
    /// </remarks>
    [HttpGet("pendentes")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPendentes(
        [FromQuery] TipoIntegracao? tipo,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        // Reusa o painel com filtro fixo "ainda não reportado".
        var full = await _service.ListPainelAsync(
            new IntegracaoTotvsPainelQuery(tipo, null, search, 0, int.MaxValue), ct);
        var pendentes = full.Items.Where(i => i.IntegracaoResultado is null).ToList();
        var page = pendentes.Skip(skip).Take(take)
            .Select(i => new
            {
                i.Id,
                i.TipoIntegracao,
                i.TipoIntegracaoLabel,
                i.Nome,
                i.Cpf,
                i.Descricao,
                approvedAtUtc = TotvsPayloadHelper.FormatDate(i.ApprovedAtUtc),
                i.IntegracaoResultado,
                i.IntegracaoMensagem,
                integradaEmUtc = TotvsPayloadHelper.FormatDate(i.IntegradaEmUtc),
            })
            .ToList();
        return Ok(new { items = page, total = pendentes.Count, pendentes = pendentes.Count, sucesso = 0, falha = 0 });
    }

    /// <summary>Retorna todos os dados de uma solicitação específica para integração.</summary>
    [HttpGet("{tipo:int}/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetalhe(int tipo, Guid id, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        var result = await _service.GetDetalheAsync((TipoIntegracao)tipo, id, ct);
        return result is null ? NotFound(new { message = "Registro não encontrado." }) : Ok(result);
    }

    /// <summary>Registra o resultado de uma integração (sucesso ou falha).</summary>
    /// <remarks>
    /// <c>resultado</c> aceita apenas os valores do enum <c>IntegracaoResultado</c>:
    /// <list type="bullet">
    ///   <item><c>1</c> ou <c>"Sucesso"</c> — integração concluída com sucesso</item>
    ///   <item><c>2</c> ou <c>"Falha"</c> — falhou, pode tentar novamente</item>
    ///   <item><c>3</c> ou <c>"FalhaDefinitiva"</c> — falha sem retry automático</item>
    /// </list>
    /// Qualquer outro valor (<c>0</c>, <c>null</c>, strings desconhecidas) retorna HTTP 400.
    /// </remarks>
    [HttpPost("{tipo:int}/{id:guid}/resultado")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegistrarResultado(
        int tipo,
        Guid id,
        [FromBody] IntegracaoTotvsResultadoRequest request,
        CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        // Validação explícita — o binder do System.Text.Json aceita qualquer short
        // como enum, então precisa filtrar valores fora do conjunto definido.
        if (!Enum.IsDefined(typeof(IntegracaoResultado), request.Resultado))
            return BadRequest(new
            {
                message = "Campo 'resultado' inválido. Valores aceitos: 'Sucesso' (1), 'Falha' (2) ou 'FalhaDefinitiva' (3).",
                recebido = (int)request.Resultado
            });

        try
        {
            await _service.RegistrarResultadoAsync((TipoIntegracao)tipo, id, request, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Relatório de reconciliação: pendentes e com falha há mais de N dias.</summary>
    [HttpGet("reconciliacao")]
    [ProducesResponseType(typeof(IntegracaoReconciliacaoResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reconciliacao(
        [FromQuery] int diasMinimos = 2,
        CancellationToken ct = default)
    {
        return Ok(await _service.ReconciliacaoAsync(diasMinimos, ct));
    }

    /// <summary>
    /// Força a efetivação manual de uma integração que ficou sem resposta do TOTVS.
    /// Registra Sucesso e executa todos os efeitos colaterais (materializar funcionário, fechar headcount, etc.),
    /// registrando que a efetivação foi realizada manualmente e por quem.
    /// Retorna HTTP 409 se a integração já possui resultado Sucesso.
    /// </summary>
    [HttpPost("{tipo:int}/{id:guid}/efetivar-manual")]
    [ProducesResponseType(typeof(EfetivarManualResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EfetivarManual(int tipo, Guid id, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        try
        {
            var result = await _service.EfetivarManualAsync(
                (TipoIntegracao)tipo, id, _userContext.FuncionarioId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Reenvia uma integração (limpa resultado para reprocessamento).</summary>
    [HttpPost("{tipo:int}/{id:guid}/retry")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Retry(
        int tipo,
        Guid id,
        CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        try
        {
            await _service.RetryAsync((TipoIntegracao)tipo, id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Volta uma integração para o estado pendente (sem resultado), reiniciando o fluxo do zero.
    /// Para desligamentos em <c>Concluida</c>, reverte o status para <c>EmIntegracao</c>.
    /// Registra no histórico de status quem realizou a operação.
    /// </summary>
    [HttpPost("{tipo:int}/{id:guid}/voltar-pendente")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VoltarPendente(int tipo, Guid id, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        try
        {
            await _service.VoltarPendenteAsync((TipoIntegracao)tipo, id, _userContext, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
