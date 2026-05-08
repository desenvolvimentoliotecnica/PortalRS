namespace RhPortal.Api.Infrastructure.Frontend;

/// <summary>
/// Monta URLs absolutas do front (Next) seguindo a mesma estratégia de
/// <c>PreAdmissaoService.BuildFrontendUrl</c> / <c>AuthController.BuildFrontendUrl</c>.
/// </summary>
public interface IFrontendPublicUrlBuilder
{
    /// <param name="pathAndQuery">Deve iniciar em <c>/</c>; normalmente inclui <c>/app/...</c> para rotas públicas ou autenticadas no Next.</param>
    string BuildAbsoluteUrl(string pathAndQuery);
}
