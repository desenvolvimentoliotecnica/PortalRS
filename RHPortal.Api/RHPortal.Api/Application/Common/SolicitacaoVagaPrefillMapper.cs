using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Common;

internal static class SolicitacaoVagaPrefillMapper
{
    public static VagaMotivoAbertura? MapMotivoAbertura(SolicitacaoVaga solicitacao)
    {
        if (solicitacao.TipoSolicitacao == TipoSolicitacaoVaga.AumentoQuadro)
            return VagaMotivoAbertura.AumentoDeQuadro;

        var codigo = solicitacao.Motivo?.Codigo;
        if (!string.IsNullOrWhiteSpace(codigo))
        {
            return codigo switch
            {
                Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodPedidoDemissao
                    or Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodDesligamentoSemJustaCausa
                    or Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodTerminoContrato
                    or Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodMovimentacao
                    or Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodAfastamento
                    => VagaMotivoAbertura.Substituicao,
                Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodNovaUnidade
                    => VagaMotivoAbertura.NovoProjeto,
                Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodAtenderDemanda
                    or Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodExpansaoBase
                    or Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder.CodCotaAprendiz
                    => VagaMotivoAbertura.AumentoDeQuadro,
                _ => solicitacao.Motivo?.EfeitoHeadcount switch
                {
                    EfeitoHeadcount.Aumenta => VagaMotivoAbertura.AumentoDeQuadro,
                    EfeitoHeadcount.Ambos or EfeitoHeadcount.Diminui => VagaMotivoAbertura.Substituicao,
                    _ => null
                }
            };
        }

        if (solicitacao.TipoSolicitacao == TipoSolicitacaoVaga.Substituicao)
            return VagaMotivoAbertura.Substituicao;

        return solicitacao.MotivoRequisicao switch
        {
            MotivoRequisicaoVaga.PedidoDemissao
                or MotivoRequisicaoVaga.DesligamentoSemJustaCausa
                or MotivoRequisicaoVaga.TerminoContrato
                or MotivoRequisicaoVaga.Movimentacao
                or MotivoRequisicaoVaga.Afastamento
                => VagaMotivoAbertura.Substituicao,
            MotivoRequisicaoVaga.NovaUnidade
                => VagaMotivoAbertura.NovoProjeto,
            MotivoRequisicaoVaga.AtenderDemanda
                or MotivoRequisicaoVaga.ExpansaoBase
                or MotivoRequisicaoVaga.CotaAprendiz
                => VagaMotivoAbertura.AumentoDeQuadro,
            _ => null
        };
    }
}
