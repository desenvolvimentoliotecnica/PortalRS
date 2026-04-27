using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.CentroCusto;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Centros de Custo para integração TOTVS.
/// </summary>
[ApiController]
[Route("api/centros-custo")]
public sealed class CentroCustoController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CentroCustoController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<CentroCustoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CentroCustoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 5000)
    {
        var query = db.CentrosCusto.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchLower) ||
                x.Description.ToLower().Contains(searchLower));
        }

        var total = await query.CountAsync(ct);
        var ccList = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .Select(x => new
            {
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId,
                EmpresaCode = x.Empresa != null ? x.Empresa.Code : null,
                EmpresaDescription = x.Empresa != null ? x.Empresa.Description : null,
                x.ValidFrom, x.ValidUntil,
                x.ParentId,
                ParentCode = x.Parent != null ? x.Parent.Code : null,
                ParentDescription = x.Parent != null ? x.Parent.Description : null,
                HeadcountAutorizado = x.Headcount,
                x.Phone,
                x.BranchOrLocation,
                x.OwnerFuncionarioId,
                OwnerFuncionarioName = x.OwnerFuncionario != null ? x.OwnerFuncionario.Name : null,
                x.Description2,
            })
            .ToListAsync(ct);

        // Headcount derivado:
        //   - Ativos = funcionários com Status=Active no CC
        //   - Orçado = Ativos + vagas abertas vinculadas ao CC (Status=Aberta)
        //   PSECAO.LIMITEFUNC do RM está zerado em 100% dos CCs, então usamos vagas abertas
        //   como proxy de "headcount pendente / a contratar".
        var ccIds = ccList.Select(c => c.Id).ToList();
        var ativosByCc = await db.Funcionarios.AsNoTracking()
            .Where(f => f.CentroCustoId != null && ccIds.Contains(f.CentroCustoId.Value)
                        && f.Status == Domain.Enums.FuncionarioStatus.Active)
            .GroupBy(f => f.CentroCustoId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Id, g => g.Count, ct);

        var vagasAbertasRaw = await db.Vagas.AsNoTracking()
            .Where(v => v.CentroCustoId != null && ccIds.Contains(v.CentroCustoId.Value)
                        && v.Status == global::RHPortal.Api.Domain.Enums.VagaStatus.Aberta)
            .GroupBy(v => v.CentroCustoId!.Value)
            .Select(g => new { Id = g.Key, Pendentes = g.Sum(v => v.HeadcountAutorizado) })
            .ToListAsync(ct);
        var vagasAbertasByCc = vagasAbertasRaw.ToDictionary(x => x.Id, x => Math.Max(0, x.Pendentes));

        var items = ccList.Select(x =>
        {
            var ativos = ativosByCc.TryGetValue(x.Id, out var a) ? a : 0;
            var pendentes = vagasAbertasByCc.TryGetValue(x.Id, out var p) ? p : 0;
            var orcado = ativos + pendentes;
            return new CentroCustoResponse(
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId, x.EmpresaCode, x.EmpresaDescription,
                x.ValidFrom, x.ValidUntil,
                x.ParentId, x.ParentCode, x.ParentDescription,
                ativos, // Headcount = ativos (compat)
                x.Phone, x.BranchOrLocation, x.OwnerFuncionarioId, x.OwnerFuncionarioName, x.Description2,
                ativos, orcado);
        }).ToList();

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<CentroCustoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CentroCustoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = db.CentrosCusto.AsNoTracking()
            .Where(x => x.IsActive && (!x.ValidUntil.HasValue || x.ValidUntil >= today));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(searchLower) ||
                x.Description.ToLower().Contains(searchLower));
        }

        var items = await query
            .OrderBy(x => x.Code)
            .Take(50)
            .Select(x => new CentroCustoLookupItem(
                x.Id, x.Code, x.Description,
                $"{x.Code} - {x.Description}"))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CentroCustoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CentroCustoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var raw = await db.CentrosCusto
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId,
                EmpresaCode = x.Empresa != null ? x.Empresa.Code : null,
                EmpresaDescription = x.Empresa != null ? x.Empresa.Description : null,
                x.ValidFrom, x.ValidUntil,
                x.ParentId,
                ParentCode = x.Parent != null ? x.Parent.Code : null,
                ParentDescription = x.Parent != null ? x.Parent.Description : null,
                x.Phone, x.BranchOrLocation,
                x.OwnerFuncionarioId,
                OwnerFuncionarioName = x.OwnerFuncionario != null ? x.OwnerFuncionario.Name : null,
                x.Description2,
            })
            .FirstOrDefaultAsync(ct);

        if (raw is null) return NotFound();

        var ativos = await db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.CentroCustoId == raw.Id && f.Status == Domain.Enums.FuncionarioStatus.Active, ct);
        var pendentes = await db.Vagas.AsNoTracking()
            .Where(v => v.CentroCustoId == raw.Id && v.Status == global::RHPortal.Api.Domain.Enums.VagaStatus.Aberta)
            .SumAsync(v => (int?)(v.HeadcountAutorizado), ct) ?? 0;
        pendentes = Math.Max(0, pendentes);
        var orcado = ativos + pendentes;

        var item = new CentroCustoResponse(
            raw.Id, raw.Code, raw.Description, raw.Manager, raw.Notes,
            raw.IsActive, raw.CreatedAtUtc, raw.UpdatedAtUtc,
            raw.EmpresaId, raw.EmpresaCode, raw.EmpresaDescription,
            raw.ValidFrom, raw.ValidUntil,
            raw.ParentId, raw.ParentCode, raw.ParentDescription,
            ativos, raw.Phone, raw.BranchOrLocation,
            raw.OwnerFuncionarioId, raw.OwnerFuncionarioName, raw.Description2,
            ativos, orcado);
        return Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CentroCustoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CentroCustoResponse>> Create(
        [FromBody] CentroCustoCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (await db.CentrosCusto.AnyAsync(
            x => x.EmpresaId == request.EmpresaId && x.Code == request.Code.Trim(), ct))
            return Conflict(new { message = $"Já existe um centro de custo com o código '{request.Code}' nesta empresa." });

        if (request.ParentId.HasValue &&
            !await db.CentrosCusto.AnyAsync(p => p.Id == request.ParentId, ct))
        {
            return BadRequest(new { message = "Centro de custo pai não encontrado." });
        }

        var entity = new CentroCusto
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Description = request.Description.Trim(),
            Manager = string.IsNullOrWhiteSpace(request.Manager) ? null : request.Manager.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            IsActive = request.IsActive,
            EmpresaId = request.EmpresaId,
            ValidFrom = request.ValidFrom,
            ValidUntil = request.ValidUntil,
            ParentId = request.ParentId,
            // Campos absorvidos de Department (Sessão 31.2)
            Headcount = Math.Max(0, request.Headcount),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            BranchOrLocation = string.IsNullOrWhiteSpace(request.BranchOrLocation) ? null : request.BranchOrLocation.Trim(),
            // Campo absorvido de Area
            OwnerFuncionarioId = request.OwnerFuncionarioId,
            Description2 = string.IsNullOrWhiteSpace(request.Description2) ? null : request.Description2.Trim(),
        };

        db.CentrosCusto.Add(entity);
        await db.SaveChangesAsync(ct);

        var raw = await db.CentrosCusto
            .AsNoTracking()
            .Where(x => x.Id == entity.Id)
            .Select(x => new
            {
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId,
                EmpresaCode = x.Empresa != null ? x.Empresa.Code : null,
                EmpresaDescription = x.Empresa != null ? x.Empresa.Description : null,
                x.ValidFrom, x.ValidUntil,
                x.ParentId,
                ParentCode = x.Parent != null ? x.Parent.Code : null,
                ParentDescription = x.Parent != null ? x.Parent.Description : null,
                x.Phone, x.BranchOrLocation,
                x.OwnerFuncionarioId,
                OwnerFuncionarioName = x.OwnerFuncionario != null ? x.OwnerFuncionario.Name : null,
                x.Description2,
            })
            .FirstAsync(ct);

        var created = new CentroCustoResponse(
            raw.Id, raw.Code, raw.Description, raw.Manager, raw.Notes,
            raw.IsActive, raw.CreatedAtUtc, raw.UpdatedAtUtc,
            raw.EmpresaId, raw.EmpresaCode, raw.EmpresaDescription,
            raw.ValidFrom, raw.ValidUntil,
            raw.ParentId, raw.ParentCode, raw.ParentDescription,
            0, raw.Phone, raw.BranchOrLocation,
            raw.OwnerFuncionarioId, raw.OwnerFuncionarioName, raw.Description2,
            0, 0);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CentroCustoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CentroCustoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CentroCustoUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CentrosCusto.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (await db.CentrosCusto.AnyAsync(
            x => x.Id != id && x.EmpresaId == request.EmpresaId && x.Code == request.Code.Trim(), ct))
            return Conflict(new { message = $"Já existe outro centro de custo com o código '{request.Code}' nesta empresa." });

        if (request.ParentId.HasValue)
        {
            if (request.ParentId == id)
                return BadRequest(new { message = "Um centro de custo não pode ser pai de si mesmo." });
            if (!await db.CentrosCusto.AnyAsync(p => p.Id == request.ParentId, ct))
                return BadRequest(new { message = "Centro de custo pai não encontrado." });
            if (await WouldCreateCycle(db, id, request.ParentId.Value, ct))
                return BadRequest(new { message = "Atribuição criaria um ciclo na hierarquia." });
        }

        entity.Code = request.Code.Trim();
        entity.Description = request.Description.Trim();
        entity.Manager = string.IsNullOrWhiteSpace(request.Manager) ? null : request.Manager.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        entity.IsActive = request.IsActive;
        entity.EmpresaId = request.EmpresaId;
        entity.ValidFrom = request.ValidFrom;
        entity.ValidUntil = request.ValidUntil;
        entity.ParentId = request.ParentId;
        // Campos absorvidos de Department (Sessão 31.2)
        entity.Headcount = Math.Max(0, request.Headcount);
        entity.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        entity.BranchOrLocation = string.IsNullOrWhiteSpace(request.BranchOrLocation) ? null : request.BranchOrLocation.Trim();
        // Campo absorvido de Area
        entity.OwnerFuncionarioId = request.OwnerFuncionarioId;
        entity.Description2 = string.IsNullOrWhiteSpace(request.Description2) ? null : request.Description2.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var raw = await db.CentrosCusto
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id, x.Code, x.Description, x.Manager, x.Notes,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc,
                x.EmpresaId,
                EmpresaCode = x.Empresa != null ? x.Empresa.Code : null,
                EmpresaDescription = x.Empresa != null ? x.Empresa.Description : null,
                x.ValidFrom, x.ValidUntil,
                x.ParentId,
                ParentCode = x.Parent != null ? x.Parent.Code : null,
                ParentDescription = x.Parent != null ? x.Parent.Description : null,
                x.Phone, x.BranchOrLocation,
                x.OwnerFuncionarioId,
                OwnerFuncionarioName = x.OwnerFuncionario != null ? x.OwnerFuncionario.Name : null,
                x.Description2,
            })
            .FirstAsync(ct);

        var ativos = await db.Funcionarios.AsNoTracking()
            .CountAsync(f => f.CentroCustoId == raw.Id && f.Status == Domain.Enums.FuncionarioStatus.Active, ct);
        var pendentes = await db.Vagas.AsNoTracking()
            .Where(v => v.CentroCustoId == raw.Id && v.Status == global::RHPortal.Api.Domain.Enums.VagaStatus.Aberta)
            .SumAsync(v => (int?)(v.HeadcountAutorizado), ct) ?? 0;
        pendentes = Math.Max(0, pendentes);
        var orcado = ativos + pendentes;

        var updated = new CentroCustoResponse(
            raw.Id, raw.Code, raw.Description, raw.Manager, raw.Notes,
            raw.IsActive, raw.CreatedAtUtc, raw.UpdatedAtUtc,
            raw.EmpresaId, raw.EmpresaCode, raw.EmpresaDescription,
            raw.ValidFrom, raw.ValidUntil,
            raw.ParentId, raw.ParentCode, raw.ParentDescription,
            ativos, raw.Phone, raw.BranchOrLocation,
            raw.OwnerFuncionarioId, raw.OwnerFuncionarioName, raw.Description2,
            ativos, orcado);

        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CentrosCusto.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        // Centros de custo vinculados a funcionários importados do TOTVS RM são read-only.
        // Inferimos a origem pela presença de funcionários com MatriculaRm ou CdnFuncionario.
        var temFuncionariosImportados = await db.Funcionarios.AnyAsync(
            f => f.CentroCustoId == id && (f.MatriculaRm != null || f.CdnFuncionario != null), ct);
        if (temFuncionariosImportados)
        {
            return Conflict(new
            {
                message = $"Centro de Custo \"{entity.Code} - {entity.Description}\" tem funcionários importados do ERP. Não é permitido excluir — exclua na origem; o Portal espelha o cadastro.",
            });
        }

        // Pre-check de todos os vínculos antes de chamar SaveChanges.
        // Sem este bloco, o DELETE quebra com 23503 foreign_key_violation vindo do Postgres
        // (JobPositions, Vagas, SolicitacoesVaga, SolicitacoesPromocao, Funcionarios,
        // PreAdmissoes e a auto-ref ParentId). A mensagem bruta que o EF retorna é
        // inútil para o usuário — aqui montamos uma lista humanamente legível com
        // contagens, para que o front exiba exatamente o que impede a exclusão.
        var filhosCc       = await db.CentrosCusto.CountAsync(x => x.ParentId == id, ct);
        var vagas          = await db.Vagas.CountAsync(x => x.CentroCustoId == id, ct);
        var cargos         = await db.Set<JobPosition>().CountAsync(x => x.CentroCustoId == id, ct);
        var funcionarios   = await db.Set<Funcionario>().CountAsync(x => x.CentroCustoId == id, ct);
        var solicVagas     = await db.Set<SolicitacaoVaga>().CountAsync(x => x.CentroCustoId == id, ct);
        var solicPromocoes = await db.Set<SolicitacaoPromocao>().CountAsync(x => x.CentroCustoId == id, ct);
        var preAdmissoes   = await db.Set<PreAdmissao>().CountAsync(x => x.CentroCustoId == id, ct);

        var blocos = new List<string>();
        if (filhosCc       > 0) blocos.Add($"{filhosCc} centro(s) de custo filho(s) na hierarquia");
        if (vagas          > 0) blocos.Add($"{vagas} vaga(s)");
        if (cargos         > 0) blocos.Add($"{cargos} cargo(s)");
        if (funcionarios   > 0) blocos.Add($"{funcionarios} funcionário(s)");
        if (solicVagas     > 0) blocos.Add($"{solicVagas} solicitação(ões) de vaga");
        if (solicPromocoes > 0) blocos.Add($"{solicPromocoes} solicitação(ões) de promoção");
        if (preAdmissoes   > 0) blocos.Add($"{preAdmissoes} pré-admissão(ões)");

        if (blocos.Count > 0)
        {
            return Conflict(new
            {
                message = $"Não é possível excluir \"{entity.Code} - {entity.Description}\" — há vínculos: "
                          + string.Join(", ", blocos)
                          + ". Remova ou transfira esses vínculos antes.",
                dependencies = new
                {
                    centrosCustoFilhos = filhosCc,
                    vagas,
                    cargos,
                    funcionarios,
                    solicitacoesVaga = solicVagas,
                    solicitacoesPromocao = solicPromocoes,
                    preAdmissoes,
                }
            });
        }

        try
        {
            db.CentrosCusto.Remove(entity);
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23503")
        {
            // Safety net: outra FK foi adicionada e esqueci de incluir acima.
            // Devolve mensagem clara em vez de 500. PG constraint name vai no detail
            // para o log / suporte identificar qual tabela/coluna tocar.
            return Conflict(new
            {
                message = "Não é possível excluir — existe um vínculo em outra tabela que não foi detectado. "
                          + "Contate o suporte informando o centro de custo.",
                detail = pg.ConstraintName,
            });
        }

        return NoContent();
    }

    /// <summary>
    /// Árvore hierárquica de centros de custo do tenant.
    /// Raízes são os CCs com ParentId null.
    /// </summary>
    [HttpGet("tree")]
    [ProducesResponseType(typeof(List<CentroCustoTreeNode>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CentroCustoTreeNode>>> GetTree(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] bool onlyActive = false)
    {
        var query = db.CentrosCusto.AsNoTracking();
        if (onlyActive) query = query.Where(x => x.IsActive);

        var flat = await query
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id, x.Code, x.Description, x.IsActive, x.EmpresaId, x.ParentId,
                EmpresaCode = x.Empresa != null ? x.Empresa.Code : null
            })
            .ToListAsync(ct);

        var byParent = flat.ToLookup(x => x.ParentId);

        List<CentroCustoTreeNode> BuildChildren(Guid? parentId)
        {
            return byParent[parentId]
                .Select(x => new CentroCustoTreeNode(
                    x.Id, x.Code, x.Description, x.IsActive,
                    x.EmpresaId, x.EmpresaCode,
                    BuildChildren(x.Id)))
                .ToList();
        }

        return Ok(BuildChildren(null));
    }

    private static async Task<bool> WouldCreateCycle(AppDbContext db, Guid nodeId, Guid candidateParentId, CancellationToken ct)
    {
        var current = candidateParentId;
        for (int hops = 0; hops < 1000; hops++)
        {
            if (current == nodeId) return true;
            var parent = await db.CentrosCusto
                .AsNoTracking()
                .Where(x => x.Id == current)
                .Select(x => x.ParentId)
                .FirstOrDefaultAsync(ct);
            if (parent is null) return false;
            current = parent.Value;
        }
        return true;
    }

    /// <summary>
    /// Importação em lote de centros de custo. Upsert por (EmpresaCodigo, Code).
    /// Suporta até 5.000 registros por requisição.
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(CentroCustoImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CentroCustoImportResult>> Import(
        [FromBody] List<CentroCustoImportItem> items,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Nenhum item fornecido." });
        if (items.Count > 5000)
            return BadRequest(new { message = "Máximo de 5.000 registros por importação." });

        // Resolve empresa codes → IDs
        var empresaMap = await db.Empresas
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code })
            .ToDictionaryAsync(x => x.Code.ToLowerInvariant(), x => x.Id, ct);

        // Build existing map: key = "empresaCode|code"
        var existingMap = await db.CentrosCusto
            .AsNoTracking()
            .Select(x => new { x.Id, x.Code, x.EmpresaId, EmpresaCode = x.Empresa != null ? x.Empresa.Code : null })
            .ToListAsync(ct);
        var existingDict = existingMap
            .Where(x => x.EmpresaCode != null)
            .ToDictionary(
                x => $"{x.EmpresaCode!.ToLowerInvariant()}|{x.Code.ToLowerInvariant()}",
                x => x.Id);
        // Also include items without empresa (key = "|code")
        foreach (var x in existingMap.Where(x => x.EmpresaCode == null))
            existingDict.TryAdd($"|{x.Code.ToLowerInvariant()}", x.Id);

        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();
        var toAdd = new List<CentroCusto>();
        int pending = 0;

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var code = item.Code.Trim();
            Guid? empresaId = null;
            string empresaCodeKey = "";
            if (!string.IsNullOrWhiteSpace(item.EmpresaCodigo))
            {
                if (empresaMap.TryGetValue(item.EmpresaCodigo.Trim().ToLowerInvariant(), out var eid))
                { empresaId = eid; empresaCodeKey = item.EmpresaCodigo.Trim().ToLowerInvariant(); }
                else { errors.Add($"Linha {i + 1}: Empresa '{item.EmpresaCodigo}' não encontrada."); skipped++; continue; }
            }

            var mapKey = $"{empresaCodeKey}|{code.ToLowerInvariant()}";
            DateOnly? validFrom = TryParseDate(item.ValidFrom);
            DateOnly? validUntil = TryParseDate(item.ValidUntil);

            if (existingDict.TryGetValue(mapKey, out var existingId))
            {
                var entity = await db.CentrosCusto.FindAsync([existingId], ct);
                if (entity is null) { skipped++; continue; }
                entity.Code = code;
                entity.Description = item.Description.Trim();
                entity.Manager = string.IsNullOrWhiteSpace(item.Manager) ? null : item.Manager.Trim();
                entity.IsActive = item.IsActive;
                entity.EmpresaId = empresaId;
                entity.ValidFrom = validFrom;
                entity.ValidUntil = validUntil;
                entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                updated++;
            }
            else
            {
                var entity = new CentroCusto
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    Description = item.Description.Trim(),
                    Manager = string.IsNullOrWhiteSpace(item.Manager) ? null : item.Manager.Trim(),
                    IsActive = item.IsActive,
                    EmpresaId = empresaId,
                    ValidFrom = validFrom,
                    ValidUntil = validUntil,
                };
                toAdd.Add(entity);
                existingDict[mapKey] = entity.Id;
                created++;
            }

            pending++;
            if (pending >= 100)
            {
                if (toAdd.Count > 0) { db.CentrosCusto.AddRange(toAdd); toAdd.Clear(); }
                await db.SaveChangesAsync(ct);
                pending = 0;
            }
        }

        if (toAdd.Count > 0) db.CentrosCusto.AddRange(toAdd);
        if (pending > 0) await db.SaveChangesAsync(ct);

        return Ok(new CentroCustoImportResult(created, updated, skipped, errors));
    }

    private static DateOnly? TryParseDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var v = s.Trim();
        if (DateOnly.TryParseExact(v, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var d)) return d;
        if (DateOnly.TryParseExact(v, "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out d)) return d;
        if (DateOnly.TryParseExact(v, "dd-MM-yyyy", null, System.Globalization.DateTimeStyles.None, out d)) return d;
        return null;
    }
}
