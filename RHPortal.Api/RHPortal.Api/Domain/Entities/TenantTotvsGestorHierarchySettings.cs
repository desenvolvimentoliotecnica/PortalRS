namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Config por tenant para sync de gestor direto via consulta SQL RM (consultaSQLServer/KNG...)
/// configurável na área Owner. Credenciais em texto cifrado.
/// </summary>
public sealed class TenantTotvsGestorHierarchySettings
{
    public string TenantId { get; set; } = default!;

    public Tenant Tenant { get; set; } = null!;

    /// <summary>
    /// URL da consulta com placeholders <c>{CODCOLIGADA}</c> e <c>{CHAPA}</c>
    /// (substituídos na chamada GET).
    /// </summary>
    public string ConsultaUrlTemplate { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string HttpUser { get; set; } = string.Empty;

    public string? PasswordEncrypted { get; set; }

    public int DefaultCodColigada { get; set; } = 1;

    public int DelayMsBetweenRequests { get; set; } = 250;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
