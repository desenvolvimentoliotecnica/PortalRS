using Bogus;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailMessageSeeder
{
    public static async Task EnsureAsync(
        AppDbContext db,
        string tenantId,
        int targetCount,
        CancellationToken ct,
        IStringLocalizer<SeedMessages> localizer,
        int? randomSeed = null)
    {
        targetCount = Math.Max(0, targetCount);
        if (targetCount == 0)
            return;

        var existingCount = await db.EmailMessages.CountAsync(x => x.TenantId == tenantId, ct);
        if (existingCount >= targetCount)
            return;

        var seed = (randomSeed ?? 42) + 31;
        var faker = new Faker("pt_BR")
        {
            Random = new Randomizer(seed)
        };

        var now = DateTimeOffset.UtcNow;
        var subjects = new[]
        {
            localizer["Seed.EmailSubjectConfirmacao"].Value,
            localizer["Seed.EmailSubjectEntrevista"].Value,
            localizer["Seed.EmailSubjectRetorno"].Value,
            localizer["Seed.EmailSubjectAtualizacao"].Value,
            localizer["Seed.EmailSubjectLembrete"].Value,
            localizer["Seed.EmailSubjectFeedback"].Value
        };

        var sources = new[] { "portal", "sistema", "triagem", "agenda" };
        var owners = Enumerable.Range(1, 3)
            .Select(i => new { Id = $"user-{i}", Name = faker.Name.FullName() })
            .ToArray();

        var toCreate = targetCount - existingCount;
        var messages = new List<EmailMessage>();
        for (var i = 0; i < toCreate; i++)
        {
            var owner = faker.PickRandom(owners);
            var isSystem = faker.Random.Bool(0.15f);
            var status = faker.PickRandom(Enum.GetValues<EmailMessageStatus>());
            var created = now.AddMinutes(-faker.Random.Int(15, 6000));
            var attemptCount = status switch
            {
                EmailMessageStatus.Sent => faker.Random.Int(1, 2),
                EmailMessageStatus.Failed => faker.Random.Int(2, 3),
                _ => faker.Random.Int(0, 1)
            };

            var subject = faker.PickRandom(subjects);
            if (faker.Random.Bool(0.5f))
                subject = $"{subject} - {faker.Name.JobTitle()}";

            var msg = new EmailMessage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OwnerUserId = isSystem ? null : owner.Id,
                OwnerUserName = isSystem ? null : owner.Name,
                IsSystem = isSystem,
                Source = faker.PickRandom(sources),
                To = faker.Internet.Email(),
                Subject = subject,
                BodyHtml = $"<p>{faker.Lorem.Sentence(10)}</p>",
                Status = status,
                AttemptCount = attemptCount,
                MaxAttempts = 3,
                NextAttemptAtUtc = status == EmailMessageStatus.Queued || status == EmailMessageStatus.InProgress
                    ? created.AddMinutes(5)
                    : null,
                LastError = status == EmailMessageStatus.Failed ? localizer["Seed.EmailSendFailure"].Value : null,
                CreatedAtUtc = created,
                UpdatedAtUtc = created.AddMinutes(faker.Random.Int(1, 120))
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
                    ErrorMessage = status == EmailMessageStatus.Failed ? localizer["Seed.SmtpTimeout"].Value : null
                };
                msg.Attempts.Add(attempt);
            }

            messages.Add(msg);
        }

        db.EmailMessages.AddRange(messages);
        await db.SaveChangesAsync(ct);
    }
}
