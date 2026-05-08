using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace RhPortal.Api.Infrastructure.Frontend;

public sealed class FrontendPublicUrlBuilder : IFrontendPublicUrlBuilder
{
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public FrontendPublicUrlBuilder(IConfiguration configuration, IHttpContextAccessor httpContextAccessor)
    {
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
    }

    /// <inheritdoc />
    public string BuildAbsoluteUrl(string pathAndQuery)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pathAndQuery);
        if (pathAndQuery[0] != '/')
            pathAndQuery = "/" + pathAndQuery;

        var baseOverride = _configuration["Frontend:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(baseOverride))
            return $"{baseOverride.TrimEnd('/')}{pathAndQuery}";

        var port = _configuration.GetValue<int?>("Frontend:Port") ?? 3000;
        var httpCtx = _httpContextAccessor.HttpContext;
        var scheme = httpCtx?.Request.Scheme ?? "http";
        var host = httpCtx?.Request.Host.Host ?? "localhost";
        return $"{scheme}://{host}:{port}{pathAndQuery}";
    }
}
