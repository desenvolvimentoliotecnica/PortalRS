namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Ação executada automaticamente em determinado momento de uma etapa de aprovação.
/// Configurável na tela de Configuração de Aprovações.
/// </summary>
public enum AcaoEtapa : short
{
    /// <summary>Sem ação extra — apenas avança no fluxo.</summary>
    Nenhuma = 0,

    /// <summary>Cria a Vaga em status Rascunho para o RH começar a preencher.</summary>
    CriarVagaRascunho = 1,
    /// <summary>Marca a solicitação como Aprovada e a coloca na fila de integração TOTVS.</summary>
    EnviarIntegracao = 2,
}
