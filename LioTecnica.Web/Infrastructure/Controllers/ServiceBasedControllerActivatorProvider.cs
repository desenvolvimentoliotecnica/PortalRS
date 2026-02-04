using LioTecnica.Web.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.DependencyInjection;

namespace LioTecnica.Web.Infrastructure.Controllers;

/// <summary>
/// Controller activator provider that resolves explicitly registered controllers (e.g. OwnerController,
/// UnidadesController) from the service provider instead of using ActivatorUtilities, avoiding
/// "Multiple constructors accepting all given argument types" when a controller has many dependencies.
/// </summary>
internal sealed class ServiceBasedControllerActivatorProvider : IControllerActivatorProvider
{
    private static readonly Type[] ResolveFromServiceProvider = { typeof(OwnerController), typeof(UnidadesController) };

    public Func<ControllerContext, object> CreateActivator(ControllerActionDescriptor descriptor)
    {
        ArgumentNullException.ThrowIfNull(descriptor);
        var controllerType = descriptor.ControllerTypeInfo?.AsType()
            ?? throw new ArgumentException("ControllerTypeInfo is null.", nameof(descriptor));

        if (Array.Exists(ResolveFromServiceProvider, t => t == controllerType))
        {
            return context => context.HttpContext.RequestServices.GetRequiredService(controllerType);
        }

        return context => ActivatorUtilities.CreateInstance(context.HttpContext.RequestServices, controllerType);
    }

    public Action<ControllerContext, object>? CreateReleaser(ControllerActionDescriptor descriptor) => null;

    public Func<ControllerContext, object, ValueTask>? CreateAsyncReleaser(ControllerActionDescriptor descriptor) => null;
}
