using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Localization;

namespace RhPortal.Api.Infrastructure.Localization;

public sealed class LocalizedIdentityErrorDescriber : IdentityErrorDescriber
{
    private readonly IStringLocalizer<ValidationMessages> _localizer;

    public LocalizedIdentityErrorDescriber(IStringLocalizer<ValidationMessages> localizer)
    {
        _localizer = localizer;
    }

    public override IdentityError DefaultError()
        => Build(nameof(DefaultError), _localizer["ValidationErrors.Identity.Default"]);

    public override IdentityError DuplicateEmail(string email)
        => Build(nameof(DuplicateEmail), _localizer["ValidationErrors.Identity.DuplicateEmail", email]);

    public override IdentityError DuplicateUserName(string userName)
        => Build(nameof(DuplicateUserName), _localizer["ValidationErrors.Identity.DuplicateUserName", userName]);

    public override IdentityError InvalidEmail(string? email)
        => Build(nameof(InvalidEmail), _localizer["ValidationErrors.Identity.InvalidEmail", email ?? string.Empty]);

    public override IdentityError InvalidUserName(string? userName)
        => Build(nameof(InvalidUserName), _localizer["ValidationErrors.Identity.InvalidUserName", userName ?? string.Empty]);

    public override IdentityError PasswordTooShort(int length)
        => Build(nameof(PasswordTooShort), _localizer["ValidationErrors.Identity.PasswordTooShort", length]);

    public override IdentityError PasswordRequiresNonAlphanumeric()
        => Build(nameof(PasswordRequiresNonAlphanumeric), _localizer["ValidationErrors.Identity.PasswordRequiresNonAlphanumeric"]);

    public override IdentityError PasswordRequiresDigit()
        => Build(nameof(PasswordRequiresDigit), _localizer["ValidationErrors.Identity.PasswordRequiresDigit"]);

    public override IdentityError PasswordRequiresLower()
        => Build(nameof(PasswordRequiresLower), _localizer["ValidationErrors.Identity.PasswordRequiresLower"]);

    public override IdentityError PasswordRequiresUpper()
        => Build(nameof(PasswordRequiresUpper), _localizer["ValidationErrors.Identity.PasswordRequiresUpper"]);

    public override IdentityError PasswordRequiresUniqueChars(int uniqueChars)
        => Build(nameof(PasswordRequiresUniqueChars), _localizer["ValidationErrors.Identity.PasswordRequiresUniqueChars", uniqueChars]);

    private static IdentityError Build(string code, string description)
        => new() { Code = code, Description = description };
}
