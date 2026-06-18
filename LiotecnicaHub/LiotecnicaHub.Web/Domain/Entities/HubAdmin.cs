namespace LiotecnicaHub.Web.Domain.Entities;

public class HubAdmin
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
}
