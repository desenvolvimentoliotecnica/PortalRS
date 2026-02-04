using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

/// <summary>
/// Módulo Gestão: Dashboard, Planos de Desenvolvimento, Humor e Resumo de Atividades.
/// </summary>
public class GestaoController : Controller
{
    public IActionResult Index()
    {
        return RedirectToAction(nameof(Dashboard));
    }

    [HttpGet]
    public IActionResult Dashboard()
    {
        return View();
    }

    [HttpGet]
    public IActionResult PlanosDesenvolvimento()
    {
        return View();
    }

    [HttpGet]
    public IActionResult Humor()
    {
        return View();
    }

    [HttpGet]
    public IActionResult ResumoAtividades()
    {
        return View();
    }
}
