namespace RhPortal.Api.Contracts.Navegacao;

/// <summary>
/// Resposta do endpoint <c>GET /api/navegacao/sidebar</c>.
/// Retorna a árvore de navegação já agrupada por bucket de UI,
/// com gating de módulo + permissão resolvidos no backend.
/// </summary>
public sealed record NavegacaoSidebarResponse(
    IReadOnlyList<NavGrupoResponse> Grupos,
    string? ContextoEspecial);

/// <summary>
/// Grupo (bucket) de navegação. A ordem de exibição segue <see cref="Ordem"/>.
/// </summary>
public sealed record NavGrupoResponse(
    string Key,
    string Label,
    int Ordem,
    bool OcultarHeader,
    IReadOnlyList<NavItemResponse> Itens);

/// <summary>
/// Item individual da sidebar. Sempre emitido quando o usuário tem a permissão;
/// quando bloqueado por módulo/pacote, vem com <see cref="Acessivel"/>=false.
/// </summary>
public sealed record NavItemResponse(
    string Id,
    string Label,
    string Href,
    string Icon,
    int Ordem,
    string? ModuloKey,
    string? PackageKey,
    bool Acessivel,
    string? MotivoBloqueio,
    bool OpenInNewTab = false);

/// <summary>
/// Códigos de bloqueio semântico. O frontend usa para decidir apresentação.
/// </summary>
public static class MotivoBloqueioNav
{
    public const string SemPermissao = "sem-permissao";
    public const string ModuloDesativado = "modulo-desativado";
    public const string PacoteInativo = "pacote-inativo";
    public const string PacoteNaoContratado = "pacote-nao-contratado";
    public const string TelaBloqueada = "tela-bloqueada";
}
