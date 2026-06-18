using RhPortal.Api.Domain;
using RhPortal.Api.Domain.Enums;

namespace RHPortal.Api.Tests.SolicitacoesVaga;

public sealed class SolicitacaoVagaStatusRulesTests
{
    [Fact]
    public void StatusAtivos_inclui_fluxo_rm_e_selecao()
    {
        Assert.Contains(SolicitacaoStatus.Rascunho, SolicitacaoVagaStatusRules.StatusAtivos);
        Assert.Contains(SolicitacaoStatus.EmProcessoSeletivo, SolicitacaoVagaStatusRules.StatusAtivos);
        Assert.Contains(SolicitacaoStatus.Suspensa, SolicitacaoVagaStatusRules.StatusAtivos);
        Assert.Contains(SolicitacaoStatus.EmAndamento, SolicitacaoVagaStatusRules.StatusAtivos);
    }

    [Fact]
    public void StatusAtivos_exclui_terminais_fora_do_fluxo()
    {
        Assert.DoesNotContain(SolicitacaoStatus.Reprovada, SolicitacaoVagaStatusRules.StatusAtivos);
        Assert.DoesNotContain(SolicitacaoStatus.Cancelada, SolicitacaoVagaStatusRules.StatusAtivos);
        Assert.DoesNotContain(SolicitacaoStatus.EncerradaSemContratacao, SolicitacaoVagaStatusRules.StatusAtivos);
    }

    [Fact]
    public void StatusAtivosKeys_espelha_enum()
    {
        Assert.Contains(nameof(SolicitacaoStatus.EmAndamento), SolicitacaoVagaStatusRules.StatusAtivosKeys);
    }
}
