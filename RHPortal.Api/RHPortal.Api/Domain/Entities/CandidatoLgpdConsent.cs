using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoLgpdConsent : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid CandidatoId { get; set; }

    public bool ProcessarCandidatura { get; set; }
    public bool PermitirContato { get; set; }
    public bool BancoTalentos { get; set; }
    public int? RetencaoMeses { get; set; }
    public LgpdSharingScope? Compartilhamento { get; set; }
    public bool DadosSensiveis { get; set; }
    public bool Comunicacoes { get; set; }

    public DateTimeOffset? ConsentidoEmUtc { get; set; }
    public DateTimeOffset? RevogadoEmUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public Candidato? Candidato { get; set; }
}
