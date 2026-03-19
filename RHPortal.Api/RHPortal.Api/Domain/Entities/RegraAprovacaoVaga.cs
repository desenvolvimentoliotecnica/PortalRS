namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Regra configurável pelo admin que define quem deve ser Aprovador1 e Aprovador2
/// para solicitações de vaga abertas por um determinado perfil (Role).
/// Se SolicitanteRoleId for null, é uma regra padrão aplicável a qualquer perfil.
/// </summary>
public sealed class RegraAprovacaoVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Perfil do solicitante ao qual esta regra se aplica. Null = regra padrão (fallback).</summary>
    public Guid? SolicitanteRoleId { get; set; }
    public ApplicationRole? SolicitanteRole { get; set; }

    /// <summary>Funcionário fixo designado como Aprovador1.</summary>
    public Guid Aprovador1FuncionarioId { get; set; }
    public Funcionario? Aprovador1 { get; set; }

    /// <summary>Funcionário fixo designado como Aprovador2. Opcional.</summary>
    public Guid? Aprovador2FuncionarioId { get; set; }
    public Funcionario? Aprovador2 { get; set; }

    /// <summary>Se true, a solicitação vai exigir aprovação do Aprovador2 também.</summary>
    public bool Aprovador2Habilitado { get; set; }

    /// <summary>Regra ativa ou inativa (soft-disable sem excluir).</summary>
    public bool Ativo { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
