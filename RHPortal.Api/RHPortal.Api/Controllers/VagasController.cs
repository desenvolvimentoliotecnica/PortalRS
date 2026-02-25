using System.Linq;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Vagas.Handlers;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Infrastructure.Tenancy;
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

    public VagasController(
        ICurrentUserContext userContext,
        ITenantContext tenantContext,
        IServiceScopeFactory scopeFactory,
        IRHPortalAiMatchClient? aiMatchClient = null)
    {
        _userContext = userContext;
        _tenantContext = tenantContext;
        _scopeFactory = scopeFactory;
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
            return StatusCode(503, new { message = "Serviço de matching por IA (RHPortal.Ai) não configurado. Configure o cliente e execute o RHPortal.Ai." });

        var unifiedItems = await _aiMatchClient.RunUnifiedMatchingAsync(
            id,
            _tenantContext.TenantId ?? "",
            minScore,
            Math.Clamp(take, 10, 100),
            ct
        ).ConfigureAwait(false);

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
        var snapshot = await cacheService.GetOrStartAsync(id, take, ct);

        if (snapshot.Status == RhPortal.Api.Domain.Entities.UnifiedMatchingCacheStatus.Ready)
        {
            return Ok(new
            {
                status = "ready",
                filtersHash = snapshot.FiltersHash,
                computedAtUtc = snapshot.ComputedAtUtc,
                items = snapshot.Items
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
        var updated = await handler.HandleAsync(id, request ?? new UpdateVagaMatchingFiltrosRequest(null), ct);
        if (updated is null)
            return NotFound();
        // Dispara recálculo unificado em background; a tela lê do cache.
        _ = unifiedCache.InvalidateAndStartAsync(id, take: 20, ct: CancellationToken.None);
        return Ok(updated);
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
