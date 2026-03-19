using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Vínculo entre um candidato e um ProjetoVaga (rodada de seleção).
/// Cada projeto tem seu banco de candidatos; reprovados não aparecem em projetos futuros.
/// </summary>
public sealed class ProjetoCandidato : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid ProjetoId { get; set; }
    public ProjetoVaga? Projeto { get; set; }

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public StatusCandidatoProjeto Status { get; set; } = StatusCandidatoProjeto.Ativo;

    /// <summary>Fase atual do candidato no processo seletivo.</summary>
    public Guid? FaseAtualId { get; set; }
    public FaseProcesso? FaseAtual { get; set; }

    /// <summary>Observações do recrutador sobre o candidato nesta rodada.</summary>
    [MaxLength(2000)]
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
