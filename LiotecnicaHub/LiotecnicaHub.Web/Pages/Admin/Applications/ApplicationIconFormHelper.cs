using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace LiotecnicaHub.Web.Pages.Admin.Applications;

public static class ApplicationIconFormHelper
{
    public static async Task ApplyIconChangesAsync(
        HubApplication app,
        ApplicationInput input,
        IFormFile? iconFile,
        IHubAppIconStorage iconStorage,
        ModelStateDictionary modelState,
        CancellationToken ct)
    {
        try
        {
            if (input.RemoveIcon)
            {
                await iconStorage.RemoveManagedIconAsync(app.IconUrl, ct);
                app.IconUrl = null;
                return;
            }

            if (iconFile is { Length: > 0 })
            {
                app.IconUrl = await iconStorage.SaveAsync(app.Id, iconFile, app.IconUrl, ct);
            }
        }
        catch (InvalidOperationException ex)
        {
            modelState.AddModelError(string.Empty, ex.Message);
        }
    }
}
