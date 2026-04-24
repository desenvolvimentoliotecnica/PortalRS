using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Templates editáveis das notificações automáticas de mudança de etapa de candidatura
/// (e-mail + WhatsApp). A matriz tem 7 etapas × 2 canais = 14 linhas. Cada linha pode
/// ser sobrescrita por tenant; sem override, o serviço usa o default hardcoded.
/// Usado pela tela admin <c>/administracao/notificacoes-templates</c>.
/// </summary>
[ApiController]
[Route("api/notificacoes-templates")]
[RequireModule("recrutamento")]
public sealed class NotificacoesTemplatesController : ControllerBase
{
    private readonly INotificacaoTemplateService _service;

    public NotificacoesTemplatesController(INotificacaoTemplateService service)
    {
        _service = service;
    }

    /// <summary>
    /// Lista a matriz completa (14 linhas). Cada item indica se é override do tenant
    /// ou default hardcoded (<c>UsaDefault=true</c>).
    /// </summary>
    [HttpGet]
    [RequirePermission("audit.view")]
    [ProducesResponseType(typeof(IReadOnlyList<NotificacaoTemplateItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NotificacaoTemplateItem>>> Listar(CancellationToken ct)
    {
        var matriz = await _service.ListarMatrizAsync(ct);
        return Ok(matriz);
    }

    /// <summary>
    /// Salva (upsert) um template para uma combinação etapa × canal. Se o corpo e o
    /// assunto forem iguais ao default hardcoded, o override é removido (volta ao default).
    /// Idempotente.
    /// </summary>
    [HttpPost]
    [RequirePermission("audit.view")]
    [ProducesResponseType(typeof(NotificacaoTemplateItem), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NotificacaoTemplateItem>> Salvar(
        [FromBody] NotificacaoTemplateSaveRequest request,
        CancellationToken ct)
    {
        try
        {
            var salvo = await _service.SaveAsync(
                request.Etapa, request.Canal,
                request.Assunto, request.Corpo, ct);
            return Ok(salvo);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Remove o override de uma combinação etapa × canal. A partir daí, o serviço
    /// volta a usar o default hardcoded. Idempotente — 200 mesmo quando não havia override.
    /// </summary>
    [HttpDelete("{etapa}/{canal}")]
    [RequirePermission("audit.view")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RestaurarDefault(
        EtapaMacroCandidatura etapa,
        CanalNotificacao canal,
        CancellationToken ct)
    {
        await _service.RestoreDefaultAsync(etapa, canal, ct);
        return NoContent();
    }
}
