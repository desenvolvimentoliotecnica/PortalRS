using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.MicrosoftGraph;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Infrastructure.Tenancy;
using System.Text;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Configurações gerais do tenant (ex: fluxo de aprovação com etapa RH).
/// Acesso restrito a Admin.
/// </summary>
[ApiController]
[Route("api/tenant-configuracao")]
public sealed class TenantConfiguracaoController : ControllerBase
{
    private readonly ITenantConfiguracaoService _service;
    private readonly IMicrosoftGraphCalendarService _graphCalendarService;
    private readonly ICurrentUserContext _userContext;

    public TenantConfiguracaoController(
        ITenantConfiguracaoService service,
        IMicrosoftGraphCalendarService graphCalendarService,
        ICurrentUserContext userContext)
    {
        _service = service;
        _graphCalendarService = graphCalendarService;
        _userContext = userContext;
    }

    /// <summary>Retorna a configuração atual do tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(TenantConfiguracaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var dto = await _service.GetAsync(ct);
        return Ok(dto);
    }

    /// <summary>Cria ou atualiza a configuração do tenant (somente Admin).</summary>
    [HttpPut]
    [ProducesResponseType(typeof(TenantConfiguracaoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] TenantConfiguracaoUpsertRequest request, CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var dto = await _service.UpsertAsync(request, ct);
        return Ok(dto);
    }

    [HttpGet("rm-importacao-automatica/execucoes")]
    [ProducesResponseType(typeof(IReadOnlyList<RmImportacaoAutomaticaRunDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRmImportacaoAutomaticaRuns([FromQuery] int take = 50, CancellationToken ct = default)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var runs = await _service.ListRmImportacaoAutomaticaRunsAsync(take, ct);
        return Ok(runs);
    }

    [HttpGet("rm-importacao-automatica/execucoes/ultima/log")]
    public async Task<IActionResult> DownloadLastRmImportacaoAutomaticaRunLog(CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var log = await _service.GetRmImportacaoAutomaticaRunLogAsync(null, ct);
        if (log is null)
            return NotFound(new { message = "Nenhuma execução automática RM encontrada." });

        return File(Encoding.UTF8.GetBytes(log.Content), "text/plain; charset=utf-8", log.FileName);
    }

    [HttpGet("rm-importacao-automatica/execucoes/{id:guid}/log")]
    public async Task<IActionResult> DownloadRmImportacaoAutomaticaRunLog(Guid id, CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var log = await _service.GetRmImportacaoAutomaticaRunLogAsync(id, ct);
        if (log is null)
            return NotFound(new { message = "Execução automática RM não encontrada." });

        return File(Encoding.UTF8.GetBytes(log.Content), "text/plain; charset=utf-8", log.FileName);
    }

    // ────────── IA por tenant (Fase 3 LLM-agnóstico) ──────────

    /// <summary>
    /// Retorna a configuração de IA do tenant (provider/modelo de chat e embeddings),
    /// junto com o "effective" depois de resolver fallbacks e a lista de providers
    /// conhecidos pelo factory.
    /// </summary>
    [HttpGet("ai")]
    [ProducesResponseType(typeof(TenantAiConfigDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAiConfig(CancellationToken ct)
    {
        var dto = await _service.GetAiConfigAsync(ct);
        return Ok(dto);
    }

    /// <summary>
    /// Atualiza a configuração de IA do tenant. Strings vazias/whitespace viram <c>null</c>
    /// (= herda o default global do <c>appsettings.Ai</c>). Somente Admin.
    /// </summary>
    [HttpPut("ai")]
    [ProducesResponseType(typeof(TenantAiConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpsertAiConfig([FromBody] TenantAiConfigRequest request, CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var dto = await _service.UpsertAiConfigAsync(request, ct);
        return Ok(dto);
    }

    // ────────── Microsoft Graph — Agenda (Outlook) ──────────

    /// <summary>Retorna a configuração de integração com Microsoft Graph para agenda.</summary>
    [HttpGet("microsoft-graph-calendar")]
    [ProducesResponseType(typeof(GraphCalendarConfigView), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGraphCalendarConfig(CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var dto = await _graphCalendarService.GetConfigAsync(ct);
        return Ok(dto);
    }

    /// <summary>Salva a configuração de integração com Microsoft Graph para agenda.</summary>
    [HttpPut("microsoft-graph-calendar")]
    [ProducesResponseType(typeof(GraphCalendarConfigView), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpsertGraphCalendarConfig(
        [FromBody] GraphCalendarConfigRequest request,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var dto = await _graphCalendarService.SaveConfigAsync(request, ct);
        return Ok(dto);
    }

    /// <summary>Testa a conexão com Microsoft Graph e retorna eventos da agenda do UPN configurado.</summary>
    [HttpPost("microsoft-graph-calendar/test")]
    [ProducesResponseType(typeof(GraphCalendarTestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> TestGraphCalendarConnection(CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var result = await _graphCalendarService.TestConnectionAsync(ct);
        return Ok(result);
    }
}
