namespace RhPortal.Api.Application.Common;

/// <summary>
/// Rotas Next.js (<c>basePath</c>=<c>/app</c>): notificações internas devem usar path sem <c>/app</c>; links em e-mails usam path absoluto já com <c>/app</c>.
/// </summary>
public static class SolicitacaoVagaFrontendLinks
{
    /// <summary>URL relativa para <see cref="Link"/> / deep links dentro do SPA.</summary>
    public static string SolicitacaoVagaRelativeEdit(Guid id) =>
        $"/gestao/solicitacoes/editar?id={Uri.EscapeDataString(id.ToString())}";

    /// <summary>Path após origin (inclui <c>/app</c>) para <c href</c> em HTML de e-mail.</summary>
    public static string SolicitacaoVagaEmailPublicPath(Guid id) =>
        $"/app/gestao/solicitacoes/editar?id={Uri.EscapeDataString(id.ToString())}";
}
