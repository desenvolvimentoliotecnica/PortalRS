using System.Security.Cryptography;
using Microsoft.Extensions.Caching.Memory;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.AdmissaoPortal;

public interface IAdmissaoPortalOtpService
{
    Task<(bool Ok, string? Error)> RequestOtpAsync(Guid preAdmissaoId, string cpf, string? email, CancellationToken ct);
    bool VerifyOtp(Guid preAdmissaoId, string cpf, string code);
}

public sealed class AdmissaoPortalOtpService : IAdmissaoPortalOtpService
{
    private const int OtpLength = 6;
    private static readonly TimeSpan OtpTtl = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(1);

    private readonly IMemoryCache _cache;
    private readonly IEmailQueueService _emailQueue;

    public AdmissaoPortalOtpService(IMemoryCache cache, IEmailQueueService emailQueue)
    {
        _cache = cache;
        _emailQueue = emailQueue;
    }

    public async Task<(bool Ok, string? Error)> RequestOtpAsync(
        Guid preAdmissaoId,
        string cpf,
        string? email,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return (false, "E-mail não cadastrado. Entre em contato com o RH.");

        var cpfNorm = NormalizeCpf(cpf);
        if (cpfNorm.Length < 11)
            return (false, "CPF inválido.");

        var cooldownKey = CooldownKey(preAdmissaoId, cpfNorm);
        if (_cache.TryGetValue(cooldownKey, out _))
            return (false, "Aguarde 1 minuto antes de solicitar um novo código.");

        var code = GenerateCode();
        var otpKey = OtpKey(preAdmissaoId, cpfNorm);
        _cache.Set(otpKey, code, OtpTtl);
        _cache.Set(cooldownKey, true, ResendCooldown);

        await _emailQueue.EnqueueTemplateAsync(
            CandidateEmailTemplateCodes.AdmissaoPortalOtp,
            email.Trim(),
            new Dictionary<string, string?>
            {
                ["CandidatoNome"] = "",
                ["EmpresaNome"] = "Portal de Admissão",
                ["CodigoOtp"] = code,
                ["ValidadeMinutos"] = ((int)OtpTtl.TotalMinutes).ToString(),
            },
            isSystem: true,
            source: "admissao-portal-otp",
            ct);

        return (true, null);
    }

    public bool VerifyOtp(Guid preAdmissaoId, string cpf, string code)
    {
        var cpfNorm = NormalizeCpf(cpf);
        var otpKey = OtpKey(preAdmissaoId, cpfNorm);
        if (!_cache.TryGetValue(otpKey, out string? stored) || string.IsNullOrWhiteSpace(stored))
            return false;

        var input = (code ?? "").Trim();
        if (input.Length != OtpLength)
            return false;

        if (!string.Equals(stored, input, StringComparison.Ordinal))
            return false;

        _cache.Remove(otpKey);
        return true;
    }

    private static string GenerateCode()
    {
        var value = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return value.ToString("D6");
    }

    private static string OtpKey(Guid preAdmissaoId, string cpfNorm)
        => $"admissao-portal-otp:{preAdmissaoId:N}:{cpfNorm}";

    private static string CooldownKey(Guid preAdmissaoId, string cpfNorm)
        => $"admissao-portal-otp-cooldown:{preAdmissaoId:N}:{cpfNorm}";

    private static string NormalizeCpf(string cpf)
        => new string((cpf ?? "").Where(char.IsDigit).ToArray());
}
