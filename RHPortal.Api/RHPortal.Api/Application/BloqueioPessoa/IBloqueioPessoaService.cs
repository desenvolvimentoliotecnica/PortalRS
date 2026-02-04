using RhPortal.Api.Contracts.BloqueioPessoa;

namespace RhPortal.Api.Application.BloqueioPessoa;

public interface IBloqueioPessoaService
{
    Task<BloqueioPessoaPagedResponse> ListAsync(BloqueioPessoaListQuery query, CancellationToken ct);
    Task<BloqueioPessoaResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<BloqueioPessoaResponse?> GetByPessoaIdAsync(Guid pessoaId, CancellationToken ct);
    Task<BloqueioPessoaResponse?> CreateManualAsync(BloqueioPessoaCreateManualRequest request, CancellationToken ct);
    Task<BloqueioPessoaResponse?> CreateFromCandidatoAsync(Guid candidatoId, CancellationToken ct);
    Task<BloqueioPessoaResponse?> CreateFromFuncionarioAsync(Guid funcionarioId, CancellationToken ct);
    Task<BloqueioPessoaResponse?> CreateFromTalentoAsync(Guid talentoId, CancellationToken ct);
    /// <summary>Bloqueia uma pessoa já cadastrada (por PessoaId).</summary>
    Task<BloqueioPessoaResponse?> BlockByPessoaIdAsync(Guid pessoaId, string? motivo, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<bool> IsPessoaBlockedAsync(Guid pessoaId, CancellationToken ct);
}
