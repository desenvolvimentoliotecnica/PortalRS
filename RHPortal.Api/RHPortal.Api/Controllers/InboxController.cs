using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Inbox;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Inbox;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Caixa de entrada: mensagens, anexos e status de processamento.
/// </summary>
[ApiController]
[Route("api/inbox")]
public sealed class InboxController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;
    private readonly IStringLocalizer<InfrastructureMessages> _infraLocalizer;

    public InboxController(
        IStringLocalizer<ControllerMessages> localizer,
        IStringLocalizer<InfrastructureMessages> infraLocalizer)
    {
        _localizer = localizer;
        _infraLocalizer = infraLocalizer;
    }

    /// <summary>
    /// Lista itens da inbox com filtros (origem, status, vaga e busca).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<InboxResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InboxResponse>>> List(
        [FromServices] AppDbContext db,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = db.InboxItems
            .AsNoTracking()
            .Include(x => x.Anexos)
            .AsQueryable();

        if (TryParseEnum<InboxOrigem>(origem, out var parsedOrigem))
            query = query.Where(x => x.Origem == parsedOrigem);

        if (TryParseEnum<InboxStatus>(status, out var parsedStatus))
            query = query.Where(x => x.Status == parsedStatus);

        if (vagaId.HasValue)
            query = query.Where(x => x.VagaId == vagaId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var text = q.Trim().ToLower();
            query = query.Where(x =>
                (x.Remetente ?? "").ToLower().Contains(text) ||
                (x.Assunto ?? "").ToLower().Contains(text) ||
                (x.Destinatario ?? "").ToLower().Contains(text));
        }

        var items = await query
            .OrderByDescending(x => x.RecebidoEm)
            .Take(500)
            .Select(x => MapResponse(x))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Obtém um item da inbox pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(InboxResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InboxResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var item = await db.InboxItems
            .AsNoTracking()
            .Include(x => x.Anexos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return item is null ? NotFound() : Ok(MapResponse(item));
    }

    /// <summary>
    /// Cria um item da inbox (ex.: entrada manual).
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(InboxResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<InboxResponse>> Create(
        [FromBody] InboxCreateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] RhPortal.Api.Infrastructure.Tenancy.ITenantContext tenantContext,
        [FromServices] IHubContext<InboxHub> hub,
        CancellationToken ct)
    {
        if (!TryParseEnum<InboxOrigem>(request.Origem, out var origem))
            return BadRequest(new { message = _localizer["ControllerErrors.InboxOrigemInvalid"] });

        if (!TryParseEnum<InboxStatus>(request.Status, out var status))
            return BadRequest(new { message = _localizer["ControllerErrors.InboxStatusInvalid"] });

        var entity = new InboxItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            Origem = origem,
            Status = status,
            RecebidoEm = request.RecebidoEm == default ? DateTimeOffset.UtcNow : request.RecebidoEm,
            Remetente = request.Remetente,
            Assunto = request.Assunto,
            Destinatario = request.Destinatario,
            VagaId = request.VagaId,
            PreviewText = request.PreviewText,
            ProcessamentoPct = request.Processamento?.Pct ?? 0,
            ProcessamentoEtapa = request.Processamento?.Etapa,
            ProcessamentoTentativas = request.Processamento?.Tentativas ?? 0,
            ProcessamentoUltimoErro = request.Processamento?.UltimoErro,
            ProcessamentoLogRaw = SerializeLog(request.Processamento?.Log),
            SuggestedVagasJson = SerializeSuggestions(request.SuggestedVagas)
        };

        if (request.Anexos is { Count: > 0 })
        {
            foreach (var a in request.Anexos)
            {
                entity.Anexos.Add(new InboxAnexo
                {
                    Id = a.Id ?? Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    Nome = a.Nome,
                    Tipo = a.Tipo,
                    TamanhoKB = a.TamanhoKB,
                    Hash = a.Hash
                });
            }
        }

        db.InboxItems.Add(entity);
        await db.SaveChangesAsync(ct);

        await SendInboxEventAsync(hub, tenantContext.TenantId, "created", entity, ct);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, MapResponse(entity));
    }

    /// <summary>
    /// Envia um arquivo para processamento (currículo, e-mail etc.).
    /// </summary>
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upload(
        [FromForm] InboxUploadRequest request,
        [FromServices] InboxFileProcessor processor,
        [FromServices] RhPortal.Api.Infrastructure.Tenancy.ITenantContext tenantContext,
        [FromServices] IOptions<InboxFolderOptions> options,
        CancellationToken ct)
    {
        var file = request.File;
        if (file is null || file.Length == 0)
            return BadRequest(new { message = _localizer["ControllerErrors.InboxFileRequired"] });

        var tenantId = tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return BadRequest(new { message = _localizer["ControllerErrors.TenantNotFound"] });

        var inboxOptions = options.Value;
        var safeName = Path.GetFileName(file.FileName);
        var ext = Path.GetExtension(safeName);
        var uniqueName = $"{Guid.NewGuid():N}{ext}";
        var tenantFolder = Path.Combine(inboxOptions.RootPath, tenantId, inboxOptions.IncomingFolderName);
        Directory.CreateDirectory(tenantFolder);

        var filePath = Path.Combine(tenantFolder, uniqueName);
        await using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(stream, ct);
        }

        await processor.ProcessAsync(tenantId, filePath, inboxOptions, InboxOrigem.Upload, ct);
        return Ok(new { status = "queued" });
    }

    /// <summary>
    /// Atualiza um item da inbox.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(InboxResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InboxResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] InboxUpdateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] RhPortal.Api.Infrastructure.Tenancy.ITenantContext tenantContext,
        [FromServices] IHubContext<InboxHub> hub,
        CancellationToken ct)
    {
        if (!TryParseEnum<InboxOrigem>(request.Origem, out var origem))
            return BadRequest(new { message = _localizer["ControllerErrors.InboxOrigemInvalid"] });

        if (!TryParseEnum<InboxStatus>(request.Status, out var status))
            return BadRequest(new { message = _localizer["ControllerErrors.InboxStatusInvalid"] });

        var entity = await db.InboxItems
            .Include(x => x.Anexos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (entity is null) return NotFound();

        entity.Origem = origem;
        entity.Status = status;
        entity.RecebidoEm = request.RecebidoEm == default ? entity.RecebidoEm : request.RecebidoEm;
        entity.Remetente = request.Remetente;
        entity.Assunto = request.Assunto;
        entity.Destinatario = request.Destinatario;
        entity.VagaId = request.VagaId;
        entity.PreviewText = request.PreviewText;
        entity.ProcessamentoPct = request.Processamento?.Pct ?? 0;
        entity.ProcessamentoEtapa = request.Processamento?.Etapa;
        entity.ProcessamentoTentativas = request.Processamento?.Tentativas ?? 0;
        entity.ProcessamentoUltimoErro = request.Processamento?.UltimoErro;
        entity.ProcessamentoLogRaw = SerializeLog(request.Processamento?.Log);
        entity.SuggestedVagasJson = SerializeSuggestions(request.SuggestedVagas);
        entity.TenantId = tenantContext.TenantId;

        entity.Anexos.Clear();
        if (request.Anexos is { Count: > 0 })
        {
            foreach (var a in request.Anexos)
            {
                entity.Anexos.Add(new InboxAnexo
                {
                    Id = a.Id ?? Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    Nome = a.Nome,
                    Tipo = a.Tipo,
                    TamanhoKB = a.TamanhoKB,
                    Hash = a.Hash
                });
            }
        }

        if (!entity.CandidatoId.HasValue)
        {
            var email = request.Remetente ?? entity.Remetente;
            if (!string.IsNullOrWhiteSpace(email) && email.Contains("@"))
            {
                var cand = await db.Candidatos.FirstOrDefaultAsync(x => x.Email == email, ct);
                if (cand is not null)
                    entity.CandidatoId = cand.Id;
            }
        }

        if (entity.CandidatoId.HasValue)
        {
            var candidato = await db.Candidatos.FirstOrDefaultAsync(x => x.Id == entity.CandidatoId.Value, ct);
            if (candidato is not null)
            {
                var targetVagaId = request.VagaId ?? await GetOrCreateInboxVagaIdAsync(db, ct);
                if (targetVagaId != Guid.Empty)
                    candidato.VagaId = targetVagaId;
            }
        }

        await db.SaveChangesAsync(ct);

        await SendInboxEventAsync(hub, tenantContext.TenantId, "updated", entity, ct);
        return Ok(MapResponse(entity));
    }

    /// <summary>
    /// Remove um item da inbox.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] IHubContext<InboxHub> hub,
        CancellationToken ct)
    {
        var entity = await db.InboxItems.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.InboxItems.Remove(entity);
        await db.SaveChangesAsync(ct);
        await hub.Clients.Group(InboxHub.GetTenantGroup(entity.TenantId))
            .SendAsync("inbox.deleted", new InboxRealtimeMessage("deleted", entity.Id, MapStatus(entity.Status), entity.RecebidoEm, entity.Assunto, entity.Remetente), ct);
        return NoContent();
    }

    /// <summary>
    /// Adiciona o remetente do item da inbox à base de talentos (cria Pessoa + Talento e opcionalmente Candidato na vaga BANCO-TALENTOS).
    /// </summary>
    [HttpPost("{id:guid}/add-to-talentos")]
    [ProducesResponseType(typeof(RhPortal.Api.Contracts.Talentos.TalentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RhPortal.Api.Contracts.Talentos.TalentoResponse>> AddToTalentos(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        [FromServices] ITalentoService talentoService,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        var entity = await db.InboxItems.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var email = entity.Remetente?.Trim();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains("@", StringComparison.Ordinal))
            return BadRequest(new { message = _localizer["ControllerErrors.InboxRemetenteRequired"] ?? "Remetente (e-mail) é obrigatório para adicionar à base de talentos." });

        var origemTalento = entity.Origem switch
        {
            InboxOrigem.Pasta => RhPortal.Api.Domain.Enums.OrigemTalento.Pasta,
            InboxOrigem.Upload => RhPortal.Api.Domain.Enums.OrigemTalento.Pasta,
            _ => RhPortal.Api.Domain.Enums.OrigemTalento.Email
        };

        var nome = email.Contains("@", StringComparison.Ordinal) ? email.Substring(0, email.IndexOf('@')).Replace(".", " ").Trim() : email;
        if (string.IsNullOrWhiteSpace(nome)) nome = email;

        var (talento, _) = await talentoService.GetOrCreateByEmailAsync(
            email,
            nome,
            null,
            null,
            null,
            null,
            entity.PreviewText,
            null,
            origemTalento,
            ct);

        var vagaId = await GetOrCreateInboxVagaIdAsync(db, ct);
        if (vagaId != Guid.Empty && talento.Pessoa is not null)
        {
            var alreadyHas = await db.Candidatos.AnyAsync(c => c.TalentoId == talento.Id && c.VagaId == vagaId, ct);
            if (!alreadyHas)
            {
                var candidatoFonte = entity.Origem == InboxOrigem.Pasta || entity.Origem == InboxOrigem.Upload ? CandidateOrigin.Pasta : CandidateOrigin.Email;
                var candidato = new Candidato
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    Nome = talento.Pessoa.Nome,
                    Email = talento.Pessoa.Email,
                    Fone = talento.Pessoa.Fone,
                    Cidade = talento.Pessoa.Cidade,
                    Uf = talento.Pessoa.Uf,
                    Fonte = candidatoFonte,
                    Status = CandidateStatus.Triagem,
                    VagaId = vagaId,
                    TalentoId = talento.Id,
                    Obs = _infraLocalizer["InfrastructureInbox.OrigemPastaObs", entity.Assunto ?? "inbox"].Value,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };
                db.Candidatos.Add(candidato);
                entity.CandidatoId = candidato.Id;
                await db.SaveChangesAsync(ct);
            }
        }

        var response = await talentoService.GetByIdAsync(talento.Id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    private static bool TryParseEnum<TEnum>(string? value, out TEnum result) where TEnum : struct
    {
        result = default;
        if (string.IsNullOrWhiteSpace(value) || value == "all")
            return false;
        return Enum.TryParse(value, true, out result);
    }

    private static string MapOrigem(InboxOrigem origem)
        => origem.ToString().ToLowerInvariant();

    private static string MapStatus(InboxStatus status)
        => status.ToString().ToLowerInvariant();

    private static InboxResponse MapResponse(InboxItem item)
    {
        var processamento = item.ProcessamentoPct > 0 || item.ProcessamentoTentativas > 0 || !string.IsNullOrWhiteSpace(item.ProcessamentoEtapa)
            ? new InboxProcessamentoDto(
                item.ProcessamentoPct,
                item.ProcessamentoEtapa,
                DeserializeLog(item.ProcessamentoLogRaw),
                item.ProcessamentoTentativas,
                item.ProcessamentoUltimoErro)
            : null;

        var anexos = item.Anexos.Select(a => new InboxAnexoDto(a.Id, a.Nome, a.Tipo, a.TamanhoKB, a.Hash)).ToList();
        var suggestions = DeserializeSuggestions(item.SuggestedVagasJson);

        return new InboxResponse(
            item.Id,
            MapOrigem(item.Origem),
            MapStatus(item.Status),
            item.RecebidoEm,
            item.Remetente,
            item.Assunto,
            item.Destinatario,
            item.VagaId,
            item.PreviewText,
            processamento,
            anexos,
            suggestions,
            item.CreatedAtUtc,
            item.UpdatedAtUtc);
    }

    private static string? SerializeLog(IReadOnlyList<string>? log)
    {
        if (log is null || log.Count == 0) return null;
        return JsonSerializer.Serialize(log);
    }

    private static IReadOnlyList<string> DeserializeLog(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(raw) ?? new List<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private static string? SerializeSuggestions(IReadOnlyList<InboxSuggestedVagaDto>? items)
    {
        if (items is null || items.Count == 0) return null;
        return JsonSerializer.Serialize(items);
    }

    private static IReadOnlyList<InboxSuggestedVagaDto> DeserializeSuggestions(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<InboxSuggestedVagaDto>();
        try
        {
            return JsonSerializer.Deserialize<List<InboxSuggestedVagaDto>>(raw) ?? new List<InboxSuggestedVagaDto>();
        }
        catch
        {
            return Array.Empty<InboxSuggestedVagaDto>();
        }
    }

    private static Task SendInboxEventAsync(IHubContext<InboxHub> hub, string tenantId, string action, InboxItem entity, CancellationToken ct)
    {
        var message = new InboxRealtimeMessage(
            action,
            entity.Id,
            MapStatus(entity.Status),
            entity.RecebidoEm,
            entity.Assunto,
            entity.Remetente);

        // Publica para todos os clientes conectados no grupo do tenant.
        return hub.Clients.Group(InboxHub.GetTenantGroup(tenantId))
            .SendAsync($"inbox.{action}", message, ct);
    }

    private async Task<Guid> GetOrCreateInboxVagaIdAsync(AppDbContext db, CancellationToken ct)
    {
        const string code = "BANCO-TALENTOS";
        var existing = await db.Vagas.FirstOrDefaultAsync(x => x.Codigo == code, ct);
        if (existing is not null)
            return existing.Id;

        // 31.2: Area+Department foram absorvidos por CentroCusto
        var centroCusto = await db.CentrosCusto.FirstOrDefaultAsync(ct);
        if (centroCusto is null)
            return Guid.Empty;

        var vaga = new Vaga
        {
            Id = Guid.NewGuid(),
            Codigo = code,
            Titulo = _infraLocalizer["InfrastructureInbox.VagaBaseTitulo"],
            CentroCustoId = centroCusto.Id,
            Status = VagaStatus.Rascunho,
            QuantidadeVagas = 1,
            MatchMinimoPercentual = 70,
            DescricaoInterna = _infraLocalizer["InfrastructureInbox.VagaBaseDescricao"],
            Visibilidade = VagaPublicacaoVisibilidade.Interna
        };

        db.Vagas.Add(vaga);
        await db.SaveChangesAsync(ct);
        return vaga.Id;
    }
}
