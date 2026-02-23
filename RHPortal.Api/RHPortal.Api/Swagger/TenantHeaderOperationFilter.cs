using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Swagger;

public sealed class TenantHeaderOperationFilter : IOperationFilter
{
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public TenantHeaderOperationFilter(IStringLocalizer<InfrastructureMessages> localizer)
    {
        _localizer = localizer;
    }

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        operation.Parameters ??= new List<OpenApiParameter>();

        operation.Parameters.Add(new OpenApiParameter
        {
            Name = TenantMiddleware.TenantHeaderName,
            In = ParameterLocation.Header,
            Required = true,
            Description = _localizer["InfrastructureErrors.TenantHeaderDescription"],
            Schema = new OpenApiSchema { Type = "string" }
        });

        operation.Parameters.Add(new OpenApiParameter
        {
            Name = ApiKeyConstants.ApiKeyHeaderName,
            In = ParameterLocation.Header,
            Required = false,
            Description = "API Key for programmatic access (alternative to Bearer token). Use with X-Tenant-Id.",
            Schema = new OpenApiSchema { Type = "string" }
        });
    }
}
