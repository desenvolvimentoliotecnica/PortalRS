namespace LioTecnica.Web.Infrastructure.Middleware;

/// <summary>Placeholder for debug exception logging; can be re-enabled for debug sessions.</summary>
public sealed class DebugExceptionLoggingMiddleware
{
    private readonly RequestDelegate _next;

    public DebugExceptionLoggingMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        await _next(context);
    }
}
