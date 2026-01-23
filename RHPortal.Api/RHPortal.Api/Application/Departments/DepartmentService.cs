using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Departments;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Departments;

public interface IDepartmentService
{
    Task<PagedResult<DepartmentGridRowResponse>> ListGridAsync(DepartmentListQuery query, CancellationToken ct);

    Task<DepartmentResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<DepartmentResponse> CreateAsync(DepartmentCreateRequest request, CancellationToken ct);
    Task<DepartmentResponse?> UpdateAsync(Guid id, DepartmentUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class DepartmentService : IDepartmentService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public DepartmentService(AppDbContext db, IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
    }

    public async Task<PagedResult<DepartmentResponse>> ListAsync(DepartmentListQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;
        if (pageSize > 100) pageSize = 100; // proteção

        var search = (query.Search ?? string.Empty).Trim();

        IQueryable<Domain.Entities.Department> departmentsQuery = _db.Departments
            .AsNoTracking()
            .Include(x => x.Area);

        // Filtros
        if (!string.IsNullOrWhiteSpace(search))
        {
            departmentsQuery = departmentsQuery.Where(x =>
                x.Code.Contains(search) ||
                x.Name.Contains(search));
        }

        if (query.Status.HasValue)
            departmentsQuery = departmentsQuery.Where(x => x.Status == query.Status.Value);

        if (query.AreaId.HasValue)
            departmentsQuery = departmentsQuery.Where(x => x.AreaId == query.AreaId.Value);

        // Total antes da paginação
        var totalItems = await departmentsQuery.CountAsync(ct);

        // Ordenação segura (sem “OrderBy string”)
        var ascending = !string.Equals(query.Dir, "desc", StringComparison.OrdinalIgnoreCase);

        departmentsQuery = query.Sort?.Trim().ToLowerInvariant() switch
        {
            "code" => ascending ? departmentsQuery.OrderBy(x => x.Code) : departmentsQuery.OrderByDescending(x => x.Code),
            "status" => ascending ? departmentsQuery.OrderBy(x => x.Status) : departmentsQuery.OrderByDescending(x => x.Status),
            "headcount" => ascending ? departmentsQuery.OrderBy(x => x.Headcount) : departmentsQuery.OrderByDescending(x => x.Headcount),
            "area" => ascending ? departmentsQuery.OrderBy(x => x.Area!.Name) : departmentsQuery.OrderByDescending(x => x.Area!.Name),
            _ => ascending ? departmentsQuery.OrderBy(x => x.Name) : departmentsQuery.OrderByDescending(x => x.Name),
        };

        // Paginação
        var items = await departmentsQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new DepartmentResponse(
                x.Id,
                x.Code,
                x.Name,
                x.AreaId,
                x.Area != null ? x.Area.Name : null,
                x.Status,
                x.Headcount,
                x.ManagerName,
                x.ManagerEmail,
                x.Phone,
                x.CostCenter,
                x.BranchOrLocation,
                x.Description,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new PagedResult<DepartmentResponse>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages
        );
    }

    public async Task<PagedResult<DepartmentGridRowResponse>> ListGridAsync(DepartmentListQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;
        if (pageSize > 100) pageSize = 100;

        var search = (query.Search ?? string.Empty).Trim();

        var q =
            from d in _db.Departments.AsNoTracking()
            join u in _db.Units.AsNoTracking()
                on ((d.BranchOrLocation ?? "").Trim().ToLower().Replace("-", ""))
                equals (u.Id.ToString().Trim().ToLower().Replace("-", ""))
                into uj
            from u in uj.DefaultIfEmpty()
            select new { d, u };

        // Filtro: search em Nome, Código, Gestor (nome/email)
        if (!string.IsNullOrWhiteSpace(search))
        {
            q = q.Where(x =>
                x.d.Name.Contains(search) ||
                x.d.Code.Contains(search) ||
                (x.d.ManagerName != null && x.d.ManagerName.Contains(search)) ||
                (x.d.ManagerEmail != null && x.d.ManagerEmail.Contains(search)));
        }

        // Filtro: status
        if (query.Status.HasValue)
            q = q.Where(x => x.d.Status == query.Status.Value);

        var totalItems = await q.CountAsync(ct);

        // Ordenação
        var asc = !string.Equals(query.Dir, "desc", StringComparison.OrdinalIgnoreCase);
        var sort = (query.Sort ?? "department").Trim().ToLowerInvariant();

        q = sort switch
        {
            "department" => asc
                ? q.OrderBy(x => x.d.Name).ThenBy(x => x.d.Code)
                : q.OrderByDescending(x => x.d.Name).ThenByDescending(x => x.d.Code),

            "code" => asc
                ? q.OrderBy(x => x.d.Code).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => x.d.Code).ThenByDescending(x => x.d.Name),

            "manager" => asc
                ? q.OrderBy(x => x.d.ManagerName).ThenBy(x => x.d.ManagerEmail).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => x.d.ManagerName).ThenByDescending(x => x.d.ManagerEmail).ThenByDescending(x => x.d.Name),

            "email" => asc
                ? q.OrderBy(x => x.d.ManagerEmail).ThenBy(x => x.d.ManagerName).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => x.d.ManagerEmail).ThenByDescending(x => x.d.ManagerName).ThenByDescending(x => x.d.Name),

            "costcenter" => asc
                ? q.OrderBy(x => x.d.CostCenter).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => x.d.CostCenter).ThenByDescending(x => x.d.Name),

            "location" => asc
                ? q.OrderBy(x => (x.u != null ? x.u.Name : x.d.BranchOrLocation)).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => (x.u != null ? x.u.Name : x.d.BranchOrLocation)).ThenByDescending(x => x.d.Name),


            "headcount" => asc
                ? q.OrderBy(x => x.d.Headcount).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => x.d.Headcount).ThenByDescending(x => x.d.Name),

            "status" => asc
                ? q.OrderBy(x => x.d.Status).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => x.d.Status).ThenByDescending(x => x.d.Name),

            "vacanciesopen" => asc
                ? q.OrderBy(x => 0).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => 0).ThenByDescending(x => x.d.Name),

            "vacanciestotal" => asc
                ? q.OrderBy(x => 0).ThenBy(x => x.d.Name)
                : q.OrderByDescending(x => 0).ThenByDescending(x => x.d.Name),

            _ => asc
                ? q.OrderBy(x => x.d.Name).ThenBy(x => x.d.Code)
                : q.OrderByDescending(x => x.d.Name).ThenByDescending(x => x.d.Code),
        };

        // Page (traz só o necessário)
        var pageRows = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.d.Id,
                x.d.Name,
                x.d.Code,
                x.d.ManagerName,
                x.d.ManagerEmail,
                x.d.CostCenter,
                RawLocation = x.d.BranchOrLocation,

                UnitCode = x.u != null ? x.u.Code : null,
                UnitName = x.u != null ? x.u.Name : null,
                UnitCity = x.u != null ? x.u.City : null,
                UnitUf = x.u != null ? x.u.Uf : null,

                x.d.Headcount,
                x.d.Status
            })
            .ToListAsync(ct);

        var items = pageRows.Select(r =>
        {
            var location = !string.IsNullOrWhiteSpace(r.UnitName)
                ? r.UnitName
                : r.RawLocation;

            return new DepartmentGridRowResponse(
                r.Id,
                r.Name,
                r.Code,
                r.ManagerName,
                r.ManagerEmail,
                r.CostCenter,
                location,
                r.Headcount,
                r.Status,
                0,
                0
            );
        }).ToList();


        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new PagedResult<DepartmentGridRowResponse>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages
        );
    }



    public async Task<DepartmentResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.Departments
            .AsNoTracking()
            .Include(x => x.Area)
            .Where(x => x.Id == id)
            .Select(x => new DepartmentResponse(
                x.Id, x.Code, x.Name, x.AreaId, x.Area!.Name,
                x.Status, x.Headcount,
                x.ManagerName, x.ManagerEmail,
                x.Phone, x.CostCenter, x.BranchOrLocation,
                x.Description, x.CreatedAtUtc, x.UpdatedAtUtc
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<DepartmentResponse> CreateAsync(DepartmentCreateRequest request, CancellationToken ct)
    {
        var codeAlreadyExists = await _db.Departments.AnyAsync(x => x.Code == request.Code, ct);
        if (codeAlreadyExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.DepartmentCodeExists", request.Code]);

        var entity = new Domain.Entities.Department
        {
            Id = Guid.NewGuid(),
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            AreaId = request.AreaId,
            Status = request.Status,
            Headcount = request.Headcount,
            ManagerName = request.ManagerName?.Trim(),
            ManagerEmail = request.ManagerEmail?.Trim(),
            Phone = request.Phone?.Trim(),
            CostCenter = request.CostCenter?.Trim(),
            BranchOrLocation = request.BranchOrLocation?.Trim(),
            Description = request.Description?.Trim()
        };

        _db.Departments.Add(entity);
        await _db.SaveChangesAsync(ct);

        var created = await GetByIdAsync(entity.Id, ct);
        return created!;
    }

    public async Task<DepartmentResponse?> UpdateAsync(Guid id, DepartmentUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Departments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var codeConflict = await _db.Departments.AnyAsync(x => x.Id != id && x.Code == request.Code, ct);
        if (codeConflict)
            throw new InvalidOperationException(_localizer["ServiceErrors.DepartmentCodeExistsOther", request.Code]);

        entity.Code = request.Code.Trim();
        entity.Name = request.Name.Trim();
        entity.AreaId = request.AreaId;
        entity.Status = request.Status;
        entity.Headcount = request.Headcount;
        entity.ManagerName = request.ManagerName?.Trim();
        entity.ManagerEmail = request.ManagerEmail?.Trim();
        entity.Phone = request.Phone?.Trim();
        entity.CostCenter = request.CostCenter?.Trim();
        entity.BranchOrLocation = request.BranchOrLocation?.Trim();
        entity.Description = request.Description?.Trim();

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Departments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.Departments.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
