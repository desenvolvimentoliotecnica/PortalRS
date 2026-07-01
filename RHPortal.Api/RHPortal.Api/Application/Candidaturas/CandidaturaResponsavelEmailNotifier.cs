using System.Net;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.Candidaturas;

public interface ICandidaturaResponsavelEmailNotifier
{
    /// <summary>
    /// Enfileira e-mail para gestor requisitante e recrutador responsável da vaga
    /// quando <c>EnviarEmailResponsavelNaCandidatura</c> estiver habilitado no tenant.
    /// </summary>
    Task NotifyNovaCandidaturaAsync(Guid candidatoId, Guid vagaId, CancellationToken ct);
}

public sealed class CandidaturaResponsavelEmailNotifier : ICandidaturaResponsavelEmailNotifier
{
    private readonly AppDbContext _db;
    private readonly IEmailQueueService _emailQueue;

    public CandidaturaResponsavelEmailNotifier(AppDbContext db, IEmailQueueService emailQueue)
    {
        _db = db;
        _emailQueue = emailQueue;
    }

    public async Task NotifyNovaCandidaturaAsync(Guid candidatoId, Guid vagaId, CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (config is null || !config.EnviarEmailResponsavelNaCandidatura)
            return;

        var data = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.GestorRequisitanteFuncionario)
            .Include(v => v.RecrutadorResponsavelUser)
            .Where(v => v.Id == vagaId)
            .Select(v => new
            {
                VagaTitulo = v.Titulo,
                VagaCodigo = v.Codigo,
                GestorEmail = v.GestorRequisitanteFuncionario != null
                    ? v.GestorRequisitanteFuncionario.Email
                    : null,
                RecrutadorEmail = v.RecrutadorResponsavelUser != null
                    ? v.RecrutadorResponsavelUser.Email
                    : null,
            })
            .FirstOrDefaultAsync(ct);

        var candidato = await _db.Candidatos.AsNoTracking()
            .Where(c => c.Id == candidatoId)
            .Select(c => new { c.Nome, c.Email })
            .FirstOrDefaultAsync(ct);

        if (data is null || candidato is null) return;

        var vagaLabel = string.IsNullOrWhiteSpace(data.VagaCodigo)
            ? data.VagaTitulo ?? "Vaga"
            : $"{data.VagaTitulo} ({data.VagaCodigo})";

        var candidatoEsc = WebUtility.HtmlEncode(candidato.Nome ?? "");
        var emailEsc = WebUtility.HtmlEncode(candidato.Email ?? "");
        var vagaEsc = WebUtility.HtmlEncode(vagaLabel);

        var subject = $"Nova candidatura — {vagaLabel}";
        var html =
            "<p>Um candidato se candidatou a uma vaga pelo portal.</p>" +
            $"<p><strong>Candidato:</strong> {candidatoEsc}</p>" +
            $"<p><strong>E-mail:</strong> {emailEsc}</p>" +
            $"<p><strong>Vaga:</strong> {vagaEsc}</p>";

        var destinatarios = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(data.GestorEmail))
            destinatarios.Add(data.GestorEmail.Trim());
        if (!string.IsNullOrWhiteSpace(data.RecrutadorEmail))
            destinatarios.Add(data.RecrutadorEmail.Trim());

        foreach (var email in destinatarios)
        {
            try
            {
                await _emailQueue.EnqueueRawAsync(
                    email,
                    subject,
                    html,
                    bodyText: null,
                    isSystem: true,
                    source: "candidatura-responsavel",
                    ct);
            }
            catch
            {
                /* best-effort */
            }
        }
    }
}
