namespace RhPortal.Api.Application.Funcionarios;

public interface IFuncionarioCorporateEmailResolver
{
    Task<string?> ResolveEmailAsync(Guid funcionarioId, CancellationToken ct);

    Task<IReadOnlyDictionary<Guid, string>> ResolveEmailsAsync(
        IReadOnlyList<Guid> funcionarioIds,
        CancellationToken ct);

    Task<CorporateEmailByChapaResult?> ResolveByChapaAsync(string chapa, CancellationToken ct);
}

public sealed record CorporateEmailByChapaResult(
    string ChapaConsultada,
    string? ChapaEncontradaNoAd,
    string? EmailCorporativo,
    string? DisplayName,
    string? UserPrincipalName,
    string Fonte);
