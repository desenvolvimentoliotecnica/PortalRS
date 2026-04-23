using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Carta de oferta digital enviada pelo RH ao candidato. Coexiste com o fluxo de e-mail
/// atual: o RH pode continuar enviando e-mails soltos e, opcionalmente, criar uma proposta
/// com token de aceite digital — quando o candidato clica no link público, o sistema registra
/// data, IP, user-agent e o nome confirmado pelo próprio candidato como evidência.
/// </summary>
public sealed class PropostaVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    /// <summary>
    /// Candidatura (junction Candidato↔Vaga) à qual esta proposta pertence. Preenchido via
    /// <c>CandidaturaService.GetOrCreateAsync</c> no momento do create. Opcional apenas por
    /// compatibilidade com propostas criadas antes da junção — nas novas, deve estar sempre populado.
    /// </summary>
    public Guid? CandidaturaId { get; set; }
    public Candidatura? Candidatura { get; set; }

    public PropostaVagaStatus Status { get; set; } = PropostaVagaStatus.Rascunho;

    // ── Dados da oferta ──────────────────────────────────────────────
    [StringLength(3)]
    public string? Moeda { get; set; }

    public decimal? SalarioOferecido { get; set; }

    [StringLength(2000)]
    public string? DescricaoBeneficios { get; set; }

    public DateOnly? DataPrevistaInicio { get; set; }

    /// <summary>Corpo livre da carta (pode ser editado antes do envio).</summary>
    [StringLength(8000)]
    public string? MensagemPersonalizada { get; set; }

    // ── Acesso pelo candidato ───────────────────────────────────────
    /// <summary>Token único gerado no envio; compõe a URL pública de aceite.</summary>
    [StringLength(64)]
    public string? AccessToken { get; set; }

    public DateTimeOffset? EnviadaEmUtc { get; set; }

    /// <summary>Prazo para resposta. Depois disso o job de expiração marca como Expirada.</summary>
    public DateTimeOffset? ExpiraEmUtc { get; set; }

    public DateTimeOffset? VisualizadaEmUtc { get; set; }

    // ── Evidência de aceite / recusa ────────────────────────────────
    public DateTimeOffset? RespondidaEmUtc { get; set; }

    [StringLength(160)]
    public string? NomeConfirmadoCandidato { get; set; }

    [StringLength(60)]
    public string? IpOrigemResposta { get; set; }

    [StringLength(400)]
    public string? UserAgentResposta { get; set; }

    [StringLength(2000)]
    public string? MotivoRecusa { get; set; }

    // ── Rastreabilidade interna ────────────────────────────────────
    public Guid? CriadaPorUserId { get; set; }
    public Guid? EnviadaPorUserId { get; set; }

    [StringLength(500)]
    public string? ObservacaoInternaRh { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
