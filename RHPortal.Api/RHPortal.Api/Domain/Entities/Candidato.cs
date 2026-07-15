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

    [StringLength(14)]
    public string? Cpf { get; set; }

    [StringLength(20)]
    public string? Rg { get; set; }

    public DateOnly? DataNascimento { get; set; }

    [StringLength(160)]
    public string? NomeMae { get; set; }

    [StringLength(160)]
    public string? NomePai { get; set; }

    [StringLength(40)]
    public string? Fone { get; set; }

    [StringLength(40)]
    public string? Celular { get; set; }

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

    /// <summary>Se o candidato está trabalhando atualmente.</summary>
    public bool? TrabalhandoAtualmente { get; set; }

    /// <summary>Pretensão salarial do candidato (em R$).</summary>
    public decimal? PretensaoSalarial { get; set; }

    /// <summary>
    /// Cache da Vaga principal do candidato — aponta para a <c>VagaId</c> da
    /// <see cref="Candidatura"/> ativa mais recente (ordenada por <c>AplicadaEmUtc</c> desc).
    /// A fonte-de-verdade é a tabela <c>Candidaturas</c>; este campo é um índice O(1)
    /// para listas/dashboards e é sincronizado automaticamente por
    /// <c>CandidaturaService.RecalcularVagaPrincipalAsync</c> sempre que uma Candidatura
    /// é criada, avança de etapa ou é encerrada. Pode ser <c>null</c> se o candidato não
    /// possui candidatura ativa no momento.
    /// </summary>
    public Guid? VagaId { get; set; }

    /// <summary>
    /// Nav property ligada ao cache <see cref="VagaId"/>. Use <c>Candidaturas</c> para
    /// enumerar todas as vagas às quais o candidato se candidatou.
    /// </summary>
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    public Guid? TalentoId { get; set; }
    public Talento? Talento { get; set; }

    [StringLength(2000)]
    public string? Obs { get; set; }

    /// <summary>Grau de fit IA à vaga: baixo | parcial | adequado | bom | excelente.</summary>
    [StringLength(32)]
    public string? FitIaNivel { get; set; }

    /// <summary>Motivo curto do termômetro de fit gerado pela IA.</summary>
    [StringLength(240)]
    public string? FitIaMotivo { get; set; }

    public string? CvText { get; set; }

    [StringLength(80)]
    public string? PortalAccessKey { get; set; }

    [StringLength(400)]
    public string? PortalPasswordHash { get; set; }

    public int? LastMatchScore { get; set; }
    public bool? LastMatchPass { get; set; }
    public DateTimeOffset? LastMatchAtUtc { get; set; }
    public Guid? LastMatchVagaId { get; set; }

    [StringLength(120)]
    public string? ApplicationRecruiterUserId { get; set; }
    [StringLength(200)]
    public string? ApplicationRecruiterUserName { get; set; }

    public List<CandidatoDocumento> Documentos { get; set; } = new();
    public List<CandidatoReferencia> Referencias { get; set; } = new();
    public CandidatoAcessibilidade? Acessibilidade { get; set; }
    public CandidatoAgendaPreferencia? AgendaPreferencia { get; set; }
    public List<CandidatoAgendaBloqueio> AgendaBloqueios { get; set; } = new();
    public CandidatoNotificacaoPreferencia? NotificacaoPreferencia { get; set; }
    public List<CandidatoPortalNotificacao> PortalNotificacoes { get; set; } = new();
    public CandidatoLgpdConsent? LgpdConsent { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoDocumento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    /// <summary>Vaga à qual este anexo se refere (ex.: CV enviado na candidatura ao portal). Null = legado ou documento genérico do talento.</summary>
    public Guid? VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

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
