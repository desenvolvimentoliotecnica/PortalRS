using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Portal;

public interface IPortalCandidateAuthService
{
    Task<PortalCandidateAuthResponse?> LoginAsync(PortalCandidateLoginRequest request, CancellationToken ct);
    Task<PortalCandidateAuthResponse> RegisterAsync(PortalCandidateRegisterRequest request, CancellationToken ct);
}

public sealed class PortalCandidateAuthService : IPortalCandidateAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<Candidato> _passwordHasher;

    public PortalCandidateAuthService(AppDbContext db, IPasswordHasher<Candidato> passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    public async Task<PortalCandidateAuthResponse?> LoginAsync(PortalCandidateLoginRequest request, CancellationToken ct)
    {
        var email = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(email)) return null;

        var candidato = await _db.Candidatos
            .FirstOrDefaultAsync(x => x.Email == email, ct);

        if (candidato is null || string.IsNullOrWhiteSpace(candidato.PortalPasswordHash))
            return null;

        var result = _passwordHasher.VerifyHashedPassword(candidato, candidato.PortalPasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return null;

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            candidato.PortalPasswordHash = _passwordHasher.HashPassword(candidato, request.Password);
            await _db.SaveChangesAsync(ct);
        }

        return new PortalCandidateAuthResponse(candidato.Id, candidato.Nome, candidato.Email);
    }

    public async Task<PortalCandidateAuthResponse> RegisterAsync(PortalCandidateRegisterRequest request, CancellationToken ct)
    {
        var email = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException("Email invalido.");

        var candidato = await _db.Candidatos
            .FirstOrDefaultAsync(x => x.Email == email, ct);

        if (candidato is not null)
        {
            if (!string.IsNullOrWhiteSpace(candidato.PortalPasswordHash))
                throw new InvalidOperationException("Acesso ja cadastrado. Use o login.");

            candidato.Nome = (request.Nome ?? string.Empty).Trim();
            candidato.Email = email;
            candidato.Fone = NormalizeRequired(request.Fone);
            candidato.Cidade = NormalizeRequired(request.Cidade);
            candidato.Uf = NormalizeUfRequired(request.Uf);
            candidato.PortalPasswordHash = _passwordHasher.HashPassword(candidato, request.Password);

            await _db.SaveChangesAsync(ct);
            return new PortalCandidateAuthResponse(candidato.Id, candidato.Nome, candidato.Email);
        }

        var entity = new Candidato
        {
            Id = Guid.NewGuid(),
            Nome = (request.Nome ?? string.Empty).Trim(),
            Email = email,
            Fone = NormalizeRequired(request.Fone),
            Cidade = NormalizeRequired(request.Cidade),
            Uf = NormalizeUfRequired(request.Uf),
            Fonte = CandidatoFonte.Site,
            Status = CandidatoStatus.Novo,
            VagaId = null,
            PortalAccessKey = GeneratePortalAccessKey()
        };

        entity.PortalPasswordHash = _passwordHasher.HashPassword(entity, request.Password);

        _db.Candidatos.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new PortalCandidateAuthResponse(entity.Id, entity.Nome, entity.Email);
    }

    private static string NormalizeEmail(string? email)
        => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string NormalizeUfRequired(string? uf)
        => (uf ?? string.Empty).Trim().ToUpperInvariant();

    private static string NormalizeRequired(string? value)
        => (value ?? string.Empty).Trim();

    private static string GeneratePortalAccessKey()
    {
        var raw = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        return raw.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
