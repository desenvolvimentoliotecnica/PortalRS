using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface IListUsersWithoutFuncionarioHandler
{
    Task<IReadOnlyList<UserWithoutFuncionarioItemResponse>> HandleAsync(CancellationToken ct);
}

public sealed class ListUsersWithoutFuncionarioHandler : IListUsersWithoutFuncionarioHandler
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public ListUsersWithoutFuncionarioHandler(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<UserWithoutFuncionarioItemResponse>> HandleAsync(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var totalInTenant = await _db.Users.AsNoTracking().CountAsync(ct);
        var items = await _db.Users
            .AsNoTracking()
            .OrderBy(x => x.FullName)
            .ThenBy(x => x.Email)
            .Select(x => new UserWithoutFuncionarioItemResponse(
                x.Id,
                x.FullName ?? "",
                x.Email ?? "",
                x.FuncionarioId != null
            ))
            .ToListAsync(ct);
        return items;
    }
}
