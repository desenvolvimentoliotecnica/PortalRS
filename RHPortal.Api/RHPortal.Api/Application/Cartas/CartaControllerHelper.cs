using Microsoft.AspNetCore.Mvc;

namespace RhPortal.Api.Application.Cartas;

public static class CartaControllerHelper
{
    private const string DocxContentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    public static IActionResult ToActionResult(this CartaResult result)
    {
        if (result.IsDirectDownload)
        {
            return new FileContentResult(result.Content!, DocxContentType)
            {
                FileDownloadName = result.FileName ?? "carta.docx",
            };
        }

        return new OkObjectResult(new { url = result.Url });
    }
}
