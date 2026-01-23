using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Units;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Units;

public interface IUnitService
{
    Task<PagedResult<UnitGridRowResponse>> ListGridAsync(UnitListQuery query, CancellationToken ct);

    Task<UnitResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<UnitResponse> CreateAsync(UnitCreateRequest request, CancellationToken ct);
    Task<UnitResponse?> UpdateAsync(Guid id, UnitUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class UnitService : IUnitService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public UnitService(AppDbContext db, IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
    }

    public async Task<PagedResult<UnitGridRowResponse>> ListGridAsync(UnitListQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;
        if (pageSize > 100) pageSize = 100;

        var search = (query.Search ?? string.Empty).Trim();

        IQueryable<Domain.Entities.Unit> q = _db.Units.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            q = q.Where(x =>
                x.Name.Contains(search) ||
                x.Code.Contains(search) ||
                (x.City != null && x.City.Contains(search)) ||
                (x.Uf != null && x.Uf.Contains(search)) ||
                (x.Email != null && x.Email.Contains(search)) ||
                (x.Phone != null && x.Phone.Contains(search)) ||
                (x.ResponsibleName != null && x.ResponsibleName.Contains(search)) ||
                (x.Type != null && x.Type.Contains(search)));
        }

        if (query.Status.HasValue)
            q = q.Where(x => x.Status == query.Status.Value);

        var totalItems = await q.CountAsync(ct);

        var asc = !string.Equals(query.Dir, "desc", StringComparison.OrdinalIgnoreCase);
        var sort = (query.Sort ?? "unit").Trim().ToLowerInvariant();

        q = sort switch
        {
            "unit" => asc
                ? q.OrderBy(x => x.Name).ThenBy(x => x.Code)
                : q.OrderByDescending(x => x.Name).ThenByDescending(x => x.Code),

            "code" => asc
                ? q.OrderBy(x => x.Code).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Code).ThenByDescending(x => x.Name),

            "status" => asc
                ? q.OrderBy(x => x.Status).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Status).ThenByDescending(x => x.Name),

            "headcount" => asc
                ? q.OrderBy(x => x.Headcount).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Headcount).ThenByDescending(x => x.Name),

            "email" => asc
                ? q.OrderBy(x => x.Email).ThenBy(x => x.Phone).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Email).ThenByDescending(x => x.Phone).ThenByDescending(x => x.Name),

            "phone" => asc
                ? q.OrderBy(x => x.Phone).ThenBy(x => x.Email).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Phone).ThenByDescending(x => x.Email).ThenByDescending(x => x.Name),

            "type" => asc
                ? q.OrderBy(x => x.Type).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Type).ThenByDescending(x => x.Name),

            "city" => asc
                ? q.OrderBy(x => x.City).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.City).ThenByDescending(x => x.Name),

            "uf" => asc
                ? q.OrderBy(x => x.Uf).ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Uf).ThenByDescending(x => x.Name),

            _ => asc
                ? q.OrderBy(x => x.Name).ThenBy(x => x.Code)
                : q.OrderByDescending(x => x.Name).ThenByDescending(x => x.Code),
        };

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new UnitGridRowResponse(
                x.Id,
                x.Name,
                x.Code,
                x.Status,
                x.Headcount,
                x.Email,
                x.Phone,
                x.Type,
                x.City,
                x.Uf,

                // ✅ novos campos
                x.AddressLine,
                x.Neighborhood,
                x.ZipCode,
                x.ResponsibleName,
                x.Notes
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new PagedResult<UnitGridRowResponse>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages
        );
    }

    public async Task<UnitResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.Units
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new UnitResponse(
                x.Id,
                x.Code,
                x.Name,
                x.Status,
                x.City,
                x.Uf,
                x.AddressLine,
                x.Neighborhood,
                x.ZipCode,
                x.Email,
                x.Phone,
                x.ResponsibleName,
                x.Type,
                x.Headcount,
                x.Notes,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<UnitResponse> CreateAsync(UnitCreateRequest request, CancellationToken ct)
    {
        var normalizedCode = NormalizeCode(request.Code);
        ValidateCode(normalizedCode);

        if (request.Headcount < 0)
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitHeadcountNegative"]);

        var codeAlreadyExists = await _db.Units.AnyAsync(x => x.Code == normalizedCode, ct);
        if (codeAlreadyExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitCodeExists", normalizedCode]);

        var entity = new Domain.Entities.Unit
        {
            Id = Guid.NewGuid(),
            Code = normalizedCode,
            Name = (request.Name ?? string.Empty).Trim(),

            Status = request.Status,
            City = TrimOrNull(request.City),
            Uf = NormalizeUf(request.Uf),

            AddressLine = TrimOrNull(request.AddressLine),
            Neighborhood = TrimOrNull(request.Neighborhood),
            ZipCode = NormalizeZip(request.ZipCode),

            Email = TrimOrNull(request.Email),
            Phone = TrimOrNull(request.Phone),

            ResponsibleName = TrimOrNull(request.ResponsibleName),
            Type = TrimOrNull(request.Type),

            Headcount = request.Headcount,
            Notes = TrimOrNull(request.Notes)
        };

        _db.Units.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<UnitResponse?> UpdateAsync(Guid id, UnitUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Units.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var normalizedCode = NormalizeCode(request.Code);
        ValidateCode(normalizedCode);

        if (request.Headcount < 0)
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitHeadcountNegative"]);

        var codeConflict = await _db.Units.AnyAsync(x => x.Id != id && x.Code == normalizedCode, ct);
        if (codeConflict)
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitCodeExistsOther", normalizedCode]);

        entity.Code = normalizedCode;
        entity.Name = (request.Name ?? string.Empty).Trim();

        entity.Status = request.Status;
        entity.City = TrimOrNull(request.City);
        entity.Uf = NormalizeUf(request.Uf);

        entity.AddressLine = TrimOrNull(request.AddressLine);
        entity.Neighborhood = TrimOrNull(request.Neighborhood);
        entity.ZipCode = NormalizeZip(request.ZipCode);

        entity.Email = TrimOrNull(request.Email);
        entity.Phone = TrimOrNull(request.Phone);

        entity.ResponsibleName = TrimOrNull(request.ResponsibleName);
        entity.Type = TrimOrNull(request.Type);

        entity.Headcount = request.Headcount;
        entity.Notes = TrimOrNull(request.Notes);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Units.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.Units.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static string NormalizeCode(string code)
        => (code ?? string.Empty).Trim().ToUpperInvariant();

    private void ValidateCode(string code)
    {
        // padrão mínimo: "UNI-" + pelo menos 2 caracteres
        if (!code.StartsWith("UNI-"))
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitCodePrefix"]);

        if (code.Length < 6)
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitCodeTooShort"]);
    }

    private string? NormalizeUf(string? uf)
    {
        var v = TrimOrNull(uf);
        if (v is null) return null;

        v = v.ToUpperInvariant();
        if (v.Length != 2)
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitUfInvalid"]);

        return v;
    }

    private string? NormalizeZip(string? zip)
    {
        var v = TrimOrNull(zip);
        if (v is null) return null;

        // aceita "00000-000" ou "00000000"
        v = v.Replace(" ", "");
        if (v.Length is not (8 or 9))
            throw new InvalidOperationException(_localizer["ServiceErrors.UnitCepInvalid"]);

        return v;
    }

    private static string? TrimOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Trim();
    }
}
