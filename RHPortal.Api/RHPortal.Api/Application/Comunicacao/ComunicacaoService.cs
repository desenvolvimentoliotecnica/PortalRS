using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using System.Security.Claims;

namespace RhPortal.Api.Application.Comunicacao;

// ── DTOs ──

public sealed record LogComunicacaoResponse(
    Guid Id, Guid CandidatoId, string? CandidatoNome, Guid? ProjetoId,
    TipoComunicacao Tipo, string? Assunto, string? Mensagem, string? Destinatario,
    string? UsuarioNome, DateTimeOffset DataUtc);

public sealed record EnviarEmailRequest(
    Guid CandidatoId, Guid? ProjetoId, string Assunto, string Mensagem);

public sealed record RegistrarContatoRequest(
    Guid CandidatoId, Guid? ProjetoId, TipoComunicacao Tipo, string? Mensagem);

// ── Interface ──

public interface IComunicacaoService
{
    Task<IReadOnlyList<LogComunicacaoResponse>> ListByCandidatoAsync(Guid candidatoId, CancellationToken ct);
    Task<LogComunicacaoResponse> EnviarEmailAsync(EnviarEmailRequest request, ClaimsPrincipal user, CancellationToken ct);
    Task<LogComunicacaoResponse> RegistrarContatoAsync(RegistrarContatoRequest request, ClaimsPrincipal user, CancellationToken ct);
    Task<string> GerarWhatsAppLinkAsync(Guid candidatoId, string? mensagem, CancellationToken ct);
}

// ── Service ──

public sealed class ComunicacaoService : IComunicacaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;

    public ComunicacaoService(AppDbContext db, ITenantContext tenantContext, IEmailQueueService emailQueue)
    {
        _db = db;
        _tenantContext = tenantContext;
        _emailQueue = emailQueue;
    }

    public async Task<IReadOnlyList<LogComunicacaoResponse>> ListByCandidatoAsync(Guid candidatoId, CancellationToken ct)
    {
        return await _db.Set<LogComunicacao>().AsNoTracking()
            .Include(l => l.Candidato)
            .Where(l => l.CandidatoId == candidatoId)
            .OrderByDescending(l => l.DataUtc)
            .Select(l => new LogComunicacaoResponse(
                l.Id, l.CandidatoId, l.Candidato!.Nome, l.ProjetoId,
                l.Tipo, l.Assunto, l.Mensagem, l.Destinatario,
                l.UsuarioNome, l.DataUtc))
            .ToListAsync(ct);
    }

    public async Task<LogComunicacaoResponse> EnviarEmailAsync(EnviarEmailRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var candidato = await _db.Candidatos.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CandidatoId, ct)
            ?? throw new InvalidOperationException("Candidato não encontrado.");

        if (!string.IsNullOrWhiteSpace(candidato.Email))
        {
            await _emailQueue.EnqueueRawAsync(
                to: candidato.Email,
                subject: request.Assunto?.Trim() ?? "(sem assunto)",
                bodyHtml: request.Mensagem?.Trim() ?? "",
                bodyText: null,
                isSystem: false,
                source: "comunicacao",
                ct: ct);
        }

        var log = new LogComunicacao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            CandidatoId = request.CandidatoId,
            ProjetoId = request.ProjetoId,
            Tipo = TipoComunicacao.Email,
            Assunto = request.Assunto?.Trim(),
            Mensagem = request.Mensagem?.Trim(),
            Destinatario = candidato.Email,
            UsuarioNome = user.FindFirst(ClaimTypes.Name)?.Value ?? user.FindFirst("name")?.Value,
            DataUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<LogComunicacao>().Add(log);
        await _db.SaveChangesAsync(ct);

        return new LogComunicacaoResponse(
            log.Id, log.CandidatoId, candidato.Nome, log.ProjetoId,
            log.Tipo, log.Assunto, log.Mensagem, log.Destinatario,
            log.UsuarioNome, log.DataUtc);
    }

    public async Task<LogComunicacaoResponse> RegistrarContatoAsync(RegistrarContatoRequest request, ClaimsPrincipal user, CancellationToken ct)
    {
        var candidato = await _db.Candidatos.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CandidatoId, ct)
            ?? throw new InvalidOperationException("Candidato não encontrado.");

        var log = new LogComunicacao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            CandidatoId = request.CandidatoId,
            ProjetoId = request.ProjetoId,
            Tipo = request.Tipo,
            Mensagem = request.Mensagem?.Trim(),
            Destinatario = request.Tipo == TipoComunicacao.WhatsApp ? candidato.Fone : candidato.LinkedinUrl,
            UsuarioNome = user.FindFirst(ClaimTypes.Name)?.Value ?? user.FindFirst("name")?.Value,
            DataUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<LogComunicacao>().Add(log);
        await _db.SaveChangesAsync(ct);

        return new LogComunicacaoResponse(
            log.Id, log.CandidatoId, candidato.Nome, log.ProjetoId,
            log.Tipo, log.Assunto, log.Mensagem, log.Destinatario,
            log.UsuarioNome, log.DataUtc);
    }

    public async Task<string> GerarWhatsAppLinkAsync(Guid candidatoId, string? mensagem, CancellationToken ct)
    {
        var candidato = await _db.Candidatos.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId, ct)
            ?? throw new InvalidOperationException("Candidato não encontrado.");

        var phone = (candidato.Fone ?? "").Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", "").Replace("+", "");
        if (!phone.StartsWith("55") && phone.Length <= 11)
            phone = "55" + phone;

        var encodedMsg = Uri.EscapeDataString(mensagem ?? "");
        return $"https://wa.me/{phone}?text={encodedMsg}";
    }
}
