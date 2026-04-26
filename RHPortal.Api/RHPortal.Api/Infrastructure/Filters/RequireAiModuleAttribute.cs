using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Filters;

/// <summary>
/// Filtro que bloqueia o request com <c>503 Service Unavailable</c> +
/// <c>ProblemDetails</c> quando o módulo <c>"ai"</c> está desabilitado para
/// o tenant atual (gerenciado pelo Owner via <c>TenantModule</c>).
///
/// <para>
/// Use em controllers/actions que invocam IA fora do <see cref="IUnifiedAiService"/>
/// (que já faz o gating internamente), tipicamente os endpoints do
/// <see cref="Controllers.AssistenteIaController"/> que chamam
/// <c>IOllamaClient</c> direto.
/// </para>
///
/// <para>
/// Owner/system não passa pelo gating (não tem "tenant" para checar).
/// </para>
///
/// <para>Fase 5 LLM-agnóstico — LUC-117 estendido (2026-04-26).</para>
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireAiModuleAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var resolver = context.HttpContext.RequestServices.GetRequiredService<ITenantAiSettingsResolver>();
        var tenantContext = context.HttpContext.RequestServices.GetRequiredService<ITenantContext>();

        if (!await resolver.IsAiEnabledAsync(context.HttpContext.RequestAborted))
        {
            var tenantId = tenantContext.TenantId ?? "?";
            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "IA desabilitada para este tenant",
                Detail = $"O módulo de IA está desabilitado para o tenant '{tenantId}'. Contate o owner da plataforma.",
                Type = "https://docs.renderrh.qualiit/ai/unavailable",
                Extensions =
                {
                    ["reason"] = AiUnavailableReason.ModuleDisabled.ToString(),
                    ["tenantId"] = tenantId,
                }
            };
            context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status503ServiceUnavailable };
            return;
        }

        await next();
    }
}
