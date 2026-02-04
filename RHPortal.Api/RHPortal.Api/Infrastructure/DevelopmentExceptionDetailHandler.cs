using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace RhPortal.Api.Infrastructure;

/// <summary>
/// Em Development, inclui a mensagem da exceção no ProblemDetails.Detail da resposta 500.
/// </summary>
public sealed class DevelopmentExceptionDetailHandler : IExceptionHandler
{
    private readonly IWebHostEnvironment _env;

    public DevelopmentExceptionDetailHandler(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
            return false;

        var detail = exception.Message;
        if (exception.InnerException != null)
            detail += " | Inner: " + exception.InnerException.Message;

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An error occurred while processing your request.",
            Detail = detail
        };

        httpContext.Response.StatusCode = problem.Status.Value;
        httpContext.Response.ContentType = "application/problem+json";
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
