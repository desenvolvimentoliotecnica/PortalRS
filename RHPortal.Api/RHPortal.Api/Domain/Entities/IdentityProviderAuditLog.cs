namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Log de auditoria de operações no provedor de identidade (Azure AD / Entra).
/// Registra cada chamada de disable/revoke com resultado e rastreabilidade.
/// </summary>
public sealed class IdentityProviderAuditLog : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Funcionário cujo acesso foi modificado.</summary>
    public Guid FuncionarioId { get; set; }

    /// <summary>Email/UPN usado na chamada à Graph API.</summary>
    public string Email { get; set; } = default!;

    public IdentityProviderOperacao Operacao { get; set; }

    public bool Sucesso { get; set; }

    /// <summary>Mensagem de erro retornada pela API (quando Sucesso=false).</summary>
    public string? MensagemErro { get; set; }

    /// <summary>Funcionário (ou usuário do sistema) que iniciou a operação.</summary>
    public Guid? IniciadoPorId { get; set; }

    /// <summary>Id do workflow/etapa que originou a operação (rastreabilidade).</summary>
    public Guid? WorkflowId { get; set; }
    public Guid? EtapaId { get; set; }

    public DateTimeOffset ExecutadoEmUtc { get; set; } = DateTimeOffset.UtcNow;
}

public enum IdentityProviderOperacao : short
{
    DisableUser = 1,
    EnableUser = 2,
    RevokeSessions = 3
}
