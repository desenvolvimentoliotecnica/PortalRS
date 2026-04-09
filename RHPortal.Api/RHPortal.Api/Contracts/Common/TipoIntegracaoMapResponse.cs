namespace RhPortal.Api.Contracts.Common;

/// <summary>
/// Mapeamento de tipo de integração TOTVS para o procedure Progress (.p).
/// </summary>
public sealed record TipoIntegracaoMapResponse(
    short Code,
    string Name,
    string Description,
    string ProcedureName
);
