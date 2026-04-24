namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Histórico de alterações na configuração de documentação padrão — registra
/// cada mudança (global ou por <c>NivelCargo</c>) com o usuário que alterou,
/// o valor anterior e o novo. Usado pela tela admin para auditoria e rollback visual.
/// </summary>
public sealed class DocumentacaoPadraoHistorico : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Escopo da alteração: global do tenant ou específico de um NivelCargo.</summary>
    public DocumentacaoPadraoEscopo Escopo { get; set; }

    /// <summary>Preenchido quando <see cref="Escopo"/> = <c>PorNivelCargo</c>. Null quando global ou PorCargo.</summary>
    public Guid? NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    /// <summary>Preenchido quando <see cref="Escopo"/> = <c>PorCargo</c>. Null quando global ou PorNivelCargo.</summary>
    public Guid? CargoId { get; set; }
    public JobPosition? Cargo { get; set; }

    /// <summary>Tipo do documento (enum TipoDocumento serializado como smallint).</summary>
    public short TipoDocumento { get; set; }

    /// <summary>
    /// Valor anterior: 0=Obrigatório, 1=Opcional, 2=Não será pedido.
    /// Null quando era herdado (no caso de override por NivelCargo) ou não existia.
    /// </summary>
    public short? ConfiguracaoAnterior { get; set; }

    /// <summary>
    /// Novo valor: 0=Obrigatório, 1=Opcional, 2=Não será pedido.
    /// Null quando o override foi removido (voltou a herdar).
    /// </summary>
    public short? ConfiguracaoNova { get; set; }

    /// <summary>Tipo da ação registrada — útil para filtros e ícones.</summary>
    public DocumentacaoPadraoAcao Acao { get; set; }

    /// <summary>Usuário que realizou a alteração (ApplicationUser.Id). Null quando sem contexto (seed/job).</summary>
    public Guid? UserId { get; set; }

    /// <summary>Nome do usuário no momento da alteração (congelado para evitar dependência de FK com Users).</summary>
    public string? UserNome { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
}

public enum DocumentacaoPadraoEscopo : short
{
    Global = 0,
    PorNivelCargo = 1,
    PorCargo = 2,
}

public enum DocumentacaoPadraoAcao : short
{
    /// <summary>Criou valor customizado (antes não existia ou era default).</summary>
    Criado = 0,
    /// <summary>Alterou valor existente para outro.</summary>
    Alterado = 1,
    /// <summary>Removeu override (voltou a herdar do global) — só em PorNivelCargo.</summary>
    Removido = 2,
}
