using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[AllowAnonymous]
public sealed class PortalVagasController : Controller
{
    [HttpGet("/PortalVagas")]
    public IActionResult Index()
    {
        return View();
    }
}
