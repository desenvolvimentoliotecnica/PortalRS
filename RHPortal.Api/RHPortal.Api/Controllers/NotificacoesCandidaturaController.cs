using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Auditoria das notificações de mudança de etapa (e-mail + WhatsApp).
/// Cada transição registra um log por canal avaliado — mesmo quando o envio é pulado
/// por falta de opt-in ou destino. Esta controller expõe a listagem para a tela admin
/// <c>/administracao/notificacoes-candidatura</c>.
/// </summary>
[ApiController]
[Route("api/notificacoes-candidatura")]
[RequireModule("recrutamento")]
public sealed class NotificacoesCandidaturaController : ControllerBase
{
    private readonly ICandidaturaNotificacaoService _service;

    public NotificacoesCandidaturaController(ICandidaturaNotificacaoService service)
    {
        _service = service;
    }

    /// <summary>
    /// Lista os logs de notificação com filtros opcionais. Ordenação fixa em
    /// <c>CriadoEmUtc</c> desc. Paginação server-side (máx. 200 itens por página).
    /// </summary>
    [HttpGet("logs")]
    [RequirePermission("audit.view")]
    [ProducesResponseType(typeof(NotificacaoCandidaturaLogsResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<NotificacaoCandidaturaLogsResponse>> Listar(
        [FromQuery] Guid? candidatoId,
        [FromQuery] Guid? candidaturaId,
        [FromQuery] CanalNotificacao? canal,
        [FromQuery] NotificacaoStatus? status,
        [FromQuery] EtapaMacroCandidatura? etapa,
        [FromQuery] DateTimeOffset? dataInicioUtc,
        [FromQuery] DateTimeOffset? dataFimUtc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var resp = await _service.ListarLogsAsync(
            candidatoId, candidaturaId, canal, status, etapa,
            dataInicioUtc, dataFimUtc, page, pageSize, ct);
        return Ok(resp);
    }
}
