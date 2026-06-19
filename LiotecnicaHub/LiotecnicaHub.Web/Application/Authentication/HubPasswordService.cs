using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Infrastructure.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace LiotecnicaHub.Web.Application.Authentication;

public interface IHubPasswordService
{
    string HashPassword(HubUser user, string password);
    bool VerifyPassword(HubUser user, string password);
    string GetDefaultPassword();
}

public sealed class HubPasswordService : IHubPasswordService
{
    private readonly PasswordHasher<HubUser> _hasher = new();
    private readonly HubOptions _options;

    public HubPasswordService(IOptions<HubOptions> options) => _options = options.Value;

    public string HashPassword(HubUser user, string password) =>
        _hasher.HashPassword(user, password);

    public bool VerifyPassword(HubUser user, string password)
    {
        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            return false;

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }

    public string GetDefaultPassword() =>
        string.IsNullOrWhiteSpace(_options.DefaultUserPassword)
            ? "Liotec@2026"
            : _options.DefaultUserPassword;
}
