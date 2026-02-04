using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Pessoa na base de talentos. Referencia Pessoa (dados da pessoa).</summary>
public sealed class Talento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    public OrigemTalento Origem { get; set; } = OrigemTalento.Manual;

    /// <summary>JSON snapshot do perfil (resumo, competências, experiências, treinamentos, formação) para matching.</summary>
    public string? CvProfileJson { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Versão do registro; incrementada a cada atualização.</summary>
    public int Versao { get; set; }

    public List<Candidato> Candidaturas { get; set; } = new();
    public List<TalentoCompetencia> Competencias { get; set; } = new();
    public List<TalentoExperiencia> Experiencias { get; set; } = new();
    public List<TalentoTreinamento> Treinamentos { get; set; } = new();
    public List<TalentoFormacao> Formacao { get; set; } = new();
    public List<TalentoDocumento> Documentos { get; set; } = new();
}
