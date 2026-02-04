using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.ViewComponents;

/// <summary>
/// Menu lateral exibido quando o usuário está em contexto Owner (fora do tenant).
/// Mostra apenas o link para a listagem de tenants (/Owner/Tenants).
/// </summary>
public sealed class OwnerMenuViewComponent : ViewComponent
{
    public IViewComponentResult Invoke(string linkClass = "nav-link")
    {
        ViewData["LinkClass"] = linkClass;
        return View();
    }
}
