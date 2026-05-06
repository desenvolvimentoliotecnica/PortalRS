using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Messaging.Email;

public sealed class EmailConfigDto
{
    public string Provider { get; set; } = "smtp";
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public bool SmtpEnableSsl { get; set; } = true;
    public string? SmtpUserName { get; set; }
    public string? SmtpPassword { get; set; }
    public string? SmtpFromName { get; set; }
    public string? SmtpFromAddress { get; set; }
    public bool SmtpUseTestRedirect { get; set; }
    public string? SmtpTestRedirectAddress { get; set; }
    public string? ImapHost { get; set; }
    public int ImapPort { get; set; } = 993;
    public bool ImapEnableSsl { get; set; } = true;
    public string? ImapUserName { get; set; }
    public string? ImapPassword { get; set; }
}

public sealed class EmailConfigView
{
    public string Provider { get; set; } = "smtp";
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public bool SmtpEnableSsl { get; set; } = true;
    public string? SmtpUserName { get; set; }
    public bool SmtpHasPassword { get; set; }
    public string? SmtpFromName { get; set; }
    public string? SmtpFromAddress { get; set; }
    public bool SmtpUseTestRedirect { get; set; }
    public string? SmtpTestRedirectAddress { get; set; }
    public string? ImapHost { get; set; }
    public int ImapPort { get; set; } = 993;
    public bool ImapEnableSsl { get; set; } = true;
    public string? ImapUserName { get; set; }
    public bool ImapHasPassword { get; set; }
}

public interface IEmailConfigService
{
    Task<EmailConfigView?> GetAsync(CancellationToken ct);
    Task<EmailConfigView> SaveAsync(EmailConfigDto dto, CancellationToken ct);
    Task<EmailConfig?> GetEntityAsync(CancellationToken ct);
    Task<EmailConfigDto?> GetDecryptedAsync(CancellationToken ct);
}

public sealed class EmailConfigService : IEmailConfigService
{
    private readonly AppDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly ITenantContext _tenantContext;

    public EmailConfigService(AppDbContext db, ISecretProtector protector, ITenantContext tenantContext)
    {
        _db = db;
        _protector = protector;
        _tenantContext = tenantContext;
    }

    private async Task<EmailConfig?> FindConfigAsync(CancellationToken ct, bool tracking = false)
    {
        return tracking
            ? await _db.EmailConfigs.FirstOrDefaultAsync(ct)
            : await _db.EmailConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
    }

    public async Task<EmailConfigView?> GetAsync(CancellationToken ct)
    {
        var entity = await FindConfigAsync(ct);
        if (entity is null) return null;
        return MapView(entity);
    }

    public async Task<EmailConfig?> GetEntityAsync(CancellationToken ct)
    {
        return await FindConfigAsync(ct, tracking: true);
    }

    public async Task<EmailConfigDto?> GetDecryptedAsync(CancellationToken ct)
    {
        var entity = await FindConfigAsync(ct);
        if (entity is null) return null;

        return new EmailConfigDto
        {
            Provider = entity.Provider,
            SmtpHost = entity.SmtpHost,
            SmtpPort = entity.SmtpPort,
            SmtpEnableSsl = entity.SmtpEnableSsl,
            SmtpUserName = entity.SmtpUserName,
            SmtpPassword = string.IsNullOrWhiteSpace(entity.SmtpPasswordEncrypted)
                ? null
                : TryDecrypt(entity.SmtpPasswordEncrypted, "SMTP"),
            SmtpFromName = entity.SmtpFromName,
            SmtpFromAddress = entity.SmtpFromAddress,
            SmtpUseTestRedirect = entity.SmtpUseTestRedirect,
            SmtpTestRedirectAddress = entity.SmtpTestRedirectAddress,
            ImapHost = entity.ImapHost,
            ImapPort = entity.ImapPort,
            ImapEnableSsl = entity.ImapEnableSsl,
            ImapUserName = entity.ImapUserName,
            ImapPassword = string.IsNullOrWhiteSpace(entity.ImapPasswordEncrypted)
                ? null
                : TryDecrypt(entity.ImapPasswordEncrypted, "IMAP")
        };
    }

    public async Task<EmailConfigView> SaveAsync(EmailConfigDto dto, CancellationToken ct)
    {
        if (dto.SmtpUseTestRedirect)
        {
            var addr = dto.SmtpTestRedirectAddress?.Trim();
            if (string.IsNullOrWhiteSpace(addr))
                throw new InvalidOperationException("Informe o e-mail de redirecionamento quando o modo teste SMTP estiver ativo.");
            try
            {
                _ = new MailAddress(addr);
            }
            catch (FormatException)
            {
                throw new InvalidOperationException("E-mail de redirecionamento SMTP (modo teste) inválido.");
            }
        }

        var entity = await FindConfigAsync(ct, tracking: true);
        var now = DateTimeOffset.UtcNow;
        if (entity is null)
        {
            entity = new EmailConfig
            {
                Id = Guid.NewGuid(),
                CreatedAtUtc = now
            };
            _db.EmailConfigs.Add(entity);
        }

        if (string.IsNullOrWhiteSpace(entity.TenantId))
            entity.TenantId = _tenantContext.TenantId ?? string.Empty;

        entity.Provider = string.IsNullOrWhiteSpace(dto.Provider) ? "smtp" : dto.Provider.Trim().ToLowerInvariant();
        entity.SmtpHost = dto.SmtpHost?.Trim();
        entity.SmtpPort = dto.SmtpPort;
        entity.SmtpEnableSsl = dto.SmtpEnableSsl;
        entity.SmtpUserName = dto.SmtpUserName?.Trim();
        entity.SmtpFromName = dto.SmtpFromName?.Trim();
        entity.SmtpFromAddress = dto.SmtpFromAddress?.Trim();
        entity.SmtpUseTestRedirect = dto.SmtpUseTestRedirect;
        entity.SmtpTestRedirectAddress = dto.SmtpUseTestRedirect ? dto.SmtpTestRedirectAddress?.Trim() : null;
        entity.ImapHost = dto.ImapHost?.Trim();
        entity.ImapPort = dto.ImapPort;
        entity.ImapEnableSsl = dto.ImapEnableSsl;
        entity.ImapUserName = dto.ImapUserName?.Trim();
        entity.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(dto.SmtpPassword))
        {
            try
            {
                entity.SmtpPasswordEncrypted = _protector.Encrypt(dto.SmtpPassword);
                Console.Error.WriteLine($"[EmailConfig] Senha SMTP criptografada: {entity.SmtpPasswordEncrypted?.Length ?? 0} chars");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[EmailConfig] FALHA ao criptografar senha SMTP: {ex.Message}");
                // Salva sem criptografia como fallback temporário
                entity.SmtpPasswordEncrypted = dto.SmtpPassword;
            }
        }
        if (!string.IsNullOrWhiteSpace(dto.ImapPassword))
        {
            try { entity.ImapPasswordEncrypted = _protector.Encrypt(dto.ImapPassword); }
            catch { entity.ImapPasswordEncrypted = dto.ImapPassword; }
        }

        await _db.SaveChangesAsync(ct);

        // O EF Core com IgnoreQueryFilters pode não gerar UPDATE correto para a senha.
        // Forçar via SQL direto quando a senha mudou.
        Console.Error.WriteLine($"[EmailConfig] Entity Id={entity.Id}, TenantId={entity.TenantId}, SmtpPwEnc={entity.SmtpPasswordEncrypted?.Length}chars");
        if (!string.IsNullOrWhiteSpace(entity.SmtpPasswordEncrypted))
        {
            var rows = await _db.Database.ExecuteSqlRawAsync(
                "UPDATE \"EmailConfigs\" SET \"SmtpPasswordEncrypted\" = {0}, \"UpdatedAtUtc\" = {1} WHERE \"Id\" = {2}",
                entity.SmtpPasswordEncrypted, DateTimeOffset.UtcNow, entity.Id);
            Console.Error.WriteLine($"[EmailConfig] SQL UPDATE SmtpPassword rows={rows}");
        }
        if (!string.IsNullOrWhiteSpace(entity.ImapPasswordEncrypted))
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE \"EmailConfigs\" SET \"ImapPasswordEncrypted\" = {0}, \"UpdatedAtUtc\" = {1} WHERE \"Id\" = {2}",
                entity.ImapPasswordEncrypted, DateTimeOffset.UtcNow, entity.Id);
        }

        return MapView(entity);
    }

    private string? TryDecrypt(string encrypted, string label)
    {
        try
        {
            var result = _protector.Decrypt(encrypted);
            Console.Error.WriteLine($"[EmailConfig] {label} decriptação OK: {result?.Length ?? 0} chars");
            return result;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[EmailConfig] {label} decriptação FALHOU: {ex.Message}");
            return null;
        }
    }

    private static EmailConfigView MapView(EmailConfig entity)
    {
        return new EmailConfigView
        {
            Provider = entity.Provider,
            SmtpHost = entity.SmtpHost,
            SmtpPort = entity.SmtpPort,
            SmtpEnableSsl = entity.SmtpEnableSsl,
            SmtpUserName = entity.SmtpUserName,
            SmtpHasPassword = !string.IsNullOrWhiteSpace(entity.SmtpPasswordEncrypted),
            SmtpFromName = entity.SmtpFromName,
            SmtpFromAddress = entity.SmtpFromAddress,
            SmtpUseTestRedirect = entity.SmtpUseTestRedirect,
            SmtpTestRedirectAddress = entity.SmtpTestRedirectAddress,
            ImapHost = entity.ImapHost,
            ImapPort = entity.ImapPort,
            ImapEnableSsl = entity.ImapEnableSsl,
            ImapUserName = entity.ImapUserName,
            ImapHasPassword = !string.IsNullOrWhiteSpace(entity.ImapPasswordEncrypted)
        };
    }
}
