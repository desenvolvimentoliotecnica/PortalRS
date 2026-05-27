using Microsoft.Extensions.Hosting;

namespace RhPortal.Api.Application.PreAdmissao;

public static class PreAdmissaoDocumentoStorage
{
    private const string LocalPrefix = "local://";

    public static bool IsLocal(string? storagePath)
        => !string.IsNullOrWhiteSpace(storagePath)
            && storagePath.StartsWith(LocalPrefix, StringComparison.OrdinalIgnoreCase);

    public static string BuildStorageFileName(Guid documentId, string? originalName)
    {
        var extension = Path.GetExtension(originalName ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(extension))
        {
            extension = new string(extension
                .Where(c => char.IsLetterOrDigit(c) || c == '.')
                .ToArray());

            if (extension.Length > 12)
                extension = extension[..12];
        }
        else
        {
            extension = string.Empty;
        }

        return $"{documentId:N}{extension}";
    }

    public static string NormalizeFileName(string? fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
            name = "documento";

        return name.Length > 260 ? name[..260] : name;
    }

    public static string GetFolder(IHostEnvironment host, string? tenantId, Guid preAdmissaoId)
        => Path.Combine(
            host.ContentRootPath,
            "App_Data",
            "uploads",
            tenantId ?? string.Empty,
            "pre-admissao",
            preAdmissaoId.ToString("N"));

    public static string BuildLocalStoragePath(Guid preAdmissaoId, string storageFileName)
        => $"{LocalPrefix}pre-admissao/{preAdmissaoId:N}/{storageFileName}";

    public static string? TryResolveLocalPath(IHostEnvironment host, string? tenantId, string? storagePath)
    {
        if (!IsLocal(storagePath)) return null;

        var relative = storagePath![LocalPrefix.Length..]
            .Replace('\\', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries);

        if (relative.Length != 3 || !relative[0].Equals("pre-admissao", StringComparison.OrdinalIgnoreCase))
            return null;

        if (!Guid.TryParseExact(relative[1], "N", out var preAdmissaoId))
            return null;

        var fileName = Path.GetFileName(relative[2]);
        if (string.IsNullOrWhiteSpace(fileName))
            return null;

        return Path.Combine(GetFolder(host, tenantId, preAdmissaoId), fileName);
    }
}
