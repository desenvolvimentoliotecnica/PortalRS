using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Owner;

/// <summary>
/// Percorre funcionários do tenant ativo, consulta RM e atualiza <see cref="Funcionario.GestorDiretoId"/>.
/// </summary>
public sealed class TotvsGestorHierarchySyncRunner
{
    private readonly MasterDbContext _masterDb;
    private readonly ITenantContext _tenantContext;
    private readonly AppDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TotvsGestorHierarchySyncRunner> _logger;

    public TotvsGestorHierarchySyncRunner(
        MasterDbContext masterDb,
        ITenantContext tenantContext,
        AppDbContext db,
        ISecretProtector protector,
        IHttpClientFactory httpClientFactory,
        ILogger<TotvsGestorHierarchySyncRunner> logger)
    {
        _masterDb = masterDb;
        _tenantContext = tenantContext;
        _db = db;
        _protector = protector;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task RunAsync(TotvsGestorHierarchyRunHandle handle, CancellationToken ct)
    {
        var tenantId = handle.TenantId;
        handle.AddLine($"Tenant={tenantId}");

        var settings = await _masterDb.TenantTotvsGestorHierarchySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);

        if (settings is null)
        {
            handle.CompleteFailed("Config não encontrada. Salve URL, usuário e senha na aba Gestores RM antes de executar.");
            return;
        }

        var tpl = settings.ConsultaUrlTemplate.Trim();
        if (!tpl.Contains("{CODCOLIGADA}", StringComparison.Ordinal) || !tpl.Contains("{CHAPA}", StringComparison.Ordinal))
        {
            handle.CompleteFailed("URL precisa incluir os placeholders {CODCOLIGADA} e {CHAPA}.");
            return;
        }

        if (string.IsNullOrWhiteSpace(settings.HttpUser) || string.IsNullOrWhiteSpace(settings.PasswordEncrypted))
        {
            handle.CompleteFailed("Usuário HTTP ou senha não configurados.");
            return;
        }

        string pass;
        try
        {
            pass = _protector.Decrypt(settings.PasswordEncrypted)!;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao decriptografar senha Totvs Gestor para {Tenant}", tenantId);
            handle.CompleteFailed("Senha armazenada inválida (regrave a senha).");
            return;
        }

        if (string.IsNullOrWhiteSpace(pass))
        {
            handle.CompleteFailed("Senha HTTP vazia.");
            return;
        }

        _tenantContext.SetTenantId(tenantId);

        var alvos = await _db.Funcionarios
            .AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active
                        && f.MatriculaRm != null
                        && f.MatriculaRm != "")
            .Select(f => new { f.Id, f.MatriculaRm, f.CdnEmpresa })
            .OrderBy(x => x.MatriculaRm)
            .ToListAsync(ct);

        handle.SetTotal(alvos.Count);
        handle.AddLine($"Funcionários com CHAPA: {alvos.Count}. DelayMs={Math.Clamp(settings.DelayMsBetweenRequests, 0, 60_000)}");

        if (alvos.Count == 0)
        {
            handle.AddLine("Nenhum funcionário ativo com MatriculaRm (CHAPA) preenchida.");
            handle.CompleteSuccess();
            return;
        }

        var client = _httpClientFactory.CreateClient("totvsGestorHierarchy");
        var delay = Math.Clamp(settings.DelayMsBetweenRequests, 0, 60_000);
        var defaultCol = Math.Max(1, settings.DefaultCodColigada);
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{settings.HttpUser.Trim()}:{pass}"));

        var i = 0;
        foreach (var row in alvos)
        {
            ct.ThrowIfCancellationRequested();

            var chapaNorm = TotvsGestorHierarchyConsultaParser.NormalizeChapa(row.MatriculaRm);
            if (chapaNorm is null)
                continue;

            var codColigada = ResolveCodColigada(row.CdnEmpresa, defaultCol);
            var url = tpl
                .Replace("{CODCOLIGADA}", codColigada.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal)
                .Replace("{CHAPA}", Uri.EscapeDataString(chapaNorm), StringComparison.Ordinal);

            HttpResponseMessage resp;
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
                resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            }
            catch (Exception ex)
            {
                handle.AddLine($"ERRO HTTP {row.Id} chapa={chapaNorm}: {ex.Message}");
                i++;
                handle.Tick(i);
                await Throttle(delay, ct);
                continue;
            }

            await using var bodyStream = await resp.Content.ReadAsStreamAsync(ct);
            using var reader = new StreamReader(bodyStream);
            var body = await reader.ReadToEndAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                handle.AddLine($"HTTP {(int)resp.StatusCode} chapa={chapaNorm} body={Truncate(body)}");
                i++;
                handle.Tick(i);
                await Throttle(delay, ct);
                continue;
            }

            var parsed = TotvsGestorHierarchyConsultaParser.Parse(body);

            Guid? novoGestorId = null;

            switch (parsed.Kind)
            {
                case TotvsGestorHierarchyConsultaParseKind.SemChefeTopo:
                    novoGestorId = null;
                    handle.AddLine($"TOPO sem chefe RM chapa={chapaNorm}");
                    break;
                case TotvsGestorHierarchyConsultaParseKind.ChefeIdentificado:
                {
                    var gChapa = TotvsGestorHierarchyConsultaParser.NormalizeChapa(parsed.ChefeChapa);
                    if (gChapa is null)
                    {
                        handle.AddLine($"PARSE CHEFE SEM CHAPA chapa_FUNC={chapaNorm} texto={Truncate(parsed.RawChefeSuperiorText)}");
                        i++;
                        handle.Tick(i);
                        await Throttle(delay, ct);
                        continue;
                    }

                    var candidatos = await _db.Funcionarios
                        .AsNoTracking()
                        .Where(f => f.MatriculaRm != null && f.MatriculaRm.Trim() == gChapa)
                        .Select(f => new { f.Id, f.CdnEmpresa })
                        .ToListAsync(ct);

                    Guid? bossId = null;
                    foreach (var c in candidatos)
                    {
                        if (parsed.ChefeColigada is null ||
                            ResolveCodColigada(c.CdnEmpresa, defaultCol) == parsed.ChefeColigada.Value)
                        {
                            bossId = c.Id;
                            break;
                        }
                    }

                    if (bossId is null)
                    {
                        handle.AddLine(
                            $"GESTOR_RM_NAO_LOCALIZADO chapa_sub={chapaNorm} gestor_RM_chapa={gChapa} coligada_RM={parsed.ChefeColigada?.ToString() ?? "?"} nome_RM={Truncate(parsed.ChefeNomeRaw)} — GestorDiretoId não alterado.");
                        i++;
                        handle.Tick(i);
                        await Throttle(delay, ct);
                        continue;
                    }

                    if (bossId.Value == row.Id)
                    {
                        handle.AddLine($"AUTO_GESTOR_IGNORADO chapa={chapaNorm}");
                        i++;
                        handle.Tick(i);
                        await Throttle(delay, ct);
                        continue;
                    }

                    novoGestorId = bossId;
                    handle.AddLine($"OK chapa={chapaNorm} → gestorChapaRM={gChapa} portalGestorId={bossId.Value:D}");
                    break;
                }
                default:
                    handle.AddLine($"PARSE_INCERTO chapa={chapaNorm} raw={Truncate(body)}");
                    i++;
                    handle.Tick(i);
                    await Throttle(delay, ct);
                    continue;
            }

            var emp = await _db.Funcionarios.FirstOrDefaultAsync(f => f.Id == row.Id, ct);
            if (emp is null)
            {
                i++;
                handle.Tick(i);
                await Throttle(delay, ct);
                continue;
            }

            emp.GestorDiretoId = novoGestorId;
            emp.UpdatedAtUtc = DateTimeOffset.UtcNow;
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erro salvando GestorDiretoId para {EmpId}", row.Id);
                handle.AddLine($"SAVE_FAIL id={row.Id}: {ex.Message}");
            }

            i++;
            handle.Tick(i);
            await Throttle(delay, ct);
        }

        handle.AddLine($"Fim — processados={i}");
        handle.CompleteSuccess();
    }

    internal static int ResolveCodColigada(string? cdnEmpresa, int fallback)
    {
        if (string.IsNullOrWhiteSpace(cdnEmpresa))
            return fallback;
        var t = cdnEmpresa.Trim();
        return int.TryParse(t, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) && v > 0 ? v : fallback;
    }

    private static Task Throttle(int ms, CancellationToken ct) =>
        ms <= 0 ? Task.CompletedTask : Task.Delay(ms, ct);

    private static string Truncate(string? s, int max = 240)
    {
        if (string.IsNullOrEmpty(s))
            return "";
        return s.Length <= max ? s.Replace('\r', ' ').Replace('\n', ' ') : s[..max].Replace('\r', ' ').Replace('\n', ' ') + "...";
    }
}
