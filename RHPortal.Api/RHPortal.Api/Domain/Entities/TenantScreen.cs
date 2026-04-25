namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Override de exibição de uma tela (item do NavegacaoManifest) para um tenant.
/// Armazenado no master, gerenciado pelo Owner.
/// Estado: "ativo" (padrão) | "oculto" (não aparece no sidebar) | "bloqueado" (aparece com cadeado).
/// </summary>
public sealed class TenantScreen
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string NavItemId { get; set; } = default!;
    public string Estado { get; set; } = EstadoTela.Ativo;
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public Guid? UpdatedByOwnerId { get; set; }

    public Tenant? Tenant { get; set; }
    public Owner? UpdatedByOwner { get; set; }
}

public static class EstadoTela
{
    public const string Ativo = "ativo";
    public const string Oculto = "oculto";
    public const string Bloqueado = "bloqueado";

    public static bool IsValid(string? value) =>
        value is Ativo or Oculto or Bloqueado;
}
