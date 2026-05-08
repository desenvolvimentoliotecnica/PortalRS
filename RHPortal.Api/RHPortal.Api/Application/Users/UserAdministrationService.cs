using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Users;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Users;

public sealed class UserAdministrationService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public UserAdministrationService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        AppDbContext db,
        IStringLocalizer<ServiceMessages> localizer)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _db = db;
        _localizer = localizer;
    }

    public async Task<IReadOnlyList<UserListItemResponse>> ListAsync(CancellationToken ct)
    {
        var users = await _userManager.Users
            .AsNoTracking()
            .Include(x => x.Funcionario)
            .OrderBy(x => x.FullName)
            .ToListAsync(ct);

        var userIds = users.Select(x => x.Id).ToList();
        var userRoles = await _db.UserRoles
            .Where(x => userIds.Contains(x.UserId))
            .ToListAsync(ct);

        var roleIds = userRoles.Select(x => x.RoleId).Distinct().ToList();
        var rolesById = await _roleManager.Roles
            .Where(x => roleIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name ?? string.Empty, ct);

        var userUnits = await _db.UserUnits
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .Include(x => x.Unit)
            .ToListAsync(ct);

        return users.Select(u =>
        {
            var names = userRoles
                .Where(x => x.UserId == u.Id)
                .Select(x => rolesById.TryGetValue(x.RoleId, out var name) ? name : string.Empty)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();

            var units = userUnits
                .Where(x => x.UserId == u.Id && x.Unit != null)
                .Select(x => new UnitInfoResponse(x.Unit!.Id, x.Unit.Code, x.Unit.Name))
                .DistinctBy(x => x.Id)
                .ToList();

            FuncionarioInfoResponse? funcionarioInfo = null;
            if (u.Funcionario != null)
                funcionarioInfo = new FuncionarioInfoResponse(u.Funcionario.Id, u.Funcionario.Name, u.Funcionario.Email ?? string.Empty, u.Funcionario.CentroCustoId);

            return new UserListItemResponse(
                u.Id,
                u.FullName,
                u.Email ?? string.Empty,
                u.IsActive,
                names,
                units,
                funcionarioInfo
            );
        }).ToList();
    }

    public async Task<UserResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var user = await _userManager.Users
            .Include(x => x.Funcionario)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return null;

        var userRoleIds = await _db.UserRoles
            .Where(x => x.UserId == user.Id)
            .Select(x => x.RoleId)
            .ToListAsync(ct);

        var roles = await _roleManager.Roles
            .Where(x => userRoleIds.Contains(x.Id))
            .Select(x => new RoleInfoResponse(x.Id, x.Name ?? string.Empty))
            .ToListAsync(ct);

        var units = await _db.UserUnits
            .AsNoTracking()
            .Where(x => x.UserId == user.Id)
            .Select(x => new UnitInfoResponse(x.Unit!.Id, x.Unit.Code, x.Unit.Name))
            .ToListAsync(ct);

        FuncionarioInfoResponse? funcionarioInfo = null;
        if (user.Funcionario != null)
            funcionarioInfo = new FuncionarioInfoResponse(user.Funcionario.Id, user.Funcionario.Name, user.Funcionario.Email ?? string.Empty, user.Funcionario.CentroCustoId);

        return new UserResponse(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            user.IsActive,
            roles,
            units,
            funcionarioInfo,
            user.CreatedAtUtc,
            user.UpdatedAtUtc
        );
    }

    public async Task<UserResponse> CreateAsync(UserCreateRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException(_localizer["ServiceErrors.UserEmailRequired"]);

        var emailExists = await _userManager.Users.AnyAsync(x => x.Email == email, ct);
        if (emailExists)
            throw new InvalidOperationException(_localizer["ServiceErrors.UserEmailInUse"]);

        var roles = await LoadRolesAsync(request.RoleIds, ct);

        if (request.FuncionarioId.HasValue && request.FuncionarioId.Value != Guid.Empty)
        {
            var funcionario = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == request.FuncionarioId.Value, ct);
            if (funcionario == null)
                throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioNotFound"]);
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            UserName = email,
            FullName = request.FullName.Trim(),
            IsActive = request.IsActive,
            FuncionarioId = request.FuncionarioId
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
            throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(x => x.Description)));

        if (roles.Count > 0)
        {
            var roleNames = roles.Select(x => x.Name ?? string.Empty).Where(x => x.Length > 0).ToList();
            var roleResult = await _userManager.AddToRolesAsync(user, roleNames);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(x => x.Description)));
        }

        await SyncUserUnitsAsync(user.Id, request.UnitIds ?? [], ct);

        if (request.FuncionarioId.HasValue && request.FuncionarioId.Value != Guid.Empty)
        {
            var funcionario = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == request.FuncionarioId.Value, ct);
            if (funcionario != null)
            {
                funcionario.UserId = user.Id;
                await _db.SaveChangesAsync(ct);
            }
        }

        var created = await GetByIdAsync(user.Id, ct);
        return created!;
    }

    public async Task<UserResponse?> UpdateAsync(Guid id, UserUpdateRequest request, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return null;

        var email = request.Email.Trim();
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var emailExists = await _userManager.Users.AnyAsync(x => x.Email == email && x.Id != id, ct);
            if (emailExists)
                throw new InvalidOperationException(_localizer["ServiceErrors.UserEmailInUse"]);

            user.Email = email;
            user.UserName = email;
        }

        user.FullName = request.FullName.Trim();
        user.IsActive = request.IsActive;

        if (request.FuncionarioId.HasValue && request.FuncionarioId.Value != Guid.Empty)
        {
            var funcionarioExists = await _db.Funcionarios.AnyAsync(x => x.Id == request.FuncionarioId.Value, ct);
            if (!funcionarioExists)
                throw new InvalidOperationException(_localizer["ServiceErrors.FuncionarioNotFound"]);
        }
        user.FuncionarioId = request.FuncionarioId;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

        if (request.UnitIds is not null)
            await SyncUserUnitsAsync(id, request.UnitIds, ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<UserResponse?> UpdateStatusAsync(Guid id, bool isActive, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return null;

        user.IsActive = isActive;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

        return await GetByIdAsync(id, ct);
    }

    public async Task<UserResponse?> UpdateRolesAsync(Guid id, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return null;

        var roles = await LoadRolesAsync(roleIds, ct);
        var roleNames = roles.Select(x => x.Name ?? string.Empty).Where(x => x.Length > 0).ToList();

        var currentRoleNames = await _userManager.GetRolesAsync(user);
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoleNames);
        if (!removeResult.Succeeded)
            throw new InvalidOperationException(string.Join("; ", removeResult.Errors.Select(x => x.Description)));

        if (roleNames.Count > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(user, roleNames);
            if (!addResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", addResult.Errors.Select(x => x.Description)));
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return false;

        // Vários DbSets têm FK para ApplicationUser com DeleteBehavior.Restrict.
        // Sem limpar dependências, o DELETE em PostgreSQL falha (HTTP 500 via DbUpdateException).
        IExecutionStrategy strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                await RemoveTenantScopedApplicationUserDependenciesAsync(id, ct);

                var result = await _userManager.DeleteAsync(user);
                if (!result.Succeeded)
                    throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

                await tx.CommitAsync(ct);
                return true;
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        });
    }

    /// <summary>
    /// Remove ou neutraliza linhas que referenciam <paramref name="userId"/> com FK RESTRICT
    /// antes de apagar o registro em AspNetUsers ("Users").
    /// </summary>
    private async Task RemoveTenantScopedApplicationUserDependenciesAsync(Guid userId, CancellationToken ct)
    {
        // Nullable refs — evitar violação de FK no DELETE do usuário.
        await _db.SolicitacoesAprovacaoEtapa
            .Where(x => x.AssumedByUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.AssumedByUserId, (Guid?)null), ct);

        await _db.HistoricosStatus
            .Where(x => x.AlteradoPorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.AlteradoPorUserId, (Guid?)null), ct);

        await _db.PropostasVaga
            .Where(x => x.CriadaPorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.CriadaPorUserId, (Guid?)null), ct);
        await _db.PropostasVaga
            .Where(x => x.EnviadaPorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.EnviadaPorUserId, (Guid?)null), ct);

        await _db.Vagas
            .Where(x => x.RecrutadorResponsavelUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.RecrutadorResponsavelUserId, (Guid?)null), ct);
        await _db.Vagas
            .Where(x => x.AlcadaSalarialAprovadaPorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.AlcadaSalarialAprovadaPorUserId, (Guid?)null), ct);

        await _db.SolicitacoesVagaIndicacao
            .Where(x => x.IndicadoPorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.IndicadoPorUserId, (Guid?)null), ct);

        await _db.DocumentacaoPadraoHistoricos
            .Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.UserId, (Guid?)null), ct);

        await _db.AvaliacaoCalibragens
            .Where(x => x.DecididoPorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.DecididoPorUserId, (Guid?)null), ct);

        await _db.DevelopmentPlans
            .Where(x => x.TargetUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TargetUserId, (Guid?)null), ct);

        await _db.Funcionarios
            .Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.UserId, (Guid?)null), ct);

        // Gamificação / humor — Restrict para User
        await _db.RenderCoinTransactions.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.RenderCoinBalances.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.RenderCoinRedemptions.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.MoodEntries.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.GamificationDailyStates.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);

        // Celebrações — Restrict em autor/reações/menções
        await _db.CelebrationCommentReactions.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.CelebrationCommentMentions.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.CelebrationMentions.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.CelebrationComments.Where(x => x.AuthorId == userId).ExecuteDeleteAsync(ct);
        await _db.CelebrationPosts.Where(x => x.AuthorId == userId).ExecuteDeleteAsync(ct);

        await _db.FeedbackItems.Where(x => x.FromUserId == userId || x.ToUserId == userId).ExecuteDeleteAsync(ct);

        await _db.DevelopmentPlans.Where(x => x.OwnerUserId == userId).ExecuteDeleteAsync(ct);

        await _db.OneOnOneMeetings.Where(x => x.ManagerId == userId || x.CollaboratorId == userId).ExecuteDeleteAsync(ct);

        await _db.NotificationReceipts.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.Notifications.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);

        var surveyResponseIds = await _db.SurveyResponses.AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.Id)
            .ToListAsync(ct);
        if (surveyResponseIds.Count > 0)
        {
            await _db.SurveyAnswers.Where(x => surveyResponseIds.Contains(x.ResponseId)).ExecuteDeleteAsync(ct);
            await _db.SurveyResponses.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        }
    }

    public async Task<UserResponse?> SetPasswordAsync(Guid id, string newPassword, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return null;

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

        return await GetByIdAsync(id, ct);
    }

    private async Task<IReadOnlyList<ApplicationRole>> LoadRolesAsync(IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        if (roleIds is null || roleIds.Count == 0)
            return Array.Empty<ApplicationRole>();

        var roles = await _roleManager.Roles
            .Where(x => roleIds.Contains(x.Id))
            .ToListAsync(ct);

        if (roles.Count != roleIds.Count)
            throw new InvalidOperationException(_localizer["ServiceErrors.UserRolesNotFound"]);

        return roles;
    }

    private async Task SyncUserUnitsAsync(Guid userId, IReadOnlyList<Guid> unitIds, CancellationToken ct)
    {
        var validIds = unitIds?.Where(x => x != Guid.Empty).Distinct().ToList() ?? [];
        if (validIds.Count > 0)
        {
            var existingInTenant = await _db.Units
                .AsNoTracking()
                .Where(x => validIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(ct);
            if (existingInTenant.Count != validIds.Count)
                throw new InvalidOperationException(_localizer["ServiceErrors.UserUnitsNotFound"]);
        }

        var current = await _db.UserUnits.Where(x => x.UserId == userId).ToListAsync(ct);
        _db.UserUnits.RemoveRange(current);
        await _db.SaveChangesAsync(ct);

        foreach (var unitId in validIds)
        {
            _db.UserUnits.Add(new UserUnit { UserId = userId, UnitId = unitId });
        }

        if (validIds.Count > 0)
            await _db.SaveChangesAsync(ct);
    }
}
