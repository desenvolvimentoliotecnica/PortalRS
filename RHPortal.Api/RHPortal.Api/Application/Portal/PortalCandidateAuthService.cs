using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Portal;

public interface IPortalCandidateAuthService
{
    Task<PortalCandidateAuthResponse?> LoginAsync(PortalCandidateLoginRequest request, CancellationToken ct);
    Task<PortalCandidateAuthResponse> RegisterAsync(PortalCandidateRegisterRequest request, CancellationToken ct);
    Task EnsureCpfDisponivelAsync(string cpfNorm, Guid? excludeCandidatoId, CancellationToken ct);
}

public sealed class PortalCandidateAuthService : IPortalCandidateAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<Candidato> _passwordHasher;
    private readonly IStringLocalizer<ServiceMessages> _localizer;
    private readonly NotificationPublisher _notificationPublisher;
    private readonly ITenantContext _tenantContext;
    private readonly ITalentoService _talentoService;

    public PortalCandidateAuthService(
        AppDbContext db,
        IPasswordHasher<Candidato> passwordHasher,
        IStringLocalizer<ServiceMessages> localizer,
        NotificationPublisher notificationPublisher,
        ITenantContext tenantContext,
        ITalentoService talentoService)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _localizer = localizer;
        _notificationPublisher = notificationPublisher;
        _tenantContext = tenantContext;
        _talentoService = talentoService;
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

        return MapAuthResponse(candidato);
    }

    public async Task<PortalCandidateAuthResponse> RegisterAsync(PortalCandidateRegisterRequest request, CancellationToken ct)
    {
        var email = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException(_localizer["ServiceErrors.PortalEmailInvalid"]);

        ValidateAndParseDocumentacao(
            request.Cpf,
            request.Rg,
            request.DataNascimento,
            request.NomeMae,
            out var cpfNorm,
            out var dataNascimento,
            _localizer);

        var candidato = await _db.Candidatos
            .FirstOrDefaultAsync(x => x.Email == email, ct);

        if (candidato is not null)
        {
            if (!string.IsNullOrWhiteSpace(candidato.PortalPasswordHash))
                throw new InvalidOperationException(_localizer["ServiceErrors.PortalAccessExists"]);

            await EnsureCpfDisponivelAsync(cpfNorm, candidato.Id, ct);

            var (talento, _) = await _talentoService.GetOrCreateByEmailAsync(
                email,
                request.Nome,
                NormalizeRequired(request.Fone),
                NormalizeRequired(request.Cidade),
                NormalizeUfRequired(request.Uf),
                null,
                null,
                null,
                OrigemTalento.Site,
                ct);
            candidato.TalentoId = talento.Id;

            candidato.Nome = (request.Nome ?? string.Empty).Trim();
            candidato.Email = email;
            candidato.Cpf = cpfNorm;
            candidato.Rg = NormalizeRequired(request.Rg);
            candidato.DataNascimento = dataNascimento;
            candidato.NomeMae = NormalizeRequired(request.NomeMae);
            candidato.NomePai = NormalizeOptional(request.NomePai);
            candidato.Fone = NormalizeRequired(request.Fone);
            candidato.Cidade = NormalizeRequired(request.Cidade);
            candidato.Uf = NormalizeUfRequired(request.Uf);
            candidato.PortalPasswordHash = _passwordHasher.HashPassword(candidato, request.Password);
            candidato.UpdatedAtUtc = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(ct);
            await NotifyPortalRegisterAsync(candidato, ct);
            return MapAuthResponse(candidato);
        }

        await EnsureCpfDisponivelAsync(cpfNorm, excludeCandidatoId: null, ct);

        var (talentoNew, _) = await _talentoService.GetOrCreateByEmailAsync(
            email,
            request.Nome,
            NormalizeRequired(request.Fone),
            NormalizeRequired(request.Cidade),
            NormalizeUfRequired(request.Uf),
            null,
            null,
            null,
            OrigemTalento.Site,
            ct);

        var tenantId = _tenantContext.TenantId ?? "";
        var entity = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Nome = (request.Nome ?? string.Empty).Trim(),
            Email = email,
            Cpf = cpfNorm,
            Rg = NormalizeRequired(request.Rg),
            DataNascimento = dataNascimento,
            NomeMae = NormalizeRequired(request.NomeMae),
            NomePai = NormalizeOptional(request.NomePai),
            Fone = NormalizeRequired(request.Fone),
            Cidade = NormalizeRequired(request.Cidade),
            Uf = NormalizeUfRequired(request.Uf),
            Fonte = CandidateOrigin.Site,
            Status = CandidateStatus.Novo,
            VagaId = null,
            TalentoId = talentoNew.Id,
            PortalAccessKey = GeneratePortalAccessKey(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        entity.PortalPasswordHash = _passwordHasher.HashPassword(entity, request.Password);

        _db.Candidatos.Add(entity);
        await _db.SaveChangesAsync(ct);
        await NotifyPortalRegisterAsync(entity, ct);

        return MapAuthResponse(entity);
    }

    public static bool IsDocumentacaoBasicaCompleta(Candidato candidato)
        => !string.IsNullOrWhiteSpace(candidato.Cpf)
           && !string.IsNullOrWhiteSpace(candidato.Rg)
           && candidato.DataNascimento.HasValue
           && !string.IsNullOrWhiteSpace(candidato.NomeMae);

    public static string NormalizeCpf(string? cpf)
        => (cpf ?? string.Empty).Replace(".", "").Replace("-", "").Replace(" ", "").Trim();

    public static void ValidateAndParseDocumentacao(
        string? cpf,
        string? rg,
        string? dataNascimento,
        string? nomeMae,
        out string cpfNorm,
        out DateOnly dataNasc,
        IStringLocalizer<ServiceMessages>? localizer = null)
    {
        cpfNorm = NormalizeCpf(cpf);
        if (!ValidacaoHelper.ValidarCpf(cpfNorm))
            throw new InvalidOperationException(
                localizer?["ServiceErrors.PortalCpfInvalid"] ?? "CPF inválido.");

        if (string.IsNullOrWhiteSpace(rg))
            throw new InvalidOperationException(
                localizer?["ServiceErrors.PortalRgRequired"] ?? "RG é obrigatório.");

        if (string.IsNullOrWhiteSpace(dataNascimento)
            || !DateOnly.TryParse(dataNascimento.Trim(), out dataNasc))
            throw new InvalidOperationException(
                localizer?["ServiceErrors.PortalDataNascimentoInvalid"] ?? "Data de nascimento inválida.");

        if (string.IsNullOrWhiteSpace(nomeMae))
            throw new InvalidOperationException(
                localizer?["ServiceErrors.PortalNomeMaeRequired"] ?? "Nome da mãe é obrigatório.");
    }

    public async Task EnsureCpfDisponivelAsync(string cpfNorm, Guid? excludeCandidatoId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cpfNorm)) return;

        var query = _db.Candidatos.AsNoTracking().Where(x => x.Cpf != null && x.Cpf != "");
        if (excludeCandidatoId.HasValue)
            query = query.Where(x => x.Id != excludeCandidatoId.Value);

        var candidatos = await query.Select(x => new { x.Id, x.Cpf }).ToListAsync(ct);
        if (candidatos.Any(x => NormalizeCpf(x.Cpf) == cpfNorm))
            throw new InvalidOperationException(_localizer["ServiceErrors.PortalCpfDuplicate"]);
    }

    public static PortalCandidateAuthResponse MapAuthResponse(Candidato candidato)
        => new(candidato.Id, candidato.Nome, candidato.Email, IsDocumentacaoBasicaCompleta(candidato));

    public static PortalCandidateProfileResponse MapProfileResponse(
        Candidato candidate,
        string? avatarUrl,
        PortalCandidateDocumentoSummary? curriculo)
        => new(
            candidate.Id,
            candidate.Nome,
            candidate.Email,
            candidate.Cpf,
            candidate.Rg,
            candidate.DataNascimento?.ToString("yyyy-MM-dd"),
            candidate.NomeMae,
            candidate.NomePai,
            candidate.Fone,
            candidate.Celular,
            candidate.Cidade,
            candidate.Uf,
            candidate.LinkedinUrl,
            candidate.ResumoProfissional,
            avatarUrl,
            curriculo,
            candidate.TrabalhandoAtualmente,
            IsDocumentacaoBasicaCompleta(candidate));

    private static string NormalizeEmail(string? email)
        => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string NormalizeUfRequired(string? uf)
        => (uf ?? string.Empty).Trim().ToUpperInvariant();

    private static string NormalizeRequired(string? value)
        => (value ?? string.Empty).Trim();

    private static string? NormalizeOptional(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string GeneratePortalAccessKey()
    {
        var raw = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        return raw.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private async Task NotifyPortalRegisterAsync(Candidato candidato, CancellationToken ct)
    {
        try
        {
            var tenantId = string.IsNullOrWhiteSpace(candidato.TenantId) ? _tenantContext.TenantId : candidato.TenantId;
            var parts = new List<string>
            {
                $"Nome: {candidato.Nome}",
                $"Email: {candidato.Email}"
            };

            if (!string.IsNullOrWhiteSpace(candidato.Fone))
                parts.Add($"Fone: {candidato.Fone}");
            if (!string.IsNullOrWhiteSpace(candidato.Cidade) || !string.IsNullOrWhiteSpace(candidato.Uf))
                parts.Add($"Cidade/UF: {candidato.Cidade} - {candidato.Uf}");

            var message = string.Join(" | ", parts);
            var request = new NotificationSendRequest(
                NotificationScope.Tenant,
                "Novo candidato cadastrado",
                message,
                "info",
                $"/Candidatos?open={candidato.Id}",
                tenantId,
                null);

            await _notificationPublisher.PublishToTenantsAsync(new[] { tenantId }, request, ct);
        }
        catch
        {
            // best-effort
        }
    }
}
