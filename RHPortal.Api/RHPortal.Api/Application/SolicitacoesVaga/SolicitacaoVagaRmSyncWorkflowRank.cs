using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.SolicitacoesVaga;

/// <summary>Ordem aproximada do fluxo portal para bloquear regressão automática por sync RM.</summary>
public static class SolicitacaoVagaRmSyncWorkflowRank
{
    public static int Rank(SolicitacaoStatus s) => s switch
    {
        SolicitacaoStatus.Rascunho => 10,
        SolicitacaoStatus.AjustesNecessarios => 20,
        SolicitacaoStatus.DevolvidaTriagemGestor => 25,
        SolicitacaoStatus.PendenteTriagem => 30,
        SolicitacaoStatus.EmTriagem => 35,
        SolicitacaoStatus.PendenteAprovacao => 40,
        SolicitacaoStatus.PendenteAprovacaoRh => 42,
        SolicitacaoStatus.PendenteAprovacaoAumentoHC => 44,
        SolicitacaoStatus.Aprovada => 50,
        SolicitacaoStatus.PendenteIntegracaoRm => 55,
        SolicitacaoStatus.EmIntegracao => 60,
        SolicitacaoStatus.EmProcessoSeletivo => 70,
        SolicitacaoStatus.Suspensa => 75,
        SolicitacaoStatus.AguardandoReprocessamentoRm => 58,
        SolicitacaoStatus.ErroIntegracaoRm => 57,
        SolicitacaoStatus.Concluida => 900,
        SolicitacaoStatus.ContratacaoConcluida => 900,
        SolicitacaoStatus.Reprovada => 850,
        SolicitacaoStatus.Cancelada => 850,
        SolicitacaoStatus.EncerradaSemContratacao => 850,
        _ => 15
    };

    /// <summary>True se <paramref name="candidate"/> seria regressão em relação a <paramref name="current"/>.</summary>
    public static bool WouldRegress(SolicitacaoStatus current, SolicitacaoStatus candidate)
    {
        if (current == candidate)
            return false;

        // Terminais só podem ser alterados fora do sync (regra produto).
        if (current is SolicitacaoStatus.Reprovada or SolicitacaoStatus.Cancelada or SolicitacaoStatus.Concluida
            or SolicitacaoStatus.ContratacaoConcluida or SolicitacaoStatus.EncerradaSemContratacao)
            return false;

        var rc = Rank(current);
        var rNew = Rank(candidate);
        return rNew < rc;
    }
}
