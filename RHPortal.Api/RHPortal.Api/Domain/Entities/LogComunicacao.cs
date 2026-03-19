using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Log de comunicação com candidato. Registra cada contato (email, WhatsApp, LinkedIn).
/// </summary>
public sealed class LogComunicacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid? ProjetoId { get; set; }
    public ProjetoVaga? Projeto { get; set; }

    /// <summary>Tipo de contato.</summary>
    public TipoComunicacao Tipo { get; set; }

    /// <summary>Assunto (para email).</summary>
    [MaxLength(200)]
    public string? Assunto { get; set; }

    /// <summary>Corpo da mensagem.</summary>
    [MaxLength(4000)]
    public string? Mensagem { get; set; }

    /// <summary>Destinatário (email, tel, link).</summary>
    [MaxLength(200)]
    public string? Destinatario { get; set; }

    /// <summary>Usuário que fez o contato.</summary>
    [MaxLength(120)]
    public string? UsuarioNome { get; set; }

    public DateTimeOffset DataUtc { get; set; }
}

public enum TipoComunicacao : short
{
    Email = 0,
    WhatsApp = 1,
    LinkedIn = 2,
    Telefone = 3
}
