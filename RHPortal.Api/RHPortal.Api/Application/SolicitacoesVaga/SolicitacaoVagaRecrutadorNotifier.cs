using System.Net;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public interface ISolicitacaoVagaRecrutadorNotifier
{
    /// <param name="excludeEmail">
    /// E-mail já notificado pelo magic link (mesmo primeiro aprovador com perfil Recrutador) — não duplica mensagem genérica.</param>
    Task NotifyNovaEnviadaAsync(SolicitacaoVaga entity, CancellationToken ct, string? excludeEmail = null);
    Task NotifyFinalizadaAsync(Guid solicitacaoId, CancellationToken ct);
}

/// <summary>
/// Envia e-mail aos usuários ativos com perfil cujo nome começa com "Recrutador"
/// (mesma regra de <c>LookupController.UsersRecrutadores</c>).
/// </summary>
public sealed class SolicitacaoVagaRecrutadorNotifier : ISolicitacaoVagaRecrutadorNotifier
{
    private readonly AppDbContext _db;
    private readonly IEmailQueueService _emailQueue;
    private readonly IFrontendPublicUrlBuilder _frontendUrls;

    public SolicitacaoVagaRecrutadorNotifier(
        AppDbContext db,
        IEmailQueueService emailQueue,
        IFrontendPublicUrlBuilder frontendUrls)
    {
        _db = db;
        _emailQueue = emailQueue;
        _frontendUrls = frontendUrls;
    }

    public Task NotifyNovaEnviadaAsync(SolicitacaoVaga entity, CancellationToken ct, string? excludeEmail = null) =>
        EnqueueParaRecrutadoresAsync(entity, novaEnviada: true, ct, excludeEmail);

    public async Task NotifyFinalizadaAsync(Guid solicitacaoId, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == solicitacaoId, ct);
        if (entity is null) return;
        if (entity.Status != SolicitacaoStatus.Aprovada
            && entity.Status != SolicitacaoStatus.Concluida
            && entity.Status != SolicitacaoStatus.ContratacaoConcluida)
            return;

        await EnqueueParaRecrutadoresAsync(entity, novaEnviada: false, ct, excludeEmail: null);
    }

    private async Task EnqueueParaRecrutadoresAsync(
        SolicitacaoVaga entity,
        bool novaEnviada,
        CancellationToken ct,
        string? excludeEmail)
    {
        var emails = await GetActiveRecrutadorEmailsAsync(ct);
        if (emails.Count == 0) return;

        var tituloEsc = WebUtility.HtmlEncode(entity.Titulo ?? "");
        var absoluteUrl = _frontendUrls.BuildAbsoluteUrl(SolicitacaoVagaFrontendLinks.SolicitacaoVagaEmailPublicPath(entity.Id));
        string subject;
        string html;
        if (novaEnviada)
        {
            subject = $"Nova requisição de vaga enviada — {entity.Titulo}";
            html =
                "<p>Uma nova requisição de vaga foi <strong>enviada</strong>.</p>" +
                $"<p><strong>{tituloEsc}</strong></p>" +
                $"<p><a href=\"{WebUtility.HtmlEncode(absoluteUrl)}\">Abrir solicitação</a></p>";
        }
        else
        {
            subject = $"Requisição de vaga finalizada — {entity.Titulo}";
            var statusEsc = WebUtility.HtmlEncode(entity.Status.ToString());
            html =
                "<p>A requisição de vaga foi <strong>finalizada</strong> para fins de recrutamento.</p>" +
                $"<p><strong>{tituloEsc}</strong></p>" +
                $"<p>Status: <strong>{statusEsc}</strong></p>" +
                $"<p><a href=\"{WebUtility.HtmlEncode(absoluteUrl)}\">Abrir solicitação</a></p>";
        }

        string? excludeNorm = string.IsNullOrWhiteSpace(excludeEmail) ? null : excludeEmail.Trim();

        foreach (var email in emails)
        {
            try
            {
                if (excludeNorm is not null
                    && string.Equals(email.Trim(), excludeNorm, StringComparison.OrdinalIgnoreCase))
                    continue;

                await _emailQueue.EnqueueRawAsync(
                    email, subject, html, null,
                    isSystem: true, source: "SolicitacaoVagaRecrutadores", ct);
            }
            catch
            {
                /* best-effort */
            }
        }
    }

    private async Task<IReadOnlyList<string>> GetActiveRecrutadorEmailsAsync(CancellationToken ct)
    {
        var recrutadorRoleIds = await _db.Roles
            .AsNoTracking()
            .Where(r => r.Name != null && r.Name.ToLower().StartsWith("recrutador"))
            .Select(r => r.Id)
            .ToListAsync(ct);

        if (recrutadorRoleIds.Count == 0)
            return Array.Empty<string>();

        var userIds = await _db.Set<ApplicationUserRole>()
            .AsNoTracking()
            .Where(ur => recrutadorRoleIds.Contains(ur.RoleId))
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync(ct);

        if (userIds.Count == 0)
            return Array.Empty<string>();

        return await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id) && u.IsActive && u.Email != null && u.Email != "")
            .OrderBy(u => u.Email)
            .Select(u => u.Email!)
            .Distinct()
            .ToListAsync(ct);
    }
}
