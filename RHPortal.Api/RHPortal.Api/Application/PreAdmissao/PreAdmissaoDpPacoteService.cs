using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.PreAdmissao;

public interface IPreAdmissaoDpPacoteService
{
    Task<EnviarPacoteDpResponse?> EnviarAsync(Guid preAdmissaoId, string email, Guid? enviadoPorUserId, CancellationToken ct);
    Task<PacoteDpPublicResponse?> GetPublicAsync(string token, CancellationToken ct);
    Task<PreAdmissaoDocumentoDownloadResult?> GetDocumentoPublicAsync(string token, Guid docId, CancellationToken ct);
    Task<(Stream Stream, string FileName)?> BuildZipPublicAsync(string token, CancellationToken ct);
}

public sealed class PreAdmissaoDpPacoteService : IPreAdmissaoDpPacoteService
{
    private static readonly PreAdmissaoStatus[] StatusPermitidos =
    [
        PreAdmissaoStatus.Aprovada,
        PreAdmissaoStatus.EmIntegracao,
        PreAdmissaoStatus.Integrada,
    ];

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;
    private readonly IS3StorageService _storage;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ICurrentUserContext _currentUser;

    public PreAdmissaoDpPacoteService(
        AppDbContext db,
        ITenantContext tenantContext,
        IEmailQueueService emailQueue,
        IS3StorageService storage,
        IHostEnvironment hostEnvironment,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ICurrentUserContext currentUser)
    {
        _db = db;
        _tenantContext = tenantContext;
        _emailQueue = emailQueue;
        _storage = storage;
        _hostEnvironment = hostEnvironment;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
        _currentUser = currentUser;
    }

    public async Task<EnviarPacoteDpResponse?> EnviarAsync(
        Guid preAdmissaoId,
        string email,
        Guid? enviadoPorUserId,
        CancellationToken ct)
    {
        var emailTrim = email?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(emailTrim) || !emailTrim.Contains('@'))
            throw new InvalidOperationException("Informe um e-mail válido do Departamento Pessoal.");

        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .Include(x => x.Documentos)
            .Include(x => x.JobPosition)
            .Include(x => x.Vaga)
            .FirstOrDefaultAsync(x => x.Id == preAdmissaoId, ct);
        if (pa is null) return null;

        if (!StatusPermitidos.Contains(pa.Status))
            throw new InvalidOperationException("Só é possível enviar o pacote ao DP após a pré-admissão estar aprovada.");

        var now = DateTimeOffset.UtcNow;
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var expira = now.AddDays(7);

        pa.DpAccessToken = token;
        pa.DpTokenExpiraEmUtc = expira;
        pa.DpEnviadoEmUtc = now;
        pa.DpEnviadoParaEmail = emailTrim;
        pa.DpEnviadoPorUserId = enviadoPorUserId ?? _currentUser.UserId;
        pa.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(ct);

        var url = BuildFrontendUrl($"/app/PortalVagas/PacoteDp?token={Uri.EscapeDataString(token)}&tenantId={Uri.EscapeDataString(_tenantContext.TenantId ?? "")}");
        var (assunto, html, text) = MontarEmail(pa, url, expira);
        await _emailQueue.EnqueueRawAsync(
            emailTrim,
            assunto,
            html,
            text,
            isSystem: true,
            source: "pre-admissao-pacote-dp",
            ct);

        return new EnviarPacoteDpResponse(emailTrim, now, expira, url);
    }

    public async Task<PacoteDpPublicResponse?> GetPublicAsync(string token, CancellationToken ct)
    {
        var pa = await FindByTokenAsync(token, ct);
        if (pa is null) return null;
        return MapPublic(pa);
    }

    public async Task<PreAdmissaoDocumentoDownloadResult?> GetDocumentoPublicAsync(
        string token,
        Guid docId,
        CancellationToken ct)
    {
        var pa = await FindByTokenAsync(token, ct);
        if (pa is null) return null;
        if (pa.Documentos.All(d => d.Id != docId)) return null;
        return await DownloadDocAsync(pa.Documentos.First(d => d.Id == docId), ct);
    }

    public async Task<(Stream Stream, string FileName)?> BuildZipPublicAsync(string token, CancellationToken ct)
    {
        var pa = await FindByTokenAsync(token, ct);
        if (pa is null) return null;

        var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var doc in pa.Documentos.OrderBy(d => d.Tipo).ThenBy(d => d.NomeArquivo))
            {
                var download = await DownloadDocAsync(doc, ct);
                if (download is null) continue;

                await using (download.Stream)
                {
                    var entryName = UniqueZipName(usedNames, doc);
                    var entry = zip.CreateEntry(entryName, CompressionLevel.Fastest);
                    await using var entryStream = entry.Open();
                    await download.Stream.CopyToAsync(entryStream, ct);
                }
            }
        }

        ms.Position = 0;
        var safeNome = SanitizeFilePart(pa.Nome);
        return (ms, $"pacote-admissao-{safeNome}-{pa.Id.ToString("N")[..8]}.zip");
    }

    private async Task<Domain.Entities.PreAdmissao?> FindByTokenAsync(string token, CancellationToken ct)
    {
        var t = token?.Trim();
        if (string.IsNullOrWhiteSpace(t)) return null;

        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(x => x.Documentos)
            .Include(x => x.JobPosition)
            .Include(x => x.Vaga)
            .FirstOrDefaultAsync(x => x.DpAccessToken == t, ct);

        if (pa is null) return null;
        if (pa.DpTokenExpiraEmUtc is null || pa.DpTokenExpiraEmUtc.Value < DateTimeOffset.UtcNow)
            return null;
        return pa;
    }

    private async Task<PreAdmissaoDocumentoDownloadResult?> DownloadDocAsync(PreAdmissaoDocumento doc, CancellationToken ct)
    {
        if (PreAdmissaoDocumentoStorage.IsLocal(doc.StoragePath))
        {
            var path = PreAdmissaoDocumentoStorage.TryResolveLocalPath(_hostEnvironment, doc.TenantId, doc.StoragePath);
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var contentType = string.IsNullOrWhiteSpace(doc.ContentType) ? "application/octet-stream" : doc.ContentType;
            return new PreAdmissaoDocumentoDownloadResult(stream, contentType, doc.NomeArquivo);
        }

        try
        {
            var url = _storage.GetPresignedUrl(doc.StoragePath);
            var http = _httpClientFactory.CreateClient();
            var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode) return null;
            var remoteStream = await response.Content.ReadAsStreamAsync(ct);
            var remoteType = response.Content.Headers.ContentType?.MediaType ?? doc.ContentType ?? "application/octet-stream";
            return new PreAdmissaoDocumentoDownloadResult(remoteStream, remoteType, doc.NomeArquivo);
        }
        catch
        {
            return null;
        }
    }

    private PacoteDpPublicResponse MapPublic(Domain.Entities.PreAdmissao pa)
    {
        var endereco = string.Join(", ", new[]
        {
            pa.Logradouro,
            pa.Numero,
            pa.Complemento,
            pa.Bairro,
        }.Where(x => !string.IsNullOrWhiteSpace(x)));

        var cargo = pa.Vaga?.Titulo ?? pa.JobPosition?.Name;

        return new PacoteDpPublicResponse(
            pa.Nome,
            pa.Cpf,
            pa.Rg,
            pa.DataNascimento,
            pa.Email,
            pa.Celular,
            string.IsNullOrWhiteSpace(endereco) ? null : endereco,
            pa.Cidade,
            pa.Uf,
            pa.Cep,
            cargo,
            pa.DataAdmissao,
            pa.Salario,
            pa.BancoCodigo,
            pa.BancoNome,
            string.IsNullOrWhiteSpace(pa.Agencia)
                ? null
                : $"{pa.Agencia}{(string.IsNullOrWhiteSpace(pa.AgenciaDigito) ? "" : "-" + pa.AgenciaDigito)}",
            string.IsNullOrWhiteSpace(pa.Conta)
                ? null
                : $"{pa.Conta}{(string.IsNullOrWhiteSpace(pa.ContaDigito) ? "" : "-" + pa.ContaDigito)}",
            pa.TipoConta?.ToString(),
            pa.PisPasep,
            pa.DpTokenExpiraEmUtc ?? DateTimeOffset.UtcNow,
            pa.Documentos
                .OrderBy(d => d.Tipo)
                .Select(d => new PacoteDpDocumentoItem(
                    d.Id,
                    d.Tipo.ToString(),
                    PreAdmissaoService.TipoDocumentoLabel(d.Tipo),
                    d.NomeArquivo,
                    d.ContentType,
                    d.TamanhoBytes,
                    d.Status.ToString(),
                    d.ObservacaoRh))
                .ToList());
    }

    private static (string Assunto, string Html, string Text) MontarEmail(
        Domain.Entities.PreAdmissao pa,
        string url,
        DateTimeOffset expira)
    {
        var cultura = CultureInfo.GetCultureInfo("pt-BR");
        var nome = WebUtility.HtmlEncode(pa.Nome);
        var cargo = WebUtility.HtmlEncode(pa.Vaga?.Titulo ?? pa.JobPosition?.Name ?? "—");
        var expiraStr = expira.ToLocalTime().ToString("dd/MM/yyyy HH:mm", cultura);
        var docs = pa.Documentos
            .OrderBy(d => d.Tipo)
            .Select(d => $"<li>{WebUtility.HtmlEncode(PreAdmissaoService.TipoDocumentoLabel(d.Tipo))} — {WebUtility.HtmlEncode(d.NomeArquivo)}</li>");

        var salario = pa.Salario.HasValue
            ? pa.Salario.Value.ToString("C", cultura)
            : "—";

        var assunto = $"Pacote de admissão — {pa.Nome}";
        var html = $"""
            <p>Olá,</p>
            <p>Segue o pacote de documentos e dados do candidato aprovado no Portal RH para cadastro nos sistemas legados (ex.: TOTVS RM).</p>
            <h3>Ficha do candidato</h3>
            <ul>
              <li><strong>Nome:</strong> {nome}</li>
              <li><strong>CPF:</strong> {WebUtility.HtmlEncode(pa.Cpf ?? "—")}</li>
              <li><strong>RG:</strong> {WebUtility.HtmlEncode(pa.Rg ?? "—")}</li>
              <li><strong>Nascimento:</strong> {(pa.DataNascimento?.ToString("dd/MM/yyyy", cultura) ?? "—")}</li>
              <li><strong>E-mail:</strong> {WebUtility.HtmlEncode(pa.Email ?? "—")}</li>
              <li><strong>Celular:</strong> {WebUtility.HtmlEncode(pa.Celular ?? "—")}</li>
              <li><strong>Endereço:</strong> {WebUtility.HtmlEncode(string.Join(" / ", new[] { pa.Logradouro, pa.Numero, pa.Bairro, pa.Cidade, pa.Uf, pa.Cep }.Where(x => !string.IsNullOrWhiteSpace(x))))}</li>
              <li><strong>Cargo/vaga:</strong> {cargo}</li>
              <li><strong>Início previsto:</strong> {(pa.DataAdmissao?.ToString("dd/MM/yyyy", cultura) ?? "—")}</li>
              <li><strong>Salário:</strong> {WebUtility.HtmlEncode(salario)}</li>
              <li><strong>Banco:</strong> {WebUtility.HtmlEncode(pa.BancoNome ?? pa.BancoCodigo ?? "—")} · Ag {WebUtility.HtmlEncode(pa.Agencia ?? "—")} · Conta {WebUtility.HtmlEncode(pa.Conta ?? "—")}</li>
              <li><strong>PIS:</strong> {WebUtility.HtmlEncode(pa.PisPasep ?? "—")}</li>
            </ul>
            <h3>Documentos no pacote</h3>
            <ul>{string.Join("", docs)}</ul>
            <p><a href="{WebUtility.HtmlEncode(url)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">Abrir pacote (ficha + ZIP)</a></p>
            <p style="color:#666;font-size:12px;">Link válido até {WebUtility.HtmlEncode(expiraStr)}. Não exige login.</p>
            """;

        var text = $"Pacote de admissão — {pa.Nome}\nAbrir: {url}\nVálido até {expiraStr}";
        return (assunto, html, text);
    }

    private string BuildFrontendUrl(string pathAndQuery)
    {
        var baseUrlOverride = _configuration["Frontend:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(baseUrlOverride))
            return $"{baseUrlOverride.TrimEnd('/')}{pathAndQuery}";

        var port = _configuration.GetValue<int?>("Frontend:Port") ?? 3005;
        var httpCtx = _httpContextAccessor.HttpContext;
        var scheme = httpCtx?.Request.Scheme ?? "http";
        var host = httpCtx?.Request.Host.Host ?? "localhost";
        return $"{scheme}://{host}:{port}{pathAndQuery}";
    }

    private static string UniqueZipName(HashSet<string> used, PreAdmissaoDocumento doc)
    {
        var tipo = SanitizeFilePart(PreAdmissaoService.TipoDocumentoLabel(doc.Tipo));
        var original = SanitizeFilePart(Path.GetFileName(doc.NomeArquivo));
        if (string.IsNullOrWhiteSpace(original)) original = "arquivo";
        var baseName = $"{tipo}_{original}";
        var name = baseName;
        var i = 2;
        while (!used.Add(name))
        {
            var ext = Path.GetExtension(baseName);
            var stem = Path.GetFileNameWithoutExtension(baseName);
            name = $"{stem}_{i}{ext}";
            i++;
        }
        return name;
    }

    private static string SanitizeFilePart(string? value)
    {
        var s = (value ?? "").Trim();
        if (string.IsNullOrEmpty(s)) return "item";
        s = Regex.Replace(s, @"[^\w\.\-]+", "_", RegexOptions.CultureInvariant);
        return s.Length > 80 ? s[..80] : s;
    }
}
