namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Mapeamento de cada tipo de integração para o procedure (.p) correspondente no TOTVS Progress Datasul.
/// </summary>
public static class TipoIntegracaoExtensions
{
    /// <summary>
    /// Retorna o nome do procedure Progress (.p) associado a este tipo de integração.
    /// </summary>
    public static string ToProcedureName(this TipoIntegracao tipo) => tipo switch
    {
        TipoIntegracao.Admissao          => "apisfadmissao.p",
        TipoIntegracao.PagamentoExtra    => "apisfpagtoextra.p",
        TipoIntegracao.Desligamento      => "apisfdesligamento.p",
        TipoIntegracao.Promocao          => "apisftransferencia.p",
        TipoIntegracao.AlteracaoEndereco => "apisfendereco.p",
        TipoIntegracao.Dependente        => "apisfdependente.p",
        TipoIntegracao.Beneficio         => "apisfbeneficio.p",
        TipoIntegracao.Ferias            => "apisfferias.p",
        TipoIntegracao.SolicitacaoVaga   => "apisfrequisicao.p",  // TODO: confirmar procedure com equipe TOTVS
        _ => throw new ArgumentOutOfRangeException(nameof(tipo), tipo, "Tipo de integração desconhecido")
    };

    /// <summary>
    /// Retorna uma descrição legível do tipo de integração.
    /// </summary>
    public static string ToDescription(this TipoIntegracao tipo) => tipo switch
    {
        TipoIntegracao.Admissao          => "Admissão de funcionário",
        TipoIntegracao.PagamentoExtra    => "Pagamento extra / evento avulso",
        TipoIntegracao.Desligamento      => "Desligamento de funcionário",
        TipoIntegracao.Promocao          => "Promoção / transferência",
        TipoIntegracao.AlteracaoEndereco => "Alteração de endereço",
        TipoIntegracao.Dependente        => "Cadastro / alteração de dependente",
        TipoIntegracao.Beneficio         => "Benefício / vale-transporte",
        TipoIntegracao.Ferias            => "Programação de férias",
        TipoIntegracao.SolicitacaoVaga   => "Requisição de pessoal",
        _ => "Desconhecido"
    };
}
