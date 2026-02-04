using Microsoft.AspNetCore.Authorization;

namespace RhPortal.Api.Infrastructure.Security;

public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
