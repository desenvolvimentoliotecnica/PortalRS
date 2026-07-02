using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.MicrosoftGraph;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Funcionarios;

public sealed class FuncionarioCorporateEmailResolver : IFuncionarioCorporateEmailResolver
{
    private readonly AppDbContext _db;
    private readonly IMicrosoftGraphCalendarService _graph;

    public FuncionarioCorporateEmailResolver(AppDbContext db, IMicrosoftGraphCalendarService graph)
    {
        _db = db;
        _graph = graph;
    }

    public async Task<string?> ResolveEmailAsync(Guid funcionarioId, CancellationToken ct)
    {
        var map = await ResolveEmailsAsync([funcionarioId], ct);
        return map.TryGetValue(funcionarioId, out var email) ? email : null;
    }

    public async Task<IReadOnlyDictionary<Guid, string>> ResolveEmailsAsync(
        IReadOnlyList<Guid> funcionarioIds,
        CancellationToken ct)
    {
        if (funcionarioIds.Count == 0)
            return new Dictionary<Guid, string>();

        var ids = funcionarioIds.Where(x => x != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, string>();

        var funcionarios = await _db.Funcionarios.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new FuncionarioEmailSource(
                x.Id,
                x.Email,
                x.MatriculaRm,
                x.UserId))
            .ToListAsync(ct);

        if (funcionarios.Count == 0)
            return new Dictionary<Guid, string>();

        var userIds = funcionarios
            .Where(x => x.UserId.HasValue)
            .Select(x => x.UserId!.Value)
            .Distinct()
            .ToList();

        var portalEmailsByUserId = userIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Users.AsNoTracking()
                .Where(u => userIds.Contains(u.Id) && u.IsActive && u.Email != null && u.Email != "")
                .Select(u => new { u.Id, u.Email })
                .ToDictionaryAsync(x => x.Id, x => x.Email!.Trim(), ct);

        var portalEmailsByFuncionarioId = await _db.Users.AsNoTracking()
            .Where(u => u.FuncionarioId != null && ids.Contains(u.FuncionarioId.Value) && u.IsActive && u.Email != null && u.Email != "")
            .Select(u => new { u.FuncionarioId, u.Email })
            .ToDictionaryAsync(x => x.FuncionarioId!.Value, x => x.Email!.Trim(), ct);

        var chapas = funcionarios
            .Select(x => x.MatriculaRm)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var adByChapa = chapas.Count == 0
            ? new Dictionary<string, GraphAdUserDto>(StringComparer.OrdinalIgnoreCase)
            : await _graph.FindUsersByMatriculasRmAsync(chapas, ct);

        var result = new Dictionary<Guid, string>();

        foreach (var funcionario in funcionarios)
        {
            var email = ResolveForFuncionario(
                funcionario,
                adByChapa,
                portalEmailsByUserId,
                portalEmailsByFuncionarioId);

            if (!string.IsNullOrWhiteSpace(email))
                result[funcionario.Id] = email;
        }

        return result;
    }

    public async Task<CorporateEmailByChapaResult?> ResolveByChapaAsync(string chapa, CancellationToken ct)
    {
        var trimmed = chapa?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return null;

        var adUser = await _graph.FindUserByMatriculaRmAsync(trimmed, ct);
        if (adUser is not null)
        {
            return new CorporateEmailByChapaResult(
                trimmed,
                adUser.EmployeeId,
                adUser.ResolveCorporateEmail(),
                adUser.DisplayName,
                adUser.UserPrincipalName,
                "microsoft-graph");
        }

        var funcionario = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.MatriculaRm == trimmed || f.MatriculaRm == trimmed.TrimStart('0'))
            .Select(f => new FuncionarioEmailSource(f.Id, f.Email, f.MatriculaRm, f.UserId))
            .FirstOrDefaultAsync(ct);

        if (funcionario is null)
        {
            return new CorporateEmailByChapaResult(
                trimmed,
                null,
                null,
                null,
                null,
                "nao-encontrado");
        }

        var map = await ResolveEmailsAsync([funcionario.Id], ct);
        if (!map.TryGetValue(funcionario.Id, out var email))
        {
            return new CorporateEmailByChapaResult(
                trimmed,
                funcionario.MatriculaRm,
                null,
                null,
                null,
                "funcionario-sem-email");
        }

        return new CorporateEmailByChapaResult(
            trimmed,
            funcionario.MatriculaRm,
            email,
            null,
            null,
            string.Equals(email, funcionario.Email?.Trim(), StringComparison.OrdinalIgnoreCase)
                ? "funcionario-rm"
                : "portal-ou-graph");
    }

    private static string? ResolveForFuncionario(
        FuncionarioEmailSource funcionario,
        IReadOnlyDictionary<string, GraphAdUserDto> adByChapa,
        IReadOnlyDictionary<Guid, string> portalEmailsByUserId,
        IReadOnlyDictionary<Guid, string> portalEmailsByFuncionarioId)
    {
        if (!string.IsNullOrWhiteSpace(funcionario.MatriculaRm))
        {
            foreach (var variant in GraphEmployeeIdVariants.FromMatriculaRm(funcionario.MatriculaRm))
            {
                if (adByChapa.TryGetValue(variant, out var adUser))
                {
                    var corporate = adUser.ResolveCorporateEmail();
                    if (!string.IsNullOrWhiteSpace(corporate))
                        return corporate;
                }
            }
        }

        if (funcionario.UserId.HasValue
            && portalEmailsByUserId.TryGetValue(funcionario.UserId.Value, out var linkedUserEmail))
            return linkedUserEmail;

        if (portalEmailsByFuncionarioId.TryGetValue(funcionario.Id, out var portalEmail))
            return portalEmail;

        return string.IsNullOrWhiteSpace(funcionario.Email) ? null : funcionario.Email.Trim();
    }

    private sealed record FuncionarioEmailSource(
        Guid Id,
        string? Email,
        string? MatriculaRm,
        Guid? UserId);
}
