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
    Task<JobPositionImportResult> ImportAsync(IReadOnlyList<JobPositionImportItem> items, CancellationToken ct);
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
        if (pageSize > 5000) pageSize = 5000;

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

        // Projeção com contagem real de funcionários (respeita TenantFilter automaticamente)
        var projected = q.Select(x => new
        {
            x.Id,
            x.Name,
            x.Code,
            x.AreaId,
            AreaName = x.Area != null ? x.Area.Name : string.Empty,
            x.Seniority,
            x.Status,
            x.UpdatedAtUtc,
            FuncionariosCount = _db.Funcionarios.Count(m => m.JobPositionId != null && m.JobPositionId == x.Id),
            x.TotvsCargoBasicId,
            x.TotvsNivCargoId,
            NivelCargoNomReduz = x.NivelCargo != null ? x.NivelCargo.NomReduz : null,
            x.DesEnvelPagto,
            x.OccupationalClassification
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

            "funcionarios" => asc
                ? projected.OrderBy(x => x.FuncionariosCount).ThenBy(x => x.Name)
                : projected.OrderByDescending(x => x.FuncionariosCount).ThenByDescending(x => x.Name),

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
                x.FuncionariosCount,
                x.Status,
                x.UpdatedAtUtc,
                x.TotvsCargoBasicId,
                x.TotvsNivCargoId,
                x.NivelCargoNomReduz,
                x.DesEnvelPagto,
                x.OccupationalClassification
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
            .Include(x => x.NivelCargo)
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
                x.OccupationalClassification,
                x.Description,
                x.SimilarityIndicator,
                x.FullDescription,
                x.NivelCargoId,
                x.NivelCargo != null ? x.NivelCargo.NomReduz : null,
                x.NivelCargo != null ? x.NivelCargo.NomComplet : null,
                x.DesEnvelPagto,
                x.TotvsCargoBasicId,
                x.TotvsNivCargoId,
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
            OccupationalClassification = TrimOrNull(request.OccupationalClassification),
            Description = TrimOrNull(request.Description),
            SimilarityIndicator = TrimSimilarityIndicator(request.SimilarityIndicator),
            FullDescription = TrimFullDescription(request.FullDescription),
            NivelCargoId = request.NivelCargoId,
            DesEnvelPagto = TrimOrNull(request.DesEnvelPagto),
            TotvsCargoBasicId = request.TotvsCargoBasicId,
            TotvsNivCargoId = request.TotvsNivCargoId,
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
        entity.OccupationalClassification = TrimOrNull(request.OccupationalClassification);
        entity.Description = TrimOrNull(request.Description);
        entity.SimilarityIndicator = TrimSimilarityIndicator(request.SimilarityIndicator);
        entity.FullDescription = TrimFullDescription(request.FullDescription);
        entity.NivelCargoId = request.NivelCargoId;
        entity.DesEnvelPagto = TrimOrNull(request.DesEnvelPagto);
        entity.TotvsCargoBasicId = request.TotvsCargoBasicId;
        entity.TotvsNivCargoId = request.TotvsNivCargoId;

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
    {
        var trimmed = (code ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(trimmed))
            return trimmed;
        if (!trimmed.StartsWith("CAR-", StringComparison.Ordinal))
            trimmed = "CAR-" + trimmed;
        return trimmed;
    }

    private void ValidateCode(string code)
    {
        if (!code.StartsWith("CAR-", StringComparison.Ordinal))
            throw new InvalidOperationException(_localizer["ServiceErrors.JobCodePrefix"]);

        if (code.Length < 6)
            throw new InvalidOperationException(_localizer["ServiceErrors.JobCodeTooShort"]);
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? TrimSimilarityIndicator(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var t = value.Trim();
        return t.Length == 0 ? null : t[..1];
    }

    private static string? TrimFullDescription(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var t = value.Trim();
        if (t.Length <= 500) return t;
        return t[..500];
    }

    public async Task<JobPositionImportResult> ImportAsync(IReadOnlyList<JobPositionImportItem> items, CancellationToken ct)
    {
        // Índice por (TotvsCargoBasicId, TotvsNivCargoId) — PK real do TOTVS
        var existingByTotvs = await _db.JobPositions
            .AsNoTracking()
            .Where(x => x.TotvsCargoBasicId != null && x.TotvsNivCargoId != null)
            .Select(x => new { x.Id, x.TotvsCargoBasicId, x.TotvsNivCargoId, x.Code })
            .ToListAsync(ct);

        var totvs = existingByTotvs.ToDictionary(
            x => (x.TotvsCargoBasicId!.Value, x.TotvsNivCargoId!.Value), x => x.Id);

        // Índice fallback por código (para registros sem IDs TOTVS)
        var existingCodes = existingByTotvs
            .ToDictionary(x => x.Code.ToUpperInvariant(), x => x.Id);

        // Complementa com registros sem IDs TOTVS
        var noTotvs = await _db.JobPositions
            .AsNoTracking()
            .Where(x => x.TotvsCargoBasicId == null || x.TotvsNivCargoId == null)
            .Select(x => new { x.Id, x.Code })
            .ToListAsync(ct);
        foreach (var r in noTotvs)
            existingCodes.TryAdd(r.Code.ToUpperInvariant(), r.Id);

        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];

            if (string.IsNullOrWhiteSpace(item.Name))
            {
                errors.Add($"Linha {i + 1}: Nome é obrigatório.");
                skipped++;
                continue;
            }

            var code = NormalizeCode(string.IsNullOrWhiteSpace(item.Code)
                ? item.Name[..Math.Min(item.Name.Length, 30)]
                : item.Code);

            // Resolve existingId: prioridade TOTVS ID pair → fallback código
            Guid existingId = Guid.Empty;
            bool found = item.TotvsCargoBasicId.HasValue && item.TotvsNivCargoId.HasValue
                ? totvs.TryGetValue((item.TotvsCargoBasicId.Value, item.TotvsNivCargoId.Value), out existingId)
                : existingCodes.TryGetValue(code.ToUpperInvariant(), out existingId);

            try
            {
                if (found)
                {
                    // Atualização
                    var entity = await _db.JobPositions.FindAsync([existingId], ct);
                    if (entity is null) { skipped++; continue; }

                    entity.Code = code;
                    entity.Name = item.Name.Trim();
                    if (item.AreaId.HasValue) entity.AreaId = item.AreaId.Value;
                    entity.Seniority = item.Seniority ?? entity.Seniority;
                    entity.Type = TrimOrNull(item.Type) ?? entity.Type;
                    entity.OccupationalClassification = TrimOrNull(item.OccupationalClassification) ?? entity.OccupationalClassification;
                    entity.FullDescription = TrimFullDescription(item.FullDescription) ?? entity.FullDescription;
                    entity.DesEnvelPagto = TrimOrNull(item.DesEnvelPagto) ?? entity.DesEnvelPagto;
                    entity.NivelCargoId = item.NivelCargoId ?? entity.NivelCargoId;
                    entity.SimilarityIndicator = TrimSimilarityIndicator(item.SimilarityIndicator) ?? entity.SimilarityIndicator;
                    if (item.TotvsCargoBasicId.HasValue) entity.TotvsCargoBasicId = item.TotvsCargoBasicId;
                    if (item.TotvsNivCargoId.HasValue) entity.TotvsNivCargoId = item.TotvsNivCargoId;
                    entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    await _db.SaveChangesAsync(ct);
                    updated++;
                }
                else
                {
                    // Criação
                    var entity = new Domain.Entities.JobPosition
                    {
                        Id = Guid.NewGuid(),
                        Code = code,
                        Name = item.Name.Trim(),
                        Status = Domain.Enums.CargoStatus.Active,
                        AreaId = item.AreaId,
                        Seniority = item.Seniority ?? Domain.Enums.SeniorityLevel.Pleno,
                        Type = TrimOrNull(item.Type),
                        OccupationalClassification = TrimOrNull(item.OccupationalClassification),
                        FullDescription = TrimFullDescription(item.FullDescription),
                        DesEnvelPagto = TrimOrNull(item.DesEnvelPagto),
                        NivelCargoId = item.NivelCargoId,
                        SimilarityIndicator = TrimSimilarityIndicator(item.SimilarityIndicator),
                        TotvsCargoBasicId = item.TotvsCargoBasicId,
                        TotvsNivCargoId = item.TotvsNivCargoId,
                    };
                    _db.JobPositions.Add(entity);
                    await _db.SaveChangesAsync(ct);
                    // Atualiza índices em memória
                    existingCodes[code.ToUpperInvariant()] = entity.Id;
                    if (item.TotvsCargoBasicId.HasValue && item.TotvsNivCargoId.HasValue)
                        totvs[(item.TotvsCargoBasicId.Value, item.TotvsNivCargoId.Value)] = entity.Id;
                    created++;
                }
            }
            catch (Exception ex)
            {
                _db.ChangeTracker.Clear();
                var msg = ex.InnerException?.Message ?? ex.Message;
                errors.Add($"Linha {i + 1} ({code}): {msg}");
                skipped++;
            }
        }

        return new JobPositionImportResult(created, updated, skipped, errors);
    }
}
