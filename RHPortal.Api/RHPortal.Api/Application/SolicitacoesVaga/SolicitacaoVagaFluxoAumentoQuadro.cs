using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.SolicitacoesVaga;

/// <summary>
/// Regras auxiliares do fluxo <see cref="TipoSolicitacaoVaga.AumentoQuadro"/>.
/// </summary>
public static class SolicitacaoVagaFluxoAumentoQuadro
{
    public static bool IsFluxo(SolicitacaoVaga entity)
        => entity.TipoSolicitacao == TipoSolicitacaoVaga.AumentoQuadro;

    /// <summary>Gestor pode submeter apenas a partir destes status.</summary>
    public static bool PodeGestorSubmitar(SolicitacaoStatus status) =>
        status is SolicitacaoStatus.Rascunho or SolicitacaoStatus.DevolvidaTriagemGestor;

    /// <summary>Ações de triagem RH aplicam-se nestes status.</summary>
    public static bool EstaEmFilaTriagem(SolicitacaoStatus status) =>
        status is SolicitacaoStatus.PendenteTriagem or SolicitacaoStatus.EmTriagem;

    /// <summary>Ao encaminhar, etapas de <see cref="TipoFluxoAprovacao.RequisicaoPessoal"/> são sempre recriadas do zero.</summary>
    public static bool RequerRecriacaoEtapasRequisicaoPessoalAoEncaminhar() => true;
}
