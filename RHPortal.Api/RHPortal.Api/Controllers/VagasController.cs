using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.Vagas.Handlers;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Gestão de vagas (uso interno do RH).
/// </summary>
[ApiController]
[Route("api/vagas")]
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
    /// <param name="areaId">Filtrar por área.</param>
    /// <param name="departmentId">Filtrar por departamento.</param>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<VagaListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<VagaListItemResponse>>> List(
        [FromQuery] string? q,
        [FromQuery] VagaStatus? status,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? departmentId,
        [FromServices] IListVagasHandler handler,
        CancellationToken ct)
    {
        Guid? effectiveAreaId;
        Guid? recrutadorUserId = null;
        if (_userContext.IsAdmin || _userContext.IsInRole("Owner"))
        {
            effectiveAreaId = areaId;
        }
        else
        {
            if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.AreaId.HasValue)
            {
                effectiveAreaId = _userContext.AreaId;
            }
            else if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue)
            {
                effectiveAreaId = null;
                recrutadorUserId = _userContext.UserId;
            }
            else
            {
                effectiveAreaId = areaId;
            }
        }

        var query = new VagaListQuery(q, status, effectiveAreaId, departmentId, recrutadorUserId);
        var items = await handler.HandleAsync(query, ct);
        return Ok(items);
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
            .Include(s => s.Solicitante).Include(s => s.Aprovador1).Include(s => s.Aprovador)
            .Where(s => s.VagaId == id).FirstOrDefaultAsync(ct);

        if (solic != null)
        {
            events.Add(new VagaHistoricoEvent("Solicitação de vaga criada", solic.Solicitante?.Name, solic.CreatedAtUtc, null, null));
            if (solic.ApprovedAtUtc.HasValue)
                events.Add(new VagaHistoricoEvent("Solicitação aprovada pelo gestor", solic.Aprovador1?.Name ?? solic.Aprovador?.Name, solic.ApprovedAtUtc.Value, null, null));
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
                .Where(c => c.PrimaryKeyJson.Contains(id.ToString()) && c.EntityName == "Vaga")
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
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        if (item is null)
            return NotFound();
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
        {
            if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.AreaId.HasValue && item.AreaId != _userContext.AreaId)
                return NotFound();
            if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue && item.RecrutadorResponsavelUserId != _userContext.UserId)
                return NotFound();
        }
        return Ok(item);
    }

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
}
