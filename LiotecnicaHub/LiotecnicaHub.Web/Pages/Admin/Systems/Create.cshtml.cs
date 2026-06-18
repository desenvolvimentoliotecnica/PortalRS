using LiotecnicaHub.Web.Application.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace LiotecnicaHub.Web.Pages.Admin.Systems;

public class CreateModel : PageModel
{
    private readonly IHubAccessAdminService _admin;

    public CreateModel(IHubAccessAdminService admin) => _admin = admin;

    [BindProperty]
    public HubSystemInput Input { get; set; } = new() { IsActive = true };

    public async Task<IActionResult> OnPostAsync(CancellationToken ct)
    {
        var result = await _admin.CreateSystemAsync(Input, ct);
        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Error ?? "Não foi possível criar o sistema.");
            return Page();
        }

        return RedirectToPage("Index");
    }
}
