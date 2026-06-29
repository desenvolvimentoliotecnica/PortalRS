using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.AdmissaoPortal;

internal static class AdmissaoPortalAnalistaResolver
{
    public static async Task<(string? Email, string? Nome)> ResolveAsync(
        AppDbContext db,
        Guid? vagaId,
        Guid? candidatoId,
        CancellationToken ct)
    {
        if (vagaId.HasValue)
        {
            var vagaUserId = await db.Set<Vaga>()
                .AsNoTracking()
                .Where(v => v.Id == vagaId.Value)
                .Select(v => v.RecrutadorResponsavelUserId)
                .FirstOrDefaultAsync(ct);

            if (vagaUserId.HasValue)
            {
                var user = await LoadUserAsync(db, vagaUserId.Value, ct);
                if (user.HasValue)
                    return user.Value;
            }

            var solicitacaoUserId = await db.Set<SolicitacaoVaga>()
                .AsNoTracking()
                .Where(s => s.VagaId == vagaId.Value && s.AnalistaRhResponsavelUserId != null)
                .OrderByDescending(s => s.UpdatedAtUtc)
                .Select(s => s.AnalistaRhResponsavelUserId)
                .FirstOrDefaultAsync(ct);

            if (solicitacaoUserId.HasValue)
            {
                var user = await LoadUserAsync(db, solicitacaoUserId.Value, ct);
                if (user.HasValue)
                    return user.Value;
            }
        }

        if (candidatoId.HasValue)
        {
            var recruiterId = await db.Set<Candidato>()
                .AsNoTracking()
                .Where(c => c.Id == candidatoId.Value)
                .Select(c => c.ApplicationRecruiterUserId)
                .FirstOrDefaultAsync(ct);

            if (Guid.TryParse(recruiterId, out var recruiterGuid))
            {
                var user = await LoadUserAsync(db, recruiterGuid, ct);
                if (user.HasValue)
                    return user.Value;
            }
        }

        return (null, null);
    }

    private static async Task<(string Email, string? Nome)?> LoadUserAsync(
        AppDbContext db,
        Guid userId,
        CancellationToken ct)
    {
        var user = await db.Set<ApplicationUser>()
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Email, u.FullName })
            .FirstOrDefaultAsync(ct);

        if (user is null || string.IsNullOrWhiteSpace(user.Email))
            return null;

        return (user.Email.Trim(), user.FullName);
    }
}
