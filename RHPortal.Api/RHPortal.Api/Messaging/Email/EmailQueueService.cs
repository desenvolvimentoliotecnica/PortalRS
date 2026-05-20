using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Messaging.Email;

public interface IEmailQueueService
{
    Task<EmailMessage> EnqueueTemplateAsync(
        string templateName,
        string to,
        IReadOnlyDictionary<string, string?> tokens,
        bool isSystem,
        string? source,
        CancellationToken ct);

    Task<EmailMessage> EnqueueRawAsync(
        string to,
        string subject,
        string bodyHtml,
        string? bodyText,
        bool isSystem,
        string? source,
        CancellationToken ct);

    Task<EmailMessage> EnqueueRawAsync(
        string to,
        string subject,
        string bodyHtml,
        string? bodyText,
        IReadOnlyList<EmailAttachmentPayload> attachments,
        bool isSystem,
        string? source,
        CancellationToken ct);
}

public sealed record EmailAttachmentPayload(
    string FileName,
    string? ContentType,
    byte[] ContentBytes);

public sealed class EmailQueueService : IEmailQueueService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;
    private readonly IEmailConfigService _emailConfig;

    public EmailQueueService(
        AppDbContext db,
        ITenantContext tenantContext,
        IHttpContextAccessor httpContextAccessor,
        IStringLocalizer<InfrastructureMessages> localizer,
        IEmailConfigService emailConfig)
    {
        _db = db;
        _tenantContext = tenantContext;
        _httpContextAccessor = httpContextAccessor;
        _localizer = localizer;
        _emailConfig = emailConfig;
    }

    public async Task<EmailMessage> EnqueueTemplateAsync(
        string templateName,
        string to,
        IReadOnlyDictionary<string, string?> tokens,
        bool isSystem,
        string? source,
        CancellationToken ct)
    {
        var template = await _db.EmailTemplates
            .Where(x => x.Name == templateName && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (template is null)
            throw new InvalidOperationException(_localizer["InfrastructureEmail.TemplateNotFound", templateName]);

        var subject = EmailTemplateRenderer.Render(template.SubjectTemplate, tokens);
        var body = EmailTemplateRenderer.Render(template.BodyHtml, tokens);

        var decrypted = await _emailConfig.GetDecryptedAsync(ct);
        (to, subject, body, _) = SmtpTestRedirectFormatting.Apply(to, subject, body, null, decrypted);

        var message = BuildMessage(to, subject, body, null, isSystem, source);
        message.TemplateId = template.Id;
        message.TemplateName = template.Name;
        message.TemplateVersion = template.Version;
        message.PayloadJson = EmailTemplateRenderer.ToJson(tokens);

        _db.EmailMessages.Add(message);
        await _db.SaveChangesAsync(ct);
        return message;
    }

    public async Task<EmailMessage> EnqueueRawAsync(
        string to,
        string subject,
        string bodyHtml,
        string? bodyText,
        bool isSystem,
        string? source,
        CancellationToken ct)
    {
        return await EnqueueRawAsync(to, subject, bodyHtml, bodyText, Array.Empty<EmailAttachmentPayload>(), isSystem, source, ct);
    }

    public async Task<EmailMessage> EnqueueRawAsync(
        string to,
        string subject,
        string bodyHtml,
        string? bodyText,
        IReadOnlyList<EmailAttachmentPayload> attachments,
        bool isSystem,
        string? source,
        CancellationToken ct)
    {
        var dto = await _emailConfig.GetDecryptedAsync(ct);
        (to, subject, bodyHtml, bodyText) = SmtpTestRedirectFormatting.Apply(to, subject, bodyHtml, bodyText, dto);

        var message = BuildMessage(to, subject, bodyHtml, bodyText, isSystem, source);
        var now = DateTimeOffset.UtcNow;
        foreach (var attachment in attachments)
        {
            if (attachment.ContentBytes.Length == 0)
                continue;

            message.Attachments.Add(new EmailMessageAttachment
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                FileName = attachment.FileName.Trim(),
                ContentType = string.IsNullOrWhiteSpace(attachment.ContentType) ? "application/octet-stream" : attachment.ContentType.Trim(),
                SizeBytes = attachment.ContentBytes.LongLength,
                ContentBytes = attachment.ContentBytes,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }

        _db.EmailMessages.Add(message);
        await _db.SaveChangesAsync(ct);
        return message;
    }

    private EmailMessage BuildMessage(string to, string subject, string bodyHtml, string? bodyText, bool isSystem, string? source)
    {
        var (userId, userName) = GetUser();
        var now = DateTimeOffset.UtcNow;

        return new EmailMessage
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            OwnerUserId = isSystem ? null : userId,
            OwnerUserName = isSystem ? null : userName,
            IsSystem = isSystem,
            Source = source,
            To = to.Trim(),
            Subject = subject.Trim(),
            BodyHtml = bodyHtml,
            BodyText = bodyText,
            Status = EmailMessageStatus.Queued,
            AttemptCount = 0,
            MaxAttempts = 3,
            NextAttemptAtUtc = DateTimeOffset.UtcNow,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
    }

    private (string? userId, string? userName) GetUser()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        if (user is null) return (null, null);
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        var name = user.Identity?.Name ?? user.FindFirstValue(ClaimTypes.Name);
        return (id, name);
    }
}
