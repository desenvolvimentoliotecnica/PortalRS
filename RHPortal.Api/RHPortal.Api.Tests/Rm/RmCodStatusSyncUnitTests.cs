using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Rm;
using Xunit;

namespace RhPortal.Api.Tests.Rm;

public sealed class RmCodStatusSyncUnitTests
{
    [Fact]
    public void RmPortalRequisicaoVinculo_TryParse_valid_pipe_splits_parts()
    {
        Assert.True(RmPortalRequisicaoVinculo.TryParse(
            "AUMENTO_QUADRO|12|8421", out var tipo, out var codCol, out var idReq));
        Assert.Equal("AUMENTO_QUADRO", tipo);
        Assert.Equal(12, codCol);
        Assert.Equal(8421, idReq);
    }

    [Fact]
    public void RmPortalRequisicaoVinculo_TryParse_rejects_less_than_three_parts()
    {
        Assert.False(RmPortalRequisicaoVinculo.TryParse("A|B", out _, out _, out _));
    }

    [Fact]
    public void RmPortalRequisicaoVinculo_IsStub_true_when_prefix_STUB()
    {
        Assert.True(RmPortalRequisicaoVinculo.IsStub("STUB-8421"));
        Assert.False(RmPortalRequisicaoVinculo.TryParse("STUB-8421", out _, out _, out _));
    }

    [Fact]
    public void RmRequisicaoStatusMapResolver_ResolveFirst_prefers_lower_priority_then_older_created()
    {
        var ts = DateTimeOffset.UtcNow;
        var maps = new List<RmRequisicaoStatusMap>
        {
            new()
            {
                Id = Guid.NewGuid(),
                TenantId = "t",
                CodStatusRm = 7,
                PortalStatusKey = nameof(SolicitacaoStatus.Rascunho),
                Priority = 90,
                CreatedAtUtc = ts
            },
            new()
            {
                Id = Guid.NewGuid(),
                TenantId = "t",
                CodStatusRm = 7,
                PortalStatusKey = nameof(SolicitacaoStatus.PendenteTriagem),
                Priority = 10,
                CreatedAtUtc = ts.AddMinutes(1),
            },
        };

        var first = RmRequisicaoStatusMapResolver.ResolveFirst(maps, 7);
        Assert.NotNull(first);
        Assert.Equal(nameof(SolicitacaoStatus.PendenteTriagem), first!.PortalStatusKey);
    }

    [Fact]
    public void SolicitacaoVagaRmSyncWorkflowRank_WouldRegress_blocks_backward_from_aprovada()
    {
        Assert.True(SolicitacaoVagaRmSyncWorkflowRank.WouldRegress(SolicitacaoStatus.Aprovada, SolicitacaoStatus.Rascunho));
        Assert.False(SolicitacaoVagaRmSyncWorkflowRank.WouldRegress(SolicitacaoStatus.Aprovada, SolicitacaoStatus.Aprovada));
    }

    [Fact]
    public void SolicitacaoVagaRmSyncWorkflowRank_WouldRegress_terminal_current_not_regress_from_map()
    {
        Assert.False(SolicitacaoVagaRmSyncWorkflowRank.WouldRegress(SolicitacaoStatus.Concluida, SolicitacaoStatus.Rascunho));
        Assert.False(SolicitacaoVagaRmSyncWorkflowRank.WouldRegress(SolicitacaoStatus.Reprovada, SolicitacaoStatus.Aprovada));
    }
}
