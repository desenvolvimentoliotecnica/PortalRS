namespace RhPortal.Api.Contracts.Organograma;

// ── Estrutura organizacional (endpoint /estrutura) ──────────────────────────

/// <summary>Dados básicos de um funcionário para o organograma.</summary>
public sealed record OrganogramaFuncionarioDto(
    Guid Id,
    string Nome,
    string? Cargo,
    string? NivelHierarquicoNome,
    int? NivelHierarquicoOrdem
);

/// <summary>Nó de uma unidade de lotação no organograma.</summary>
public sealed record OrganogramaLotacaoDto(
    Guid Id,
    string Codigo,
    string Descricao,
    int Level,
    Guid? ParentId,
    OrganogramaFuncionarioDto? Responsavel,
    IReadOnlyList<OrganogramaFuncionarioDto> Funcionarios,
    int HeadcountAutorizado,
    int HeadcountOcupado,
    int HeadcountProvisorio
);

/// <summary>Resposta completa do organograma estrutural.</summary>
public sealed record OrganogramaEstruturaResponse(
    IReadOnlyList<OrganogramaLotacaoDto> Lotacoes,
    IReadOnlyList<OrganogramaFuncionarioDto> SemLotacao
);

// ── Legado: mover funcionário ───────────────────────────────────────────────

/// <summary>Move um funcionário para um novo gestor direto.</summary>
public sealed record MoverFuncionarioRequest(
    Guid FuncionarioId,
    Guid? NovoGestorId
);
