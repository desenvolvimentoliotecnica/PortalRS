using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class DesempenhoController : Controller
{
    // Mínimo: action para a view MinhasAvaliacoes criada
    public IActionResult MinhasAvaliacoes() => View();
}

