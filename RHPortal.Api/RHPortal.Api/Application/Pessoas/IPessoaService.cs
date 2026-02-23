using RhPortal.Api.Contracts.Pessoas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Pessoas;

public interface IPessoaService
{
    Task<PessoaPagedResponse> ListAsync(PessoaListQuery query, CancellationToken ct);
    Task<PessoaResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<Pessoa?> FindByEmailAsync(string email, CancellationToken ct);
    /// <summary>Finds a Pessoa by CPF (normalized to 11 digits). Returns null if not found or CPF invalid.</summary>
    Task<Pessoa?> FindByCpfAsync(string cpf, CancellationToken ct);
    /// <summary>Finds a similar Pessoa (and its Talento if any) by email, fone, or nome+endereço. Returns at most one match; priority: email, then fone, then nome+cep/logradouro+numero.</summary>
    Task<(Pessoa Pessoa, Talento? Talento)?> FindSimilarAsync(string? email, string? fone, string? nome, string? cep, string? logradouro, string? numero, CancellationToken ct);
    Task<PessoaResponse> CreateAsync(PessoaCreateRequest request, CancellationToken ct);
    Task<PessoaResponse?> UpdateAsync(Guid id, PessoaUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    /// <summary>Creates a Pessoa if no one exists with the given email (normalized); otherwise returns the existing one. Origem is set when creating a new Pessoa.</summary>
    Task<Pessoa> GetOrCreateByEmailAsync(string email, string? nome, string? fone, string? cidade, string? uf, string? linkedinUrl, string? resumoProfissional, string? obs, OrigemPessoa? origem, CancellationToken ct);
}
