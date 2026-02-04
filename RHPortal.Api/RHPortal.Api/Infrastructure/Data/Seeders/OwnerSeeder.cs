using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class OwnerSeeder
{
    public static async Task EnsureAsync(
        MasterDbContext masterDb,
        string email,
        string password,
        CancellationToken ct)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var existing = await masterDb.Owners.FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail, ct);
        if (existing is not null)
            return;

        var hash = OwnerAuthService.HashPassword(password);
        var now = DateTimeOffset.UtcNow;
        masterDb.Owners.Add(new Owner
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = hash,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });
        await masterDb.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Updates the owner password in the database (e.g. to sync with Seed:OwnerPassword after config change).
    /// </summary>
    public static async Task<bool> UpdatePasswordAsync(
        MasterDbContext masterDb,
        string email,
        string newPassword,
        CancellationToken ct)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var existing = await masterDb.Owners.FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail, ct);
        if (existing is null)
            return false;

        existing.PasswordHash = OwnerAuthService.HashPassword(newPassword);
        existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await masterDb.SaveChangesAsync(ct);
        return true;
    }
}
