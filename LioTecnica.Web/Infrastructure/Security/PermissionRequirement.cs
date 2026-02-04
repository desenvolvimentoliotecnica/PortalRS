using Microsoft.AspNetCore.Authorization;

namespace LioTecnica.Web.Infrastructure.Security;

public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
