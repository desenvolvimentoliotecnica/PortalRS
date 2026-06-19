namespace LiotecnicaHub.Web.Infrastructure.Options;

public sealed class HubOptions
{
    public const string SectionName = "Hub";

    public string StateSigningKey { get; set; } = string.Empty;

    /// <summary>Chave HMAC para tokens SSO Hub → apps filhos. Se vazio, usa <see cref="StateSigningKey"/>.</summary>
    public string SsoSigningKey { get; set; } = string.Empty;

    /// <summary>Permite login local por e-mail e senha (além do Microsoft Entra).</summary>
    public bool AllowPasswordLogin { get; set; } = true;

    /// <summary>Legado — se true, habilita login por senha quando <see cref="AllowPasswordLogin"/> não estiver definido.</summary>
    public bool AllowDevLogin { get; set; }

    /// <summary>Senha inicial ao cadastrar usuário no admin.</summary>
    public string DefaultUserPassword { get; set; } = "Liotec@2026";
}
