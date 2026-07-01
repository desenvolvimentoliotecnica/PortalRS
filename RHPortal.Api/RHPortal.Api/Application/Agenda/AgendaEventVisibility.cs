using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Schedule;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Agenda;

internal static class AgendaEventVisibility
{
    public static bool CanViewAllEvents(ICurrentUserContext currentUser) =>
        currentUser.IsAdmin;

    public static bool IsVisibleToUser(
        ScheduleEventResponse evt,
        IReadOnlySet<Guid> vagasCarteiraIds,
        IReadOnlySet<string> ownerTokens) =>
        IsVisibleToUser(evt.VagaId, evt.Owner, evt.Notes, vagasCarteiraIds, ownerTokens);

    public static bool IsVisibleToUser(
        Guid? vagaId,
        string? owner,
        string? notes,
        IReadOnlySet<Guid> vagasCarteiraIds,
        IReadOnlySet<string> ownerTokens) =>
        (vagaId.HasValue && vagasCarteiraIds.Contains(vagaId.Value))
        || OwnerMatches(owner, ownerTokens)
        || ParticipantMatches(notes, ownerTokens);

    public static async Task<IReadOnlySet<string>> GetCurrentUserTokensAsync(
        AppDbContext db,
        ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var tokens = new HashSet<string>(StringComparer.Ordinal);

        void AddToken(string? value)
        {
            var normalized = NormalizeText(value);
            if (normalized.Length >= 3)
                tokens.Add(normalized);
        }

        AddToken(currentUser.Email);

        if (currentUser.UserId.HasValue)
        {
            var user = await db.Users.AsNoTracking()
                .Where(u => u.Id == currentUser.UserId.Value)
                .Select(u => new { u.FullName, u.Email, u.UserName })
                .FirstOrDefaultAsync(ct);

            if (user is not null)
            {
                AddToken(user.FullName);
                AddToken(user.Email);
                AddToken(user.UserName);
            }
        }

        return tokens;
    }

    public static async Task<string?> GetCurrentUserDisplayNameAsync(
        AppDbContext db,
        ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        if (currentUser.UserId.HasValue)
        {
            var fullName = await db.Users.AsNoTracking()
                .Where(u => u.Id == currentUser.UserId.Value)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(ct);

            if (!string.IsNullOrWhiteSpace(fullName))
                return fullName.Trim();
        }

        return string.IsNullOrWhiteSpace(currentUser.Email) ? null : currentUser.Email.Trim();
    }

    public static async Task<IReadOnlySet<Guid>> GetVagasCarteiraIdsAsync(
        AppDbContext db,
        ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        if (!currentUser.UserId.HasValue)
            return new HashSet<Guid>();

        var ids = await db.Vagas.AsNoTracking()
            .Where(v => v.RecrutadorResponsavelUserId == currentUser.UserId.Value)
            .Select(v => v.Id)
            .ToListAsync(ct);

        return ids.ToHashSet();
    }

    private static bool OwnerMatches(string? owner, IReadOnlySet<string> tokens)
    {
        if (string.IsNullOrWhiteSpace(owner) || tokens.Count == 0)
            return false;

        var normalizedOwner = NormalizeText(owner);
        return tokens.Any(token => normalizedOwner.Contains(token, StringComparison.Ordinal));
    }

    private static bool ParticipantMatches(string? notes, IReadOnlySet<string> tokens)
    {
        if (string.IsNullOrWhiteSpace(notes) || tokens.Count == 0)
            return false;

        var normalizedNotes = NormalizeText(notes);
        return tokens.Any(token => normalizedNotes.Contains(token, StringComparison.Ordinal));
    }

    private static string NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var normalized = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                builder.Append(char.ToLowerInvariant(c));
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
