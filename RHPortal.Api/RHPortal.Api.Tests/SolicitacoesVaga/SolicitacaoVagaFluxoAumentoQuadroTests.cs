using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.SolicitacoesVaga;

public sealed class SolicitacaoVagaFluxoAumentoQuadroTests
{
    [Fact]
    public void IsFluxo_AumentoQuadro_True()
    {
        var e = new SolicitacaoVaga { TipoSolicitacao = TipoSolicitacaoVaga.AumentoQuadro };
        Assert.True(SolicitacaoVagaFluxoAumentoQuadro.IsFluxo(e));
    }

    [Fact]
    public void PodeGestorSubmitar_ApenasRascunhoOuDevolvida()
    {
        Assert.True(SolicitacaoVagaFluxoAumentoQuadro.PodeGestorSubmitar(SolicitacaoStatus.Rascunho));
        Assert.True(SolicitacaoVagaFluxoAumentoQuadro.PodeGestorSubmitar(SolicitacaoStatus.DevolvidaTriagemGestor));
        Assert.False(SolicitacaoVagaFluxoAumentoQuadro.PodeGestorSubmitar(SolicitacaoStatus.PendenteTriagem));
        Assert.False(SolicitacaoVagaFluxoAumentoQuadro.PodeGestorSubmitar(SolicitacaoStatus.PendenteAprovacao));
    }

    [Fact]
    public void EstaEmFilaTriagem_CobrePendenteEEmTriagem()
    {
        Assert.True(SolicitacaoVagaFluxoAumentoQuadro.EstaEmFilaTriagem(SolicitacaoStatus.PendenteTriagem));
        Assert.True(SolicitacaoVagaFluxoAumentoQuadro.EstaEmFilaTriagem(SolicitacaoStatus.EmTriagem));
        Assert.False(SolicitacaoVagaFluxoAumentoQuadro.EstaEmFilaTriagem(SolicitacaoStatus.DevolvidaTriagemGestor));
    }
}
