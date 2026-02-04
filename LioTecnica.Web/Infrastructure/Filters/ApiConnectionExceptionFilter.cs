using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace LioTecnica.Web.Infrastructure.Filters;

/// <summary>
/// Quando a API (RHPortal) está indisponível: requisições _api/* ou Accept: application/json recebem 503 + JSON;
/// demais (ex.: POST Account/SwitchTenant) são redirecionadas para Home/Error com mensagem amigável.
/// </summary>
public sealed class ApiConnectionExceptionFilter : IExceptionFilter
{
    private readonly IConfiguration _configuration;

    public ApiConnectionExceptionFilter(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public void OnException(ExceptionContext context)
    {
        if (context.ExceptionHandled) return;
        if (!IsApiConnectionError(context.Exception)) return;

        var path = context.HttpContext.Request.Path.Value ?? "";
        var acceptsJson = context.HttpContext.Request.Headers.Accept.Any(v =>
            v?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true);
        var wantsJson = path.Contains("/_api/", StringComparison.OrdinalIgnoreCase) || acceptsJson;

        var baseUrl = _configuration["RhApi"] ?? _configuration["Endpoints:RhApi"] ?? "http://localhost:5056/";
        var message = "A API do Portal RH não está respondendo. Inicie a API (RHPortal.Api) — por exemplo na porta indicada em RhApi (ex.: " + baseUrl.TrimEnd('/') + ").";

        if (wantsJson)
        {
            context.Result = new JsonResult(new { error = message })
            {
                StatusCode = (int)HttpStatusCode.ServiceUnavailable
            };
        }
        else
        {
            context.Result = new RedirectToActionResult("Error", "Home", null);
        }

        context.ExceptionHandled = true;
    }

    private static bool IsApiConnectionError(Exception? ex)
    {
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is HttpRequestException) return true;
            if (e is SocketException se && se.SocketErrorCode == SocketError.ConnectionRefused) return true;
        }
        return false;
    }
}
