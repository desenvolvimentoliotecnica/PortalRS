namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Status operacional da <see cref="RhPortal.Api.Domain.Entities.SolicitacaoVaga"/>.
/// <para>
/// AUD-01 (<c>StatusHistoricoService</c>): registar transições com rótulos estáveis — preferir <c>nameof(SolicitacaoStatus.X)</c>
/// ou a string fixa igual ao nome do membro ao persistir histórico.
/// </para>
/// </summary>
public enum SolicitacaoStatus : short
{
    Rascunho = 0,
    PendenteAprovacao = 1,
    Aprovada = 2,
    Reprovada = 3,
    AjustesNecessarios = 4,
    PendenteAprovacaoRh = 5,
    Cancelada = 6,
    EmIntegracao = 7,
    Concluida = 8,

    // 9 = AguardandoDecisaoRH foi removido: a decisão de headcount agora é feita pelo gestor na criação.
    // O valor numérico 9 fica reservado/desativado; registros antigos foram migrados pra Aprovada (2)
    // na migration 20260423_RemoveAguardandoDecisaoRH. Não reutilizar 9.

    /// <summary>Aprovação de aumento definitivo de headcount; aguarda aprovador configurável (Diretoria).</summary>
    PendenteAprovacaoAumentoHC = 10,

    // ── Ciclo portal / RM (milestones abertura vaga §8 produto; Fase 2+ usará máquina de estados) ──────────

    /// <summary>Vaga enviada; aguarda triagem — homólogo inicial a PendenteTriagem UX.</summary>
    PendenteTriagem = 11,

    /// <summary>Equipa responsável está analisando a solicitação.</summary>
    EmTriagem = 12,

    /// <summary>Pendências identificadas na triagem; retorno ao solicitante gestor para ajuste.</summary>
    DevolvidaTriagemGestor = 13,

    /// <summary>Aprovado no portal, aguardando criação / confirmação da requisição no RM.</summary>
    PendenteIntegracaoRm = 14,

    /// <summary>Falha técnica na integração RM (CA09) — permite reprocessamento.</summary>
    ErroIntegracaoRm = 15,

    /// <summary>Marcador explícito de fila de reprocessamento manual/automático pós-erro RM.</summary>
    AguardandoReprocessamentoRm = 16,
}
