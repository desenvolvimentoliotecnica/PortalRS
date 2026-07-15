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

    /// <summary>
    /// Enfileira e-mail somente ao gestor requisitante da vaga quando o RH registra um parecer
    /// (observação na candidatura). Best-effort: sem gestor/e-mail não falha.
    /// </summary>
    Task NotifyParecerRegistradoAsync(
        Guid candidaturaId,
        string observacao,
        string? etapaLabel,
        string? registradoPor,
        CancellationToken ct);
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

    public async Task NotifyParecerRegistradoAsync(
        Guid candidaturaId,
        string observacao,
        string? etapaLabel,
        string? registradoPor,
        CancellationToken ct)
    {
        var text = observacao?.Trim();
        if (string.IsNullOrWhiteSpace(text))
            return;

        var row = await _db.Candidaturas
            .AsNoTracking()
            .Where(c => c.Id == candidaturaId)
            .Select(c => new
            {
                CandidatoNome = c.Candidato != null ? c.Candidato.Nome : null,
                VagaTitulo = c.Vaga != null ? c.Vaga.Titulo : null,
                VagaCodigo = c.Vaga != null ? c.Vaga.Codigo : null,
                EtapaMacro = c.EtapaMacro,
                GestorEmail = c.Vaga != null && c.Vaga.GestorRequisitanteFuncionario != null
                    ? c.Vaga.GestorRequisitanteFuncionario.Email
                    : null,
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return;

        var gestorEmail = row.GestorEmail?.Trim();
        if (string.IsNullOrWhiteSpace(gestorEmail))
            return;

        var vagaLabel = string.IsNullOrWhiteSpace(row.VagaCodigo)
            ? row.VagaTitulo ?? "Vaga"
            : $"{row.VagaTitulo} ({row.VagaCodigo})";
        var etapa = string.IsNullOrWhiteSpace(etapaLabel)
            ? row.EtapaMacro.ToString()
            : etapaLabel.Trim();

        var candidatoEsc = WebUtility.HtmlEncode(row.CandidatoNome ?? "");
        var vagaEsc = WebUtility.HtmlEncode(vagaLabel);
        var etapaEsc = WebUtility.HtmlEncode(etapa);
        var parecerEsc = WebUtility.HtmlEncode(text).Replace("\n", "<br/>");
        var porEsc = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(registradoPor) ? "RH" : registradoPor.Trim());

        var subject = $"Parecer registrado — {vagaLabel}";
        var html =
            "<p>A equipe de RH registrou um parecer nesta candidatura.</p>" +
            $"<p><strong>Candidato:</strong> {candidatoEsc}</p>" +
            $"<p><strong>Vaga:</strong> {vagaEsc}</p>" +
            $"<p><strong>Etapa:</strong> {etapaEsc}</p>" +
            $"<p><strong>Registrado por:</strong> {porEsc}</p>" +
            $"<p><strong>Parecer:</strong></p><p>{parecerEsc}</p>";

        try
        {
            await _emailQueue.EnqueueRawAsync(
                gestorEmail,
                subject,
                html,
                bodyText: null,
                isSystem: true,
                source: "candidatura-parecer-gestor",
                ct);
        }
        catch
        {
            /* best-effort */
        }
    }
}
