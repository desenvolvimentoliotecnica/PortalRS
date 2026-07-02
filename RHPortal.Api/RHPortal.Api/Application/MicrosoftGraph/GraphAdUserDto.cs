namespace RhPortal.Api.Application.MicrosoftGraph;

public sealed record GraphAdUserDto(
    string Id,
    string? DisplayName,
    string? Mail,
    string? UserPrincipalName,
    string? EmployeeId)
{
    public string? ResolveCorporateEmail()
    {
        if (!string.IsNullOrWhiteSpace(Mail))
            return Mail.Trim();

        if (!string.IsNullOrWhiteSpace(UserPrincipalName))
            return UserPrincipalName.Trim();

        return null;
    }
}
