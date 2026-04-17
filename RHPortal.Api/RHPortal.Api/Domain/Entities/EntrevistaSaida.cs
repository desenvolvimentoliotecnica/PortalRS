using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template de perguntas para entrevista de saída, configurável por tenant.
/// Um único template ativo por tenant é usado para todos os desligamentos.
/// </summary>
public sealed class TemplateEntrevistaSaida : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [MaxLength(120)]
    public string Nome { get; set; } = default!;

    public bool Ativo { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<PerguntaEntrevistaSaida> Perguntas { get; set; } = [];
}

/// <summary>Tipo de resposta aceito pela pergunta.</summary>
public enum TipoRespostaEntrevista : short
{
    Texto         = 0,
    Escala        = 1,  // 1-10
    MultiplaEscolha = 2
}

/// <summary>Pergunta de entrevista de saída, pertencente a um template.</summary>
public sealed class PerguntaEntrevistaSaida : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TemplateId { get; set; }
    public TemplateEntrevistaSaida? Template { get; set; }

    public int Ordem { get; set; }

    [MaxLength(500)]
    public string Texto { get; set; } = default!;

    public TipoRespostaEntrevista TipoResposta { get; set; } = TipoRespostaEntrevista.Texto;

    /// <summary>Opções separadas por ';' (apenas para MultiplaEscolha).</summary>
    [MaxLength(1000)]
    public string? Opcoes { get; set; }

    public bool Obrigatoria { get; set; } = false;
}

/// <summary>
/// Instância de entrevista de saída para um desligamento específico.
/// Contém o token de acesso público (one-time, 30 dias).
/// </summary>
public sealed class EntrevistaSaida : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Desligamento que originou esta entrevista.</summary>
    public Guid DesligamentoId { get; set; }

    /// <summary>Funcionário sendo desligado (destinatário do formulário).</summary>
    public Guid FuncionarioId { get; set; }

    /// <summary>Template de perguntas utilizado (snapshot da configuração ativa no momento).</summary>
    public Guid TemplateId { get; set; }

    /// <summary>Token público (one-time, 30 dias).</summary>
    [MaxLength(64)]
    public string Token { get; set; } = default!;

    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? SubmittedAtUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<RespostaEntrevistaSaida> Respostas { get; set; } = [];
}

/// <summary>Resposta de uma pergunta específica de entrevista de saída.</summary>
public sealed class RespostaEntrevistaSaida : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid EntrevistaId { get; set; }
    public EntrevistaSaida? Entrevista { get; set; }

    public Guid PerguntaId { get; set; }
    public PerguntaEntrevistaSaida? Pergunta { get; set; }

    /// <summary>Resposta livre (Texto).</summary>
    [MaxLength(2000)]
    public string? ValorTexto { get; set; }

    /// <summary>Resposta escala 1-10 (Escala).</summary>
    public int? ValorEscala { get; set; }

    /// <summary>Opção selecionada (MultiplaEscolha).</summary>
    [MaxLength(200)]
    public string? ValorOpcao { get; set; }
}
