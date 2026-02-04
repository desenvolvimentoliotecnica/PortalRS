using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace LioTecnica.Web.Infrastructure.Security;

public sealed class ApiUnauthorizedMiddleware
{
    private readonly RequestDelegate _next;

    public ApiUnauthorizedMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        await _next(context);

        if (!context.Items.ContainsKey("ApiUnauthorized"))
            return;

        if (context.Response.HasStarted)
            return;

        if (context.Request.Path.StartsWithSegments("/Account/Login"))
            return;

        await context.SignOutAsync();
        context.Response.Redirect("/Account/Login");
    }
}
