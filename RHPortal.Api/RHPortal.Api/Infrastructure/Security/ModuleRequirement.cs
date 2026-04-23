using Microsoft.AspNetCore.Authorization;

namespace RhPortal.Api.Infrastructure.Security;

public sealed record ModuleRequirement(string ModuleKey) : IAuthorizationRequirement;
