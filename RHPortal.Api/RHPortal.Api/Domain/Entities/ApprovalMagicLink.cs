using RhPortal.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Token de aprovação one-time enviado por email ao aprovador.
/// Permite que o aprovador aprove ou reprove uma solicitação diretamente
/// pelo email, sem precisar fazer login no portal.
/// </summary>
public sealed class ApprovalMagicLink : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Token aleatório criptograficamente seguro (32 bytes → ~43 chars Base64Url). Único por tenant.</summary>
    [MaxLength(64)]
    public string Token { get; set; } = default!;

    /// <summary>Etapa de aprovação à qual este link se refere.</summary>
    public Guid EtapaId { get; set; }

    /// <summary>Solicitação (FK polimórfica — sem constraint, aponta para a tabela correta via TipoFluxo).</summary>
    public Guid SolicitacaoId { get; set; }

    /// <summary>Tipo do fluxo de aprovação — determina qual tabela de solicitação atualizar.</summary>
    public TipoFluxoAprovacao TipoFluxo { get; set; }

    /// <summary>Funcionário aprovador para quem o link foi gerado.</summary>
    public Guid AprovadorFuncionarioId { get; set; }

    /// <summary>Expiração do token (72h após criação).</summary>
    public DateTimeOffset ExpiresAtUtc { get; set; }

    /// <summary>Quando o token foi utilizado. Null = ainda não utilizado.</summary>
    public DateTimeOffset? UsedAtUtc { get; set; }

    /// <summary>Ação realizada (null enquanto não utilizado).</summary>
    public MagicLinkAcao? AcaoRealizada { get; set; }

    /// <summary>IP de quem confirmou (auditoria).</summary>
    [MaxLength(45)]
    public string? IpAddress { get; set; }

    /// <summary>User-agent de quem confirmou (auditoria).</summary>
    [MaxLength(512)]
    public string? UserAgent { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Ação disponível via magic link de aprovação.</summary>
public enum MagicLinkAcao : short
{
    Aprovar  = 1,
    Reprovar = 2
}
