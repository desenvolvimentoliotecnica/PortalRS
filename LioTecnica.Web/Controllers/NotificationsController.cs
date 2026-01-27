using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class NotificationsController : Controller
{
    [HttpGet("/Notificacoes")]
    public IActionResult Index()
    {
        ViewData["Title"] = "Notificacoes";
        ViewData["SidebarSubtitle"] = "Caixa de entrada";
        return View();
    }
}
