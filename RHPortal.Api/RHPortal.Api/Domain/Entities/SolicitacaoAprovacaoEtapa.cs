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

    /// <summary>Snapshot da ação configurada para esta etapa.</summary>
    public AcaoEtapa AcaoEtapa { get; set; } = AcaoEtapa.Nenhuma;

    /// <summary>Snapshot do momento em que a ação deve executar.</summary>
    public MomentoAcao MomentoAcao { get; set; } = MomentoAcao.AoChegar;

    public StatusAprovacao Status { get; set; } = StatusAprovacao.Pendente;
    public string? Observacao { get; set; }
    public DateTimeOffset? DataUtc { get; set; }

    /// <summary>
    /// Usuário que assumiu a etapa via consenso (quando não há AprovadorId resolvido).
    /// Permite que admins sem Funcionario vinculado assumam tarefas de consenso.
    /// </summary>
    public Guid? AssumedByUserId { get; set; }

    // ----- SLA / Lembretes -----

    /// <summary>Timestamp de quando a etapa foi criada (chegou ao aprovador).</summary>
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Contagem de lembretes já enviados ao aprovador (evita spam).</summary>
    public int LembretesEnviados { get; set; } = 0;

    /// <summary>Timestamp do último lembrete enviado ao aprovador.</summary>
    public DateTimeOffset? UltimoLembreteUtc { get; set; }

    /// <summary>Timestamp em que a etapa foi escalada para o gestor do aprovador (null = não escalada).</summary>
    public DateTimeOffset? EscaladoEmUtc { get; set; }
}
