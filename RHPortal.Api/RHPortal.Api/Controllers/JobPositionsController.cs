using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.JobPositions;
using RhPortal.Api.Application.JobPositions.Handlers;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.JobPositions;
using RhPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de cargos (job positions).
/// </summary>
[ApiController]
[Route("api/job-positions")]
public sealed class JobPositionsController : ControllerBase
{
    /// <summary>
    /// Lista cargos com paginação e filtros.
    /// </summary>
    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(PagedResult<JobPositionGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<JobPositionGridRowResponse>>> List(
        [FromQuery] JobPositionListQuery query,
        [FromServices] IListJobPositionsHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(query, ct));

    /// <summary>
    /// Retorna lista simplificada de cargos para autocomplete/lookup.
    /// </summary>
    [HttpGet("lookup")]
    [ProducesResponseType(typeof(List<JobPositionLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<JobPositionLookupItem>>> Lookup(
        [FromQuery] string? search,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var query = db.JobPositions
            .AsNoTracking()
            .Include(x => x.Area)
            .Where(x => x.Status == CargoStatus.Active);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(s) ||
                x.Code.ToLower().Contains(s));
        }

        var items = await query
            .OrderBy(x => x.Name)
            .Take(50)
            .Select(x => new JobPositionLookupItem(
                x.Id,
                x.Code,
                x.Name,
                x.AreaId,
                x.Area != null ? x.Area.Name : null,
                x.Seniority.ToString(),
                x.TotvsCargoBasicId))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Consulta um cargo pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(JobPositionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<JobPositionResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetJobPositionByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo cargo.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(JobPositionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<JobPositionResponse>> Create(
        [FromBody] JobPositionCreateRequest request,
        [FromServices] ICreateJobPositionHandler handler,
        CancellationToken ct)
    {
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
    /// Atualiza um cargo.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(JobPositionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<JobPositionResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] JobPositionUpdateRequest request,
        [FromServices] IUpdateJobPositionHandler handler,
        CancellationToken ct)
    {
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
    /// Importação em lote de cargos. Cria novos ou atualiza existentes pelo código.
    /// Suporta até 5.000 registros por requisição.
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(JobPositionImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<JobPositionImportResult>> Import(
        [FromBody] List<JobPositionImportItem> items,
        [FromServices] IJobPositionService service,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Lista de itens vazia." });

        if (items.Count > 5000)
            return BadRequest(new { message = "Máximo de 5.000 registros por importação." });

        var result = await service.ImportAsync(items, ct);
        return Ok(result);
    }

    /// <summary>
    /// Pré-visualização da estrutura que seria criada para um cargo.
    /// Retorna os funcionários ativos agrupados por (Unidade de Lotação + Centro de Custo).
    /// </summary>
    [HttpGet("{id:guid}/preview-estrutura")]
    [ProducesResponseType(typeof(List<PreviewEstruturaGrupoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<List<PreviewEstruturaGrupoDto>>> PreviewEstrutura(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var cargo = await db.JobPositions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (cargo is null) return NotFound();

        var funcionarios = await db.Funcionarios
            .AsNoTracking()
            .Include(f => f.UnidadeLotacao)
            .Include(f => f.CentroCusto)
            .Where(f => f.JobPositionId == id && f.Status == FuncionarioStatus.Active)
            .Select(f => new
            {
                f.Id, f.Name,
                f.UnidadeLotacaoId,
                UnidadeNome = f.UnidadeLotacao != null ? f.UnidadeLotacao.Description : null,
                f.CentroCustoId,
                CentroCustoNome = f.CentroCusto != null ? f.CentroCusto.Description : null,
            })
            .ToListAsync(ct);

        // IDs de vagas estruturais já existentes para este cargo
        var vagasExistentes = await db.Vagas
            .AsNoTracking()
            .Where(v => v.JobPositionId == id && v.IsEstrutural)
            .Select(v => new { v.UnidadeLotacaoId, v.CentroCustoId })
            .ToListAsync(ct);

        var grupos = funcionarios
            .GroupBy(f => new { f.UnidadeLotacaoId, f.CentroCustoId })
            .Select(g => new PreviewEstruturaGrupoDto(
                g.Key.UnidadeLotacaoId,
                g.First().UnidadeNome,
                g.Key.CentroCustoId,
                g.First().CentroCustoNome,
                g.Select(f => new PreviewEstruturaFuncionarioDto(f.Id, f.Name)).ToList(),
                vagasExistentes.Any(v => v.UnidadeLotacaoId == g.Key.UnidadeLotacaoId && v.CentroCustoId == g.Key.CentroCustoId)
            ))
            .ToList();

        return Ok(grupos);
    }

    /// <summary>
    /// Cria posições estruturais (vagas preenchidas) a partir dos funcionários ativos do cargo,
    /// agrupados por (Unidade de Lotação + Centro de Custo). Operação idempotente.
    /// </summary>
    [HttpPost("{id:guid}/vagas-estruturais")]
    [ProducesResponseType(typeof(CriarEstruturasResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CriarEstruturasResultDto>> CriarVagasEstruturais(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] IOcupacaoHistoricoService ocupacaoService,
        CancellationToken ct)
    {
        var cargo = await db.JobPositions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (cargo is null) return NotFound();

        // TenantId extraído do primeiro funcionário ativo do cargo
        var refFuncionario = await db.Funcionarios
            .AsNoTracking()
            .Where(f => f.JobPositionId == id && f.Status == FuncionarioStatus.Active)
            .Select(f => new { f.TenantId })
            .FirstOrDefaultAsync(ct);

        if (refFuncionario is null)
            return Ok(new CriarEstruturasResultDto(0, 0, 0));

        var funcionarios = await db.Funcionarios
            .AsNoTracking()
            .Where(f => f.JobPositionId == id && f.Status == FuncionarioStatus.Active)
            .Select(f => new { f.Id, f.Name, f.UnidadeLotacaoId, f.CentroCustoId, f.TenantId })
            .ToListAsync(ct);

        int vagasCriadas = 0, vagasExistentes = 0, ocupacoesCriadas = 0;
        var now = DateTime.UtcNow;

        var grupos = funcionarios.GroupBy(f => new { f.UnidadeLotacaoId, f.CentroCustoId });

        foreach (var grupo in grupos)
        {
            // Busca vaga estrutural já existente para essa combinação
            var vaga = await db.Vagas.FirstOrDefaultAsync(v =>
                v.JobPositionId == id &&
                v.UnidadeLotacaoId == grupo.Key.UnidadeLotacaoId &&
                v.CentroCustoId == grupo.Key.CentroCustoId &&
                v.IsEstrutural, ct);

            if (vaga is null)
            {
                vaga = new Vaga
                {
                    Id = Guid.NewGuid(),
                    TenantId = refFuncionario.TenantId,
                    Titulo = cargo.Name,
                    JobPositionId = id,
                    UnidadeLotacaoId = grupo.Key.UnidadeLotacaoId,
                    CentroCustoId = grupo.Key.CentroCustoId,
                    Status = VagaStatus.Preenchida,
                    IsEstrutural = true,
                    HeadcountAutorizado = grupo.Count(),
                    MatchMinimoPercentual = 70,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow,
                };
                db.Vagas.Add(vaga);
                await db.SaveChangesAsync(ct);
                vagasCriadas++;
            }
            else
            {
                vagasExistentes++;
            }

            // Criar ocupações para funcionários ainda sem registro ativo nesta vaga
            foreach (var func in grupo)
            {
                var jaExiste = await db.OcupacoesHistorico.AnyAsync(o =>
                    o.VagaId == vaga.Id &&
                    o.FuncionarioId == func.Id &&
                    o.DataSaida == null, ct);

                if (!jaExiste)
                {
                    await ocupacaoService.AbrirOcupacaoAsync(func.Id, vaga.Id, now, null, ct);
                    ocupacoesCriadas++;
                }
            }
        }

        return Ok(new CriarEstruturasResultDto(vagasCriadas, vagasExistentes, ocupacoesCriadas));
    }

    /// <summary>
    /// Cria posições estruturais para TODOS os cargos que possuem funcionários ativos.
    /// Idempotente — ignora vagas e ocupações já existentes.
    /// </summary>
    [HttpPost("vagas-estruturais-bulk")]
    [ProducesResponseType(typeof(CriarEstruturasResultDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CriarEstruturasResultDto>> CriarVagasEstruturaisBulk(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        // Busca todos os funcionários ativos que possuem cargo definido
        var funcionarios = await db.Funcionarios
            .AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active && f.JobPositionId != null)
            .Select(f => new { f.Id, f.JobPositionId, f.UnidadeLotacaoId, f.CentroCustoId, f.TenantId })
            .ToListAsync(ct);

        if (funcionarios.Count == 0)
            return Ok(new CriarEstruturasResultDto(0, 0, 0));

        // Carrega nomes de todos os cargos referenciados
        var cargoIds = funcionarios.Select(f => f.JobPositionId!.Value).Distinct().ToList();
        var cargos = await db.JobPositions
            .AsNoTracking()
            .Where(c => cargoIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var tenantId = funcionarios[0].TenantId;
        var now = DateTime.UtcNow;

        // Agrupa por (Cargo, UnidadeLotacao, CentroCusto) — mesma lógica do endpoint individual
        var grupos = funcionarios.GroupBy(f => new
        {
            CargoId = f.JobPositionId!.Value,
            f.UnidadeLotacaoId,
            f.CentroCustoId,
        }).ToList();

        // Carrega todas as vagas estruturais existentes para os cargos relevantes (batch único)
        var vagasExistentes = await db.Vagas
            .Where(v => v.IsEstrutural && cargoIds.Contains(v.JobPositionId!.Value))
            .ToListAsync(ct);

        // Indexa as vagas existentes para lookup O(1)
        var vagasIndex = vagasExistentes.ToDictionary(
            v => (v.JobPositionId!.Value, v.UnidadeLotacaoId, v.CentroCustoId));

        // Resolve ou cria vaga para cada grupo
        var vagaPorGrupo = new Dictionary<(Guid, Guid?, Guid?), Vaga>();
        var novasVagas = new List<Vaga>();

        foreach (var grupo in grupos)
        {
            var key = (grupo.Key.CargoId, grupo.Key.UnidadeLotacaoId, grupo.Key.CentroCustoId);
            if (vagasIndex.TryGetValue(key, out var vagaExistente))
            {
                vagaPorGrupo[key] = vagaExistente;
            }
            else
            {
                if (!cargos.TryGetValue(grupo.Key.CargoId, out var cargoNome))
                    cargoNome = "—";

                var nova = new Vaga
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Titulo = cargoNome,
                    JobPositionId = grupo.Key.CargoId,
                    UnidadeLotacaoId = grupo.Key.UnidadeLotacaoId,
                    CentroCustoId = grupo.Key.CentroCustoId,
                    Status = VagaStatus.Preenchida,
                    IsEstrutural = true,
                    HeadcountAutorizado = grupo.Count(),
                    MatchMinimoPercentual = 70,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow,
                };
                novasVagas.Add(nova);
                vagaPorGrupo[key] = nova;
            }
        }

        // Persiste todas as novas vagas em um único SaveChanges
        if (novasVagas.Count > 0)
        {
            db.Vagas.AddRange(novasVagas);
            await db.SaveChangesAsync(ct);
        }

        // Carrega todos os OcupacoesHistorico ativos para as vagas relevantes (batch único)
        var vagaIds = vagaPorGrupo.Values.Select(v => v.Id).ToList();
        var ocupacoesAtivas = await db.OcupacoesHistorico
            .Where(o => vagaIds.Contains(o.VagaId!.Value) && o.DataSaida == null)
            .Select(o => new { o.VagaId, o.FuncionarioId })
            .ToListAsync(ct);

        var ocupacoesIndex = ocupacoesAtivas
            .Select(o => (o.VagaId, o.FuncionarioId))
            .ToHashSet();

        // Cria OcupacoesHistorico faltantes em batch
        var novasOcupacoes = new List<OcupacaoHistorico>();
        foreach (var grupo in grupos)
        {
            var key = (grupo.Key.CargoId, grupo.Key.UnidadeLotacaoId, grupo.Key.CentroCustoId);
            var vaga = vagaPorGrupo[key];
            foreach (var func in grupo)
            {
                if (!ocupacoesIndex.Contains((vaga.Id, func.Id)))
                {
                    novasOcupacoes.Add(new OcupacaoHistorico
                    {
                        Id = Guid.NewGuid(),
                        VagaId = vaga.Id,
                        FuncionarioId = func.Id,
                        DataEntrada = now,
                    });
                }
            }
        }

        if (novasOcupacoes.Count > 0)
        {
            db.OcupacoesHistorico.AddRange(novasOcupacoes);
            await db.SaveChangesAsync(ct);
        }

        return Ok(new CriarEstruturasResultDto(novasVagas.Count, vagasExistentes.Count, novasOcupacoes.Count));
    }

    /// <summary>
    /// Remove um cargo.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteJobPositionHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}

// ── DTOs locais ──────────────────────────────────────────────────────────────

public sealed record PreviewEstruturaFuncionarioDto(Guid Id, string Nome);

public sealed record PreviewEstruturaGrupoDto(
    Guid? UnidadeLotacaoId,
    string? UnidadeNome,
    Guid? CentroCustoId,
    string? CentroCustoNome,
    List<PreviewEstruturaFuncionarioDto> Funcionarios,
    bool VagaJaExiste
);

public sealed record CriarEstruturasResultDto(
    int VagasCriadas,
    int VagasJaExistentes,
    int OcupacoesCriadas
);
