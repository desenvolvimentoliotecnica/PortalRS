namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Branding / white-label do tenant — personaliza o portal (tela de login, header interno,
/// footer) para a empresa que contratou a plataforma.
/// Um único registro por tenant (upsert via TenantBrandingService).
///
/// Campos opcionais (null = usar default da plataforma).
/// </summary>
public sealed class TenantBranding : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>
    /// Nome do portal exibido no header da tela de login e no cabeçalho interno.
    /// Default da plataforma: "Portal de RH".
    /// </summary>
    public string? NomePortal { get; set; }

    /// <summary>
    /// Subtítulo/tagline exibido abaixo do nome do portal.
    /// Default da plataforma: "Gestão de pessoas e recrutamento".
    /// </summary>
    public string? Subtitulo { get; set; }

    /// <summary>
    /// Texto customizado do footer. Suporta placeholder {ano} para o ano corrente.
    /// Default da plataforma: "© {ano} · {NomePortal}".
    /// </summary>
    public string? RodapeTexto { get; set; }

    /// <summary>
    /// Cor primária (usada no gradiente do ícone e botão).
    /// Formato: #RRGGBB. Default da plataforma: "#0C3A64".
    /// </summary>
    public string? CorPrimariaHex { get; set; }

    /// <summary>
    /// Cor secundária (usada como destino do gradiente).
    /// Formato: #RRGGBB. Default da plataforma: "#105291".
    /// </summary>
    public string? CorSecundariaHex { get; set; }

    /// <summary>
    /// URL da logo (absoluta ou relativa ao frontend). Quando informada, substitui o ícone
    /// Building2 default.
    /// </summary>
    public string? LogoUrl { get; set; }

    /// <summary>
    /// Versão exibida no canto inferior direito do card de login. Default: "v2.5".
    /// </summary>
    public string? VersaoExibida { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
