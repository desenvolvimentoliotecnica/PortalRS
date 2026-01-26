using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Candidato : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [Required, StringLength(180)]
    public string Email { get; set; } = string.Empty;

    [StringLength(40)]
    public string? Fone { get; set; }

    [StringLength(120)]
    public string? Cidade { get; set; }

    [StringLength(2)]
    public string? Uf { get; set; }

    [StringLength(260)]
    public string? LinkedinUrl { get; set; }

    [StringLength(2000)]
    public string? ResumoProfissional { get; set; }

    [StringLength(260)]
    public string? AvatarFileName { get; set; }

    [StringLength(120)]
    public string? AvatarContentType { get; set; }

    public CandidateOrigin Fonte { get; set; } = CandidateOrigin.Email;
    public CandidateStatus Status { get; set; } = CandidateStatus.Novo;

    public Guid? VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    [StringLength(2000)]
    public string? Obs { get; set; }

    public string? CvText { get; set; }

    [StringLength(80)]
    public string? PortalAccessKey { get; set; }

    [StringLength(400)]
    public string? PortalPasswordHash { get; set; }

    public int? LastMatchScore { get; set; }
    public bool? LastMatchPass { get; set; }
    public DateTimeOffset? LastMatchAtUtc { get; set; }
    public Guid? LastMatchVagaId { get; set; }

    public List<CandidatoDocumento> Documentos { get; set; } = new();
    public List<CandidatoReferencia> Referencias { get; set; } = new();
    public CandidatoAcessibilidade? Acessibilidade { get; set; }
    public CandidatoAgendaPreferencia? AgendaPreferencia { get; set; }
    public List<CandidatoAgendaBloqueio> AgendaBloqueios { get; set; } = new();
    public CandidatoNotificacaoPreferencia? NotificacaoPreferencia { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoDocumento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public CandidateDocumentType Tipo { get; set; }

    [Required, StringLength(200)]
    public string NomeArquivo { get; set; } = string.Empty;

    [StringLength(120)]
    public string? ContentType { get; set; }

    [StringLength(240)]
    public string? Descricao { get; set; }

    [StringLength(260)]
    public string? StorageFileName { get; set; }

    public long? TamanhoBytes { get; set; }

    [StringLength(400)]
    public string? Url { get; set; }

    [StringLength(260)]
    public string? ArquivoNome { get; set; }

    [StringLength(20)]
    public string? DataReferencia { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
