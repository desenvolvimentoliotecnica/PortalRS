using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.DescricaoCargo;
using RhPortal.Api.Contracts.DescricaoCargo;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de Descrições de Cargo — segue o template DNALIO (Sessão 31.8).
///
/// Estrutura:
/// - Cabeçalho: Code/Title/AreaTemplate/CboCodigo/Summary
/// - Formação: mínima/desejável/área de estudo
/// - Experiência: tempo mínimo/desejável/especificação
/// - Itens (collection) com 8 categorias DNALIO (atividades, vivências,
///   competências, requisitos)
/// - Revisão: número/data/natureza/gestor
/// - HTML legados (Responsibilities/Requirements/NiceToHave/Benefits) para
///   apresentação pública
///
/// O matching consome os Itens estruturados; o RH cadastra usando essa tela.
/// </summary>
[ApiController]
[Route("api/descricoes-cargo")]
public sealed class DescricaoCargoController : ControllerBase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string? NullIfBlank(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static DescricaoCargoItemResponse MapItem(DescricaoCargoItem i) =>
        new(i.Id, i.Categoria, i.Texto, i.IsObrigatoria, i.NivelMinimo, i.Subcategoria, i.Ordem);

    private static DescricaoCargoResponse MapToResponse(DescricaoCargo x) =>
        new(
            x.Id, x.Code, x.Title,
            x.AreaTemplate, x.CboCodigo, x.Summary,
            x.FormacaoMinima, x.FormacaoDesejavel, x.FormacaoAreaEstudo,
            x.ExperienciaTempoMinimo, x.ExperienciaTempoDesejavel, x.ExperienciaEspecificacao,
            x.RevisaoNumero, x.RevisaoData, x.RevisaoNatureza, x.GestorNome, x.GestorEmail,
            x.Responsibilities, x.Requirements, x.NiceToHave, x.Benefits,
            x.IsTemplate, x.IsActive,
            x.CreatedAtUtc, x.UpdatedAtUtc,
            x.NivelCargoId,
            x.NivelCargo?.NomComplet,
            x.Itens
                .OrderBy(i => i.Categoria)
                .ThenBy(i => i.Ordem)
                .ThenBy(i => i.Texto)
                .Select(MapItem)
                .ToList());

    /// <summary>Substitui todos os itens da descrição pelos recebidos no request (pattern replace).</summary>
    private static void ReplaceItens(
        DescricaoCargo entity,
        IReadOnlyList<DescricaoCargoItemRequest>? itens,
        string tenantId,
        AppDbContext db)
    {
        foreach (var existing in entity.Itens.ToList())
            db.Remove(existing);
        entity.Itens.Clear();

        if (itens is null) return;

        foreach (var i in itens)
        {
            entity.Itens.Add(new DescricaoCargoItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DescricaoCargoId = entity.Id,
                Categoria = i.Categoria,
                Texto = i.Texto.Trim(),
                IsObrigatoria = i.IsObrigatoria,
                NivelMinimo = NullIfBlank(i.NivelMinimo),
                Subcategoria = NullIfBlank(i.Subcategoria),
                Ordem = i.Ordem,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
    }

    private static void ApplyHeaderFields(DescricaoCargo entity, dynamic request)
    {
        entity.AreaTemplate = NullIfBlank((string?)request.AreaTemplate);
        entity.CboCodigo = NullIfBlank((string?)request.CboCodigo);
        entity.Summary = NullIfBlank((string?)request.Summary);
        entity.FormacaoMinima = NullIfBlank((string?)request.FormacaoMinima);
        entity.FormacaoDesejavel = NullIfBlank((string?)request.FormacaoDesejavel);
        entity.FormacaoAreaEstudo = NullIfBlank((string?)request.FormacaoAreaEstudo);
        entity.ExperienciaTempoMinimo = NullIfBlank((string?)request.ExperienciaTempoMinimo);
        entity.ExperienciaTempoDesejavel = NullIfBlank((string?)request.ExperienciaTempoDesejavel);
        entity.ExperienciaEspecificacao = NullIfBlank((string?)request.ExperienciaEspecificacao);
        entity.RevisaoNumero = NullIfBlank((string?)request.RevisaoNumero);
        entity.RevisaoData = (DateOnly?)request.RevisaoData;
        entity.RevisaoNatureza = NullIfBlank((string?)request.RevisaoNatureza);
        entity.GestorNome = NullIfBlank((string?)request.GestorNome);
        entity.GestorEmail = NullIfBlank((string?)request.GestorEmail);
        entity.Responsibilities = NullIfBlank((string?)request.Responsibilities);
        entity.Requirements = NullIfBlank((string?)request.Requirements);
        entity.NiceToHave = NullIfBlank((string?)request.NiceToHave);
        entity.Benefits = NullIfBlank((string?)request.Benefits);
        entity.IsTemplate = (bool)request.IsTemplate;
        entity.IsActive = (bool)request.IsActive;
        entity.NivelCargoId = (Guid?)request.NivelCargoId;
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    [HttpGet]
    [ProducesResponseType(typeof(List<DescricaoCargoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DescricaoCargoResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] bool? isTemplate,
        [FromQuery] Guid? nivelCargoId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 2000)
    {
        var query = db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .AsQueryable();

        if (isTemplate.HasValue) query = query.Where(x => x.IsTemplate == isTemplate);
        if (nivelCargoId.HasValue) query = query.Where(x => x.NivelCargoId == nivelCargoId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x =>
                x.Code.ToLower().Contains(s) ||
                x.Title.ToLower().Contains(s) ||
                (x.Summary != null && x.Summary.ToLower().Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var entities = await query
            .OrderBy(x => x.Code)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        Response.Headers["X-Total-Count"] = total.ToString();
        return Ok(entities.Select(MapToResponse).ToList());
    }

    [HttpGet("lookup")]
    [ProducesResponseType(typeof(List<DescricaoCargoLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DescricaoCargoLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] bool? isTemplate)
    {
        var query = db.DescricoesCargo.AsNoTracking().Where(x => x.IsActive);
        if (isTemplate.HasValue) query = query.Where(x => x.IsTemplate == isTemplate);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x => x.Code.ToLower().Contains(s) || x.Title.ToLower().Contains(s));
        }

        var items = await query
            .OrderBy(x => x.Code)
            .Take(50)
            .Select(x => new DescricaoCargoLookupItem(
                x.Id, x.Code, x.Title, $"{x.Code} - {x.Title}", x.IsTemplate))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DescricaoCargoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return entity is null ? NotFound() : Ok(MapToResponse(entity));
    }

    [HttpPost]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DescricaoCargoResponse>> Create(
        [FromBody] DescricaoCargoCreateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        if (request.NivelCargoId.HasValue &&
            !await db.NiveisCargo.AnyAsync(n => n.Id == request.NivelCargoId, ct))
        {
            return BadRequest(new { message = "Nível de cargo não encontrado." });
        }

        var code = request.Code.Trim();
        if (await db.DescricoesCargo.AnyAsync(x => x.Code == code, ct))
            return Conflict(new { message = $"Já existe uma descrição com o código '{code}'." });

        var entity = new DescricaoCargo
        {
            Id = Guid.NewGuid(),
            Code = code,
            Title = request.Title.Trim(),
        };
        ApplyHeaderFields(entity, request);

        db.DescricoesCargo.Add(entity);
        ReplaceItens(entity, request.Itens, tenantContext.TenantId ?? string.Empty, db);

        await db.SaveChangesAsync(ct);

        var created = await db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .FirstAsync(x => x.Id == entity.Id, ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, MapToResponse(created));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DescricaoCargoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DescricaoCargoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] DescricaoCargoUpdateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        var entity = await db.DescricoesCargo
            .Include(x => x.Itens)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (request.NivelCargoId.HasValue &&
            !await db.NiveisCargo.AnyAsync(n => n.Id == request.NivelCargoId, ct))
        {
            return BadRequest(new { message = "Nível de cargo não encontrado." });
        }

        var code = request.Code.Trim();
        if (await db.DescricoesCargo.AnyAsync(x => x.Id != id && x.Code == code, ct))
            return Conflict(new { message = $"Já existe outra descrição com o código '{code}'." });

        entity.Code = code;
        entity.Title = request.Title.Trim();
        ApplyHeaderFields(entity, request);
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        ReplaceItens(entity, request.Itens, tenantContext.TenantId ?? string.Empty, db);

        await db.SaveChangesAsync(ct);

        var updated = await db.DescricoesCargo
            .AsNoTracking()
            .Include(x => x.NivelCargo)
            .Include(x => x.Itens)
            .FirstAsync(x => x.Id == id, ct);

        return Ok(MapToResponse(updated));
    }

    /// <summary>
    /// Sessão 31.8 — Importação em massa de Descrições de Cargo via .docx (template DNALIO).
    ///
    /// Aceita 1+ arquivos .docx via multipart/form-data. Para cada arquivo:
    /// 1. Parseia com `DocxDescricaoCargoParser` (extrai cabeçalho, formação,
    ///    experiência, seções DNALIO de itens, revisão).
    /// 2. Deriva Code do nome do arquivo (sanitizado, max 30 chars). Se já existe
    ///    no tenant, opcionalmente sobrescreve (parâmetro <c>overwriteIfExists</c>).
    /// 3. Salva como template ativo (<c>IsTemplate=true, IsActive=true</c>).
    ///
    /// Retorna lista com resultado por arquivo: nome, sucesso/erro, Id criado, warnings.
    /// </summary>
    [HttpPost("import-docx")]
    [RequestSizeLimit(50_000_000)] // 50 MB total
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(DocxImportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DocxImportResponse>> ImportDocx(
        [FromForm] IFormFileCollection files,
        [FromQuery] bool overwriteIfExists,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        if (files is null || files.Count == 0)
            return BadRequest(new { message = "Nenhum arquivo enviado." });

        if (files.Count > 50)
            return BadRequest(new { message = "Máximo de 50 arquivos por requisição." });

        var tenantId = tenantContext.TenantId ?? string.Empty;
        var resultados = new List<DocxImportItemResult>();

        foreach (var file in files)
        {
            var fileName = file.FileName ?? "(sem nome)";

            if (file.Length == 0)
            {
                resultados.Add(new DocxImportItemResult(fileName, false, null, null, new[] { "Arquivo vazio." }));
                continue;
            }

            if (!fileName.EndsWith(".docx", StringComparison.OrdinalIgnoreCase))
            {
                resultados.Add(new DocxImportItemResult(fileName, false, null, null, new[] { "Apenas .docx é suportado." }));
                continue;
            }

            // Code derivado do nome do arquivo: sanitiza, upper, max 30
            var code = SanitizeCodeFromFileName(fileName);
            if (string.IsNullOrWhiteSpace(code))
            {
                resultados.Add(new DocxImportItemResult(fileName, false, null, null, new[] { "Não foi possível derivar Code do nome do arquivo." }));
                continue;
            }

            DocxParseResult parseResult;
            using (var stream = file.OpenReadStream())
            {
                parseResult = DocxDescricaoCargoParser.Parse(stream, code);
            }

            if (parseResult.Request is null)
            {
                resultados.Add(new DocxImportItemResult(fileName, false, null, null, parseResult.Warnings));
                continue;
            }

            var request = parseResult.Request;
            var existing = await db.DescricoesCargo.FirstOrDefaultAsync(x => x.Code == code, ct);

            if (existing is not null && !overwriteIfExists)
            {
                resultados.Add(new DocxImportItemResult(
                    fileName, false, existing.Id, existing.Title,
                    parseResult.Warnings.Concat(new[] {
                        $"Code '{code}' já existe (descrição '{existing.Title}'). Use overwriteIfExists=true para sobrescrever ou renomeie o arquivo."
                    }).ToList()));
                continue;
            }

            try
            {
                if (existing is not null)
                {
                    // Update: aplica os campos do request + replace dos itens
                    existing.Title = request.Title;
                    existing.AreaTemplate = request.AreaTemplate;
                    existing.CboCodigo = request.CboCodigo;
                    existing.Summary = request.Summary;
                    existing.FormacaoMinima = request.FormacaoMinima;
                    existing.FormacaoDesejavel = request.FormacaoDesejavel;
                    existing.FormacaoAreaEstudo = request.FormacaoAreaEstudo;
                    existing.ExperienciaTempoMinimo = request.ExperienciaTempoMinimo;
                    existing.ExperienciaTempoDesejavel = request.ExperienciaTempoDesejavel;
                    existing.ExperienciaEspecificacao = request.ExperienciaEspecificacao;
                    existing.RevisaoNumero = request.RevisaoNumero;
                    existing.RevisaoData = request.RevisaoData;
                    existing.RevisaoNatureza = request.RevisaoNatureza;
                    existing.GestorNome = request.GestorNome;
                    existing.GestorEmail = request.GestorEmail;
                    existing.IsTemplate = request.IsTemplate;
                    existing.IsActive = request.IsActive;
                    existing.UpdatedAtUtc = DateTimeOffset.UtcNow;

                    // Replace itens (cascade pelo AppDbContext)
                    var oldItens = await db.DescricaoCargoItens.Where(i => i.DescricaoCargoId == existing.Id).ToListAsync(ct);
                    db.DescricaoCargoItens.RemoveRange(oldItens);

                    if (request.Itens is not null)
                    {
                        foreach (var i in request.Itens)
                        {
                            db.DescricaoCargoItens.Add(new DescricaoCargoItem
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                DescricaoCargoId = existing.Id,
                                Categoria = i.Categoria,
                                Texto = i.Texto.Trim(),
                                IsObrigatoria = i.IsObrigatoria,
                                NivelMinimo = NullIfBlank(i.NivelMinimo),
                                Subcategoria = NullIfBlank(i.Subcategoria),
                                Ordem = i.Ordem,
                                CreatedAtUtc = DateTimeOffset.UtcNow,
                                UpdatedAtUtc = DateTimeOffset.UtcNow,
                            });
                        }
                    }
                    await db.SaveChangesAsync(ct);
                    resultados.Add(new DocxImportItemResult(fileName, true, existing.Id, existing.Title,
                        parseResult.Warnings.Concat(new[] { "Atualizado (overwrite)." }).ToList()));
                }
                else
                {
                    // Create
                    var entity = new RhPortal.Api.Domain.Entities.DescricaoCargo
                    {
                        Id = Guid.NewGuid(),
                        Code = code,
                        Title = request.Title,
                        AreaTemplate = request.AreaTemplate,
                        CboCodigo = request.CboCodigo,
                        Summary = request.Summary,
                        FormacaoMinima = request.FormacaoMinima,
                        FormacaoDesejavel = request.FormacaoDesejavel,
                        FormacaoAreaEstudo = request.FormacaoAreaEstudo,
                        ExperienciaTempoMinimo = request.ExperienciaTempoMinimo,
                        ExperienciaTempoDesejavel = request.ExperienciaTempoDesejavel,
                        ExperienciaEspecificacao = request.ExperienciaEspecificacao,
                        RevisaoNumero = request.RevisaoNumero,
                        RevisaoData = request.RevisaoData,
                        RevisaoNatureza = request.RevisaoNatureza,
                        GestorNome = request.GestorNome,
                        GestorEmail = request.GestorEmail,
                        IsTemplate = request.IsTemplate,
                        IsActive = request.IsActive,
                        NivelCargoId = null,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                    };
                    db.DescricoesCargo.Add(entity);

                    if (request.Itens is not null)
                    {
                        foreach (var i in request.Itens)
                        {
                            entity.Itens.Add(new DescricaoCargoItem
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                DescricaoCargoId = entity.Id,
                                Categoria = i.Categoria,
                                Texto = i.Texto.Trim(),
                                IsObrigatoria = i.IsObrigatoria,
                                NivelMinimo = NullIfBlank(i.NivelMinimo),
                                Subcategoria = NullIfBlank(i.Subcategoria),
                                Ordem = i.Ordem,
                                CreatedAtUtc = DateTimeOffset.UtcNow,
                                UpdatedAtUtc = DateTimeOffset.UtcNow,
                            });
                        }
                    }

                    await db.SaveChangesAsync(ct);
                    resultados.Add(new DocxImportItemResult(fileName, true, entity.Id, entity.Title, parseResult.Warnings));
                }
            }
            catch (Exception ex)
            {
                resultados.Add(new DocxImportItemResult(fileName, false, null, null,
                    parseResult.Warnings.Concat(new[] { $"Erro ao salvar: {ex.GetType().Name} — {ex.Message}" }).ToList()));
            }
        }

        return Ok(new DocxImportResponse(
            Total: resultados.Count,
            Sucesso: resultados.Count(r => r.Sucesso),
            Falha: resultados.Count(r => !r.Sucesso),
            Itens: resultados));
    }

    /// <summary>Sanitiza nome de arquivo para virar Code: maiúscula, A-Z 0-9 + hífen, max 30.</summary>
    private static string SanitizeCodeFromFileName(string fileName)
    {
        var noExt = Path.GetFileNameWithoutExtension(fileName ?? string.Empty).ToUpperInvariant();
        var sb = new System.Text.StringBuilder();
        foreach (var c in noExt)
        {
            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))
                sb.Append(c);
            else if (c == ' ' || c == '_' || c == '-')
                sb.Append('-');
            // outros chars (acentos, símbolos) descartados
        }
        // Colapsa múltiplos hífens
        var raw = System.Text.RegularExpressions.Regex.Replace(sb.ToString(), @"-+", "-").Trim('-');
        if (raw.Length > 30) raw = raw.Substring(0, 30);
        return raw;
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
        var entity = await db.DescricoesCargo.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        // Pre-check: alguma vaga aponta para esta descrição?
        var vagasUsando = await db.Vagas.CountAsync(v => v.DescricaoCargoId == id, ct);
        if (vagasUsando > 0)
        {
            return Conflict(new
            {
                message = $"Não é possível excluir \"{entity.Code} - {entity.Title}\" — {vagasUsando} vaga(s) usam esta descrição. Desvincule as vagas antes.",
                dependencies = new { vagas = vagasUsando }
            });
        }

        // Itens da descrição morrem em Cascade pelo config do AppDbContext.
        db.DescricoesCargo.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
