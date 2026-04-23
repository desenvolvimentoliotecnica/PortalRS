using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Par (avaliador, avaliando) gerado automaticamente ao ativar um ciclo.
/// Permite acompanhar quem foi convocado para responder e quem já respondeu.
/// </summary>
public sealed class AvaliacaoConvite : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CicloId { get; set; }
    public AvaliacaoCiclo? Ciclo { get; set; }

    public Guid AvaliadorId { get; set; }
    public Funcionario? Avaliador { get; set; }

    public Guid AvaliandoId { get; set; }
    public Funcionario? Avaliando { get; set; }

    public AvaliacaoConviteTipo Tipo { get; set; }
    public AvaliacaoConviteStatus Status { get; set; } = AvaliacaoConviteStatus.Pendente;

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset? NotificadoEmUtc { get; set; }
    public DateTimeOffset? RespondidoEmUtc { get; set; }
}
