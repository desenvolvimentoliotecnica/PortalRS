namespace LiotecnicaHub.Web.Domain.Entities;

/// <summary>
/// Vincula um perfil ao acesso de abertura de um sistema no Hub (launcher).
/// Permissões de ação dentro do sistema ficam no próprio sistema (ex.: Portal RH).
/// </summary>
public class HubProfileSystemAccess
{
    public Guid ProfileId { get; set; }
    public Guid SystemId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }

    public HubProfile Profile { get; set; } = null!;
    public HubSystem System { get; set; } = null!;
}
