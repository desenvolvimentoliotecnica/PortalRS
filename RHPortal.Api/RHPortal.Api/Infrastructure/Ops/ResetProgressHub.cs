using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace RhPortal.Api.Infrastructure.Ops;

[AllowAnonymous]
public sealed class ResetProgressHub : Hub
{
}
