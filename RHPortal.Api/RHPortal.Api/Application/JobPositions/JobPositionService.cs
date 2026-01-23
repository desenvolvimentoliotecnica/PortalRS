using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.JobPositions;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.JobPositions;

public interface IJobPositionService
{
    Task<PagedResult<JobPositionGridRowResponse>> ListGridAsync(JobPositionListQuery query, CancellationToken ct);
    Task<JobPositionResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<JobPositionResponse> CreateAsync(JobPositionCreateRequest request, CancellationToken ct);
    Task<JobPositionResponse?> UpdateAsync(Guid id, JobPositionUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class JobPositionService : IJobPositionService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public JobPositionService(AppDbContext db, IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
    }

    public async Task<PagedResult<JobPositionGridRowResponse>> ListGridAsync(JobPositionListQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;
        if (pageSize > 100) pageSize = 100;

        var search = (query.Search ?? string.Empty).Trim();

        IQueryable<Domain.Entities.JobPosition> q = _db.JobPositions.AsNoTracking();

        // Filtros
        if (!string.IsNullOrWhiteSpace(search))
        {
            q = q.Where(x =>
                x.Name.Contains(search) ||
                x.Code.Contains(search) ||
                (x.Area != null && x.Area.Name.Contains(search)));
        }

        if (query.Status.HasValue)
            q = q.Where(x => x.Status == query.Status.Value);

        if (query.AreaId.HasValue)
            q = q.Where(x => x.AreaId == query.AreaId.Value);

        if (query.Seniority.HasValue)
            q = q.Where(x => x.Seniority == query.Seniority.Value);

        var totalItems = await q.CountAsync(ct);

        // Projeção com contagem real de gestores (respeita TenantFilter automaticamente)
        var projected = q.Select(x => new
        {
            x.Id,
            x.Name,
            x.Code,
            x.AreaId,
            AreaName = x.Area != null ? x.Area.Name : string.Empty,
            x.Seniority,
            x.Status,
            ManagersCount = _db.Managers.Count(m => m.JobPositionId == x.Id)
        });

        // Ordenação (whitelist)
        var asc = !string.Equals(query.Dir, "desc", StringComparison.OrdinalIgnoreCase);
        var sort = (query.Sort ?? "cargo").Trim().ToLowerInvariant();

        projected = sort switch
        {
            "cargo" => asc
                ? projected.OrderBy(x => x.Name).ThenBy(x => x.Code)
                : projected.OrderByDescending(x => x.Name).ThenByDescending(x => x.Code),

            "code" => asc
                ? projected.OrderBy(x => x.Code).ThenBy(x => x.Name)
                : projected.OrderByDescending(x => x.Code).ThenByDescending(x => x.Name),

            "area" => asc
                ? projected.OrderBy(x => x.AreaName).ThenBy(x => x.Name)
                : projected.OrderByDescending(x => x.AreaName).ThenByDescending(x => x.Name),

            "seniority" => asc
                ? projected.OrderBy(x => x.Seniority).ThenBy(x => x.Name)
                : projected.OrderByDescending(x => x.Seniority).ThenByDescending(x => x.Name),

            "status" => asc
                ? projected.OrderBy(x => x.Status).ThenBy(x => x.Name)
                : projected.OrderByDescending(x => x.Status).ThenByDescending(x => x.Name),

            "managers" => asc
                ? projected.OrderBy(x => x.ManagersCount).ThenBy(x => x.Name)
                : projected.OrderByDescending(x => x.ManagersCount).ThenByDescending(x => x.Name),

            _ => asc
                ? projected.OrderBy(x => x.Name).ThenBy(x => x.Code)
                : projected.OrderByDescending(x => x.Name).ThenByDescending(x => x.Code),
        };

        var items = await projected
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new JobPositionGridRowResponse(
                x.Id,
                x.Name,
                x.Code,
                x.AreaName,
                x.AreaId,
                x.Seniority,
                x.ManagersCount,
                x.Status
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new PagedResult<JobPositionGridRowResponse>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages
        );
    }


    public async Task<JobPositionResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.JobPositions
            .AsNoTracking()
            .Include(x => x.Area)
            .Where(x => x.Id == id)
            .Select(x => new JobPositionResponse(
                x.Id,
                x.Code,
                x.Name,
                x.Status,
                x.AreaId,
                x.Area != null ? x.Area.Name : string.Empty,
                x.Seniority,
                x.Type,
                x.Description,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<JobPositionResponse> CreateAsync(JobPositionCreateRequest request, CancellationToken ct)
    {
        var normalizedCode = NormalizeCode(request.Code);
        ValidateCode(normalizedCode);

        var areaExists = await _db.Areas.AnyAsync(a => a.Id == request.AreaId, ct);
        if (!areaExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.JobAreaInvalid"]);

        var codeAlreadyExists = await _db.JobPositions.AnyAsync(x => x.Code == normalizedCode, ct);
        if (codeAlreadyExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.JobCodeExists", normalizedCode]);

        var entity = new Domain.Entities.JobPosition
        {
            Id = Guid.NewGuid(),
            Code = normalizedCode,
            Name = (request.Name ?? string.Empty).Trim(),
            Status = request.Status,
            AreaId = request.AreaId,
            Seniority = request.Seniority,
            Type = TrimOrNull(request.Type),
            Description = TrimOrNull(request.Description)
        };

        _db.JobPositions.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<JobPositionResponse?> UpdateAsync(Guid id, JobPositionUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.JobPositions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var normalizedCode = NormalizeCode(request.Code);
        ValidateCode(normalizedCode);

        var areaExists = await _db.Areas.AnyAsync(a => a.Id == request.AreaId, ct);
        if (!areaExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.JobAreaInvalid"]);

        var codeConflict = await _db.JobPositions.AnyAsync(x => x.Id != id && x.Code == normalizedCode, ct);
        if (codeConflict)
            throw new InvalidOperationException(_localizer["ServiceErrors.JobCodeExistsOther", normalizedCode]);

        entity.Code = normalizedCode;
        entity.Name = (request.Name ?? string.Empty).Trim();
        entity.Status = request.Status;
        entity.AreaId = request.AreaId;
        entity.Seniority = request.Seniority;
        entity.Type = TrimOrNull(request.Type);
        entity.Description = TrimOrNull(request.Description);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.JobPositions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.JobPositions.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static string NormalizeCode(string code)
        => (code ?? string.Empty).Trim().ToUpperInvariant();

    private void ValidateCode(string code)
    {
        if (!code.StartsWith("CAR-"))
            throw new InvalidOperationException(_localizer["ServiceErrors.JobCodePrefix"]);

        if (code.Length < 6)
            throw new InvalidOperationException(_localizer["ServiceErrors.JobCodeTooShort"]);
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
