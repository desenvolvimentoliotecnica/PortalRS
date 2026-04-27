using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

public sealed record FuncionarioGridRowResponse(
    Guid Id,
    string Name,
    string? Email,
    string? Phone,
    FuncionarioStatus Status,
    int Headcount,
    Guid? UnitId,
    string? UnitName,
    Guid? JobPositionId,
    string? JobPositionName,
    Guid? GestorDiretoId,
    string? GestorDiretoNome,
    Guid? NivelHierarquicoId,
    string? NivelHierarquicoNome,
    // Unidade de lotação TOTVS
    Guid? UnidadeLotacaoId,
    string? UnidadeLotacaoDescricao,
    // Chaves TOTVS Datasul
    string? CdnFuncionario,
    string? CdnEmpresa,
    string? CdnEstab,
    // Centro de Custo
    Guid? CentroCustoId,
    string? CentroCustoDescricao,
    // Cadastro
    Guid? PessoaId,
    bool HasIncompleteData,
    // Códigos para exibição
    string? UnidadeLotacaoCode,
    string? CentroCustoCode,
    // Integração TOTVS RM (refactor 2026-04-26)
    /// <summary>PFUNC.CHAPA — matrícula no TOTVS RM.</summary>
    string? MatriculaRm,
    /// <summary>FK Hierarquia (organograma TOTVS) — derivada da última promoção do funcionário.</summary>
    Guid? HierarquiaId,
    string? HierarquiaDescricao,
    /// <summary>PFUNC.CODSITUACAO original ("A","F","P","D","I","T",...).</summary>
    string? CodSituacaoRm,
    /// <summary>Descrição amigável ("Ativo", "Férias", "Demitido", etc.).</summary>
    string? SituacaoRmDescricao,
    /// <summary>Código da função TOTVS (PFUNC.CODFUNCAO).</summary>
    string? CodFuncaoRm,
    /// <summary>Nome específico da função TOTVS (PFUNCAO.NOME). Mais granular que cargo.</summary>
    string? FuncaoNomeRm
);
