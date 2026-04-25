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
using RhPortal.Api.Contracts.Auditing;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Contracts.Logging;
using RhPortal.Api.Contracts.Modules;
using RhPortal.Api.Contracts.Owner;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Contracts.Roles;
using RhPortal.Api.Contracts.Units;
using RhPortal.Api.Contracts.Users;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Navegacao;
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

    [HttpPut("tenants/{tenantId}")]
    [ProducesResponseType(typeof(TenantDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantDetailResponse>> UpdateTenant(string tenantId, [FromBody] UpdateTenantNameRequest request, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        if (string.IsNullOrWhiteSpace(request?.Name))
            return BadRequest(new ProblemDetails { Title = "Invalid request", Detail = "Name é obrigatório." });

        var tenant = await _masterDb.Tenants
            .Include(t => t.CreatedByOwner)
            .FirstOrDefaultAsync(t => t.TenantId == id, ct);
        if (tenant is null)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        tenant.Name = request.Name.Trim();
        tenant.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _masterDb.SaveChangesAsync(ct);

        return Ok(new TenantDetailResponse(
            tenant.TenantId,
            tenant.Name,
            tenant.IsActive,
            tenant.CreatedAtUtc,
            tenant.UpdatedAtUtc,
            tenant.CreatedByOwnerId,
            tenant.CreatedByOwner?.Email));
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
        var q = query ?? new FuncionarioListQuery(null, null, null, null, 1, 500);
        var result = await handler.HandleAsync(q, ct);
        return Ok(result);
    }

    // ── Logs no contexto Owner (proxy scoped por tenant) ──

    [HttpGet("tenants/{tenantId}/config/logs/transactions")]
    [ProducesResponseType(typeof(AuditTransactionListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AuditTransactionListResponse>> ListTenantAuditTransactions(
        string tenantId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? methods = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 200);

        var query = db.AuditTransactions.AsNoTracking()
            .Where(x => x.Method != null && x.Method != "" && x.Path != null && x.Path != "");

        if (from.HasValue) query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.StartedAt <= to.Value);

        var statusFilter = (status ?? string.Empty).Trim().ToLowerInvariant();
        if (statusFilter == "success") query = query.Where(x => x.IsSuccess);
        else if (statusFilter == "error") query = query.Where(x => !x.IsSuccess);

        var searchText = (search ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(x =>
                x.TransactionId.Contains(searchText) ||
                (x.Path != null && x.Path.Contains(searchText)) ||
                (x.UserName != null && x.UserName.Contains(searchText)) ||
                (x.Method != null && x.Method.Contains(searchText)));
        }

        var methodsFilter = (methods ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.ToUpperInvariant())
            .ToArray();
        if (methodsFilter.Length > 0)
            query = query.Where(x => x.Method != null && methodsFilter.Contains(x.Method.ToUpper()));

        var totalItems = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderByDescending(x => x.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditTransactionListItem(
                x.Id, x.TransactionId, x.CorrelationId, x.StartedAt, x.DurationMs, x.UserName, x.Method, x.Path, x.StatusCode, x.IsSuccess))
            .ToListAsync(ct);

        return Ok(new AuditTransactionListResponse(items, page, pageSize, totalItems, totalPages));
    }

    [HttpGet("tenants/{tenantId}/config/logs/transactions/{id:guid}")]
    [ProducesResponseType(typeof(AuditTransactionDetailResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AuditTransactionDetailResponse>> GetTenantAuditTransactionById(
        string tenantId,
        Guid id,
        CancellationToken ct)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var transaction = await db.AuditTransactions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (transaction is null) return NotFound();

        var events = await db.AuditEvents.AsNoTracking()
            .Where(x => x.AuditTransactionId == id)
            .OrderBy(x => x.Order)
            .Select(x => new AuditEventItem(x.Id, x.Order, x.EventType, x.Name, x.OccurredAt, x.DataJson))
            .ToListAsync(ct);

        var changes = await db.AuditEntityChanges.AsNoTracking()
            .Where(x => x.AuditTransactionId == id)
            .OrderBy(x => x.Order)
            .ThenBy(x => x.EntityName)
            .Select(x => new AuditEntityChangeItem(
                x.Id, x.Order, x.EntityName, x.TableName, x.State, x.PrimaryKeyJson, x.BeforeJson, x.AfterJson, x.ChangedColumns, x.DataJson, x.OccurredAt))
            .ToListAsync(ct);

        var changeIds = changes.Select(x => x.Id).ToArray();
        var properties = changeIds.Length == 0
            ? new List<AuditPropertyChangeItem>()
            : await db.AuditEntityPropertyChanges.AsNoTracking()
                .Where(x => changeIds.Contains(x.AuditEntityChangeId))
                .Select(x => new AuditPropertyChangeItem(x.Id, x.PropertyName, x.BeforeValue, x.AfterValue, x.IsSensitive))
                .ToListAsync(ct);

        return Ok(new AuditTransactionDetailResponse(
            transaction.Id,
            transaction.TransactionId,
            transaction.CorrelationId,
            transaction.TraceId,
            transaction.SpanId,
            transaction.ParentSpanId,
            transaction.Environment,
            transaction.AppVersion,
            transaction.StartedAt,
            transaction.EndedAt,
            transaction.DurationMs,
            transaction.UserId,
            transaction.UserName,
            transaction.ClientId,
            transaction.Ip,
            transaction.UserAgent,
            transaction.Host,
            transaction.Method,
            transaction.Path,
            transaction.QueryString,
            transaction.RouteTemplate,
            transaction.Controller,
            transaction.Action,
            transaction.StatusCode,
            transaction.IsSuccess,
            transaction.RequestContentType,
            transaction.ResponseContentType,
            transaction.RequestBody,
            transaction.ResponseBody,
            transaction.RequestBodyHash,
            transaction.ResponseBodyHash,
            transaction.RequestIsTruncated,
            transaction.ResponseIsTruncated,
            transaction.RequestTruncatedBytes,
            transaction.ResponseTruncatedBytes,
            transaction.ErrorMessage,
            transaction.ErrorStackTrace,
            events,
            changes,
            properties));
    }

    [HttpGet("tenants/{tenantId}/config/logs/summary")]
    [ProducesResponseType(typeof(AuditSummaryResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AuditSummaryResponse>> GetTenantAuditSummary(
        string tenantId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int top = 6,
        CancellationToken ct = default)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        top = Math.Clamp(top, 3, 12);
        var query = db.AuditTransactions.AsNoTracking();
        if (from.HasValue) query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.StartedAt <= to.Value);

        var topRoutes = await query.GroupBy(x => x.Path)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new AuditSummaryItem(g.Key, g.Count(), (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var topUsers = await query.Where(x => x.UserName != null && x.UserName != "")
            .GroupBy(x => x.UserName!)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new AuditSummaryItem(g.Key, g.Count(), (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var statuses = await query.GroupBy(x => x.StatusCode ?? 0)
            .OrderByDescending(g => g.Count())
            .Select(g => new AuditStatusItem(g.Key, g.Count()))
            .ToListAsync(ct);

        return Ok(new AuditSummaryResponse(topRoutes, topUsers, statuses));
    }

    [HttpGet("tenants/{tenantId}/config/operational-logs/requests")]
    [ProducesResponseType(typeof(RequestLogListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RequestLogListResponse>> ListTenantOperationalRequests(
        string tenantId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] string? search = null,
        [FromQuery] string? level = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 200);

        var query = db.RequestLogs.AsNoTracking().Where(x => x.EndedAt != null);
        if (from.HasValue) query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.StartedAt <= to.Value);

        var searchText = (search ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(x =>
                x.TransactionId.Contains(searchText) ||
                (x.Path != null && x.Path.Contains(searchText)) ||
                (x.UserName != null && x.UserName.Contains(searchText)) ||
                (x.Method != null && x.Method.Contains(searchText)));
        }

        var levelFilter = (level ?? string.Empty).Trim().ToLowerInvariant();
        if (levelFilter is "error" or "warning")
            query = levelFilter == "error" ? query.Where(x => x.ErrorCount > 0) : query.Where(x => x.WarningCount > 0);

        var totalItems = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderByDescending(x => x.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new RequestLogListItem(
                x.Id, x.TransactionId, x.StartedAt, x.DurationMs, x.Method, x.Path, x.StatusCode, x.IsSuccess, x.UserName, x.EnvironmentNormalized, x.DeviceType ?? "unknown"))
            .ToListAsync(ct);

        return Ok(new RequestLogListResponse(items, page, pageSize, totalItems, totalPages));
    }

    [HttpGet("tenants/{tenantId}/config/operational-logs/requests/{id:guid}")]
    [ProducesResponseType(typeof(RequestLogDetailResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RequestLogDetailResponse>> GetTenantOperationalRequestById(
        string tenantId,
        Guid id,
        CancellationToken ct)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var log = await db.RequestLogs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (log is null) return NotFound();

        var entries = await db.LogEntries.AsNoTracking()
            .Where(x => x.RequestLogId == id)
            .OrderBy(x => x.Order)
            .Select(x => new LogEntryItem(x.Id, x.Order, x.Level, x.Category, x.EventId, x.EventName, x.Message, x.OccurredAt))
            .ToListAsync(ct);

        var exceptions = await db.ExceptionLogs.AsNoTracking()
            .Where(x => x.RequestLogId == id)
            .OrderBy(x => x.Order)
            .Select(x => new ExceptionLogItem(x.Id, x.Order, x.IsHandled, x.StatusCode, x.ExceptionType, x.Message, x.Tags, x.OccurredAt))
            .ToListAsync(ct);

        return Ok(new RequestLogDetailResponse(
            log.Id,
            log.TransactionId,
            log.CorrelationId,
            log.TraceId,
            log.EnvironmentName,
            log.EnvironmentNormalized,
            log.DeviceId,
            log.DeviceType,
            log.Platform,
            log.Browser,
            log.DeviceAppVersion,
            log.Locale,
            log.StartedAt,
            log.EndedAt,
            log.DurationMs,
            log.Method,
            log.Path,
            log.QueryString,
            log.StatusCode,
            log.IsSuccess,
            log.UserId,
            log.UserName,
            log.ClientId,
            log.Ip,
            log.UserAgent,
            log.Host,
            log.Controller,
            log.Action,
            log.RouteTemplate,
            log.ErrorCount,
            log.WarningCount,
            entries,
            exceptions));
    }

    [HttpGet("tenants/{tenantId}/config/operational-logs/summary")]
    [ProducesResponseType(typeof(RequestLogSummaryResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RequestLogSummaryResponse>> GetTenantOperationalSummary(
        string tenantId,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int top = 6,
        CancellationToken ct = default)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        top = Math.Clamp(top, 3, 12);
        var query = db.RequestLogs.AsNoTracking().Where(x => x.EndedAt != null);
        if (from.HasValue) query = query.Where(x => x.StartedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.StartedAt <= to.Value);

        var topRoutes = await query.GroupBy(x => x.Path)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new RequestLogSummaryItem(g.Key, g.Count(), (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var topUsers = await query.Where(x => x.UserName != null && x.UserName != "")
            .GroupBy(x => x.UserName!)
            .OrderByDescending(g => g.Count())
            .Take(top)
            .Select(g => new RequestLogSummaryItem(g.Key, g.Count(), (long)g.Average(x => x.DurationMs)))
            .ToListAsync(ct);

        var statuses = await query.GroupBy(x => x.StatusCode ?? 0)
            .OrderByDescending(g => g.Count())
            .Select(g => new RequestLogStatusItem(g.Key, g.Count()))
            .ToListAsync(ct);

        return Ok(new RequestLogSummaryResponse(topRoutes, topUsers, statuses));
    }

    // ── Módulos do tenant (habilitação comercial) ──

    /// <summary>
    /// Lista todos os módulos do catálogo com o status (ativo/inativo) para o tenant.
    /// </summary>
    [HttpGet("tenants/{tenantId}/modules")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantModuleResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TenantModuleResponse>>> ListTenantModules(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        var service = _scope.GetRequiredService<TenantModuleService>();
        var list = await service.ListAsync(id, ct);
        return Ok(list);
    }

    /// <summary>
    /// Lista todos os módulos do catálogo com o status (ativo/inativo) para o tenant
    /// e a lista de telas (derivadas do <c>NavegacaoManifest</c>) que cada módulo entrega.
    /// Usada pela tela do Owner para mostrar, por card de módulo, as funcionalidades
    /// liberadas ao contratar o pacote.
    /// </summary>
    [HttpGet("tenants/{tenantId}/modules/detailed")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantModuleDetailedResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TenantModuleDetailedResponse>>> ListTenantModulesDetailed(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        var service = _scope.GetRequiredService<TenantModuleService>();
        var list = await service.ListDetailedAsync(id, ct);
        return Ok(list);
    }

    /// <summary>
    /// Liga ou desliga um módulo para o tenant. Módulos core não podem ser desativados.
    /// </summary>
    [HttpPut("tenants/{tenantId}/modules/{moduleKey}")]
    [ProducesResponseType(typeof(TenantModuleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantModuleResponse>> SetTenantModule(
        string tenantId,
        string moduleKey,
        [FromBody] TenantModuleUpdateRequest request,
        CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        var ownerIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid? ownerId = Guid.TryParse(ownerIdClaim, out var g) ? g : null;

        var service = _scope.GetRequiredService<TenantModuleService>();
        try
        {
            var updated = await service.SetEnabledAsync(id, moduleKey, request.IsEnabled, ownerId, ct);
            return updated is null
                ? NotFound(new ProblemDetails { Title = "Module not found", Detail = $"Módulo '{moduleKey}' não existe no catálogo." })
                : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    // ── Pacotes comerciais do tenant (entitlement de alto nível) ──

    /// <summary>
    /// Lista os pacotes comerciais disponíveis com o status contratado (ativo/inativo) para o tenant.
    /// Pacotes marcados como <c>IsActive=false</c> no catálogo (ex.: em construção) ficam fora da listagem.
    /// </summary>
    [HttpGet("tenants/{tenantId}/packages")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantPackageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TenantPackageResponse>>> ListTenantPackages(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        var service = _scope.GetRequiredService<TenantPackageService>();
        var list = await service.ListAsync(id, ct);
        return Ok(list);
    }

    /// <summary>
    /// Liga ou desliga um pacote comercial para o tenant. Pacotes com <c>IsActive=false</c>
    /// no catálogo não podem ser ligados.
    /// </summary>
    [HttpPut("tenants/{tenantId}/packages/{packageKey}")]
    [ProducesResponseType(typeof(TenantPackageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TenantPackageResponse>> SetTenantPackage(
        string tenantId,
        string packageKey,
        [FromBody] TenantPackageUpdateRequest request,
        CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        var ownerIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid? ownerId = Guid.TryParse(ownerIdClaim, out var g) ? g : null;

        var service = _scope.GetRequiredService<TenantPackageService>();
        try
        {
            var updated = await service.SetEnabledAsync(id, packageKey, request.IsEnabled, ownerId, ct);
            return updated is null
                ? NotFound(new ProblemDetails { Title = "Package not found", Detail = $"Pacote '{packageKey}' não existe no catálogo." })
                : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails { Title = "Conflict", Detail = ex.Message, Status = StatusCodes.Status409Conflict });
        }
    }

    // ── Telas individuais do tenant (screen-level override) ──

    /// <summary>
    /// Lista os estados de todas as telas para o tenant.
    /// Telas sem registro retornam como "ativo" (padrão).
    /// </summary>
    [HttpGet("tenants/{tenantId}/screens")]
    [ProducesResponseType(typeof(IReadOnlyList<TenantScreenStateResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TenantScreenStateResponse>>> ListTenantScreens(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        var service = _scope.GetRequiredService<TenantScreenService>();
        var map = await service.GetEstadoMapAsync(id, ct);

        var result = NavegacaoManifest.Items
            .Select(item => new TenantScreenStateResponse(
                NavItemId: item.Id,
                Estado: map.TryGetValue(item.Id, out var e) ? e : EstadoTela.Ativo,
                UpdatedAtUtc: null))
            .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Define o estado de uma tela específica para o tenant: "ativo", "oculto" ou "bloqueado".
    /// </summary>
    [HttpPut("tenants/{tenantId}/screens/{navItemId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetTenantScreen(
        string tenantId,
        string navItemId,
        [FromBody] TenantScreenUpdateRequest request,
        CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(id) || !TenantIdPattern.IsMatch(id))
            return BadRequest(new ProblemDetails { Title = "Invalid TenantId", Detail = "TenantId inválido." });
        var exists = await _masterDb.Tenants.AnyAsync(t => t.TenantId == id, ct);
        if (!exists)
            return NotFound(new ProblemDetails { Title = "Tenant not found", Detail = $"Tenant {id} não encontrado." });

        if (!EstadoTela.IsValid(request.Estado))
            return BadRequest(new ProblemDetails { Title = "Invalid estado", Detail = "Estado deve ser 'ativo', 'oculto' ou 'bloqueado'." });

        var ownerIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid? ownerId = Guid.TryParse(ownerIdClaim, out var g) ? g : null;

        var service = _scope.GetRequiredService<TenantScreenService>();
        var ok = await service.SetEstadoAsync(id, navItemId, request.Estado, ownerId, ct);

        return ok
            ? NoContent()
            : NotFound(new ProblemDetails { Title = "NavItem not found", Detail = $"Item '{navItemId}' não existe no manifesto de navegação." });
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
