namespace RhPortal.Api.Contracts.Funcionarios;

/// <summary>Item para filtro "Gestor direto" na listagem de funcionários (distinct de quem aparece como gestor).</summary>
public sealed record GestorOpcaoResponse(Guid Id, string Nome);
