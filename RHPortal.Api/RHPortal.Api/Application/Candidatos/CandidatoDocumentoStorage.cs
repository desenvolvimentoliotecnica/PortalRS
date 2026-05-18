using Microsoft.Extensions.Hosting;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Candidatos;

public static class CandidatoDocumentoStorage
{
    public static string GetCandidateFolder(IHostEnvironment host, ITenantContext tenant, Guid candidatoId)
        => Path.Combine(
            host.ContentRootPath,
            "App_Data",
            "uploads",
            tenant.TenantId ?? "",
            "candidatos",
            candidatoId.ToString("N"));

    public static bool ExistsOnDisk(IHostEnvironment host, ITenantContext tenant, Guid candidatoId, CandidatoDocumento doc)
    {
        if (string.IsNullOrWhiteSpace(doc.StorageFileName))
            return false;

        var path = Path.Combine(GetCandidateFolder(host, tenant, candidatoId), doc.StorageFileName);
        return File.Exists(path);
    }

    public static string BuildRhDownloadUrl(Guid candidatoId, Guid documentoId)
        => $"/api/candidatos/{candidatoId}/documentos/{documentoId}/download";
}
