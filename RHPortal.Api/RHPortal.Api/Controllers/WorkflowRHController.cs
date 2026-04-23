using System.Text;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.WorkflowRH;
using RhPortal.Api.Contracts.WorkflowRH;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Workflow operacional do RH — steps de triagem (pré-efetivação) e revisão (pós-efetivação).
/// </summary>
[ApiController]
[Route("api/workflow-rh")]
public sealed class WorkflowRHController : ControllerBase
{
    private readonly IWorkflowRHService _service;

    public WorkflowRHController(IWorkflowRHService service) => _service = service;

    /// <summary>Lista workflows com filtro por tipo e status.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<WorkflowRHGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] WorkflowRHListQuery query, CancellationToken ct)
        => Ok(await _service.ListAsync(query, ct));

    /// <summary>Retorna um workflow por ID com todas as etapas.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WorkflowRHDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Busca workflow de triagem por VagaId.</summary>
    [HttpGet("by-vaga/{vagaId:guid}")]
    [ProducesResponseType(typeof(WorkflowRHDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByVaga(Guid vagaId, CancellationToken ct)
    {
        var result = await _service.GetByVagaIdAsync(vagaId, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Inicia uma etapa (muda status de NãoIniciada para EmAndamento).</summary>
    [HttpPost("{workflowId:guid}/etapas/{etapaId:guid}/iniciar")]
    [ProducesResponseType(typeof(EtapaWorkflowRHResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IniciarEtapa(Guid workflowId, Guid etapaId, CancellationToken ct)
    {
        var result = await _service.IniciarEtapaAsync(workflowId, etapaId, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Conclui uma etapa e avança para a próxima.</summary>
    [HttpPost("{workflowId:guid}/etapas/{etapaId:guid}/concluir")]
    [ProducesResponseType(typeof(EtapaWorkflowRHResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConcluirEtapa(Guid workflowId, Guid etapaId, [FromBody] ConcluirEtapaRequest request, CancellationToken ct)
    {
        var result = await _service.ConcluirEtapaAsync(workflowId, etapaId, request, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Pula uma etapa não-obrigatória.</summary>
    [HttpPost("{workflowId:guid}/etapas/{etapaId:guid}/pular")]
    [ProducesResponseType(typeof(EtapaWorkflowRHResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PularEtapa(Guid workflowId, Guid etapaId, [FromBody] PularEtapaRequest request, CancellationToken ct)
    {
        var result = await _service.PularEtapaAsync(workflowId, etapaId, request, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Assumir responsabilidade por uma etapa (fila de perfil).</summary>
    [HttpPost("{workflowId:guid}/etapas/{etapaId:guid}/assumir")]
    [ProducesResponseType(typeof(EtapaWorkflowRHResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssumirEtapa(Guid workflowId, Guid etapaId, CancellationToken ct)
    {
        var result = await _service.AssumirEtapaAsync(workflowId, etapaId, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Salva dados parciais de uma etapa sem alterar status.</summary>
    [HttpPut("{workflowId:guid}/etapas/{etapaId:guid}/dados")]
    [ProducesResponseType(typeof(EtapaWorkflowRHResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SalvarDados(Guid workflowId, Guid etapaId, [FromBody] SalvarDadosEtapaRequest request, CancellationToken ct)
    {
        var result = await _service.SalvarDadosEtapaAsync(workflowId, etapaId, request, ct);
        return result is not null ? Ok(result) : NotFound();
    }

    /// <summary>Cancela o workflow inteiro.</summary>
    [HttpPost("{workflowId:guid}/cancelar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancelar(Guid workflowId, CancellationToken ct)
    {
        var ok = await _service.CancelarAsync(workflowId, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>Exporta lista de workflows em CSV.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] WorkflowRHListQuery query, CancellationToken ct)
    {
        var rows = await _service.ListAsync(query, ct);
        var sb = new StringBuilder();
        sb.AppendLine("Vaga/Candidato;Tipo;Status;Etapa Atual;Responsável;SLA;Data");
        foreach (var r in rows)
        {
            var sujeito = r.VagaTitulo ?? r.CandidatoNome ?? "—";
            var sla = r.SlaPrazoDias.HasValue ? $"{r.SlaPrazoDias}d{(r.SlaExcedido ? " (excedido)" : "")}" : "—";
            sb.AppendLine($"{sujeito};{r.TipoWorkflowLabel};{r.StatusLabel};{r.EtapaAtualLabel ?? "—"};{r.ResponsavelNome ?? "—"};{sla};{r.CreatedAtUtc:dd/MM/yyyy}");
        }
        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv; charset=utf-8", "recrutamento.csv");
    }

    /// <summary>Histórico de alterações do workflow (auditoria de quem alterou dados do gestor).</summary>
    [HttpGet("{workflowId:guid}/historico")]
    [ProducesResponseType(typeof(IReadOnlyList<HistoricoAlteracaoResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistorico(Guid workflowId, [FromQuery] Guid? etapaId, CancellationToken ct)
        => Ok(await _service.GetHistoricoAsync(workflowId, etapaId, ct));
}
