using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace RhPortal.Api.Infrastructure;

/// <summary>
/// Responde 500 com <see cref="ProblemDetails"/> sempre preenchido com <c>Detail</c> legível
/// (tipo + mensagem + inner), para o front e logs de suporte — sem stack trace completo.
/// </summary>
public sealed class GlobalExceptionProblemDetailsHandler : IExceptionHandler
{
    private readonly IWebHostEnvironment _env;

    public GlobalExceptionProblemDetailsHandler(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var detail = BuildDetail(exception);
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An error occurred while processing your request.",
            Detail = detail,
            Instance = httpContext.Request.Path.Value,
        };

        var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;
        if (!string.IsNullOrEmpty(traceId))
            problem.Extensions["traceId"] = traceId;

        httpContext.Response.StatusCode = problem.Status!.Value;
        httpContext.Response.ContentType = "application/problem+json";
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken: cancellationToken);
        return true;
    }

    private string BuildDetail(Exception exception)
    {
        var sb = new StringBuilder(512);
        var ex = exception;
        var depth = 0;
        while (ex != null && depth < 6)
        {
            if (sb.Length > 0) sb.Append(" ← ");
            sb.Append(ex.GetType().Name);
            sb.Append(": ");
            sb.Append(ex.Message);
            ex = ex.InnerException;
            depth++;
        }

        var s = sb.ToString();
        const int max = 4000;
        if (s.Length > max) s = s[..max] + "…";

        // Em Development, acrescenta stack curto (primeiras linhas) para depuração local
        if (_env.IsDevelopment() && exception.StackTrace is { Length: > 0 } st)
        {
            var lines = st.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var head = string.Join(" | ", lines.Take(4));
            if (head.Length > 1200) head = head[..1200] + "…";
            s += " || " + head;
        }

        return s;
    }
}
