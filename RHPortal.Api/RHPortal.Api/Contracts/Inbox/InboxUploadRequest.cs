using Microsoft.AspNetCore.Http;

namespace RhPortal.Api.Contracts.Inbox;

public sealed class InboxUploadRequest
{
    public IFormFile? File { get; set; }
}
