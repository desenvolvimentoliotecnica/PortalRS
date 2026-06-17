namespace LiotecnicaHub.Web.Application.Access.Contracts;

public sealed record HubAuthMeResponse(
    Guid Id,
    string Nome,
    string Email,
    IReadOnlyList<string> Perfis);

public sealed record HubAccessScopeDto(
    string Tipo,
    string Codigo,
    string Nome);

public sealed record HubMinhasPermissoesResponse(
    Guid UsuarioId,
    IReadOnlyList<string> Permissoes,
    IReadOnlyList<HubAccessScopeDto> Escopos);

public sealed record HubVerificarPermissaoResponse(bool Permitido);

public sealed record HubMeuSistemaDto(
    string Codigo,
    string Nome,
    string? Descricao,
    string? Url,
    string? Icone,
    bool Favorito);
