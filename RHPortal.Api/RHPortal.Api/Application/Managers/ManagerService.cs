using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Managers;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Managers;

public interface IManagerService
{
    Task<PagedResult<ManagerGridRowResponse>> ListGridAsync(ManagerListQuery query, CancellationToken ct);
    Task<ManagerResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ManagerResponse> CreateAsync(ManagerCreateRequest request, CancellationToken ct);
    Task<ManagerResponse?> UpdateAsync(Guid id, ManagerUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class ManagerService : IManagerService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public ManagerService(AppDbContext db, IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
    }

    public async Task<PagedResult<ManagerGridRowResponse>> ListGridAsync(ManagerListQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;
        if (pageSize > 100) pageSize = 100;

        var search = (query.Search ?? string.Empty).Trim();

        IQueryable<Domain.Entities.Manager> q = _db.Managers
            .AsNoTracking()
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .Include(x => x.JobPosition);

        // Search: Nome, Email, Telefone, Unidade, Área, Cargo
        if (!string.IsNullOrWhiteSpace(search))
        {
            q = q.Where(x =>
                x.Name.Contains(search) ||
                x.Email.Contains(search) ||
                (x.Phone != null && x.Phone.Contains(search)) ||
                (x.Unit != null && x.Unit.Name.Contains(search)) ||
                (x.Area != null && x.Area.Name.Contains(search)) ||
                (x.JobPosition != null && x.JobPosition.Name.Contains(search)) ||
                (x.JobPosition != null && x.JobPosition.Code.Contains(search)));
        }

        // Filtros
        if (query.Status.HasValue)
            q = q.Where(x => x.Status == query.Status.Value);

        if (query.UnitId.HasValue)
            q = q.Where(x => x.UnitId == query.UnitId.Value);

        if (query.AreaId.HasValue)
            q = q.Where(x => x.AreaId == query.AreaId.Value);

        if (query.JobPositionId.HasValue)
            q = q.Where(x => x.JobPositionId == query.JobPositionId.Value);

        var totalItems = await q.CountAsync(ct);

        // Ordenação (whitelist)
        var asc = !string.Equals(query.Dir, "desc", StringComparison.OrdinalIgnoreCase);
        var sort = (query.Sort ?? "manager").Trim().ToLowerInvariant();

        q = sort switch
        {
            // Gestor (Nome)
            "manager" => asc
                ? q.OrderBy(x => x.Name).ThenBy(x => x.Email)
                : q.OrderByDescending(x => x.Name).ThenByDescending(x => x.Email),

            "email" => asc
                ? q.OrderBy(x => x.Email).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Email).ThenByDescending(x => x.Name),

            "phone" => asc
                ? q.OrderBy(x => x.Phone).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Phone).ThenByDescending(x => x.Name),

            "status" => asc
                ? q.OrderBy(x => x.Status).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Status).ThenByDescending(x => x.Name),

            // Unidade
            "unit" => asc
                ? q.OrderBy(x => x.Unit!.Name).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Unit!.Name).ThenByDescending(x => x.Name),

            // Área
            "area" => asc
                ? q.OrderBy(x => x.Area!.Name).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Area!.Name).ThenByDescending(x => x.Name),

            // Cargo
            "jobposition" => asc
                ? q.OrderBy(x => x.JobPosition!.Name).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.JobPosition!.Name).ThenByDescending(x => x.Name),

            _ => asc
                ? q.OrderBy(x => x.Name).ThenBy(x => x.Email)
                : q.OrderByDescending(x => x.Name).ThenByDescending(x => x.Email),
        };

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ManagerGridRowResponse(
                x.Id,
                x.Name,
                x.Email,
                x.Phone,
                x.Status,
                x.Headcount,
                x.UnitId,
                x.Unit != null ? x.Unit.Name : string.Empty,
                x.AreaId,
                x.Area != null ? x.Area.Name : string.Empty,
                x.JobPositionId,
                x.JobPosition != null ? x.JobPosition.Name : string.Empty
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new PagedResult<ManagerGridRowResponse>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages
        );
    }

    public async Task<ManagerResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.Managers
            .AsNoTracking()
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .Include(x => x.JobPosition)
            .Where(x => x.Id == id)
            .Select(x => new ManagerResponse(
                x.Id,
                x.Name,
                x.Email,
                x.Phone,
                x.Status,
                x.Headcount,
                x.UnitId,
                x.Unit != null ? x.Unit.Name : string.Empty,
                x.AreaId,
                x.Area != null ? x.Area.Name : string.Empty,
                x.JobPositionId,
                x.JobPosition != null ? x.JobPosition.Name : string.Empty,
                x.Notes,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<ManagerResponse> CreateAsync(ManagerCreateRequest request, CancellationToken ct)
    {
        var normalizedEmail = NormalizeEmail(request.Email);

        // validações de FK (pra não criar gestor apontando pra ids inválidos)
        await EnsureReferencesExist(request.UnitId, request.AreaId, request.JobPositionId, ct);

        // regra simples: email único por tenant (índice já garante, mas tratamos com mensagem amigável)
        var emailAlreadyExists = await _db.Managers.AnyAsync(x => x.Email == normalizedEmail, ct);
        if (emailAlreadyExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.ManagerEmailExists", normalizedEmail]);

        var entity = new Domain.Entities.Manager
        {
            Id = Guid.NewGuid(),
            Name = (request.Name ?? string.Empty).Trim(),
            Email = normalizedEmail,
            Phone = TrimOrNull(request.Phone),
            Status = request.Status,
            Headcount = request.Headcount,
            UnitId = request.UnitId,
            AreaId = request.AreaId,
            JobPositionId = request.JobPositionId,
            Notes = TrimOrNull(request.Notes)
        };

        _db.Managers.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<ManagerResponse?> UpdateAsync(Guid id, ManagerUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Managers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var normalizedEmail = NormalizeEmail(request.Email);

        await EnsureReferencesExist(request.UnitId, request.AreaId, request.JobPositionId, ct);

        // conflito de email (outro gestor)
        var emailConflict = await _db.Managers.AnyAsync(x => x.Id != id && x.Email == normalizedEmail, ct);
        if (emailConflict)
            throw new InvalidOperationException(_localizer["ServiceErrors.ManagerEmailExistsOther", normalizedEmail]);

        entity.Name = (request.Name ?? string.Empty).Trim();
        entity.Email = normalizedEmail;
        entity.Phone = TrimOrNull(request.Phone);
        entity.Status = request.Status;
        entity.Headcount = request.Headcount;
        entity.UnitId = request.UnitId;
        entity.AreaId = request.AreaId;
        entity.JobPositionId = request.JobPositionId;
        entity.Notes = TrimOrNull(request.Notes);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Managers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.Managers.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task EnsureReferencesExist(Guid unitId, Guid areaId, Guid jobPositionId, CancellationToken ct)
    {
        var unitExists = await _db.Units.AnyAsync(x => x.Id == unitId, ct);
        if (!unitExists) throw new InvalidOperationException(_localizer["ServiceErrors.ManagerUnitInvalid"]);

        var areaExists = await _db.Areas.AnyAsync(x => x.Id == areaId, ct);
        if (!areaExists) throw new InvalidOperationException(_localizer["ServiceErrors.ManagerAreaInvalid"]);

        var jobExists = await _db.JobPositions.AnyAsync(x => x.Id == jobPositionId, ct);
        if (!jobExists) throw new InvalidOperationException(_localizer["ServiceErrors.ManagerJobInvalid"]);
    }

    private static string NormalizeEmail(string email)
        => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
