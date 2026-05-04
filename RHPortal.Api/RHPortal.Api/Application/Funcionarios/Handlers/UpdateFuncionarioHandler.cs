using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface IUpdateFuncionarioHandler
{
    Task<FuncionarioResponse?> HandleAsync(Guid id, FuncionarioUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateFuncionarioHandler : IUpdateFuncionarioHandler
{
    private readonly IFuncionarioService _service;
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _user;

    public UpdateFuncionarioHandler(IFuncionarioService service, AppDbContext db, ICurrentUserContext user)
    {
        _service = service;
        _db = db;
        _user = user;
    }

    public async Task<FuncionarioResponse?> HandleAsync(Guid id, FuncionarioUpdateRequest request, CancellationToken ct)
    {
        var keys = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.Id == id)
            .Select(f => new { f.MatriculaRm, f.CdnFuncionario, f.CdnEmpresa, f.CdnEstab })
            .FirstOrDefaultAsync(ct);

        if (keys is null)
            return null;

        var importadoRm = !string.IsNullOrWhiteSpace(keys.MatriculaRm);
        var importadoDatasul = !string.IsNullOrWhiteSpace(keys.CdnFuncionario)
            && !string.IsNullOrWhiteSpace(keys.CdnEmpresa)
            && !string.IsNullOrWhiteSpace(keys.CdnEstab);

        if ((importadoRm || importadoDatasul) && !_user.IsOwner)
        {
            throw new InvalidOperationException(
                "Funcionário integrado ao ERP (RM/Datasul) só pode ser alterado por usuário com perfil Owner.");
        }

        return await _service.UpdateAsync(id, request, ct);
    }
}
