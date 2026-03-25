namespace RhPortal.Api.Contracts.Organograma;

/// <summary>Nó do organograma representando um funcionário.</summary>
public sealed record OrganogramaNodeResponse(
    Guid Id,
    string Nome,
    string? Cargo,
    Guid? NivelHierarquicoId,
    string? NivelHierarquicoNome,
    Guid? GestorDiretoId,
    Guid? AreaId,
    string? AreaNome
);

/// <summary>Move um funcionário para um novo gestor direto (drag-drop no organograma).</summary>
public sealed record MoverFuncionarioRequest(
    Guid FuncionarioId,
    Guid? NovoGestorId
);
