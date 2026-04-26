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
            .Include(x => x.UnidadeLotacao)
            .Include(x => x.JobPosition)
            .Include(x => x.GestorDireto)
            .Include(x => x.NivelHierarquico)
            .Include(x => x.CentroCusto);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var like = $"%{search}%";
            q = q.Where(x =>
                EF.Functions.Like(x.Name, like) ||
                (x.Email != null && EF.Functions.Like(x.Email, like)) ||
                (x.Phone != null && EF.Functions.Like(x.Phone, like)) ||
                (x.Unit != null && EF.Functions.Like(x.Unit.Name, like)) ||
                (x.CentroCusto != null && EF.Functions.Like(x.CentroCusto.Description, like)) ||
                (x.CentroCusto != null && EF.Functions.Like(x.CentroCusto.Code, like)) ||
                (x.JobPosition != null && EF.Functions.Like(x.JobPosition.Name, like)) ||
                (x.JobPosition != null && EF.Functions.Like(x.JobPosition.Code, like)) ||
                (x.CdnFuncionario != null && EF.Functions.Like(x.CdnFuncionario, like)) ||
                (x.CdnEmpresa != null && EF.Functions.Like(x.CdnEmpresa, like)) ||
                (x.CdnEstab != null && EF.Functions.Like(x.CdnEstab, like)));
        }

        if (query.Status.HasValue)
            q = q.Where(x => x.Status == query.Status.Value);

        if (query.UnitId.HasValue)
            q = q.Where(x => x.UnitId == query.UnitId.Value);

        if (query.JobPositionId.HasValue)
            q = q.Where(x => x.JobPositionId == query.JobPositionId.Value);

        if (query.HasMissingData == true)
            q = q.Where(x => x.HasIncompleteData);

        if (query.UnidadeLotacaoId.HasValue)
            q = q.Where(x => x.UnidadeLotacaoId == query.UnidadeLotacaoId.Value);

        if (query.CentroCustoId.HasValue)
            q = q.Where(x => x.CentroCustoId == query.CentroCustoId.Value);

        if (query.GestorDiretoId.HasValue)
            q = q.Where(x => x.GestorDiretoId == query.GestorDiretoId.Value);

        if (query.GestorUnidadeIds is { Count: > 0 } gestorUids)
            q = q.Where(x => x.UnidadeLotacaoId != null && gestorUids.Contains(x.UnidadeLotacaoId.Value));

        if (query.OnlyFuncionarioId.HasValue)
            q = q.Where(x => x.Id == query.OnlyFuncionarioId.Value);

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
            "area" or "centrocusto_desc" => asc
                ? q.OrderBy(x => x.CentroCusto != null ? x.CentroCusto.Description : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.CentroCusto != null ? x.CentroCusto.Description : "").ThenByDescending(x => x.Name),
            "jobposition" => asc
                ? q.OrderBy(x => x.JobPosition != null ? x.JobPosition.Name : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.JobPosition != null ? x.JobPosition.Name : "").ThenByDescending(x => x.Name),
            "unidadelotacao" => asc
                ? q.OrderBy(x => x.UnidadeLotacao != null ? x.UnidadeLotacao.Code : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.UnidadeLotacao != null ? x.UnidadeLotacao.Code : "").ThenByDescending(x => x.Name),
            "centrocusto" => asc
                ? q.OrderBy(x => x.CentroCusto != null ? x.CentroCusto.Code : "").ThenBy(x => x.Name)
                : q.OrderByDescending(x => x.CentroCusto != null ? x.CentroCusto.Code : "").ThenByDescending(x => x.Name),
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
                x.JobPositionId,
                x.JobPosition != null ? x.JobPosition.Name : null,
                x.GestorDiretoId,
                x.GestorDireto != null ? x.GestorDireto.Name : null,
                x.NivelHierarquicoId,
                x.NivelHierarquico != null
                    ? x.NivelHierarquico.Nome
                    : x.NivelCargo != null
                        ? x.NivelCargo.NomComplet
                        : x.JobPosition != null && x.JobPosition.NivelCargo != null
                            ? x.JobPosition.NivelCargo.NomComplet
                            : x.CdnNivCargo != null
                                ? x.CdnNivCargo.Value.ToString()
                                : null,
                x.UnidadeLotacaoId,
                x.UnidadeLotacao != null ? x.UnidadeLotacao.Description : null,
                x.CdnFuncionario,
                x.CdnEmpresa,
                x.CdnEstab,
                x.CentroCustoId,
                x.CentroCusto != null ? x.CentroCusto.Description : null,
                x.PessoaId,
                x.HasIncompleteData,
                x.UnidadeLotacao != null ? x.UnidadeLotacao.Code : null,
                x.CentroCusto != null ? x.CentroCusto.Code : null,
                // Integração TOTVS RM
                x.MatriculaRm,
                x.HierarquiaId,
                x.Hierarquia != null ? x.Hierarquia.Descricao : null
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
            .Include(x => x.JobPosition)
            .Include(x => x.GestorDireto)
            .Include(x => x.NivelHierarquico)
            .Include(x => x.NivelCargo)
            .Include(x => x.UnidadeLotacao)
            .Include(x => x.CentroCusto)
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
                x.JobPositionId,
                x.JobPosition != null ? x.JobPosition.Name : null,
                x.JobPosition != null ? x.JobPosition.Code : null,
                x.UserId,
                x.Notes,
                x.CreatedAtUtc,
                x.UpdatedAtUtc,
                x.GestorDiretoId,
                x.GestorDireto != null
                    ? x.GestorDireto.Name
                    : x.UnidadeLotacao != null && x.UnidadeLotacao.Parent != null && x.UnidadeLotacao.Parent.OwnerFuncionario != null
                        ? x.UnidadeLotacao.Parent.OwnerFuncionario.Name
                        : null,
                x.NivelHierarquicoId,
                x.NivelHierarquico != null
                    ? x.NivelHierarquico.Nome
                    : x.NivelCargo != null
                        ? x.NivelCargo.NomComplet
                        : x.JobPosition != null && x.JobPosition.NivelCargo != null
                            ? x.JobPosition.NivelCargo.NomComplet
                            : x.CdnNivCargo != null
                                ? x.CdnNivCargo.Value.ToString()
                                : null,
                x.UnidadeLotacaoId,
                x.UnidadeLotacao != null ? x.UnidadeLotacao.Description : null,
                x.CdnFuncionario,
                x.CdnEmpresa,
                x.CdnEstab,
                x.CentroCustoId,
                x.CentroCusto != null ? x.CentroCusto.Description : null,
                x.UnidadeLotacao != null ? x.UnidadeLotacao.Code : null,
                x.CentroCusto != null ? x.CentroCusto.Code : null,
                x.DataAdmissao,
                x.DataNascimento,
                x.Sexo
            ))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<FuncionarioResponse> CreateAsync(FuncionarioCreateRequest request, CancellationToken ct)
    {
        string name = (request.Name ?? string.Empty).Trim();
        var normalizedEmail = NormalizeEmail(request.Email);

        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            var emailJaExiste = await _db.Funcionarios
                .AnyAsync(x => x.Email != null && x.Email == normalizedEmail, ct);
            if (emailJaExiste)
                throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioEmailDuplicado"]);
        }

        ApplicationUser? user = null;
        if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
        {
            user = await _db.Users.FirstOrDefaultAsync(x => x.Id == request.UserId.Value, ct);
            if (user is null)
                throw new InvalidOperationException(_localizer["ServiceErrors.UserNotFound"]);
            if (user.FuncionarioId.HasValue)
                throw new InvalidOperationException(_localizer["ServiceErrors.UserAlreadyHasFuncionario"]);
            name = !string.IsNullOrWhiteSpace(name) ? name : user.FullName.Trim();
            if (string.IsNullOrWhiteSpace(normalizedEmail))
                normalizedEmail = NormalizeEmail(user.Email ?? "");
        }

        if (request.UnitId.HasValue || request.CentroCustoId.HasValue || request.JobPositionId.HasValue)
            await EnsureReferencesExist(request.UnitId, request.CentroCustoId, request.JobPositionId, ct);

        Guid? pessoaId = null;
        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
                normalizedEmail, name, TrimOrNull(request.Phone),
                null, null, null, null, TrimOrNull(request.Notes),
                OrigemPessoa.Funcionario, ct);
            pessoaId = pessoa.Id;
        }

        var entity = new Funcionario
        {
            Id = Guid.NewGuid(),
            PessoaId = pessoaId,
            Name = name,
            Email = string.IsNullOrWhiteSpace(normalizedEmail) ? null : normalizedEmail,
            Phone = TrimOrNull(request.Phone),
            Status = request.Status,
            Headcount = request.Headcount,
            UnitId = request.UnitId,
            CentroCustoId = request.CentroCustoId,
            JobPositionId = request.JobPositionId,
            Notes = TrimOrNull(request.Notes),
            UserId = request.UserId,
            CdnFuncionario = TrimOrNull(request.CdnFuncionario),
            CdnEmpresa = TrimOrNull(request.CdnEmpresa),
            CdnEstab = TrimOrNull(request.CdnEstab),
        };

        entity.RefreshIncompleteData();
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

        if (!string.IsNullOrWhiteSpace(normalizedEmail))
        {
            var emailConflitante = await _db.Funcionarios
                .AnyAsync(x => x.Id != id && x.Email != null && x.Email == normalizedEmail, ct);
            if (emailConflitante)
                throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioEmailDuplicado"]);
        }

        if (request.UnitId.HasValue || request.CentroCustoId.HasValue || request.JobPositionId.HasValue)
            await EnsureReferencesExist(request.UnitId, request.CentroCustoId, request.JobPositionId, ct);

        entity.Name = (request.Name ?? string.Empty).Trim();
        entity.Email = string.IsNullOrWhiteSpace(normalizedEmail) ? null : normalizedEmail;
        entity.Phone = TrimOrNull(request.Phone);
        entity.Status = request.Status;
        entity.Headcount = request.Headcount;
        entity.UnitId = request.UnitId;
        entity.CentroCustoId = request.CentroCustoId;
        entity.JobPositionId = request.JobPositionId;
        entity.Notes = TrimOrNull(request.Notes);
        entity.GestorDiretoId = request.GestorDiretoId;
        entity.NivelHierarquicoId = request.NivelHierarquicoId;
        entity.UnidadeLotacaoId = request.UnidadeLotacaoId;
        entity.CentroCustoId = request.CentroCustoId;
        entity.CdnFuncionario = TrimOrNull(request.CdnFuncionario);
        entity.CdnEmpresa = TrimOrNull(request.CdnEmpresa);
        entity.CdnEstab = TrimOrNull(request.CdnEstab);
        entity.DataAdmissao = request.DataAdmissao;
        entity.DataNascimento = request.DataNascimento;
        entity.Sexo = TrimOrNull(request.Sexo)?.ToUpperInvariant();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        entity.RefreshIncompleteData();

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
        entity.RefreshIncompleteData();

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

    private async Task EnsureReferencesExist(Guid? unitId, Guid? centroCustoId, Guid? jobPositionId, CancellationToken ct)
    {
        if (unitId.HasValue)
        {
            var unitExists = await _db.Units.AnyAsync(x => x.Id == unitId.Value, ct);
            if (!unitExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioUnitInvalid"]);
        }
        if (centroCustoId.HasValue)
        {
            var ccExists = await _db.CentrosCusto.AnyAsync(x => x.Id == centroCustoId.Value, ct);
            if (!ccExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioCentroCustoInvalid"]);
        }
        if (jobPositionId.HasValue)
        {
            var jobExists = await _db.JobPositions.AnyAsync(x => x.Id == jobPositionId.Value, ct);
            if (!jobExists) throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioJobInvalid"]);
        }
    }

    private static string NormalizeEmail(string? email)
        => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
