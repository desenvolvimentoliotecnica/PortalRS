using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Alerta gerado quando uma vaga ou funcionário do Portal — que tinha origem RM identificada
/// (Codigo / MatriculaRm) — sumiu do payload do worker por N ciclos consecutivos
/// (configurável em <c>RmSync:ZumbiThresholdCiclos</c>, default 3).
/// Diretriz "sempre corrigir na origem RM": o Portal NÃO altera a entidade automaticamente;
/// apenas notifica o RH para tratar no TOTVS.
/// </summary>
public sealed class RmSyncAlerta : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Tipo do alerta: "VagaAusente" | "FuncionarioAusente".</summary>
    [MaxLength(40)]
    public string Tipo { get; set; } = default!;

    /// <summary>Nome legível da entidade Portal afetada (ex.: "Vaga", "Funcionario").</summary>
    [MaxLength(40)]
    public string EntidadeNome { get; set; } = default!;

    /// <summary>Id local da entidade afetada (Vaga.Id ou Funcionario.Id).</summary>
    public Guid? EntidadeId { get; set; }

    /// <summary>Chave RM que sumiu (Codigo da vaga ou MatriculaRm do funcionário).</summary>
    [MaxLength(80)]
    public string ChaveRm { get; set; } = default!;

    public DateTimeOffset DetectadoEmUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Quantos ciclos consecutivos a chave esteve ausente quando o alerta foi disparado.</summary>
    public int CiclosAusente { get; set; }

    /// <summary>Marcado quando o RH resolve manualmente OU a chave volta a aparecer no payload do RM.</summary>
    public DateTimeOffset? ResolvidoEmUtc { get; set; }

    /// <summary>Quem resolveu (Funcionario.Id) — null se resolução automática (chave voltou).</summary>
    public Guid? ResolvidoPorId { get; set; }

    /// <summary>Ação tomada / observação livre quando resolvido manualmente.</summary>
    [MaxLength(120)]
    public string? Acao { get; set; }

    /// <summary>Run que detectou o alerta — útil pra rastreabilidade na tela Owner.</summary>
    public Guid? RunId { get; set; }
}
