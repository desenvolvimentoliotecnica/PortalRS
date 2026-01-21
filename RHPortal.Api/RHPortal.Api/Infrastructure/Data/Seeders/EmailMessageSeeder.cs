using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailMessageSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        var exists = await db.EmailMessages.AnyAsync(x => x.TenantId == tenantId, ct);
        if (exists) return;

        var now = DateTimeOffset.UtcNow;
        var random = new Random(42);
        var subjects = new[]
        {
            "Confirmacao de candidatura",
            "Convite para entrevista",
            "Retorno sobre candidatura",
            "Atualizacao do processo seletivo",
            "Lembrete de documentacao",
            "Feedback da vaga"
        };

        var sources = new[] { "portal", "sistema", "triagem", "agenda" };
        var owners = new[]
        {
            new { Id = "user-1", Name = "LIOTECNICA Admin" },
            new { Id = "user-2", Name = "Recrutadora Ana" }
        };

        var messages = new List<EmailMessage>();
        for (var i = 0; i < 40; i++)
        {
            var owner = owners[random.Next(owners.Length)];
            var isSystem = i % 7 == 0;
            var status = (EmailMessageStatus)random.Next(0, 4);
            var created = now.AddMinutes(-random.Next(15, 6000));
            var attemptCount = status switch
            {
                EmailMessageStatus.Sent => random.Next(1, 3),
                EmailMessageStatus.Failed => random.Next(2, 4),
                _ => random.Next(0, 2)
            };

            var msg = new EmailMessage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OwnerUserId = isSystem ? null : owner.Id,
                OwnerUserName = isSystem ? null : owner.Name,
                IsSystem = isSystem,
                Source = sources[random.Next(sources.Length)],
                To = $"candidato{i + 1}@email.com",
                Subject = subjects[random.Next(subjects.Length)],
                BodyHtml = "<p>Mensagem de teste para validacao do layout.</p>",
                Status = status,
                AttemptCount = attemptCount,
                MaxAttempts = 3,
                NextAttemptAtUtc = status == EmailMessageStatus.Queued || status == EmailMessageStatus.InProgress
                    ? created.AddMinutes(5)
                    : null,
                LastError = status == EmailMessageStatus.Failed ? "Falha ao enviar email (SMTP)." : null,
                CreatedAtUtc = created,
                UpdatedAtUtc = created.AddMinutes(random.Next(1, 120))
            };

            for (var a = 1; a <= attemptCount; a++)
            {
                var attempt = new EmailAttempt
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EmailMessageId = msg.Id,
                    AttemptNumber = a,
                    Provider = "smtp",
                    StartedAtUtc = created.AddMinutes(a),
                    CompletedAtUtc = created.AddMinutes(a).AddSeconds(20),
                    IsSuccess = status == EmailMessageStatus.Sent && a == attemptCount,
                    ErrorMessage = status == EmailMessageStatus.Failed ? "Timeout no servidor SMTP." : null
                };
                msg.Attempts.Add(attempt);
            }

            messages.Add(msg);
        }

        db.EmailMessages.AddRange(messages);
        await db.SaveChangesAsync(ct);
    }
}
