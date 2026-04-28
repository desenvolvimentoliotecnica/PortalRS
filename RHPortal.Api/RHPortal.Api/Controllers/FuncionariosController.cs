using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Funcionarios;
using RhPortal.Api.Application.Funcionarios.Handlers;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Contracts.Colaborador;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de funcionários.
/// </summary>
[ApiController]
[Route("api/funcionarios")]
public sealed class FuncionariosController : ControllerBase
{
    [HttpGet("users-without-funcionario")]
    [RequirePermission("funcionarios.view")]
    [ProducesResponseType(typeof(IReadOnlyList<UserWithoutFuncionarioItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<UserWithoutFuncionarioItemResponse>>> ListUsersWithoutFuncionario(
        [FromServices] IListUsersWithoutFuncionarioHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(ct));

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<FuncionarioGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<FuncionarioGridRowResponse>>> List(
        [FromQuery] FuncionarioListQuery query,
        [FromServices] IListFuncionariosHandler handler,
        [FromServices] ICurrentUserContext userContext,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!userContext.IsAdmin && !userContext.IsRH)
        {
            if (userContext.IsInRole("Gestor"))
            {
                var gestorId = userContext.FuncionarioId;
                if (!gestorId.HasValue)
                    return Ok(new PagedResult<FuncionarioGridRowResponse>([], 1, query.PageSize, 0, 0));

                // Resolve unidades de lotação do gestor (mesma lógica do GestaoController.MeuTime)
                var todasUnidades = await db.UnidadesLotacao.AsNoTracking()
                    .Where(u => u.IsActive)
                    .Select(u => new { u.Id, u.ParentId, u.OwnerFuncionarioId })
                    .ToListAsync(ct);

                var unidadesDoGestor = new HashSet<Guid>();
                var fila = new Queue<Guid>(
                    todasUnidades.Where(u => u.OwnerFuncionarioId == gestorId).Select(u => u.Id));
                while (fila.Count > 0)
                {
                    var unitId = fila.Dequeue();
                    if (!unidadesDoGestor.Add(unitId)) continue;
                    foreach (var child in todasUnidades.Where(u => u.ParentId == unitId))
                        fila.Enqueue(child.Id);
                }

                query = query with
                {
                    GestorUnidadeIds = unidadesDoGestor.Count > 0 ? unidadesDoGestor.ToList() : null,
                };
            }
            else if (userContext.IsInRole("Colaborador"))
            {
                if (!userContext.FuncionarioId.HasValue)
                    return Ok(new PagedResult<FuncionarioGridRowResponse>([], 1, query.PageSize, 0, 0));
                query = query with { OnlyFuncionarioId = userContext.FuncionarioId.Value };
            }
        }

        return Ok(await handler.HandleAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FuncionarioResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FuncionarioResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetFuncionarioByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(FuncionarioResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<FuncionarioResponse>> Create(
        [FromBody] JsonElement body,
        [FromServices] ICreateFuncionarioHandler handler,
        CancellationToken ct)
    {
        FuncionarioCreateRequest request;
        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            options.Converters.Add(new JsonStringEnumConverter());
            request = JsonSerializer.Deserialize<FuncionarioCreateRequest>(body.GetRawText(), options)
                ?? new FuncionarioCreateRequest();
        }
        catch (JsonException ex)
        {
            return BadRequest(new { message = "Invalid JSON for FuncionarioCreateRequest.", detail = ex.Message });
        }

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

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(FuncionarioResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<FuncionarioResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] FuncionarioUpdateRequest request,
        [FromServices] IUpdateFuncionarioHandler handler,
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

    [HttpPut("{id:guid}/hierarquia")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateHierarquia(
        [FromRoute] Guid id,
        [FromBody] FuncionarioHierarquiaRequest request,
        [FromServices] IFuncionarioService service,
        CancellationToken ct)
    {
        var ok = await service.UpdateHierarquiaAsync(id, request.GestorDiretoId, request.NivelHierarquicoId, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>
    /// Importação em lote de colaboradores vindos do TOTVS Datasul.
    /// Upsert pela chave composta (CdnEmpresa + CdnEstab + CdnFuncionario).
    /// Pré-carrega Pessoas e Funcionários em memória para eliminar N+1 queries.
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(FuncionarioImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<FuncionarioImportResult>> Import(
        [FromBody] List<FuncionarioImportItem> items,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        if (items is null || items.Count == 0)
            return BadRequest(new { message = "Nenhum item fornecido." });
        if (items.Count > 10_000)
            return BadRequest(new { message = "Máximo de 10.000 registros por importação." });

        var now = DateTimeOffset.UtcNow;
        var tenantId = tenantContext.TenantId;

        // ── 1. Pré-carrega Pessoas existentes pelos e-mails reais do payload (1 query) ──
        var emailSet = items
            .Where(x => !string.IsNullOrWhiteSpace(x.Email))
            .Select(x => x.Email!.Trim().ToLowerInvariant())
            .ToHashSet();

        var existingPessoas = emailSet.Count > 0
            ? await db.Pessoas
                .Where(p => emailSet.Contains(p.Email))
                .ToDictionaryAsync(p => p.Email, ct)
            : new Dictionary<string, Pessoa>();

        // ── 2. Pré-carrega Funcionarios pela chave TOTVS (tracked) ──
        var existingFuncs = await db.Funcionarios
            .Where(x => x.CdnFuncionario != null)
            .ToDictionaryAsync(
                x => $"{x.CdnEmpresa!.Trim()}|{x.CdnEstab!.Trim()}|{x.CdnFuncionario!.Trim()}",
                ct);

        // ── 2b. Pré-carrega UnidadesLotacao pelo código TOTVS (1 query) ──
        // Chave composta "{plano}|{code_normalizado}" — tolera zeros à esquerda.
        static string NormCode(string c) { var s = c.Trim().TrimStart('0'); return s.Length > 0 ? s : c.Trim(); }

        var unidadeLookup = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        {
            var allUnidades = await db.UnidadesLotacao
                .AsNoTracking()
                .Select(u => new { u.Id, u.Code, u.CdnPlanoLotac })
                .ToListAsync(ct);
            foreach (var u in allUnidades)
            {
                var p = u.CdnPlanoLotac.Trim();
                unidadeLookup.TryAdd($"{p}|{u.Code.Trim()}", u.Id);
                unidadeLookup.TryAdd($"{p}|{NormCode(u.Code)}", u.Id);
            }
        }

        // ── 2c. Pré-carrega CentrosCusto pelo Code (mesmo padrão de UnidadesLotacao) ──
        var centroCustoCodesNorm = items
            .Where(x => !string.IsNullOrWhiteSpace(x.CodCentroCusto))
            .Select(x => NormCode(x.CodCentroCusto!))
            .ToHashSet();

        var centroCustoLookup = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        if (centroCustoCodesNorm.Count > 0)
        {
            var allCentros = await db.CentrosCusto
                .AsNoTracking()
                .Select(c => new { c.Id, c.Code })
                .ToListAsync(ct);
            foreach (var c in allCentros)
            {
                var normKey = NormCode(c.Code);
                centroCustoLookup.TryAdd(c.Code.Trim(), c.Id);
                centroCustoLookup.TryAdd(normKey, c.Id);
            }
        }

        // ── 2d. Pré-carrega JobPositions pelo TotvsCargoBasicId ──
        var cargoCodesInt = items
            .Where(x => !string.IsNullOrWhiteSpace(x.CodCargo))
            .Select(x => int.TryParse(x.CodCargo!.Trim(), out var n) ? (int?)n : null)
            .Where(n => n.HasValue)
            .Select(n => n!.Value)
            .ToHashSet();

        var jobPositionLookup = new Dictionary<int, Guid>();
        if (cargoCodesInt.Count > 0)
        {
            var allCargos = await db.JobPositions
                .AsNoTracking()
                .Where(j => j.TotvsCargoBasicId != null && cargoCodesInt.Contains(j.TotvsCargoBasicId!.Value))
                .Select(j => new { j.Id, j.TotvsCargoBasicId })
                .ToListAsync(ct);
            foreach (var j in allCargos)
                jobPositionLookup.TryAdd(j.TotvsCargoBasicId!.Value, j.Id);
        }

        // ── 2e. Pré-carrega NiveisCargo pelo CdnNivCargo ──
        var nivCargoCodesInt = items
            .Where(x => !string.IsNullOrWhiteSpace(x.CodNivCargo))
            .Select(x => int.TryParse(x.CodNivCargo!.Trim(), out var n) ? (int?)n : null)
            .Where(n => n.HasValue)
            .Select(n => n!.Value)
            .ToHashSet();

        var nivelCargoLookup = new Dictionary<int, Guid>();
        if (nivCargoCodesInt.Count > 0)
        {
            var allNiveisCargo = await db.NiveisCargo
                .AsNoTracking()
                .Where(n => nivCargoCodesInt.Contains(n.CdnNivCargo))
                .Select(n => new { n.Id, n.CdnNivCargo })
                .ToListAsync(ct);
            foreach (var n in allNiveisCargo)
                nivelCargoLookup.TryAdd(n.CdnNivCargo, n.Id);
        }

        // ── 3. Identifica e cria novas Pessoas em bulk ──
        var newPessoas = new Dictionary<string, Pessoa>();
        foreach (var item in items)
        {
            var email = string.IsNullOrWhiteSpace(item.Email) ? null : item.Email!.Trim().ToLowerInvariant();
            if (email is null) continue;
            if (existingPessoas.ContainsKey(email) || newPessoas.ContainsKey(email)) continue;

            var nome = (item.Nome ?? "").Trim();
            var p = new Pessoa
            {
                Id            = Guid.NewGuid(),
                TenantId      = tenantId,
                Nome          = nome.Length > 0 ? TrimToMax(nome, 160)! : email,
                Email         = email,
                Fone          = TrimToMax(item.Fone, 40),
                Cidade        = TrimToMax(item.Cidade, 120),
                Uf            = TrimToMax(item.Uf?.ToUpper(), 2),
                Cpf           = TrimToMax(item.Cpf, 14),
                Rg            = TrimToMax(item.Rg, 20),
                Cep           = TrimToMax(item.Cep, 20),
                Logradouro    = TrimToMax(item.Logradouro, 200),
                Numero        = TrimToMax(item.NumeroEndereco, 40),
                Bairro        = TrimToMax(item.Bairro, 120),
                Origem        = OrigemPessoa.Funcionario,
                CreatedAtUtc  = now,
                UpdatedAtUtc  = now,
            };
            if (TryParseDate(item.DataNascimento, out var dn)) p.DataNascimento = dn;
            newPessoas[email] = p;
        }

        if (newPessoas.Count > 0)
            db.Pessoas.AddRange(newPessoas.Values);

        // ── 4. Loop principal: upsert Funcionarios usando dicionários in-memory ──
        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();
        var warnings = new List<string>();
        var toAdd = new List<Funcionario>();

        for (int i = 0; i < items.Count; i++)
        {
            var item     = items[i];
            var cdnFunc  = (item.CdnFuncionario ?? "").Trim();
            var cdnEmp   = (item.CdnEmpresa ?? "").Trim();
            var cdnEstab = (item.CdnEstab ?? "").Trim();
            var realEmail = string.IsNullOrWhiteSpace(item.Email) ? null : item.Email!.Trim().ToLowerInvariant();
            var nome      = (item.Nome ?? "").Trim();

            if (string.IsNullOrWhiteSpace(cdnFunc) || string.IsNullOrWhiteSpace(cdnEmp) || string.IsNullOrWhiteSpace(cdnEstab))
            {
                errors.Add($"Linha {i + 1}: CdnFuncionario, CdnEmpresa e CdnEstab são obrigatórios.");
                skipped++; continue;
            }

            // Resolve UnidadeLotacaoId from CodUnidLotac + CdnPlanoLotac (chave composta)
            Guid? unidadeLotacaoId = null;
            if (!string.IsNullOrWhiteSpace(item.CodUnidLotac))
            {
                if (string.IsNullOrWhiteSpace(item.CdnPlanoLotac))
                {
                    warnings.Add($"Func {cdnFunc}: unidade '{item.CodUnidLotac}' sem plano (cdn_plano_lotac vazio) — importado sem lotação.");
                }
                else
                {
                    var lookupKey = $"{item.CdnPlanoLotac!.Trim()}|{NormCode(item.CodUnidLotac!)}";
                    if (unidadeLookup.TryGetValue(lookupKey, out var uid))
                        unidadeLotacaoId = uid;
                    else
                        warnings.Add($"Func {cdnFunc}: unidade plano={item.CdnPlanoLotac} cod={item.CodUnidLotac} não encontrada — importado sem lotação.");
                }
            }

            // Resolve CentroCustoId from CodCentroCusto
            var codCentro = string.IsNullOrWhiteSpace(item.CodCentroCusto) ? null : NormCode(item.CodCentroCusto!);
            Guid? centroCustoId = codCentro is not null && centroCustoLookup.TryGetValue(codCentro, out var ccId) ? ccId : null;

            // Resolve JobPositionId from CodCargo via TotvsCargoBasicId
            Guid? jobPositionId = null;
            if (!string.IsNullOrWhiteSpace(item.CodCargo)
                && int.TryParse(item.CodCargo.Trim(), out var codCargoInt)
                && jobPositionLookup.TryGetValue(codCargoInt, out var jpId))
                jobPositionId = jpId;

            // Resolve NivelCargoId from CodNivCargo (and always store the raw code)
            Guid? nivelCargoId = null;
            int? cdnNivCargoRaw = null;
            if (!string.IsNullOrWhiteSpace(item.CodNivCargo)
                && int.TryParse(item.CodNivCargo.Trim(), out var codNivCargoInt))
            {
                cdnNivCargoRaw = codNivCargoInt;
                if (nivelCargoLookup.TryGetValue(codNivCargoInt, out var ncId))
                    nivelCargoId = ncId;
            }

            // Resolve pessoaId from real email only (in-memory)
            Guid? pessoaId = null;
            if (realEmail is not null)
            {
                if (existingPessoas.TryGetValue(realEmail, out var ep))
                {
                    pessoaId = ep.Id;
                    if (ep.Cpf is null) ep.Cpf = TrimToMax(item.Cpf, 14);
                    if (ep.Rg is null) ep.Rg = TrimToMax(item.Rg, 20);
                    if (ep.DataNascimento is null && TryParseDate(item.DataNascimento, out var d)) ep.DataNascimento = d;
                    if (ep.Cep is null) ep.Cep = TrimToMax(item.Cep, 20);
                    if (ep.Logradouro is null) ep.Logradouro = TrimToMax(item.Logradouro, 200);
                    if (ep.Numero is null) ep.Numero = TrimToMax(item.NumeroEndereco, 40);
                    if (ep.Bairro is null) ep.Bairro = TrimToMax(item.Bairro, 120);
                }
                else if (newPessoas.TryGetValue(realEmail, out var np))
                {
                    pessoaId = np.Id;
                }
            }

            var totvsKey = $"{cdnEmp}|{cdnEstab}|{cdnFunc}";

            if (existingFuncs.TryGetValue(totvsKey, out var entity))
            {
                entity.Name               = nome;
                entity.Email              = realEmail ?? entity.Email;
                entity.Phone              = TrimToMax(item.Fone, 40) ?? entity.Phone;
                entity.PessoaId           = pessoaId ?? entity.PessoaId;
                entity.UnidadeLotacaoId   = unidadeLotacaoId ?? entity.UnidadeLotacaoId;
                entity.JobPositionId      = jobPositionId ?? entity.JobPositionId;
                entity.CentroCustoId      = centroCustoId ?? entity.CentroCustoId;
                entity.NivelCargoId       = nivelCargoId ?? entity.NivelCargoId;
                entity.CdnNivCargo        = cdnNivCargoRaw ?? entity.CdnNivCargo;
                entity.UpdatedAtUtc       = now;
                entity.RefreshIncompleteData();
                updated++;
            }
            else
            {
                var newEntity = new Funcionario
                {
                    Id                = Guid.NewGuid(),
                    PessoaId          = pessoaId,
                    Name              = nome,
                    Email             = realEmail,
                    Phone             = TrimToMax(item.Fone, 40),
                    Status            = FuncionarioStatus.Active,
                    Headcount         = 1,
                    UnidadeLotacaoId  = unidadeLotacaoId,
                    JobPositionId     = jobPositionId,
                    CentroCustoId     = centroCustoId,
                    NivelCargoId      = nivelCargoId,
                    CdnNivCargo       = cdnNivCargoRaw,
                    CdnFuncionario    = cdnFunc,
                    CdnEmpresa        = cdnEmp,
                    CdnEstab          = cdnEstab,
                };
                newEntity.RefreshIncompleteData();
                toAdd.Add(newEntity);
                existingFuncs[totvsKey] = newEntity;
                created++;
            }
        }

        if (toAdd.Count > 0) db.Funcionarios.AddRange(toAdd);
        await db.SaveChangesAsync(ct);

        return Ok(new FuncionarioImportResult(created, updated, skipped, errors, warnings));
    }

    private static string? TrimToMax(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var t = value.Trim();
        return t.Length > max ? t[..max] : t;
    }

    private static bool TryParseDate(string? raw, out DateTime result)
    {
        if (DateTime.TryParseExact(
            (raw ?? "").Trim(),
            ["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "d/M/yyyy", "dd/MM/yyyy HH:mm:ss"],
            CultureInfo.InvariantCulture, DateTimeStyles.None, out result))
        {
            result = DateTime.SpecifyKind(result, DateTimeKind.Utc);
            return true;
        }
        return false;
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteFuncionarioHandler handler,
        CancellationToken ct)
    {
        try
        {
            var deleted = await handler.HandleAsync(id, ct);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            // Funcionário importado do ERP — não pode ser excluído pelo Portal.
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Visão 360° de um funcionário: dados cadastrais + histórico de carreira + dependentes +
    /// documentos + holerites + dados bancários (mascarados para não-RH).
    /// Autorização: funcionário vê apenas o próprio perfil; gestor vê subordinados diretos; RH/Admin veem qualquer um.
    /// </summary>
    [HttpGet("{id:guid}/perfil-360")]
    [ProducesResponseType(typeof(FuncionarioPerfil360Response), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPerfil360(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] ICurrentUserContext userContext,
        CancellationToken ct)
    {
        var f = await db.Funcionarios.AsNoTracking()
            .Include(x => x.JobPosition)
            .Include(x => x.CentroCusto)
            .Include(x => x.Unit)
            .Include(x => x.UnidadeLotacao)
            .Include(x => x.NivelHierarquico)
            .Include(x => x.NivelCargo)
            .Include(x => x.CentroCusto)
            .Include(x => x.GestorDireto)
            .Include(x => x.Pessoa)
            .Include(x => x.Hierarquia)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (f is null) return NotFound();

        // ── Autorização ──
        var callerFuncionarioId = userContext.FuncionarioId;
        var isRhOrAdmin = userContext.IsAdmin || userContext.IsRH;

        if (!isRhOrAdmin)
        {
            var isOwnProfile = callerFuncionarioId == id;
            var isSubordinate = callerFuncionarioId.HasValue && f.GestorDiretoId == callerFuncionarioId;
            if (!isOwnProfile && !isSubordinate)
                return Forbid();
        }

        var today = DateOnly.FromDateTime(DateTime.Today);

        // ── Indicadores de experiência ──
        var emExperiencia = f.DataAdmissao.HasValue &&
            f.DataAdmissao.Value.AddDays(f.PeriodoExperienciaDias) > today;

        var diasRestantesExperiencia = emExperiencia
            ? (int)(f.DataAdmissao!.Value.AddDays(f.PeriodoExperienciaDias).ToDateTime(TimeOnly.MinValue) - DateTime.Today).TotalDays
            : (int?)null;

        var progressoExperiencia = emExperiencia && f.DataAdmissao.HasValue
            ? (int)Math.Round(
                (DateTime.Today - f.DataAdmissao.Value.ToDateTime(TimeOnly.MinValue)).TotalDays
                / f.PeriodoExperienciaDias * 100)
            : (int?)null;

        // ── Histórico de carreira ──
        var historico = await db.OcupacoesHistorico.AsNoTracking()
            .Include(h => h.Vaga).ThenInclude(v => v!.JobPosition)
            .Include(h => h.Vaga).ThenInclude(v => v!.CentroCusto)
            .Where(h => h.FuncionarioId == id)
            .OrderByDescending(h => h.DataEntrada)
            .ToListAsync(ct);

        var historicoItems = historico.Select(h => new HistoricoCarreiraItemResponse(
            h.Id,
            h.Vaga?.Titulo,
            h.Vaga?.JobPosition?.Description,
            h.Vaga?.CentroCusto?.Description,
            h.DataEntrada,
            h.DataSaida,
            h.MotivoSaida?.ToString(),
            h.IsProvisorio
        )).ToList();

        // ── Dependentes ──
        var dependentes = await db.Dependentes.AsNoTracking()
            .Where(d => d.FuncionarioId == id)
            .OrderBy(d => d.NomeCompleto)
            .ToListAsync(ct);

        var dependentesItems = dependentes.Select(d => new DependenteResponse(
            d.Id, d.NomeCompleto, d.Parentesco, d.Cpf, d.DataNascimento, d.IsPcd, d.CreatedAtUtc
        )).ToList();

        // ── Documentos ──
        var docs = await db.DocumentosColaborador.AsNoTracking()
            .Where(d => d.FuncionarioId == id)
            .OrderByDescending(d => d.CreatedAtUtc)
            .ToListAsync(ct);

        var docItems = docs.Select(d => new DocumentoResponse(
            d.Id, d.Tipo, d.NomeArquivo, d.ContentType, d.TamanhoBytes, d.Status, d.ObservacaoRh, d.CreatedAtUtc
        )).ToList();

        // ── Holerites ──
        var holerites = await db.Holerites.AsNoTracking()
            .Include(h => h.EnviadoPor)
            .Where(h => h.FuncionarioId == id)
            .OrderByDescending(h => h.AnoReferencia).ThenByDescending(h => h.MesReferencia)
            .ToListAsync(ct);

        var holeriteItems = holerites.Select(h => new HoleriteResponse(
            h.Id, h.MesReferencia, h.AnoReferencia, h.ArquivoNome, h.TamanhoBytes,
            h.EnviadoPorId, h.EnviadoPor?.Name, h.EnviadoEmUtc
        )).ToList();

        // ── Dados bancários (conta mascarada para não-RH) ──
        var dadosBancarios = await db.DadosBancarios.AsNoTracking()
            .FirstOrDefaultAsync(d => d.FuncionarioId == id, ct);

        DadosBancariosResponse? dadosBancariosDto = null;
        if (dadosBancarios is not null)
        {
            var contaExibida = isRhOrAdmin
                ? dadosBancarios.Conta
                : "****" + (dadosBancarios.Conta.Length >= 4 ? dadosBancarios.Conta[^4..] : dadosBancarios.Conta);
            dadosBancariosDto = new DadosBancariosResponse(
                dadosBancarios.Id, dadosBancarios.Banco, dadosBancarios.Agencia,
                contaExibida, dadosBancarios.TipoConta, dadosBancarios.Pix, dadosBancarios.UpdatedAtUtc
            );
        }

        var gestorAvatarUrl = f.GestorDireto is not null && !string.IsNullOrWhiteSpace(f.GestorDireto.AvatarFileName)
            ? $"/api/funcionarios/{f.GestorDiretoId}/avatar"
            : null;

        // Para funcionários originados do TOTVS RM, dados pessoais (DataNascimento/Sexo) ficam na Pessoa,
        // não na Funcionario — fallback pra Pessoa quando Funcionario não tem.
        var dataNascimento = f.DataNascimento
            ?? (f.Pessoa?.DataNascimento.HasValue == true ? DateOnly.FromDateTime(f.Pessoa.DataNascimento.Value) : (DateOnly?)null);
        var sexo = f.Sexo ?? f.Pessoa?.Sexo;

        // JobPosition.Description nem sempre é populada (ex.: cargos vindos do RM só têm Name).
        var cargoNome = !string.IsNullOrWhiteSpace(f.JobPosition?.Description)
            ? f.JobPosition!.Description
            : f.JobPosition?.Name;

        // Para RM, Unidade de Lotação não existe (Datasul-only) — usa Hierarquia como equivalente.
        var lotacaoNome = f.UnidadeLotacao?.Description ?? f.Hierarquia?.Descricao;

        var p = f.Pessoa;
        var result = new FuncionarioPerfil360Response(
            f.Id,
            f.Name,
            f.Email,
            f.Phone,
            f.Status,
            !string.IsNullOrWhiteSpace(f.AvatarFileName) ? $"/api/funcionarios/{f.Id}/avatar" : null,
            f.DataAdmissao,
            dataNascimento,
            sexo,
            emExperiencia,
            diasRestantesExperiencia,
            progressoExperiencia,
            cargoNome,
            f.FuncaoNomeRm,
            null, // AreaNome — Area absorvida pelo CentroCusto em 31.2
            f.Unit?.Name,
            lotacaoNome,
            f.NivelHierarquico?.Nome,
            f.NivelCargo?.NomComplet,
            f.CentroCusto?.Description,
            f.GestorDiretoId,
            f.GestorDireto?.Name,
            gestorAvatarUrl,
            f.CdnFuncionario,
            f.CdnEmpresa,
            f.CdnEstab,
            // RM
            f.MatriculaRm,
            f.Hierarquia?.Descricao,
            f.CodSituacaoRm,
            f.SituacaoRmDescricao,
            // Pessoa: identificação
            p?.Cpf,
            p?.EstadoCivil,
            p?.Naturalidade,
            p?.EstadoNatal,
            p?.GrauInstrucao,
            p?.NomePai,
            p?.NomeMae,
            p?.Nacionalidade,
            // Pessoa: endereço
            p?.Cep,
            p?.Logradouro,
            p?.Numero,
            p?.Complemento,
            p?.Bairro,
            p?.Cidade,
            p?.Uf,
            // Pessoa: documentos
            p?.Rg,
            p?.RgOrgEmissor,
            p?.RgUf,
            p?.RgDataEmissao,
            p?.CarteiraTrabalho,
            p?.CarteiraTrabalhoSerie,
            p?.CarteiraTrabalhoUf,
            p?.CarteiraTrabalhoData,
            p?.NumeroPis,
            p?.TituloEleitor,
            p?.TituloEleitorZona,
            p?.TituloEleitorSecao,
            p?.CertificadoReservista,
            p?.CategoriaMilitar,
            historicoItems,
            dependentesItems,
            docItems,
            holeriteItems,
            dadosBancariosDto
        );

        return Ok(result);
    }

    // ─────────────────────────────────────────────────────────────────
    // Backfill de "shadow Users" para funcionários ATIVOS sem ApplicationUser.
    //
    // Por que isso existe:
    //   No tenant que vem do RM via worker, `Funcionarios` tem milhares de registros
    //   mas `Users` (Identity) fica vazia/quase-vazia (só popula quando alguém loga).
    //   Isso quebra todos os seletores de destinatário (Enviar Feedback, 1:1, PDI,
    //   Celebrações @menção, etc.) que buscam em `Users`.
    //
    // O que faz: para cada Funcionario ATIVO sem `UserId`, cria um `ApplicationUser`
    //   "shadow" reusando o mesmo GUID — sem PasswordHash, então não pode logar via
    //   Identity. Suficiente para satisfazer FKs (FeedbackItems, OneOnOneMeetings,
    //   DevelopmentPlans, etc.) e popular dropdowns de destinatário.
    //
    // Idempotente: pula funcionários já vinculados ou Users já existentes com mesmo Id.
    // ─────────────────────────────────────────────────────────────────
    [HttpPost("backfill-shadow-users")]
    [RequirePermission("admin.tenant")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> BackfillShadowUsers(
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenant,
        CancellationToken ct)
    {
        var tenantId = tenant.TenantId
            ?? throw new InvalidOperationException("Tenant context required.");

        var funcionarios = await db.Funcionarios
            .IgnoreQueryFilters()
            .Where(f => f.TenantId == tenantId
                     && f.Status == RhPortal.Api.Domain.Enums.FuncionarioStatus.Active
                     && f.UserId == null)
            .ToListAsync(ct);

        var existingUserIds = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId)
            .Select(u => u.Id)
            .ToListAsync(ct);
        var existingSet = existingUserIds.ToHashSet();

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var skipped = 0;

        foreach (var f in funcionarios)
        {
            if (existingSet.Contains(f.Id))
            {
                f.UserId = f.Id;
                skipped++;
                continue;
            }

            var name = string.IsNullOrWhiteSpace(f.Name) ? $"Funcionário {f.Id:N}" : f.Name.Trim();
            var emailRaw = string.IsNullOrWhiteSpace(f.Email)
                ? $"f-{f.Id:N}@shadow.local"
                : f.Email.Trim();

            db.Users.Add(new RhPortal.Api.Domain.Entities.ApplicationUser
            {
                Id = f.Id,
                TenantId = tenantId,
                FullName = name,
                Email = emailRaw,
                NormalizedEmail = emailRaw.ToUpperInvariant(),
                UserName = emailRaw,
                NormalizedUserName = emailRaw.ToUpperInvariant(),
                IsActive = true,
                FuncionarioId = f.Id,
                EmailConfirmed = false,
                LockoutEnabled = true,
                AccessFailedCount = 0,
                TwoFactorEnabled = false,
                PhoneNumberConfirmed = false,
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                SecurityStamp = Guid.NewGuid().ToString(),
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });

            f.UserId = f.Id;
            created++;
        }

        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            tenantId,
            funcionariosAtivosSemUser = funcionarios.Count,
            usersCriados = created,
            usersJaExistentesLigados = skipped,
        });
    }
}
