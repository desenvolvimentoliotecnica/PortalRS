using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Funcionarios;

public interface IFuncionarioService
{
    Task<PagedResult<FuncionarioGridRowResponse>> ListGridAsync(FuncionarioListQuery query, CancellationToken ct);
    Task<FuncionarioResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<FuncionarioResponse> CreateAsync(FuncionarioCreateRequest request, CancellationToken ct);
    Task<FuncionarioResponse?> UpdateAsync(Guid id, FuncionarioUpdateRequest request, CancellationToken ct);
    Task<bool> UpdateHierarquiaAsync(Guid id, Guid? gestorDiretoId, Guid? nivelHierarquicoId, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class FuncionarioService : IFuncionarioService
{
    private readonly AppDbContext _db;
    private readonly IPessoaService _pessoaService;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public FuncionarioService(AppDbContext db, IPessoaService pessoaService, IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _pessoaService = pessoaService;
        _localizer = localizer;
    }

    public async Task<PagedResult<FuncionarioGridRowResponse>> ListGridAsync(FuncionarioListQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : query.PageSize;
        if (pageSize > 100) pageSize = 100;

        var search = (query.Search ?? string.Empty).Trim();

        IQueryable<Funcionario> q = _db.Funcionarios
            .AsNoTracking()
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .Include(x => x.JobPosition)
            .Include(x => x.RequisitoCategoria)
            .Include(x => x.GestorDireto)
            .Include(x => x.NivelHierarquico);

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

        if (query.Status.HasValue)
            q = q.Where(x => x.Status == query.Status.Value);

        if (query.UnitId.HasValue)
            q = q.Where(x => x.UnitId == query.UnitId.Value);

        if (query.AreaId.HasValue)
            q = q.Where(x => x.AreaId == query.AreaId.Value);

        if (query.JobPositionId.HasValue)
            q = q.Where(x => x.JobPositionId == query.JobPositionId.Value);

        var totalItems = await q.CountAsync(ct);

        var asc = !string.Equals(query.Dir, "desc", StringComparison.OrdinalIgnoreCase);
        var sort = (query.Sort ?? "funcionario").Trim().ToLowerInvariant();

        q = sort switch
        {
            "funcionario" => asc
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
            "unit" => asc
                ? q.OrderBy(x => x.Unit != null ? x.Unit.Name : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Unit != null ? x.Unit.Name : "").ThenByDescending(x => x.Name),
            "area" => asc
                ? q.OrderBy(x => x.Area != null ? x.Area.Name : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.Area != null ? x.Area.Name : "").ThenByDescending(x => x.Name),
            "jobposition" => asc
                ? q.OrderBy(x => x.JobPosition != null ? x.JobPosition.Name : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.JobPosition != null ? x.JobPosition.Name : "").ThenByDescending(x => x.Name),
            _ => asc
                ? q.OrderBy(x => x.Name).ThenBy(x => x.Email)
                : q.OrderByDescending(x => x.Name).ThenByDescending(x => x.Email),
        };

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new FuncionarioGridRowResponse(
                x.Id,
                x.Name,
                x.Email,
                x.Phone,
                x.Status,
                x.Headcount,
                x.UnitId,
                x.Unit != null ? x.Unit.Name : null,
                x.AreaId,
                x.Area != null ? x.Area.Name : null,
                x.JobPositionId,
                x.JobPosition != null ? x.JobPosition.Name : null,
                x.RequisitoCategoriaId,
                x.RequisitoCategoria != null ? x.RequisitoCategoria.Name : null,
                x.GestorDiretoId,
                x.GestorDireto != null ? x.GestorDireto.Name : null,
                x.NivelHierarquicoId,
                x.NivelHierarquico != null ? x.NivelHierarquico.Nome : null
            ))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        return new PagedResult<FuncionarioGridRowResponse>(
            Items: items,
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages
        );
    }

    public async Task<FuncionarioResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.Funcionarios
            .AsNoTracking()
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .Include(x => x.JobPosition)
            .Include(x => x.RequisitoCategoria)
            .Where(x => x.Id == id)
            .Select(x => new FuncionarioResponse(
                x.Id,
                x.Name,
                x.Email,
                x.Phone,
                x.Status,
                x.Headcount,
                x.UnitId,
                x.Unit != null ? x.Unit.Name : null,
                x.AreaId,
                x.Area != null ? x.Area.Name : null,
                x.JobPositionId,
                x.JobPosition != null ? x.JobPosition.Name : null,
                x.RequisitoCategoriaId,
                x.RequisitoCategoria != null ? x.RequisitoCategoria.Name : null,
                x.UserId,
                x.Notes,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<FuncionarioResponse> CreateAsync(FuncionarioCreateRequest request, CancellationToken ct)
    {
        string name = (request.Name ?? string.Empty).Trim();
        var normalizedEmail = NormalizeEmail(request.Email);

        ApplicationUser? user = null;
        if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
        {
            user = await _db.Users.FirstOrDefaultAsync(x => x.Id == request.UserId.Value, ct);
            if (user is null)
                throw new InvalidOperationException(_localizer["ServiceErrors.UserNotFound"]);
            if (user.FuncionarioId.HasValue)
                throw new InvalidOperationException(_localizer["ServiceErrors.UserAlreadyHasFuncionario"]);
            name = !string.IsNullOrWhiteSpace(name) ? name : user.FullName.Trim();
            normalizedEmail = !string.IsNullOrWhiteSpace(normalizedEmail) ? normalizedEmail : NormalizeEmail(user.Email ?? "");
        }

        if (request.UnitId.HasValue || request.AreaId.HasValue || request.JobPositionId.HasValue || request.RequisitoCategoriaId.HasValue)
            await EnsureReferencesExist(request.UnitId, request.AreaId, request.JobPositionId, request.RequisitoCategoriaId, ct);

        var emailAlreadyExists = await _db.Funcionarios.AnyAsync(x => x.Email == normalizedEmail, ct);
        if (emailAlreadyExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioEmailExists", normalizedEmail]);

        var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
            normalizedEmail,
            name,
            TrimOrNull(request.Phone),
            null, null, null, null,
            TrimOrNull(request.Notes),
            OrigemPessoa.Funcionario,
            ct);

        var entity = new Funcionario
        {
            Id = Guid.NewGuid(),
            PessoaId = pessoa.Id,
            Name = name,
            Email = normalizedEmail,
            Phone = TrimOrNull(request.Phone),
            Status = request.Status,
            Headcount = request.Headcount,
            UnitId = request.UnitId,
            AreaId = request.AreaId,
            JobPositionId = request.JobPositionId,
            RequisitoCategoriaId = request.RequisitoCategoriaId,
            Notes = TrimOrNull(request.Notes),
            UserId = request.UserId
        };

        _db.Funcionarios.Add(entity);
        if (user is not null)
            user.FuncionarioId = entity.Id;
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<FuncionarioResponse?> UpdateAsync(Guid id, FuncionarioUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        var normalizedEmail = NormalizeEmail(request.Email);

        if (request.UnitId.HasValue || request.AreaId.HasValue || request.JobPositionId.HasValue || request.RequisitoCategoriaId.HasValue)
            await EnsureReferencesExist(request.UnitId, request.AreaId, request.JobPositionId, request.RequisitoCategoriaId, ct);

        var emailConflict = await _db.Funcionarios.AnyAsync(x => x.Id != id && x.Email == normalizedEmail, ct);
        if (emailConflict)
            throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioEmailExistsOther", normalizedEmail]);

        entity.Name = (request.Name ?? string.Empty).Trim();
        entity.Email = normalizedEmail;
        entity.Phone = TrimOrNull(request.Phone);
        entity.Status = request.Status;
        entity.Headcount = request.Headcount;
        entity.UnitId = request.UnitId;
        entity.AreaId = request.AreaId;
        entity.JobPositionId = request.JobPositionId;
        entity.RequisitoCategoriaId = request.RequisitoCategoriaId;
        entity.Notes = TrimOrNull(request.Notes);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> UpdateHierarquiaAsync(Guid id, Guid? gestorDiretoId, Guid? nivelHierarquicoId, CancellationToken ct)
    {
        var entity = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        entity.GestorDiretoId = gestorDiretoId;
        entity.NivelHierarquicoId = nivelHierarquicoId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        _db.Funcionarios.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task EnsureReferencesExist(Guid? unitId, Guid? areaId, Guid? jobPositionId, Guid? requisitoCategoriaId, CancellationToken ct)
    {
        if (unitId.HasValue)
        {
            var unitExists = await _db.Units.AnyAsync(x => x.Id == unitId.Value, ct);
            if (!unitExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioUnitInvalid"]);
        }
        if (areaId.HasValue)
        {
            var areaExists = await _db.Areas.AnyAsync(x => x.Id == areaId.Value, ct);
            if (!areaExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioAreaInvalid"]);
        }
        if (jobPositionId.HasValue)
        {
            var jobExists = await _db.JobPositions.AnyAsync(x => x.Id == jobPositionId.Value, ct);
            if (!jobExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioJobInvalid"]);
        }
        if (requisitoCategoriaId.HasValue)
        {
            var catExists = await _db.RequisitoCategorias.AnyAsync(x => x.Id == requisitoCategoriaId.Value, ct);
            if (!catExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioRequisitoCategoriaInvalid"]);
        }
    }

    private static string NormalizeEmail(string email)
        => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
