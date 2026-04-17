namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Tipo de integração TOTVS — determina qual procedure (.p) do Progress Datasul será chamada.
/// </summary>
public enum TipoIntegracao : short
{
    Admissao = 1,
    PagamentoExtra = 2,
    Desligamento = 3,
    Promocao = 4,
    AlteracaoEndereco = 5,
    Dependente = 6,
    Beneficio = 7,
    Ferias = 8,
    /// <summary>Requisição de Pessoal enviada ao TOTVS para abrir a vaga no ERP.</summary>
    SolicitacaoVaga = 9
}
