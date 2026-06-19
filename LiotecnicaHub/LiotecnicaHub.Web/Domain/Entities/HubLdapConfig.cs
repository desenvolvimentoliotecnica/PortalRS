using LiotecnicaHub.Web.Domain.Enums;

namespace LiotecnicaHub.Web.Domain.Entities;

public class HubLdapConfig
{
    public Guid Id { get; set; }
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
    public string? BindPasswordProtected { get; set; }
    public string SearchFilterTemplate { get; set; } = "(|(mail={0})(userPrincipalName={0})(sAMAccountName={0}))";
    public string DisplayNameAttribute { get; set; } = "displayName";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
