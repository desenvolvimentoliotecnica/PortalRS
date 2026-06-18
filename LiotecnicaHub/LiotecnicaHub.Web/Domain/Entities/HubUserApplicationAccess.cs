namespace LiotecnicaHub.Web.Domain.Entities;

/// <summary>
/// Acesso direto do usuário a um aplicativo no launcher.
/// Perfis/roles operacionais ficam em cada sistema (ex.: Portal RH).
/// </summary>
public class HubUserApplicationAccess
{
    public Guid UserId { get; set; }
    public Guid ApplicationId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }

    public HubUser User { get; set; } = null!;
    public HubApplication Application { get; set; } = null!;
}
