using System.Diagnostics;
using System.Net.Http;
using System.Net.Sockets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Models;

namespace LioTecnica.Web.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    [AllowAnonymous]
    public IActionResult Error()
    {
        var vm = new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier };
        var feature = HttpContext.Features.Get<IExceptionHandlerPathFeature>();
        var ex = feature?.Error;
        if (IsApiConnectionError(ex))
            vm.FriendlyMessage = "A API do Portal RH não está respondendo (ex.: http://localhost:5056). Inicie a API antes de usar o Portal — por exemplo: no terminal, execute \"sh dev-api.sh\" ou \"sh dev-all.sh\" na pasta __scripts__/dev.";
        return View(vm);
    }

    private static bool IsApiConnectionError(Exception? ex)
    {
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is HttpRequestException)
                return true;
            if (e is SocketException se && se.SocketErrorCode == SocketError.ConnectionRefused)
                return true;
        }
        return false;
    }
}
