using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class InboxItem : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public InboxOrigem Origem { get; set; } = InboxOrigem.Email;
    public InboxStatus Status { get; set; } = InboxStatus.Novo;

    public DateTimeOffset RecebidoEm { get; set; }

    [StringLength(180)]
    public string? Remetente { get; set; }

    [StringLength(220)]
    public string? Assunto { get; set; }

    [StringLength(200)]
    public string? Destinatario { get; set; }

    public Guid? VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }
    public Guid? CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public string? PreviewText { get; set; }

    public int ProcessamentoPct { get; set; }

    [StringLength(120)]
    public string? ProcessamentoEtapa { get; set; }

    public int ProcessamentoTentativas { get; set; }

    [StringLength(400)]
    public string? ProcessamentoUltimoErro { get; set; }

    public string? ProcessamentoLogRaw { get; set; }

    public string? SuggestedVagasJson { get; set; }

    public List<InboxAnexo> Anexos { get; set; } = new();

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class InboxAnexo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid InboxItemId { get; set; }
    public InboxItem? InboxItem { get; set; }

    [StringLength(200)]
    public string Nome { get; set; } = string.Empty;

    [StringLength(20)]
    public string? Tipo { get; set; }

    public int TamanhoKB { get; set; }

    [StringLength(120)]
    public string? Hash { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
