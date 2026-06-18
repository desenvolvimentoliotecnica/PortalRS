namespace RhPortal.Api.Application.Authentication;

public sealed class HubSsoOptions
{
    public const string SectionName = "HubSso";

    /// <summary>Chave HMAC compartilhada com o Liotecnica Hub (≥ 32 caracteres).</summary>
    public string SigningKey { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Quando true, cria usuário com perfil Operacional no tenant se o e-mail do Hub ainda não existir.
    /// O Hub já controla quem pode abrir o sistema; o Portal só materializa o cadastro local.
    /// </summary>
    public bool AutoProvisionUsers { get; set; } = true;
}
