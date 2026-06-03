using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.Vagas.Handlers;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Gestão de vagas (uso interno do RH).
/// </summary>
[ApiController]
[Route("api/vagas")]
[RequireModule("recrutamento")]
public sealed class VagasController : ControllerBase
{
    private readonly ICurrentUserContext _userContext;
    private readonly IRHPortalAiMatchClient? _aiMatchClient;
    private readonly ITenantContext _tenantContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<VagasController> _logger;

    public VagasController(
        ICurrentUserContext userContext,
        ITenantContext tenantContext,
        IServiceScopeFactory scopeFactory,
        ILogger<VagasController> logger,
        IRHPortalAiMatchClient? aiMatchClient = null)
    {
        _userContext = userContext;
        _tenantContext = tenantContext;
        _scopeFactory = scopeFactory;
        _logger = logger;
        _aiMatchClient = aiMatchClient;
    }

    /// <summary>
    /// Lista vagas com filtros administrativos.
    /// </summary>
    /// <param name="q">Busca textual por título/código.</param>
    /// <param name="status">Status da vaga (Aberta, Fechada, etc.).</param>
    /// <param name="centroCustoId">Filtrar por centro de custo (absorveu Area/Department em 31.2).</param>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<VagaListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<VagaListItemResponse>>> List(
        [FromQuery] string? q,
        [FromQuery] VagaStatus? status,
        [FromQuery] Guid? centroCustoId,
        [FromServices] IListVagasHandler handler,
        CancellationToken ct)
    {
        // O escopo de segurança é aplicado no VagaService. Aqui, centroCustoId é apenas
        // filtro explícito da tela; forçar o CC do usuário esconderia vagas atribuídas a ele.
        var query = new VagaListQuery(q, status, centroCustoId, null);
        var items = await handler.HandleAsync(query, ct);
        return Ok(items);
    }

    /// <summary>
    /// Pipeline operacional de vagas — classifica vagas em 6 estágios baseados na situação
    /// atual do recrutamento (Recém-sincronizada, Em divulgação, Recrutamento ativo,
    /// Em seleção, Em proposta, Encerrada/Zumbi). Substitui a visão antiga baseada em
    /// SolicitacaoVaga (que ignorava vagas vindas do RM).
    /// </summary>
    /// <param name="origem">Filtra por origem (Manual, AumentoQuadro, SubstituicaoDesligamento, ...).</param>
    /// <param name="centroCustoId">Filtra por centro de custo.</param>
    /// <param name="q">Busca textual em título, código ou função TOTVS.</param>
    /// <param name="incluirZumbis">Quando false, omite vagas com CiclosAusenteRm >= 3.</param>
    [HttpGet("pipeline")]
    [ProducesResponseType(typeof(VagaPipelineResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<VagaPipelineResponse>> GetPipeline(
        [FromQuery] VagaOrigemTipo? origem,
        [FromQuery] Guid? centroCustoId,
        [FromQuery] string? q,
        [FromQuery] bool? incluirZumbis,
        [FromServices] IVagaPipelineService pipelineService,
        CancellationToken ct)
    {
        var filtros = new VagaPipelineFiltros(origem, centroCustoId, q, incluirZumbis ?? true);
        var result = await pipelineService.ListarAsync(filtros, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lista vagas aprovadas pelos superiores e que estão em rascunho,
    /// aguardando o RH preencher os detalhes para então liberar para o portal.
    /// </summary>
    [HttpGet("pendencias-rh")]
    [ProducesResponseType(typeof(IReadOnlyList<VagaListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<VagaListItemResponse>>> PendenciasRh(
        [FromServices] IListVagasPendenciasRhHandler handler,
        CancellationToken ct)
    {
        var items = await handler.HandleAsync(ct);
        Console.Error.WriteLine($"[pendencias-rh] Retornando {items.Count} vagas");
        return Ok(items);
    }

    /// <summary>
    /// Histórico de eventos da vaga (quem fez o quê, quando).
    /// </summary>
    [HttpGet("{id:guid}/historico")]
    [ProducesResponseType(typeof(IReadOnlyList<VagaHistoricoEvent>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistorico(
        [FromRoute] Guid id,
        [FromServices] IVagaService vagaService,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var events = new List<VagaHistoricoEvent>();

        // 1. Solicitação — quem solicitou, quem aprovou
        var solic = await db.SolicitacoesVaga.AsNoTracking()
            .Include(s => s.Solicitante).Include(s => s.Aprovador)
            .Where(s => s.VagaId == id).FirstOrDefaultAsync(ct);

        if (solic != null)
        {
            events.Add(new VagaHistoricoEvent("Solicitação de vaga criada", solic.Solicitante?.Name, solic.CreatedAtUtc, null, null));
            if (solic.ApprovedAtUtc.HasValue)
                events.Add(new VagaHistoricoEvent("Solicitação aprovada pelo gestor", solic.Aprovador?.Name, solic.ApprovedAtUtc.Value, null, null));

            // Etapas de aprovação individuais
            var etapas = await db.SolicitacoesAprovacaoEtapa.AsNoTracking()
                .Include(e => e.Aprovador)
                .Where(e => e.SolicitacaoId == solic.Id && e.Status != StatusAprovacao.Pendente)
                .OrderBy(e => e.Ordem)
                .ToListAsync(ct);

            if (etapas.Count > 0)
            {
                var assumedIds = etapas
                    .Where(e => e.AssumedByUserId.HasValue)
                    .Select(e => e.AssumedByUserId!.Value)
                    .Distinct()
                    .ToList();

                var assumedNames = new Dictionary<Guid, string?>();
                if (assumedIds.Count > 0)
                {
                    var rows = await db.Set<ApplicationUser>()
                        .AsNoTracking()
                        .IgnoreQueryFilters()
                        .Where(u => assumedIds.Contains(u.Id))
                        .Select(u => new { u.Id, Name = u.FullName != null && u.FullName != "" ? u.FullName : u.UserName })
                        .ToListAsync(ct);
                    foreach (var r in rows)
                        assumedNames[r.Id] = r.Name;
                }

                foreach (var etapa in etapas)
                {
                    if (!etapa.DataUtc.HasValue) continue;

                    string quemFez = etapa.AssumedByUserId.HasValue && assumedNames.TryGetValue(etapa.AssumedByUserId.Value, out var adminName)
                        ? adminName ?? "Admin"
                        : etapa.Aprovador?.Name ?? "—";

                    string acao = etapa.Status switch
                    {
                        StatusAprovacao.Aprovado  => $"Etapa aprovada: {etapa.Label}",
                        StatusAprovacao.Rejeitado => $"Etapa reprovada: {etapa.Label}",
                        StatusAprovacao.Cancelado => $"Etapa cancelada: {etapa.Label}",
                        _                         => $"Etapa concluída: {etapa.Label}",
                    };

                    events.Add(new VagaHistoricoEvent(acao, quemFez, etapa.DataUtc.Value, null, null));
                }
            }
        }

        // 2. Vaga criada
        var vaga = await db.Vagas.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vaga != null)
        {
            events.Add(new VagaHistoricoEvent("Vaga criada automaticamente", null, vaga.CreatedAtUtc, null, null));
            // Se dados foram preenchidos depois (UpdatedAt > CreatedAt + 1min)
            if (vaga.UpdatedAtUtc > vaga.CreatedAtUtc.AddMinutes(1))
                events.Add(new VagaHistoricoEvent("Dados da vaga atualizados pelo RH", null, vaga.UpdatedAtUtc, null, null));
            // Status: se não é mais rascunho
            if (vaga.Status != RHPortal.Api.Domain.Enums.VagaStatus.Rascunho && vaga.DataAbertura.HasValue)
                events.Add(new VagaHistoricoEvent($"Vaga publicada (status: {vaga.Status})", null, vaga.DataAbertura.Value, null, null));
        }

        // 3. Audit trail — mudanças na vaga (quem fez o quê)
        try
        {
            var auditChanges = await db.Set<RhPortal.Api.Auditing.Entities.AuditEntityChange>()
                .AsNoTracking()
                .Include(c => c.Transaction)
                .Where(c => EF.Functions.JsonContains(c.PrimaryKeyJson, $"{{\"Id\":\"{id}\"}}") && c.EntityName == "Vaga")
                .OrderBy(c => c.OccurredAt)
                .ToListAsync(ct);

            foreach (var change in auditChanges)
            {
                var user = change.Transaction?.UserName ?? "Sistema";
                var action = change.State switch
                {
                    "Modified" => $"Vaga editada ({change.ChangedColumns ?? "dados"})",
                    "Added" => "Vaga criada",
                    _ => $"Vaga {change.State}"
                };
                // Evitar duplicar evento de criação
                if (change.State != "Added")
                    events.Add(new VagaHistoricoEvent(action, user, change.OccurredAt, null, null));
            }
        }
        catch { /* Audit tables may not exist */ }

        // 4. Candidatos adicionados individualmente
        var candidatos = await db.Candidatos.AsNoTracking()
            .Where(c => c.VagaId == id)
            .OrderBy(c => c.CreatedAtUtc)
            .Select(c => new { c.Id, c.Nome, c.Email, c.CreatedAtUtc })
            .ToListAsync(ct);

        foreach (var c in candidatos)
            events.Add(new VagaHistoricoEvent($"Candidato adicionado: {c.Nome} ({c.Email})", null, c.CreatedAtUtc, c.Id, "candidato"));

        // 5. Pré-admissões iniciadas
        var candIds = candidatos.Select(c => c.Id).ToList();
        if (candIds.Count > 0)
        {
            var admissoes = await db.Set<RhPortal.Api.Domain.Entities.PreAdmissao>().AsNoTracking()
                .Where(pa => pa.CandidatoId.HasValue && candIds.Contains(pa.CandidatoId.Value))
                .Select(pa => new { pa.Nome, pa.CreatedAtUtc, pa.Status, pa.Email })
                .ToListAsync(ct);

            foreach (var a in admissoes)
            {
                events.Add(new VagaHistoricoEvent($"Admissão iniciada para {a.Nome}", null, a.CreatedAtUtc, null, null));
                if (a.Status >= RhPortal.Api.Domain.Enums.PreAdmissaoStatus.Preenchido)
                    events.Add(new VagaHistoricoEvent($"Admissão preenchida por {a.Nome}", null, a.CreatedAtUtc.AddSeconds(1), null, null));
            }
        }

        return Ok(events.OrderByDescending(e => e.DataHora).ToList());
    }

    /// <summary>
    /// Consulta uma vaga específica pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetVagaByIdHandler handler,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        if (item is null)
            return NotFound();
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
        {
            var assignedToCurrentAnalyst = _userContext.UserId.HasValue && await db.SolicitacoesVaga
                .AsNoTracking()
                .AnyAsync(s => s.VagaId == id && s.AnalistaRhResponsavelUserId == _userContext.UserId.Value, ct);

            if (!assignedToCurrentAnalyst
                && IsAnalistaRhRestrito()
                && _userContext.UserId.HasValue
                && item.RecrutadorResponsavelUserId != _userContext.UserId)
                return NotFound();

            if (!assignedToCurrentAnalyst
                && _userContext.VagasDataScope == VagasDataScope.ByArea
                && _userContext.CentroCustoId.HasValue
                && item.CentroCustoId != _userContext.CentroCustoId)
                return NotFound();
            if (!assignedToCurrentAnalyst
                && _userContext.VagasDataScope == VagasDataScope.ByRecrutador
                && _userContext.UserId.HasValue
                && item.RecrutadorResponsavelUserId != _userContext.UserId)
                return NotFound();
        }
        return Ok(item);
    }

    private bool IsAnalistaRhRestrito()
        => _userContext.IsInRole("Analista de RH") && !_userContext.IsInRole("Especialista de RH");

    /// <summary>
    /// Lista candidatos e talentos com score de matching para a vaga (embedding + vetorial + LLM 80/20).
    /// Sem fallback: exige RHPortal.Ai em execução.
    /// </summary>
    /// <param name="id">ID da vaga.</param>
    /// <param name="minScore">Score mínimo (0 a 100).</param>
    /// <param name="take">Quantidade de itens (10 a 100, default 20).</param>
    [HttpGet("{id:guid}/matching-candidates")]
    [ProducesResponseType(typeof(IReadOnlyList<MatchingCandidateItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<IReadOnlyList<MatchingCandidateItemResponse>>> GetMatchingCandidates(
        [FromRoute] Guid id,
        [FromServices] ICandidatoVagaMatchingScoreService? scoreStore,
        [FromQuery] int minScore = 0,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        if (_aiMatchClient == null)
            return StatusCode(503, new { message = "Serviço de matching por IA (RhAi/RHPortal.Ai) não configurado. Configure o cliente e execute o RHPortal.Ai." });

        IReadOnlyList<MatchingCandidateItemResponse>? unifiedItems;
        try
        {
            unifiedItems = await _aiMatchClient.RunUnifiedMatchingAsync(
                id,
                _tenantContext.TenantId ?? "",
                minScore,
                Math.Clamp(take, 10, 100),
                ct
            ).ConfigureAwait(false);
        }
        catch (Exception)
        {
            return StatusCode(503, new { message = "RHPortal.Ai indisponível ou falha ao calcular matching. Verifique se o serviço está rodando e se há embeddings para vaga, candidatos e talentos." });
        }

        if (unifiedItems == null)
            return StatusCode(503, new { message = "RHPortal.Ai indisponível ou falha ao calcular matching. Verifique se o serviço está rodando e se há embeddings para vaga, candidatos e talentos." });

        if (scoreStore != null)
            _ = PersistUnifiedRankingInBackgroundAsync(id, unifiedItems, _tenantContext.TenantId ?? "");

        return Ok(unifiedItems);
    }

    /// <summary>
    /// Retorna o ranking unificado (candidatos + talentos) a partir do cache persistido.
    /// Se não estiver pronto para os filtros atuais, inicia recálculo em background e retorna 202 com stale (se houver).
    /// </summary>
    /// <summary>
    /// Retorna o ranking unificado (candidatos + talentos) a partir do cache persistido.
    /// O cache sempre pré-armazena até 100 candidatos. O parâmetro <c>take</c> faz slice local (sem re-rodar IA).
    /// Se não estiver pronto para os filtros atuais, inicia recálculo em background e retorna 202 com stale (se houver).
    /// </summary>
    [HttpGet("{id:guid}/matching-ranking")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(object), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetMatchingRanking(
        [FromRoute] Guid id,
        [FromServices] IVagaUnifiedMatchingCacheService cacheService,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var safeTake = Math.Clamp(take, 10, 100);
        var startedAt = DateTimeOffset.UtcNow;

        // Sempre usa o cache de 100 — o slice é feito aqui, sem re-rodar IA
        var snapshot = await cacheService.GetOrStartAsync(id, take: 100, ct: ct);
        _logger.LogInformation(
            "Matching ranking snapshot. Tenant={TenantId} VagaId={VagaId} Take={Take} CachedTotal={CachedTotal} Status={Status} ElapsedMs={ElapsedMs}",
            _tenantContext.TenantId,
            id,
            safeTake,
            snapshot.Items.Count,
            snapshot.Status,
            (long)(DateTimeOffset.UtcNow - startedAt).TotalMilliseconds
        );

        if (snapshot.Status == RhPortal.Api.Domain.Entities.UnifiedMatchingCacheStatus.Ready)
        {
            return Ok(new
            {
                status = "ready",
                filtersHash = snapshot.FiltersHash,
                startedAtUtc = snapshot.StartedAtUtc,
                computedAtUtc = snapshot.ComputedAtUtc,
                cachedCount = snapshot.Items.Count,
                items = snapshot.Items.Take(safeTake).ToList()
            });
        }

        if (snapshot.Status == RhPortal.Api.Domain.Entities.UnifiedMatchingCacheStatus.Failed)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                status = "failed",
                filtersHash = snapshot.FiltersHash,
                startedAtUtc = snapshot.StartedAtUtc,
                computedAtUtc = snapshot.ComputedAtUtc,
                lastError = snapshot.LastError,
                staleItems = snapshot.StaleItems
            });
        }

        return Accepted(new
        {
            status = "processing",
            filtersHash = snapshot.FiltersHash,
            startedAtUtc = snapshot.StartedAtUtc,
            computedAtUtc = snapshot.ComputedAtUtc,
            staleItems = snapshot.StaleItems
        });
    }

    /// <summary>
    /// Cria uma nova vaga.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VagaResponse>> Create(
        [FromBody] VagaCreateRequest request,
        [FromServices] ICreateVagaHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
        try
        {
            var created = await handler.HandleAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Atualiza os dados de uma vaga existente.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VagaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] VagaUpdateRequest request,
        [FromServices] IUpdateVagaHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
        try
        {
            var updated = await handler.HandleAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Altera o status de uma vaga. Rascunho→Aberta exige campos obrigatórios preenchidos.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> ChangeStatus(
        [FromRoute] Guid id,
        [FromBody] ChangeVagaStatusRequest request,
        [FromServices] IVagaService vagaService,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && _userContext.IsReadOnly)
            return Forbid();
        try
        {
            var result = await vagaService.ChangeStatusAsync(id, request.Status, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Atualiza apenas os filtros de matching (IA) da vaga.
    /// </summary>
    [HttpPatch("{id:guid}/matching-filtros")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> UpdateMatchingFiltros(
        [FromRoute] Guid id,
        [FromBody] UpdateVagaMatchingFiltrosRequest request,
        [FromServices] IUpdateVagaMatchingFiltrosHandler handler,
        [FromServices] IVagaUnifiedMatchingCacheService unifiedCache,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
        try
        {
            var updated = await handler.HandleAsync(id, request ?? new UpdateVagaMatchingFiltrosRequest(null), ct);
            if (updated is null)
                return NotFound();
            // Dispara recálculo unificado em background; a tela lê do cache.
            _ = unifiedCache.InvalidateAndStartAsync(id, take: 100, ct: CancellationToken.None);
            return Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Atribui (ou desatribui, com null) uma vaga a um usuário recrutador.
    /// Restrito a Admin/RH/Owner — Recrutador comum NÃO pode atribuir vagas a outros recrutadores.
    /// (Feature "Atribuição de Vaga a Recrutador" — 2026-04-26.)
    /// </summary>
    [HttpPatch("{id:guid}/recrutador")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> AssignRecrutador(
        [FromRoute] Guid id,
        [FromBody] AssignRecrutadorRequest request,
        [FromServices] IVagaService vagaService,
        CancellationToken ct)
    {
        // Bloqueio role-based (sistema usa role + scope, não permission granular).
        // Recrutador (ByRecrutador) NÃO pode atribuir vagas a outros — apenas Admin/RH/Owner.
        var canAssign = _userContext.IsAdmin
                     || _userContext.IsInRole("Owner")
                     || _userContext.IsInRole("RH")
                     || _userContext.IsInRole("Administrador");
        if (!canAssign)
            return Forbid();

        try
        {
            var updated = await vagaService.AssignRecrutadorAsync(id, request?.RecrutadorResponsavelUserId, ct);
            return Ok(updated);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("não encontrada"))
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Aprova a alçada salarial de uma vaga fora da faixa cadastrada (épico Fase 3C).
    /// Após aprovação, a vaga pode ser salva mesmo com Salário fora da Faixa.
    /// </summary>
    [HttpPost("{id:guid}/aprovar-alcada-salarial")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> AprovarAlcadaSalarial(
        [FromRoute] Guid id,
        [FromBody] AprovarAlcadaSalarialRequest request,
        [FromServices] IVagaService vagaService,
        CancellationToken ct)
    {
        if (_userContext.IsReadOnly) return Forbid();
        if (!_userContext.IsAdmin && !_userContext.IsOwner && !_userContext.IsRH)
            return Forbid();

        try
        {
            var result = await vagaService.AprovarAlcadaSalarialAsync(id, request.Justificativa, request.ObservacaoAprovador, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Limpa uma alçada salarial previamente aprovada (volta a vaga a exigir faixa).</summary>
    [HttpPost("{id:guid}/limpar-alcada-salarial")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> LimparAlcadaSalarial(
        [FromRoute] Guid id,
        [FromServices] IVagaService vagaService,
        CancellationToken ct)
    {
        if (_userContext.IsReadOnly) return Forbid();
        if (!_userContext.IsAdmin && !_userContext.IsOwner && !_userContext.IsRH)
            return Forbid();

        var result = await vagaService.LimparAlcadaSalarialAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    private async Task RecalcMatchingScoresInBackgroundAsync(Guid vagaId, string tenantId)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var client = scope.ServiceProvider.GetService<IRHPortalAiMatchClient>();
            var scoreService = scope.ServiceProvider.GetService<ICandidatoVagaMatchingScoreService>();
            if (client == null || scoreService == null)
                return;
            // Usa matching unificado (vetorial + LLM 80/20); persiste só candidatos (tabela não guarda talentos)
            var list = await client.RunUnifiedMatchingAsync(vagaId, tenantId, minScore: 0, take: 20);
            var items = list?
                .Where(x => string.Equals(x.Source, "candidato", StringComparison.OrdinalIgnoreCase))
                .Select(x => (x.CandidatoId, x.Score))
                .ToList() ?? new List<(Guid, int)>();
            await scoreService.ReplaceScoresForVagaAsync(vagaId, items, tenantId);
        }
        catch
        {
            // best-effort; log em produção se desejar
        }
    }

    private async Task PersistUnifiedRankingInBackgroundAsync(Guid vagaId, IReadOnlyList<MatchingCandidateItemResponse> unifiedItems, string tenantId)
    {
        try
        {
            var items = unifiedItems
                .Where(x => string.Equals(x.Source, "candidato", StringComparison.OrdinalIgnoreCase))
                .Select(x => (x.CandidatoId, x.Score))
                .ToList();
            if (items.Count == 0) return;
            using var scope = _scopeFactory.CreateScope();
            var scoreService = scope.ServiceProvider.GetService<ICandidatoVagaMatchingScoreService>();
            if (scoreService == null) return;
            await scoreService.ReplaceScoresForVagaAsync(vagaId, items, tenantId);
        }
        catch
        {
            // best-effort
        }
    }

    /// <summary>
    /// Faz snooze do alerta de vaga sem preenchimento por N dias (padrão: 30).
    /// </summary>
    [HttpPost("{id:guid}/snooze-alerta")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SnoozeAlerta(
        [FromRoute] Guid id,
        [FromBody] SnoozeAlertaRequest? request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && _userContext.IsReadOnly) return Forbid();
        var vaga = await db.Vagas.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vaga is null) return NotFound();
        var dias = request?.DiasSnooze ?? 30;
        vaga.AlertaVagaSemFillSnoozeAteUtc = DateTimeOffset.UtcNow.AddDays(dias);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Reduz manualmente o HeadcountAutorizado de uma vaga (RH decide desativar posição aberta).
    /// </summary>
    [HttpPost("{id:guid}/reduzir-headcount")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReduzirHeadcount(
        [FromRoute] Guid id,
        [FromBody] ReduzirHeadcountRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && _userContext.IsReadOnly) return Forbid();
        var vaga = await db.Vagas.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vaga is null) return NotFound();
        if (request.NovoHeadcount < 1)
            return BadRequest(new { message = "O headcount mínimo é 1." });
        vaga.HeadcountAutorizado = request.NovoHeadcount;
        // Limpar alerta de snooze ao reduzir headcount (decisão tomada)
        vaga.AlertaVagaSemFillSnoozeAteUtc = null;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Remove uma vaga.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteVagaHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Retorna o histórico de ocupação (quem ocupou os slots) de uma vaga.
    /// </summary>
    [HttpGet("{id:guid}/ocupacoes")]
    [ProducesResponseType(typeof(IReadOnlyList<OcupacaoHistoricoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<OcupacaoHistoricoDto>>> GetOcupacoes(
        [FromRoute] Guid id,
        [FromServices] IOcupacaoHistoricoService service,
        CancellationToken ct)
    {
        var result = await service.GetByVagaAsync(id, ct);
        return Ok(result);
    }

    /// <summary>
    /// Atualiza apenas o HeadcountAutorizado de uma vaga.
    /// </summary>
    [HttpPatch("{id:guid}/headcount")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateHeadcount(
        [FromRoute] Guid id,
        [FromBody] UpdateHeadcountRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var vaga = await db.Vagas.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vaga is null) return NotFound();
        vaga.HeadcountAutorizado = Math.Max(1, request.HeadcountAutorizado);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Sessão 31.8 — Breakdown explicável do matching de um candidato em uma vaga.
    ///
    /// Retorna o score final + cada critério usado (Competência, Experiência,
    /// Formação, Localidade — distância em km, Idioma, Conhecimento Técnico,
    /// Vivência Específica) com peso configurado, sub-score, contribuição e
    /// itens cobertos/faltando para o RH entender por que o candidato bate
    /// (ou não) com a vaga.
    ///
    /// Requer que a vaga tenha <c>DescricaoCargoId</c> preenchido (template
    /// DNALIO). Para vagas sem template, usa o algoritmo legado (sem breakdown).
    /// </summary>
    [HttpGet("{id:guid}/matching-breakdown/{candidatoId:guid}")]
    [ProducesResponseType(typeof(RhPortal.Api.Application.Matching.MatchingBreakdown), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMatchingBreakdown(
        [FromRoute] Guid id,
        [FromRoute] Guid candidatoId,
        [FromServices] RhPortal.Api.Application.Matching.DescricaoCargoMatchingService descricaoCargoMatching,
        CancellationToken ct)
    {
        var breakdown = await descricaoCargoMatching.CalcularBreakdownAsync(candidatoId, id, ct);
        if (breakdown is null)
        {
            return NotFound(new
            {
                message = "Não foi possível calcular o breakdown — verifique se a vaga existe, tem DescricaoCargo vinculada (cadastro de Descrição de Cargos), e se o candidato existe."
            });
        }
        return Ok(breakdown);
    }

    /// <summary>
    /// Fase 4.R — Matching por LLM (Qwen 2.5). "LLM-as-a-Judge" — raciocínio profundo
    /// sobre CV × DescCargo estruturada + pesos calibrados. Retorna score 0-100 +
    /// justificativa em PT-BR + breakdown por critério com pontos fortes e gaps.
    ///
    /// <para>Cache automático: se CV + DescCargo + pesos não mudaram, retorna instantâneo.
    /// Caso contrário, chama Qwen (10-15s). Idempotente por hash SHA256.</para>
    ///
    /// <para>Use <c>?force=true</c> para forçar regeração.</para>
    /// </summary>
    /// <summary>
    /// Score LLM em cache apenas (sem invocar Gemini). Retorna 404 se ainda não houver análise gerada.
    /// </summary>
    [HttpGet("{id:guid}/matching-llm-cached/{candidatoId:guid}")]
    [ProducesResponseType(typeof(RhPortal.Api.Application.Ai.LlmMatchingResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMatchingLlmCached(
        [FromRoute] Guid id,
        [FromRoute] Guid candidatoId,
        [FromServices] RhPortal.Api.Application.Ai.ILlmMatchingService llmMatching,
        CancellationToken ct)
    {
        var result = await llmMatching.GetCachedScoreAsync(candidatoId, id, ct);
        if (result is null)
            return NotFound(new { message = "Nenhuma Análise IA em cache para este candidato — use o botão Análise IA." });
        return Ok(result);
    }

    [HttpGet("{id:guid}/matching-llm/{candidatoId:guid}")]
    [ProducesResponseType(typeof(RhPortal.Api.Application.Ai.LlmMatchingResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetMatchingLlm(
        [FromRoute] Guid id,
        [FromRoute] Guid candidatoId,
        [FromQuery] bool force,
        [FromServices] RhPortal.Api.Application.Ai.ILlmMatchingService llmMatching,
        CancellationToken ct)
    {
        try
        {
            var result = await llmMatching.ScoreAsync(candidatoId, id, force, ct);
            if (result is null)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Não foi possível gerar score por LLM. Verifique: (1) vaga tem DescricaoCargo vinculada, (2) provider de IA do tenant (Admin → IA) e chave Gemini no Owner → IA, (3) candidato válido."
                });
            }
            return Ok(result);
        }
        catch (RhPortal.Api.Application.Ai.LlmTimeoutException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Fase 4 — Matching HÍBRIDO (léxico 30% + semântico 50% + localidade 20%).
    /// Requer Ollama rodando + embeddings indexados. Se indisponíveis, retorna
    /// automaticamente o matching léxico com <c>Modo="fallback"</c>.
    /// </summary>
    [HttpGet("{id:guid}/matching-breakdown-hybrid/{candidatoId:guid}")]
    [ProducesResponseType(typeof(RhPortal.Api.Application.Matching.MatchingBreakdown), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMatchingBreakdownHybrid(
        [FromRoute] Guid id,
        [FromRoute] Guid candidatoId,
        [FromServices] RhPortal.Api.Application.Matching.HybridMatchingService hybrid,
        CancellationToken ct)
    {
        var breakdown = await hybrid.CalcularHybridAsync(candidatoId, id, ct);
        if (breakdown is null)
        {
            return NotFound(new { message = "Não foi possível calcular breakdown híbrido — verifique vaga, DescricaoCargo e candidato." });
        }
        return Ok(breakdown);
    }
}

public record UpdateHeadcountRequest(int HeadcountAutorizado);
public record SnoozeAlertaRequest(int DiasSnooze);
public record ReduzirHeadcountRequest(int NovoHeadcount);
