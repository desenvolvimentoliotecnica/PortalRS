using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Mensagem interna exibida no workspace do candidato no Portal de Vagas.
/// Usada pelo RH para pedir atualização de dados sem depender de e-mail/WhatsApp.
/// </summary>
public sealed class CandidatoPortalNotificacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid? VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    public Guid? CandidaturaId { get; set; }
    public Candidatura? Candidatura { get; set; }

    [Required, StringLength(60)]
    public string Tipo { get; set; } = "CompletarDados";

    [Required, StringLength(160)]
    public string Titulo { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Mensagem { get; set; } = string.Empty;

    /// <summary>JSON simples com os campos solicitados pelo RH.</summary>
    public string? CamposPendentesJson { get; set; }

    public DateTimeOffset? LidaEmUtc { get; set; }
    public DateTimeOffset? ResolvidaEmUtc { get; set; }

    public Guid? CriadaPorUserId { get; set; }
    [StringLength(200)]
    public string? CriadaPorNome { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
