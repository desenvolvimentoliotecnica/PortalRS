using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.RmConfiguracao;

public sealed record GestorUsuarioProvisioningPreviewResponse(
    int TotalCandidatos,
    int SemEmail,
    int JaComUsuarioGestor,
    int CriarUsuario,
    int VincularUsuarioExistente,
    int AdicionarRoleGestor,
    int Conflitos,
    IReadOnlyList<GestorUsuarioProvisioningItem> Items);

public sealed record GestorUsuarioProvisioningItem(
    Guid FuncionarioId,
    string Nome,
    string? Email,
    string? MatriculaRm,
    string? FuncaoRm,
    string? Cargo,
    string? NivelHierarquico,
    int QtdSubordinados,
    IReadOnlyList<string> Motivos,
    Guid? UsuarioId,
    string? UsuarioEmail,
    bool JaTemUsuario,
    bool JaTemRoleGestor,
    bool PodeExecutar,
    string Acao,
    string? Observacao);

public sealed record GestorUsuarioProvisioningRequest(
    string SenhaPadrao,
    bool ResetarSenhaUsuariosExistentes = false);

public sealed record GestorUsuarioProvisioningLogEntry(
    string Level,
    string Message,
    Guid? FuncionarioId = null,
    Guid? UsuarioId = null);

public sealed class GestorUsuarioProvisioningService
{
    private static readonly string[] LeadershipTerms =
    [
        "coord",
        "coordenador",
        "coordenadora",
        "gerent",
        "gerente",
        "supervis",
        "supervisor",
        "supervisora",
        "lider",
        "líder",
        "encarreg"
    ];

    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;

    public GestorUsuarioProvisioningService(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager)
    {
        _db = db;
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task<GestorUsuarioProvisioningPreviewResponse> PreviewAsync(CancellationToken ct)
    {
        var items = await BuildItemsAsync(ct);
        return BuildPreview(items);
    }

    public async IAsyncEnumerable<GestorUsuarioProvisioningLogEntry> ExecuteAsync(
        GestorUsuarioProvisioningRequest request,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SenhaPadrao))
        {
            yield return new("error", "Senha padrão obrigatória.");
            yield break;
        }

        var gestorRole = await _roleManager.Roles.FirstOrDefaultAsync(r => r.Name == "Gestor", ct);
        if (gestorRole is null)
        {
            yield return new("error", "Role Gestor não encontrada. Execute o seed de perfis antes.");
            yield break;
        }

        var items = (await BuildItemsAsync(ct)).Where(i => i.PodeExecutar).ToList();
        yield return new("info", $"Iniciando provisionamento idempotente. Candidatos executáveis: {items.Count}.");

        foreach (var item in items)
        {
            ct.ThrowIfCancellationRequested();
            var funcionario = await _db.Funcionarios.FirstOrDefaultAsync(f => f.Id == item.FuncionarioId, ct);
            if (funcionario is null)
            {
                yield return new("warn", $"Funcionário não encontrado: {item.Nome}.", item.FuncionarioId);
                continue;
            }

            ApplicationUser? user = null;
            if (item.UsuarioId.HasValue)
                user = await _userManager.Users.FirstOrDefaultAsync(u => u.Id == item.UsuarioId.Value, ct);

            if (user is null && !string.IsNullOrWhiteSpace(funcionario.Email))
                user = await _userManager.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == funcionario.Email.ToLower(), ct);

            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    TenantId = funcionario.TenantId,
                    Email = funcionario.Email!.Trim(),
                    UserName = funcionario.Email!.Trim(),
                    FullName = funcionario.Name.Trim(),
                    IsActive = true,
                    FuncionarioId = funcionario.Id,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };

                var createResult = await _userManager.CreateAsync(user, request.SenhaPadrao);
                if (!createResult.Succeeded)
                {
                    yield return new(
                        "error",
                        $"Falha ao criar usuário para {funcionario.Name}: {string.Join("; ", createResult.Errors.Select(e => e.Description))}",
                        funcionario.Id);
                    continue;
                }

                funcionario.UserId = user.Id;
                await _db.SaveChangesAsync(ct);
                yield return new("success", $"Usuário criado para {funcionario.Name} ({user.Email}).", funcionario.Id, user.Id);
            }
            else
            {
                var changed = false;
                if (user.FuncionarioId is null)
                {
                    user.FuncionarioId = funcionario.Id;
                    changed = true;
                }
                if (funcionario.UserId != user.Id)
                {
                    funcionario.UserId = user.Id;
                    changed = true;
                }
                if (!user.IsActive)
                {
                    user.IsActive = true;
                    changed = true;
                }
                if (changed)
                {
                    user.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    var updateResult = await _userManager.UpdateAsync(user);
                    if (!updateResult.Succeeded)
                    {
                        yield return new(
                            "error",
                            $"Falha ao vincular usuário existente para {funcionario.Name}: {string.Join("; ", updateResult.Errors.Select(e => e.Description))}",
                            funcionario.Id,
                            user.Id);
                        continue;
                    }
                    await _db.SaveChangesAsync(ct);
                    yield return new("success", $"Usuário existente vinculado a {funcionario.Name} ({user.Email}).", funcionario.Id, user.Id);
                }
                else
                {
                    yield return new("info", $"Usuário já vinculado para {funcionario.Name} ({user.Email}).", funcionario.Id, user.Id);
                }

                if (request.ResetarSenhaUsuariosExistentes)
                {
                    var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                    var resetResult = await _userManager.ResetPasswordAsync(user, token, request.SenhaPadrao);
                    if (!resetResult.Succeeded)
                    {
                        yield return new(
                            "error",
                            $"Falha ao redefinir senha de {user.Email}: {string.Join("; ", resetResult.Errors.Select(e => e.Description))}",
                            funcionario.Id,
                            user.Id);
                    }
                    else
                    {
                        yield return new("success", $"Senha redefinida para {user.Email}.", funcionario.Id, user.Id);
                    }
                }
            }

            if (!await _userManager.IsInRoleAsync(user, "Gestor"))
            {
                var roleResult = await _userManager.AddToRoleAsync(user, "Gestor");
                if (!roleResult.Succeeded)
                {
                    yield return new(
                        "error",
                        $"Falha ao atribuir perfil Gestor para {user.Email}: {string.Join("; ", roleResult.Errors.Select(e => e.Description))}",
                        funcionario.Id,
                        user.Id);
                    continue;
                }

                yield return new("success", $"Perfil Gestor atribuído para {user.Email}.", funcionario.Id, user.Id);
            }
            else
            {
                yield return new("info", $"{user.Email} já possui perfil Gestor.", funcionario.Id, user.Id);
            }
        }

        var finalPreview = await PreviewAsync(ct);
        yield return new(
            "done",
            $"Concluído. Já com usuário Gestor: {finalPreview.JaComUsuarioGestor}; criar usuário pendente: {finalPreview.CriarUsuario}; adicionar role pendente: {finalPreview.AdicionarRoleGestor}.");
    }

    private async Task<IReadOnlyList<GestorUsuarioProvisioningItem>> BuildItemsAsync(CancellationToken ct)
    {
        var subordinados = await _db.Funcionarios
            .AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active && f.GestorDiretoId != null)
            .GroupBy(f => f.GestorDiretoId!.Value)
            .Select(g => new { FuncionarioId = g.Key, Qtd = g.Count() })
            .ToDictionaryAsync(x => x.FuncionarioId, x => x.Qtd, ct);

        var funcionarios = await _db.Funcionarios
            .AsNoTracking()
            .Include(f => f.JobPosition)
            .Include(f => f.NivelHierarquico)
            .Where(f => f.Status == FuncionarioStatus.Active)
            .OrderBy(f => f.Name)
            .ToListAsync(ct);

        var candidateIds = new HashSet<Guid>();
        foreach (var f in funcionarios)
        {
            var hasSubordinates = subordinados.ContainsKey(f.Id);
            var hasLeadershipTerm = ContainsLeadershipTerm(f.FuncaoNomeRm)
                || ContainsLeadershipTerm(f.JobPosition?.Name)
                || ContainsLeadershipTerm(f.NivelHierarquico?.Nome);
            if (hasSubordinates || hasLeadershipTerm)
                candidateIds.Add(f.Id);
        }

        var candidates = funcionarios.Where(f => candidateIds.Contains(f.Id)).ToList();
        var candidateEmails = candidates
            .Select(f => f.Email?.Trim().ToLowerInvariant())
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct()
            .ToList();
        var ids = candidates.Select(f => f.Id).ToList();

        var users = await _userManager.Users
            .AsNoTracking()
            .Where(u => (u.FuncionarioId != null && ids.Contains(u.FuncionarioId.Value))
                || (u.Email != null && candidateEmails.Contains(u.Email.ToLower())))
            .ToListAsync(ct);

        var gestorRole = await _roleManager.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Name == "Gestor", ct);
        var gestorUserIds = gestorRole is null
            ? new HashSet<Guid>()
            : (await _db.UserRoles.AsNoTracking()
                .Where(ur => ur.RoleId == gestorRole.Id && users.Select(u => u.Id).Contains(ur.UserId))
                .Select(ur => ur.UserId)
                .ToListAsync(ct))
                .ToHashSet();

        return candidates.Select(f =>
        {
            var userByFuncionario = users.FirstOrDefault(u => u.FuncionarioId == f.Id);
            var userByEmail = string.IsNullOrWhiteSpace(f.Email)
                ? null
                : users.FirstOrDefault(u => string.Equals(u.Email, f.Email, StringComparison.OrdinalIgnoreCase));
            var user = userByFuncionario ?? userByEmail;
            var conflict = userByEmail is not null
                && userByEmail.FuncionarioId is not null
                && userByEmail.FuncionarioId != f.Id;

            var motivos = new List<string>();
            if (subordinados.TryGetValue(f.Id, out var qtd) && qtd > 0)
                motivos.Add($"{qtd} subordinado(s)");
            if (ContainsLeadershipTerm(f.FuncaoNomeRm))
                motivos.Add($"Função RM: {f.FuncaoNomeRm}");
            if (ContainsLeadershipTerm(f.JobPosition?.Name))
                motivos.Add($"Cargo: {f.JobPosition?.Name}");
            if (ContainsLeadershipTerm(f.NivelHierarquico?.Nome))
                motivos.Add($"Nível: {f.NivelHierarquico?.Nome}");

            var hasRole = user is not null && gestorUserIds.Contains(user.Id);
            var hasEmail = !string.IsNullOrWhiteSpace(f.Email);
            var canExecute = hasEmail && !conflict;
            var action = !hasEmail
                ? "Ignorar: sem e-mail"
                : conflict
                    ? "Conflito: e-mail vinculado a outro funcionário"
                    : user is null
                        ? "Criar usuário + atribuir Gestor"
                        : hasRole && user.FuncionarioId == f.Id
                            ? "Sem ação"
                            : user.FuncionarioId is null
                                ? "Vincular usuário + atribuir Gestor"
                                : "Atribuir Gestor";

            return new GestorUsuarioProvisioningItem(
                f.Id,
                f.Name,
                f.Email,
                f.MatriculaRm,
                f.FuncaoNomeRm,
                f.JobPosition?.Name,
                f.NivelHierarquico?.Nome,
                qtd,
                motivos,
                user?.Id,
                user?.Email,
                user is not null,
                hasRole,
                canExecute,
                action,
                conflict ? $"Usuário {userByEmail?.Email} já está vinculado a outro funcionário." : null);
        }).ToList();
    }

    private static GestorUsuarioProvisioningPreviewResponse BuildPreview(IReadOnlyList<GestorUsuarioProvisioningItem> items)
    {
        return new GestorUsuarioProvisioningPreviewResponse(
            items.Count,
            items.Count(i => string.IsNullOrWhiteSpace(i.Email)),
            items.Count(i => i is { JaTemUsuario: true, JaTemRoleGestor: true }),
            items.Count(i => i.PodeExecutar && !i.JaTemUsuario),
            items.Count(i => i.PodeExecutar && i is { JaTemUsuario: true, UsuarioId: not null } && i.Acao.StartsWith("Vincular", StringComparison.OrdinalIgnoreCase)),
            items.Count(i => i.PodeExecutar && i.JaTemUsuario && !i.JaTemRoleGestor),
            items.Count(i => !i.PodeExecutar && !string.IsNullOrWhiteSpace(i.Observacao)),
            items);
    }

    private static bool ContainsLeadershipTerm(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        return LeadershipTerms.Any(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));
    }
}
