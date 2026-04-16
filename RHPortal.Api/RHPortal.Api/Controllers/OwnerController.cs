using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Funcionarios.Handlers;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Application.Roles;
using RhPortal.Api.Application.Units.Handlers;
using RhPortal.Api.Application.Users;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Contracts.Owner;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Contracts.Roles;
using RhPortal.Api.Contracts.Units;
using RhPortal.Api.Contracts.Users;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/owner")]
[Authorize(Policy = "Owner")]
public sealed class OwnerController : ControllerBase
{
    private static readonly Regex TenantIdPattern = new("^[a-z0-9][a-z0-9\\-]{1,62}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly MasterDbContext _masterDb;
    private readonly OwnerAuthService _ownerAuth;
    private readonly ITenantProvisioningService _provisioning;
    private readonly IServiceProvider _scope;
    private readonly IPreAdmissaoService _preAdmissaoService;

    public OwnerController(MasterDbContext masterDb, OwnerAuthService ownerAuth, ITenantProvisioningService provisioning, IServiceProvider scope, IPreAdmissaoService preAdmissaoService)
    {
        _masterDb = masterDb;
        _ownerAuth = ownerAuth;
        _provisioning = provisioning;
        _scope = scope;
        _preAdmissaoService = preAdmissaoService;
    }

    [AllowAnonymous]
    [HttpPost("auth/login")]
    [ProducesResponseType(typeof(OwnerLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<OwnerLoginResponse>> Login([FromBody] OwnerLoginRequest request, CancellationToken ct)
    {
        var response = await _ownerAuth.LoginAsync(request, ct);
        if (response is null)
            return Unauthorized();
        return Ok(response);
    }

    [HttpGet("tenants")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TenantListItemResponse>>> ListTenants(CancellationToken ct)
    {
        var list = await _masterDb.Tenants
            .AsNoTracking()
            .OrderBy(t => t.TenantId)
            .Select(t => new TenantListItemResponse(t.TenantId, t.Name, t.IsActive, t.CreatedAtUtc, t.UpdatedAtUtc))
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpGet("tenants/{tenantId}")]
    [ProducesResponseType(typeof(TenantDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantDetailResponse>> GetTenant(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var tenant = await _masterDb.Tenants
            .AsNoTracking()
            .Include(t => t.CreatedByOwner)
            .Where(t => t.TenantId == id)
            .Select(t => new TenantDetailResponse(
                t.TenantId,
                t.Name,
                t.IsActive,
                t.CreatedAtUtc,
                t.UpdatedAtUtc,
                t.CreatedByOwnerId,
                t.CreatedByOwner != null ? t.CreatedByOwner.Email : null))
            .FirstOrDefaultAsync(ct);
        if (tenant is null)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        return Ok(tenant);
    }

    [HttpPost("tenants")]
    [ProducesResponseType(typeof(TenantListItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<TenantListItemResponse>> CreateTenant([FromBody] CreateTenantRequest? request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantId) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ProblemDetails { Title = "Invalid request", Detail = "TenantId and Name are required." });

        var tenantId = request.TenantId.Trim().ToLowerInvariant();
        if (!TenantIdPattern.IsMatch(tenantId))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId must be 2-63 chars, lowercase letters, numbers, hyphens." });

        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tenantId, ct);
        if (exists)
            return BadRequest(new ProblemDetails { Title = "Tenant exists", Detail = $"Tenant {tenantId} already exists." });

        Guid? ownerId = null;
        var ownerIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(ownerIdClaim, out var parsed))
            ownerId = parsed;

        try
        {
            await _provisioning.ProvisionTenantAsync(tenantId, request.Name.Trim(), seedAfterCreate: true, createdByOwnerId: ownerId, ct);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new ProblemDetails
            {
                Title = "Erro ao provisionar tenant",
                Detail = ex.Message,
                Extensions = { ["inner"] = ex.InnerException?.Message }
            });
        }

        var created = await _masterDb.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => new TenantListItemResponse(t.TenantId, t.Name, t.IsActive, t.CreatedAtUtc, t.UpdatedAtUtc))
            .FirstAsync(ct);

        return CreatedAtAction(nameof(ListTenants), created);
    }

    [HttpDelete("tenants/{tenantId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTenant(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        if (string.Equals(id, "owner", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new ProblemDetails { Title = "Reserved TenantId", Detail = "Não é permitido eliminar o tenant reservado 'owner'." });
        var tenant = await _masterDb.Tenants.FirstOrDefaultAsync(t => t.TenantId == id, ct);
        if (tenant is null)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        tenant.IsActive = false;
        tenant.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _masterDb.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("tenants/{tenantId}/reactivate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReactivateTenant(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var tenant = await _masterDb.Tenants.FirstOrDefaultAsync(t => t.TenantId == id, ct);
        if (tenant is null)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        tenant.IsActive = true;
        tenant.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _masterDb.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Retorna o status de migrações de todos os tenants (se o schema do banco está em dia).</summary>
    [HttpGet("tenants/migrations/status")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantMigrationStatusResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TenantMigrationStatusResponse>>> GetTenantsMigrationStatus(CancellationToken ct)
    {
        var tenantIds = await _masterDb.Tenants
            .AsNoTracking()
            .OrderBy(t => t.TenantId)
            .Select(t => t.TenantId)
            .ToListAsync(ct);

        var results = new List<TenantMigrationStatusResponse>();
        foreach (var tid in tenantIds)
        {
            try
            {
                using var scope = _scope.CreateScope();
                var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
                tenantContext.SetTenantId(tid);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var pending = await db.Database.GetPendingMigrationsAsync(ct);
                var list = pending.ToList();
                results.Add(new TenantMigrationStatusResponse(tid, list.Count == 0, list.Count, list, null));
            }
            catch (Exception ex)
            {
                results.Add(new TenantMigrationStatusResponse(tid, false, 0, Array.Empty<string>(), ex.Message));
            }
        }

        return Ok(results);
    }

    /// <summary>Aplica migrações pendentes no banco do tenant.</summary>
    [HttpPost("tenants/{tenantId}/migrations/apply")]
    [ProducesResponseType(typeof(TenantMigrationsApplyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<TenantMigrationsApplyResponse>> ApplyTenantMigrations(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });

        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(id);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var pendingBefore = await db.Database.GetPendingMigrationsAsync(ct);
            var countBefore = pendingBefore.Count();
            await db.Database.MigrateAsync(ct);
            var pendingAfter = await db.Database.GetPendingMigrationsAsync(ct);
            var countAfter = pendingAfter.Count();
            var applied = countBefore - countAfter;
            return Ok(new TenantMigrationsApplyResponse(applied));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new ProblemDetails
            {
                Title = "Erro ao aplicar migrações",
                Detail = ex.Message,
                Extensions = { ["inner"] = ex.InnerException?.Message }
            });
        }
    }

    /// <summary>Aplica migrações pendentes via SSE, emitindo uma linha de log por migration.</summary>
    [HttpGet("tenants/{tenantId}/migrations/apply-stream")]
    public async Task ApplyTenantMigrationsStream(string tenantId, CancellationToken ct)
    {
        Response.Headers["Content-Type"] = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no"; // desabilita buffer do nginx

        async Task Send(object data)
        {
            var json = JsonSerializer.Serialize(data);
            await Response.WriteAsync($"data: {json}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }

        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
        {
            await Send(new { step = "error", message = "TenantId inválido." });
            return;
        }

        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
        {
            await Send(new { step = "error", message = $"Tenant '{id}' não encontrado." });
            return;
        }

        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(id);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var pending = (await db.Database.GetPendingMigrationsAsync(ct)).ToList();
            await Send(new { step = "start", total = pending.Count });

            if (pending.Count == 0)
            {
                await Send(new { step = "done", applied = 0, message = "Nenhuma migration pendente." });
                return;
            }

            var migrator = db.GetInfrastructure().GetRequiredService<IMigrator>();
            int applied = 0;

            foreach (var migration in pending)
            {
                await Send(new { step = "running", name = migration });
                try
                {
                    await migrator.MigrateAsync(migration, ct);
                    applied++;
                    await Send(new { step = "ok", name = migration, applied });
                }
                catch (Exception ex)
                {
                    await Send(new { step = "error", name = migration, message = ex.Message, inner = ex.InnerException?.Message });
                    return;
                }
            }

            await Send(new { step = "done", applied, message = $"{applied} migration(s) aplicada(s) com sucesso." });
        }
        catch (Exception ex)
        {
            try { await Send(new { step = "error", message = ex.Message }); } catch { /* stream fechado */ }
        }
    }

    /// <summary>Executa o seed do tenant (admin user, roles, áreas, etc.). Idempotente.</summary>
    [HttpPost("tenants/{tenantId}/seed")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> SeedTenant(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        try
        {
            await _provisioning.SeedTenantAsync(id, ct);
            return Ok(new { message = "Seed executado com sucesso.", tenantId = id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new ProblemDetails
            {
                Title = "Erro ao executar seed",
                Detail = ex.Message,
                Extensions = { ["inner"] = ex.InnerException?.Message }
            });
        }
    }

    [HttpGet("tenants/{tenantId}/users")]
    [ProducesResponseType(typeof(IReadOnlyList<UserListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<UserListItemResponse>>> ListTenantUsers(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(id);
        var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
        var list = await service.ListAsync(ct);
        return Ok(list);
    }

    [HttpGet("tenants/{tenantId}/users/{id:guid}")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponse>> GetTenantUser(string tenantId, Guid id, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tid);
        var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
        var user = await service.GetByIdAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost("tenants/{tenantId}/users")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> CreateTenantUser(string tenantId, [FromBody] UserCreateRequest request, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(tid);
            var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
            var created = await service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetTenantUser), new { tenantId = tid, id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    [HttpPut("tenants/{tenantId}/users/{id:guid}")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> UpdateTenantUser(string tenantId, Guid id, [FromBody] UserUpdateRequest request, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(tid);
            var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
            var updated = await service.UpdateAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    [HttpPatch("tenants/{tenantId}/users/{id:guid}/status")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponse>> UpdateTenantUserStatus(string tenantId, Guid id, [FromBody] UserStatusUpdateRequest request, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tid);
        var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
        var updated = await service.UpdateStatusAsync(id, request.IsActive, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("tenants/{tenantId}/users/{id:guid}/roles")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> UpdateTenantUserRoles(string tenantId, Guid id, [FromBody] UserRolesUpdateRequest request, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(tid);
            var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
            var updated = await service.UpdateRolesAsync(id, request.RoleIds, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    [HttpPut("tenants/{tenantId}/users/{id:guid}/password")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> SetTenantUserPassword(string tenantId, Guid id, [FromBody] UserPasswordUpdateRequest request, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(tid);
            var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
            var updated = await service.SetPasswordAsync(id, request.NewPassword, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    [HttpDelete("tenants/{tenantId}/users/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTenantUser(string tenantId, Guid id, CancellationToken ct)
    {
        var tid = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(tid) || !TenantIdPattern.IsMatch(tid))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == tid, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {tid} não encontrado." });
        try
        {
            using var scope = _scope.CreateScope();
            var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            tenantContext.SetTenantId(tid);
            var service = scope.ServiceProvider.GetRequiredService<UserAdministrationService>();
            var removed = await service.DeleteAsync(id, ct);
            return removed ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    [HttpGet("tenants/{tenantId}/roles")]
    [ProducesResponseType(typeof(IReadOnlyList<RoleListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RoleListItemResponse>>> ListTenantRoles(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(id);
        var service = scope.ServiceProvider.GetRequiredService<RoleAdministrationService>();
        var list = await service.ListAsync(ct);
        return Ok(list);
    }

    [HttpGet("tenants/{tenantId}/units")]
    [ProducesResponseType(typeof(PagedResult<UnitGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<UnitGridRowResponse>>> ListTenantUnits(string tenantId, [FromQuery] UnitListQuery? query, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(id);
        var handler = scope.ServiceProvider.GetRequiredService<IListUnitsHandler>();
        var q = query ?? new UnitListQuery(null, null, 1, 500);
        var result = await handler.HandleAsync(q, ct);
        return Ok(result);
    }

    [HttpGet("tenants/{tenantId}/funcionarios")]
    [ProducesResponseType(typeof(PagedResult<FuncionarioGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<FuncionarioGridRowResponse>>> ListTenantFuncionarios(string tenantId, [FromQuery] FuncionarioListQuery? query, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(id);
        var handler = scope.ServiceProvider.GetRequiredService<IListFuncionariosHandler>();
        var q = query ?? new FuncionarioListQuery(null, null, null, null, null, 1, 500);
        var result = await handler.HandleAsync(q, ct);
        return Ok(result);
    }

    // ── Painel Integração TOTVS (cross-tenant) ──

    /// <summary>
    /// Histórico de integração TOTVS cross-tenant — Owner vê todos os tenants.
    /// Filtros opcionais: tenantId (empresa específica), resultado (1=Sucesso, 2=Falha).
    /// </summary>
    [HttpGet("integracao/painel")]
    [ProducesResponseType(typeof(IReadOnlyList<OwnerPainelIntegracaoRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> OwnerPainelIntegracao(
        [FromQuery] string? tenantId,
        [FromQuery] IntegracaoResultado? resultado,
        CancellationToken ct)
        => Ok(await _preAdmissaoService.OwnerListPainelIntegracaoAsync(tenantId, resultado, ct));
}
