using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Etapa de aprovação em execução para uma solicitação específica.
/// Criada em SubmitAsync com snapshot da configuração no momento do envio.
/// N etapas por solicitação, uma linha por etapa.
/// SolicitacaoId é FK polimórfica (sem constraint) — aponta para Promocao, Desligamento ou Vaga.
/// </summary>
public sealed class SolicitacaoAprovacaoEtapa : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid SolicitacaoId { get; set; }
    public TipoFluxoAprovacao TipoFluxo { get; set; }

    public int Ordem { get; set; }

    /// <summary>Snapshot do label no momento do submit (ex: "Gerência", "Compliance").</summary>
    public string Label { get; set; } = "";

    /// <summary>
    /// Aprovador resolvido no submit (null = fila de perfil, ainda não assumida).
    /// Se FilaDePerfil: preenchido quando alguém do perfil assume a tarefa ao aprovar.
    /// </summary>
    public Guid? AprovadorId { get; set; }
    public Funcionario? Aprovador { get; set; }

    /// <summary>
    /// Snapshot do perfil de fila (null = não é fila).
    /// Qualquer usuário com esse role pode aprovar quando AprovadorId == null.
    /// </summary>
    public Guid? RoleFilaId { get; set; }

    public StatusAprovacao Status { get; set; } = StatusAprovacao.Pendente;
    public string? Observacao { get; set; }
    public DateTimeOffset? DataUtc { get; set; }
}
