using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Users;

public class DeleteModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public DeleteModel(IHubAccessAdminService admin) => _admin = admin;

    public HubUserDeleteInfo? UserInfo { get; set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken ct)
    {
        UserInfo = await _admin.GetUserDeleteInfoAsync(id, ct);
        return UserInfo is null ? NotFound() : Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, CancellationToken ct)
    {
        var result = await _admin.DeleteUserAsync(id, ct);
        if (!result.Success)
        {
            UserInfo = await _admin.GetUserDeleteInfoAsync(id, ct);
            if (UserInfo is null)
                return NotFound();

            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível excluir o usuário.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
