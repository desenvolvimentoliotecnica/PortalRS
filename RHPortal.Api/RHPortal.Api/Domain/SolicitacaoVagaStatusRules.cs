using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain;

/// <summary>
/// Conjuntos canônicos de status de solicitação de vaga — fonte única para dashboard, listagem e KPIs.
/// </summary>
public static class SolicitacaoVagaStatusRules
{
    /// <summary>
    /// Itens em andamento no fluxo (chip "Ativas" na grid e KPIs de solicitações ativas).
    /// </summary>
    public static readonly SolicitacaoStatus[] StatusAtivos =
    [
        SolicitacaoStatus.Rascunho,
        SolicitacaoStatus.PendenteAprovacao,
        SolicitacaoStatus.Aprovada,
        SolicitacaoStatus.AjustesNecessarios,
        SolicitacaoStatus.PendenteAprovacaoRh,
        SolicitacaoStatus.EmIntegracao,
        SolicitacaoStatus.Concluida,
        SolicitacaoStatus.PendenteAprovacaoAumentoHC,
        SolicitacaoStatus.PendenteTriagem,
        SolicitacaoStatus.EmTriagem,
        SolicitacaoStatus.DevolvidaTriagemGestor,
        SolicitacaoStatus.PendenteIntegracaoRm,
        SolicitacaoStatus.ErroIntegracaoRm,
        SolicitacaoStatus.AguardandoReprocessamentoRm,
        SolicitacaoStatus.EmProcessoSeletivo,
        SolicitacaoStatus.Suspensa,
        SolicitacaoStatus.EmAndamento,
    ];

    public static readonly SolicitacaoStatus[] StatusAprovados =
    [
        SolicitacaoStatus.Aprovada,
        SolicitacaoStatus.Concluida,
    ];

    public static bool IsAtivo(SolicitacaoStatus status) => StatusAtivos.Contains(status);

    public static bool IsAprovado(SolicitacaoStatus status) => StatusAprovados.Contains(status);

    public static IReadOnlyList<string> StatusAtivosKeys { get; } =
        StatusAtivos.Select(s => s.ToString()).ToArray();

    public static IReadOnlyList<string> StatusAprovadosKeys { get; } =
        StatusAprovados.Select(s => s.ToString()).ToArray();
}
