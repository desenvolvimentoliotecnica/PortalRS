namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>Job background + limites do sync CODSTATUS RM → <see cref="RhPortal.Api.Domain.Entities.SolicitacaoVaga"/>.</summary>
public sealed class RmSolicitacaoStatusSyncOptions
{
    public const string SectionName = "RmSolicitacaoStatusSync";

    public bool Enabled { get; set; }

    public int IntervalMinutes { get; set; } = 15;

    /// <summary>Máximo de solicitações por ciclo (HostedService ou POST sem ids).</summary>
    public int MaxPerRun { get; set; } = 50;
}
