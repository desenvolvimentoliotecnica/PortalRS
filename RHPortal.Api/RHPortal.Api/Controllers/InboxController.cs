using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Inbox;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/inbox")]
public sealed class InboxController : ControllerBase
{
    [HttpGet]
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

    [HttpGet("{id:guid}")]
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

    [HttpPost]
    public async Task<ActionResult<InboxResponse>> Create(
        [FromBody] InboxCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!TryParseEnum<InboxOrigem>(request.Origem, out var origem))
            return BadRequest(new { message = "Origem invalida." });

        if (!TryParseEnum<InboxStatus>(request.Status, out var status))
            return BadRequest(new { message = "Status invalido." });

        var entity = new InboxItem
        {
            Id = Guid.NewGuid(),
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
                    Nome = a.Nome,
                    Tipo = a.Tipo,
                    TamanhoKB = a.TamanhoKB,
                    Hash = a.Hash
                });
            }
        }

        db.InboxItems.Add(entity);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, MapResponse(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<InboxResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] InboxUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!TryParseEnum<InboxOrigem>(request.Origem, out var origem))
            return BadRequest(new { message = "Origem invalida." });

        if (!TryParseEnum<InboxStatus>(request.Status, out var status))
            return BadRequest(new { message = "Status invalido." });

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

        entity.Anexos.Clear();
        if (request.Anexos is { Count: > 0 })
        {
            foreach (var a in request.Anexos)
            {
                entity.Anexos.Add(new InboxAnexo
                {
                    Id = a.Id ?? Guid.NewGuid(),
                    Nome = a.Nome,
                    Tipo = a.Tipo,
                    TamanhoKB = a.TamanhoKB,
                    Hash = a.Hash
                });
            }
        }

        await db.SaveChangesAsync(ct);

        return Ok(MapResponse(entity));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.InboxItems.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        db.InboxItems.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
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
}
