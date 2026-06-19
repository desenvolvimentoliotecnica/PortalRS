using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using LiotecnicaHub.Web.Infrastructure.Data;
using LiotecnicaHub.Web.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Application.Authentication;

public sealed class HubLdapConfigDto
{
    public bool IsEnabled { get; set; }
    public string? Server { get; set; }
    public int Port { get; set; } = 636;
    public bool UseSsl { get; set; } = true;
    public bool UseStartTls { get; set; }
    public bool SkipServerCertificateValidation { get; set; }
    public string? BaseDn { get; set; }
    public string? UserSearchBase { get; set; }
    public string? Domain { get; set; }
    public HubLdapLoginIdentityMode LoginIdentityMode { get; set; } = HubLdapLoginIdentityMode.UserPrincipalName;
    public string? BindDn { get; set; }
    public string? BindPassword { get; set; }
    public string SearchFilterTemplate { get; set; } = "(|(mail={0})(userPrincipalName={0})(sAMAccountName={0}))";
    public string DisplayNameAttribute { get; set; } = "displayName";
}

public sealed class HubLdapConfigView
{
    public bool IsEnabled { get; set; }
    public string? Server { get; set; }
    public int Port { get; set; }
    public bool UseSsl { get; set; }
    public bool UseStartTls { get; set; }
    public bool SkipServerCertificateValidation { get; set; }
    public string? BaseDn { get; set; }
    public string? UserSearchBase { get; set; }
    public string? Domain { get; set; }
    public HubLdapLoginIdentityMode LoginIdentityMode { get; set; }
    public string? BindDn { get; set; }
    public bool HasBindPassword { get; set; }
    public string SearchFilterTemplate { get; set; } = string.Empty;
    public string DisplayNameAttribute { get; set; } = "displayName";
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Server)
        && !string.IsNullOrWhiteSpace(BaseDn)
        && Port is > 0 and <= 65535;
}

public interface IHubLdapConfigService
{
    Task<HubLdapConfigView?> GetAsync(CancellationToken ct);
    Task<HubLdapConfigView> SaveAsync(HubLdapConfigDto dto, CancellationToken ct);
    Task<HubLdapConfigDto?> GetDecryptedAsync(CancellationToken ct);
    Task<bool> IsLoginEnabledAsync(CancellationToken ct);
}

public sealed class HubLdapConfigService : IHubLdapConfigService
{
    private readonly HubDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly ILogger<HubLdapConfigService> _logger;

    public HubLdapConfigService(
        HubDbContext db,
        ISecretProtector protector,
        ILogger<HubLdapConfigService> logger)
    {
        _db = db;
        _protector = protector;
        _logger = logger;
    }

    public async Task<HubLdapConfigView?> GetAsync(CancellationToken ct)
    {
        var entity = await _db.LdapConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return entity is null ? null : MapView(entity);
    }

    public async Task<HubLdapConfigDto?> GetDecryptedAsync(CancellationToken ct)
    {
        var entity = await _db.LdapConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null) return null;

        return MapDto(entity, TryUnprotectBindPassword(entity.BindPasswordProtected));
    }

    public async Task<bool> IsLoginEnabledAsync(CancellationToken ct)
    {
        var view = await GetAsync(ct);
        return view is { IsEnabled: true, IsConfigured: true };
    }

    public async Task<HubLdapConfigView> SaveAsync(HubLdapConfigDto dto, CancellationToken ct)
    {
        Validate(dto);

        var entity = await _db.LdapConfigs.FirstOrDefaultAsync(ct);
        var now = DateTimeOffset.UtcNow;
        if (entity is null)
        {
            entity = new HubLdapConfig
            {
                Id = Guid.NewGuid(),
                CreatedAtUtc = now
            };
            _db.LdapConfigs.Add(entity);
        }

        entity.IsEnabled = dto.IsEnabled;
        entity.Server = dto.Server?.Trim();
        entity.Port = dto.Port;
        entity.UseSsl = dto.UseSsl;
        entity.UseStartTls = dto.UseStartTls;
        entity.SkipServerCertificateValidation = dto.SkipServerCertificateValidation;
        entity.BaseDn = dto.BaseDn?.Trim();
        entity.UserSearchBase = string.IsNullOrWhiteSpace(dto.UserSearchBase) ? null : dto.UserSearchBase.Trim();
        entity.Domain = string.IsNullOrWhiteSpace(dto.Domain) ? null : dto.Domain.Trim();
        entity.LoginIdentityMode = dto.LoginIdentityMode;
        entity.BindDn = string.IsNullOrWhiteSpace(dto.BindDn) ? null : dto.BindDn.Trim();
        entity.SearchFilterTemplate = NormalizeSearchFilter(dto.SearchFilterTemplate);
        entity.DisplayNameAttribute = NormalizeDisplayNameAttribute(dto.DisplayNameAttribute);
        entity.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(dto.BindPassword))
            entity.BindPasswordProtected = _protector.Protect(dto.BindPassword.Trim());

        await _db.SaveChangesAsync(ct);
        return MapView(entity);
    }

    private static void Validate(HubLdapConfigDto dto)
    {
        if (dto.Port is <= 0 or > 65535)
            throw new InvalidOperationException("Informe uma porta LDAP válida (1–65535).");

        if (dto.UseSsl && dto.UseStartTls)
            throw new InvalidOperationException("Use LDAPS ou StartTLS, não os dois ao mesmo tempo.");

        if (dto.IsEnabled)
        {
            if (string.IsNullOrWhiteSpace(dto.Server))
                throw new InvalidOperationException("Informe o servidor LDAP para habilitar o login.");

            if (string.IsNullOrWhiteSpace(dto.BaseDn))
                throw new InvalidOperationException("Informe o Base DN para habilitar o login LDAP.");
        }

        if (dto.LoginIdentityMode == HubLdapLoginIdentityMode.SamAccountName
            && string.IsNullOrWhiteSpace(dto.Domain))
        {
            throw new InvalidOperationException(
                "Informe o domínio Windows (NETBIOS) quando o formato de login for SAM.");
        }

        if (dto.LoginIdentityMode == HubLdapLoginIdentityMode.SearchAndBind
            && string.IsNullOrWhiteSpace(dto.BindDn))
        {
            throw new InvalidOperationException(
                "Informe a conta de serviço (Bind DN) para o modo Buscar e autenticar.");
        }
    }

    private static HubLdapConfigView MapView(HubLdapConfig entity) => new()
    {
        IsEnabled = entity.IsEnabled,
        Server = entity.Server,
        Port = entity.Port,
        UseSsl = entity.UseSsl,
        UseStartTls = entity.UseStartTls,
        SkipServerCertificateValidation = entity.SkipServerCertificateValidation,
        BaseDn = entity.BaseDn,
        UserSearchBase = entity.UserSearchBase,
        Domain = entity.Domain,
        LoginIdentityMode = entity.LoginIdentityMode,
        BindDn = entity.BindDn,
        HasBindPassword = !string.IsNullOrWhiteSpace(entity.BindPasswordProtected),
        SearchFilterTemplate = entity.SearchFilterTemplate,
        DisplayNameAttribute = entity.DisplayNameAttribute
    };

    private static HubLdapConfigDto MapDto(HubLdapConfig entity, string? bindPassword) => new()
    {
        IsEnabled = entity.IsEnabled,
        Server = entity.Server,
        Port = entity.Port,
        UseSsl = entity.UseSsl,
        UseStartTls = entity.UseStartTls,
        SkipServerCertificateValidation = entity.SkipServerCertificateValidation,
        BaseDn = entity.BaseDn,
        UserSearchBase = entity.UserSearchBase,
        Domain = entity.Domain,
        LoginIdentityMode = entity.LoginIdentityMode,
        BindDn = entity.BindDn,
        BindPassword = bindPassword,
        SearchFilterTemplate = entity.SearchFilterTemplate,
        DisplayNameAttribute = entity.DisplayNameAttribute
    };

    private string? TryUnprotectBindPassword(string? protectedPassword)
    {
        if (string.IsNullOrWhiteSpace(protectedPassword))
            return null;

        try
        {
            return _protector.Unprotect(protectedPassword);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Falha ao descriptografar senha da conta de serviço LDAP. Reconfigure no Admin.");
            return null;
        }
    }

    private static string NormalizeSearchFilter(string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrWhiteSpace(value))
            return "(|(mail={0})(userPrincipalName={0})(sAMAccountName={0}))";

        if (!value.Contains("{0}", StringComparison.Ordinal))
            throw new InvalidOperationException("O filtro LDAP deve conter o placeholder {0} para o login do usuário.");

        return value;
    }

    private static string NormalizeDisplayNameAttribute(string? raw)
    {
        var value = raw?.Trim();
        return string.IsNullOrWhiteSpace(value) ? "displayName" : value;
    }
}
