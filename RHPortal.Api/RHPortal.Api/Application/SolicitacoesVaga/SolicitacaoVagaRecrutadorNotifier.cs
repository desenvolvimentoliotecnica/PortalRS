using System.Net;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public interface ISolicitacaoVagaRecrutadorNotifier
{
    Task NotifyNovaEnviadaAsync(SolicitacaoVaga entity, CancellationToken ct);
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

    public SolicitacaoVagaRecrutadorNotifier(AppDbContext db, IEmailQueueService emailQueue)
    {
        _db = db;
        _emailQueue = emailQueue;
    }

    public Task NotifyNovaEnviadaAsync(SolicitacaoVaga entity, CancellationToken ct) =>
        EnqueueParaRecrutadoresAsync(entity, novaEnviada: true, ct);

    public async Task NotifyFinalizadaAsync(Guid solicitacaoId, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == solicitacaoId, ct);
        if (entity is null) return;
        if (entity.Status != SolicitacaoStatus.Aprovada
            && entity.Status != SolicitacaoStatus.Concluida
            && entity.Status != SolicitacaoStatus.ContratacaoConcluida)
            return;

        await EnqueueParaRecrutadoresAsync(entity, novaEnviada: false, ct);
    }

    private async Task EnqueueParaRecrutadoresAsync(SolicitacaoVaga entity, bool novaEnviada, CancellationToken ct)
    {
        var emails = await GetActiveRecrutadorEmailsAsync(ct);
        if (emails.Count == 0) return;

        var tituloEsc = WebUtility.HtmlEncode(entity.Titulo ?? "");
        var path = $"/rs/solicitacoes/{entity.Id}";
        string subject;
        string html;
        if (novaEnviada)
        {
            subject = $"Nova requisição de vaga enviada — {entity.Titulo}";
            html =
                "<p>Uma nova requisição de vaga foi <strong>enviada</strong>.</p>" +
                $"<p><strong>{tituloEsc}</strong></p>" +
                $"<p><a href=\"{path}\">Abrir solicitação</a></p>";
        }
        else
        {
            subject = $"Requisição de vaga finalizada — {entity.Titulo}";
            var statusEsc = WebUtility.HtmlEncode(entity.Status.ToString());
            html =
                "<p>A requisição de vaga foi <strong>finalizada</strong> para fins de recrutamento.</p>" +
                $"<p><strong>{tituloEsc}</strong></p>" +
                $"<p>Status: <strong>{statusEsc}</strong></p>" +
                $"<p><a href=\"{path}\">Abrir solicitação</a></p>";
        }

        foreach (var email in emails)
        {
            try
            {
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
