using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Pessoas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Pessoas;

public sealed class PessoaService : IPessoaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public PessoaService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<PessoaPagedResponse> ListAsync(PessoaListQuery query, CancellationToken ct)
    {
        IQueryable<Pessoa> q = _db.Pessoas.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var like = $"%{term}%";
            q = q.Where(p =>
                EF.Functions.Like(p.Nome, like) ||
                EF.Functions.Like(p.Email, like) ||
                (p.Fone != null && EF.Functions.Like(p.Fone, like)) ||
                (p.Cidade != null && EF.Functions.Like(p.Cidade, like)) ||
                (p.Uf != null && EF.Functions.Like(p.Uf, like)));
        }

        var ordered = q.OrderBy(p => p.Nome).ThenBy(p => p.Email);
        var totalCount = await ordered.CountAsync(ct);

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var ids = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var pessoas = await _db.Pessoas
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .OrderBy(p => p.Nome)
            .ThenBy(p => p.Email)
            .ToListAsync(ct);

        var bloqueios = await _db.PessoaBloqueios
            .AsNoTracking()
            .Where(b => ids.Contains(b.PessoaId))
            .Select(b => new { b.PessoaId, b.Id })
            .ToListAsync(ct);
        var bloqueioByPessoa = bloqueios.ToDictionary(x => x.PessoaId, x => x.Id);

        var items = pessoas.Select(p =>
        {
            var estaBloqueado = bloqueioByPessoa.TryGetValue(p.Id, out var bloqueioId);
            return new PessoaListItemResponse(
                p.Id,
                p.Nome,
                p.Email,
                p.Fone,
                p.Cidade,
                p.Uf,
                p.Origem,
                p.CreatedAtUtc,
                estaBloqueado,
                estaBloqueado ? bloqueioId : null);
        }).ToList();

        return new PessoaPagedResponse(items, totalCount, page, pageSize);
    }

    public async Task<PessoaResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Pessoas
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return entity is null ? null : MapToResponse(entity);
    }

    public async Task<Pessoa?> FindByEmailAsync(string email, CancellationToken ct)
    {
        var normalized = NormalizeEmail(email);
        if (string.IsNullOrWhiteSpace(normalized)) return null;
        return await _db.Pessoas
            .AsTracking()
            .FirstOrDefaultAsync(x => x.TenantId == _tenantContext.TenantId && x.Email == normalized, ct);
    }

    public async Task<Pessoa?> FindByCpfAsync(string cpf, CancellationToken ct)
    {
        var normalized = NormalizeCpf(cpf);
        if (string.IsNullOrWhiteSpace(normalized)) return null;
        var tenantId = _tenantContext.TenantId;
        var candidates = await _db.Pessoas
            .AsTracking()
            .Where(p => p.TenantId == tenantId && p.Cpf != null)
            .ToListAsync(ct);
        return candidates.FirstOrDefault(p => NormalizeCpf(p.Cpf) == normalized);
    }

    public async Task<(Pessoa Pessoa, Talento? Talento)?> FindSimilarAsync(string? email, string? fone, string? nome, string? cep, string? logradouro, string? numero, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = NormalizeEmail(email);
            var pessoa = await _db.Pessoas
                .AsTracking()
                .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Email == normalizedEmail, ct);
            if (pessoa != null)
            {
                var talento = await _db.Talentos
                    .AsTracking()
                    .Include(t => t.Pessoa)
                    .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.PessoaId == pessoa.Id, ct);
                return (pessoa, talento);
            }
        }

        if (!string.IsNullOrWhiteSpace(fone))
        {
            var normalizedFone = NormalizeFone(fone);
            if (!string.IsNullOrWhiteSpace(normalizedFone))
            {
                var pessoas = await _db.Pessoas
                    .AsTracking()
                    .Where(p => p.TenantId == tenantId && (p.Fone != null || p.FoneContato != null))
                    .ToListAsync(ct);
                var pessoa = pessoas.FirstOrDefault(p =>
                    NormalizeFone(p.Fone) == normalizedFone || NormalizeFone(p.FoneContato) == normalizedFone);
                if (pessoa != null)
                {
                    var talento = await _db.Talentos
                        .AsTracking()
                        .Include(t => t.Pessoa)
                        .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.PessoaId == pessoa.Id, ct);
                    return (pessoa, talento);
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(nome) && (!string.IsNullOrWhiteSpace(cep) || (!string.IsNullOrWhiteSpace(logradouro) && !string.IsNullOrWhiteSpace(numero))))
        {
            var nomeNorm = (nome ?? string.Empty).Trim();
            var cepNorm = (cep ?? string.Empty).Trim();
            var logNorm = (logradouro ?? string.Empty).Trim();
            var numNorm = (numero ?? string.Empty).Trim();
            var q = _db.Pessoas.AsTracking().Where(p => p.TenantId == tenantId && p.Nome != null);
            var pessoas = await q.ToListAsync(ct);
            var pessoa = pessoas.FirstOrDefault(p =>
            {
                var pNome = (p.Nome ?? string.Empty).Trim();
                if (string.Equals(pNome, nomeNorm, StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.IsNullOrWhiteSpace(cepNorm) && string.Equals((p.Cep ?? string.Empty).Trim(), cepNorm, StringComparison.OrdinalIgnoreCase))
                        return true;
                    if (!string.IsNullOrWhiteSpace(logNorm) && !string.IsNullOrWhiteSpace(numNorm) &&
                        string.Equals((p.Logradouro ?? string.Empty).Trim(), logNorm, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals((p.Numero ?? string.Empty).Trim(), numNorm, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
                return false;
            });
            if (pessoa != null)
            {
                var talento = await _db.Talentos
                    .AsTracking()
                    .Include(t => t.Pessoa)
                    .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.PessoaId == pessoa.Id, ct);
                return (pessoa, talento);
            }
        }

        return null;
    }

    public async Task<PessoaResponse> CreateAsync(PessoaCreateRequest request, CancellationToken ct)
    {
        const string logPath = "/Users/victoralves/Projects/Voltage.RenderRH/.cursor/debug.log";
        void Log(string hypothesisId, string location, string message, object? data = null)
        {
            try
            {
                var line = JsonSerializer.Serialize(new { hypothesisId, location, message, data, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), sessionId = "debug-session", runId = "run1" }) + "\n";
                File.AppendAllText(logPath, line);
            }
            catch { /* no-op */ }
        }
        // #region agent log
        try
        {
            var tenantId = _tenantContext.TenantId;
            Log("A", "PessoaService.CreateAsync:entry", "CreateAsync called", new { tenantIdLength = tenantId?.Length ?? 0, tenantIdEmpty = string.IsNullOrEmpty(tenantId), origem = request?.Origem.ToString(), nomeLen = request?.Nome?.Length ?? 0, emailLen = request?.Email?.Length ?? 0 });
            var entity = new Pessoa
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                Origem = request!.Origem,
                Nome = (request.Nome ?? string.Empty).Trim(),
                Email = NormalizeEmail(request.Email),
                Fone = TrimToMax(request.Fone, 40),
                Cidade = TrimToMax(request.Cidade, 120),
                Uf = TrimToMax(request.Uf, 2),
                LinkedinUrl = TrimToMax(request.LinkedinUrl, 260),
                ResumoProfissional = TrimToMax(request.ResumoProfissional, 2000),
                Obs = TrimToMax(request.Obs, 2000),
                Cep = TrimToMax(request.Cep, 20),
                Logradouro = TrimToMax(request.Logradouro, 200),
                Numero = TrimToMax(request.Numero, 40),
                Bairro = TrimToMax(request.Bairro, 120),
                Complemento = TrimToMax(request.Complemento, 120),
                Cpf = TrimToMax(request.Cpf, 14),
                Rg = TrimToMax(request.Rg, 20),
                FoneContato = TrimToMax(request.FoneContato, 40),
                DataNascimento = ToUtcDate(request.DataNascimento),
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            Log("E", "PessoaService.CreateAsync:entityBuilt", "Entity built", new { entityTenantIdLen = entity.TenantId?.Length ?? 0, entityEmailLen = entity.Email?.Length ?? 0 });
            _db.Pessoas.Add(entity);
            Log("C", "PessoaService.CreateAsync:beforeSaveChanges", "Before SaveChangesAsync");
            await _db.SaveChangesAsync(ct);
            Log("C", "PessoaService.CreateAsync:afterSaveChanges", "After SaveChangesAsync");
            Log("D", "PessoaService.CreateAsync:beforeMapToResponse", "Before MapToResponse");
            var response = MapToResponse(entity);
            Log("D", "PessoaService.CreateAsync:afterMapToResponse", "After MapToResponse");
            return response;
        }
        catch (Exception ex)
        {
            Log("A", "PessoaService.CreateAsync:catch", "Exception", new { exType = ex.GetType().FullName, exMessage = ex.Message, innerType = ex.InnerException?.GetType().FullName, innerMessage = ex.InnerException?.Message });
            throw;
        }
        // #endregion
    }

    public async Task<PessoaResponse?> UpdateAsync(Guid id, PessoaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Pessoas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        entity.Nome = (request.Nome ?? string.Empty).Trim();
        entity.Email = NormalizeEmail(request.Email);
        entity.Origem = request.Origem;
        entity.Fone = TrimToMax(request.Fone, 40);
        entity.Cidade = TrimToMax(request.Cidade, 120);
        entity.Uf = TrimToMax(request.Uf, 2);
        entity.LinkedinUrl = TrimToMax(request.LinkedinUrl, 260);
        entity.ResumoProfissional = TrimToMax(request.ResumoProfissional, 2000);
        entity.Obs = TrimToMax(request.Obs, 2000);
        entity.Cep = TrimToMax(request.Cep, 20);
        entity.Logradouro = TrimToMax(request.Logradouro, 200);
        entity.Numero = TrimToMax(request.Numero, 40);
        entity.Bairro = TrimToMax(request.Bairro, 120);
        entity.Complemento = TrimToMax(request.Complemento, 120);
        entity.Cpf = TrimToMax(request.Cpf, 14);
        entity.Rg = TrimToMax(request.Rg, 20);
        entity.FoneContato = TrimToMax(request.FoneContato, 40);
        entity.DataNascimento = ToUtcDate(request.DataNascimento);
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Pessoas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;
        _db.Pessoas.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<Pessoa> GetOrCreateByEmailAsync(string email, string? nome, string? fone, string? cidade, string? uf, string? linkedinUrl, string? resumoProfissional, string? obs, OrigemPessoa? origem, CancellationToken ct)
    {
        var normalized = NormalizeEmail(email);
        if (string.IsNullOrWhiteSpace(normalized))
            throw new ArgumentException("Email is required.", nameof(email));

        var existing = await _db.Pessoas
            .AsTracking()
            .FirstOrDefaultAsync(x => x.TenantId == _tenantContext.TenantId && x.Email == normalized, ct);

        if (existing is not null)
        {
            if (!string.IsNullOrWhiteSpace(nome)) existing.Nome = TrimToMax(nome, 160)!;
            if (fone != null) existing.Fone = TrimToMax(fone, 40);
            if (cidade != null) existing.Cidade = TrimToMax(cidade, 120);
            if (uf != null) existing.Uf = TrimToMax(uf, 2);
            if (linkedinUrl != null) existing.LinkedinUrl = TrimToMax(linkedinUrl, 260);
            if (resumoProfissional != null) existing.ResumoProfissional = TrimToMax(resumoProfissional, 2000);
            if (obs != null) existing.Obs = TrimToMax(obs, 2000);
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
            return existing;
        }

        var entity = new Pessoa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Origem = origem ?? OrigemPessoa.Manual,
            Nome = TrimToMax((nome ?? string.Empty).Trim(), 160) ?? " ",
            Email = normalized,
            Fone = TrimToMax(fone, 40),
            Cidade = TrimToMax(cidade, 120),
            Uf = TrimToMax(uf, 2),
            LinkedinUrl = TrimToMax(linkedinUrl, 260),
            ResumoProfissional = TrimToMax(resumoProfissional, 2000),
            Obs = TrimToMax(obs, 2000),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        if (string.IsNullOrWhiteSpace(entity.Nome)) entity.Nome = normalized;
        _db.Pessoas.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity;
    }

    private static PessoaResponse MapToResponse(Pessoa p) =>
        new(p.Id, p.Nome, p.Email, p.Fone, p.Cidade, p.Uf, p.LinkedinUrl, p.ResumoProfissional, p.Obs,
            p.Cep, p.Logradouro, p.Numero, p.Bairro, p.Complemento, p.Cpf, p.Rg, p.FoneContato,
            p.DataNascimento, p.Origem, p.CreatedAtUtc, p.UpdatedAtUtc);

    private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>Normalizes CPF to 11 digits only. Returns null if result is not 11 digits.</summary>
    public static string? NormalizeCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return digits.Length == 11 ? digits : null;
    }

    private static string? NormalizeFone(string? fone)
    {
        if (string.IsNullOrWhiteSpace(fone)) return null;
        var digits = new string(fone.Where(char.IsDigit).ToArray());
        return digits.Length >= 10 ? digits : null;
    }

    private static string? TrimToMax(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : (value.Length <= max ? value.Trim() : value.Trim().Substring(0, max));

    /// <summary>Converts DateTime to UTC for PostgreSQL (timestamp with time zone). Unspecified is treated as UTC.</summary>
    private static DateTime? ToUtcDate(DateTime? value)
    {
        if (value is null) return null;
        var d = value.Value;
        if (d.Kind == DateTimeKind.Utc) return d;
        if (d.Kind == DateTimeKind.Unspecified)
            return DateTime.SpecifyKind(d, DateTimeKind.Utc);
        return d.ToUniversalTime();
    }
}
