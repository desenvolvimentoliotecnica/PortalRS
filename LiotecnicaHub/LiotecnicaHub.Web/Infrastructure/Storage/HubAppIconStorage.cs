namespace LiotecnicaHub.Web.Infrastructure.Storage;

public interface IHubAppIconStorage
{
    string UploadsPublicPrefix { get; }
    bool IsManagedPath(string? iconUrl);
    Task<string> SaveAsync(Guid applicationId, IFormFile file, string? previousIconUrl, CancellationToken ct);
    Task RemoveManagedIconAsync(string? iconUrl, CancellationToken ct);
    Task RemoveAllForApplicationAsync(Guid applicationId, CancellationToken ct);
}

public sealed class HubAppIconStorage : IHubAppIconStorage
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".gif"
    };

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/webp", "image/gif"
    };

    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<HubAppIconStorage> _logger;
    private readonly string _uploadRelativePath;
    private readonly long _maxBytes;

    public HubAppIconStorage(
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<HubAppIconStorage> logger)
    {
        _environment = environment;
        _logger = logger;
        _uploadRelativePath = configuration["Hub:AppIconUploadPath"]
            ?? configuration["HUB_APP_ICON_UPLOAD_PATH"]
            ?? "uploads/apps";
        _maxBytes = configuration.GetValue("Hub:AppIconMaxBytes", 2 * 1024 * 1024);
    }

    public string UploadsPublicPrefix => $"/{_uploadRelativePath.Trim('/')}/";

    public bool IsManagedPath(string? iconUrl)
    {
        if (string.IsNullOrWhiteSpace(iconUrl)) return false;
        return iconUrl.StartsWith(UploadsPublicPrefix, StringComparison.OrdinalIgnoreCase);
    }

    public async Task<string> SaveAsync(
        Guid applicationId,
        IFormFile file,
        string? previousIconUrl,
        CancellationToken ct)
    {
        if (file.Length <= 0)
            throw new InvalidOperationException("Selecione um arquivo de imagem válido.");

        if (file.Length > _maxBytes)
            throw new InvalidOperationException($"A imagem deve ter no máximo {_maxBytes / (1024 * 1024)} MB.");

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
            throw new InvalidOperationException("Formato não suportado. Use PNG, JPG, WEBP ou GIF.");

        var contentType = file.ContentType;
        if (!string.IsNullOrWhiteSpace(contentType) && !AllowedContentTypes.Contains(contentType))
            throw new InvalidOperationException("O arquivo enviado não é uma imagem válida.");

        var physicalDir = GetPhysicalDirectory();
        Directory.CreateDirectory(physicalDir);

        await RemoveAllForApplicationAsync(applicationId, ct);
        if (IsManagedPath(previousIconUrl))
            await RemoveManagedIconAsync(previousIconUrl, ct);

        var normalizedExt = extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ? ".jpg" : extension.ToLowerInvariant();
        var fileName = $"{applicationId:D}{normalizedExt}";
        var physicalPath = Path.Combine(physicalDir, fileName);

        await using (var stream = new FileStream(physicalPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(stream, ct);
        }

        var publicPath = $"{UploadsPublicPrefix}{fileName}";
        _logger.LogInformation("Ícone do aplicativo {ApplicationId} salvo em {Path}", applicationId, publicPath);
        return publicPath;
    }

    public Task RemoveManagedIconAsync(string? iconUrl, CancellationToken ct)
    {
        if (!IsManagedPath(iconUrl))
            return Task.CompletedTask;

        var physicalPath = MapToPhysicalPath(iconUrl!);
        if (File.Exists(physicalPath))
        {
            File.Delete(physicalPath);
            _logger.LogInformation("Ícone removido: {Path}", iconUrl);
        }

        return Task.CompletedTask;
    }

    public Task RemoveAllForApplicationAsync(Guid applicationId, CancellationToken ct)
    {
        var physicalDir = GetPhysicalDirectory();
        if (!Directory.Exists(physicalDir))
            return Task.CompletedTask;

        var prefix = applicationId.ToString("D");
        foreach (var path in Directory.EnumerateFiles(physicalDir, $"{prefix}.*"))
        {
            File.Delete(path);
            _logger.LogInformation("Ícone antigo removido: {Path}", path);
        }

        return Task.CompletedTask;
    }

    private string GetPhysicalDirectory() =>
        Path.Combine(_environment.WebRootPath, _uploadRelativePath.Replace('/', Path.DirectorySeparatorChar));

    private string MapToPhysicalPath(string publicPath)
    {
        var relative = publicPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        return Path.Combine(_environment.WebRootPath, relative);
    }
}

public static class HubAppIconStorageSetup
{
    public static void EnsureUploadDirectory(IWebHostEnvironment environment, IConfiguration configuration)
    {
        var relative = configuration["Hub:AppIconUploadPath"]
            ?? configuration["HUB_APP_ICON_UPLOAD_PATH"]
            ?? "uploads/apps";
        var physicalDir = Path.Combine(environment.WebRootPath, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(physicalDir);
    }
}
