using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Job de importação de CV do talento (processamento em background).</summary>
public sealed class TalentoCvImportJob : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TalentoId { get; set; }
    public Talento? Talento { get; set; }

    public Guid TalentoDocumentoId { get; set; }
    public TalentoDocumento? TalentoDocumento { get; set; }

    public CvImportStatus Status { get; set; } = CvImportStatus.Pendente;
    public bool EnviarParaGpt { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? StartedAtUtc { get; set; }
    public DateTimeOffset? FinishedAtUtc { get; set; }

    /// <summary>Quando Status = PendenteValidacao: talento similar encontrado.</summary>
    public Guid? SimilarTalentoId { get; set; }

    /// <summary>JSON com suggested data e dados para aprovar (quando PendenteValidacao).</summary>
    public string? SuggestedDataJson { get; set; }

    /// <summary>Mensagem de erro em caso de falha no processamento.</summary>
    public string? ErrorMessage { get; set; }
}
