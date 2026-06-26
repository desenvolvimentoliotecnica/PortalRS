using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.AdmissaoPortal;

public interface IAdmissaoPortalRhNotificacaoService
{
    /// <summary>
    /// Enfileira e-mail para a analista de RH com checklist dos dados preenchidos pelo candidato.
    /// Ações de auto-save são agrupadas (throttle) para evitar excesso de e-mails.
    /// </summary>
    Task NotifyAtualizacaoAsync(Guid preAdmissaoId, string triggerAction, CancellationToken ct);

    /// <summary>Envia mensagem de atendimento do candidato para a analista de RH responsável.</summary>
    Task<bool> SendAtendimentoAsync(Guid preAdmissaoId, string assunto, string mensagem, CancellationToken ct);
}

public sealed class AdmissaoPortalRhNotificacaoService : IAdmissaoPortalRhNotificacaoService
{
    private static readonly TimeSpan AutoSaveThrottle = TimeSpan.FromMinutes(3);

    private static readonly HashSet<string> ThrottledActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "save_dados",
    };

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;
    private readonly IEmailConfigService _emailConfig;
    private readonly IFrontendPublicUrlBuilder _frontendUrls;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AdmissaoPortalRhNotificacaoService> _logger;

    public AdmissaoPortalRhNotificacaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IEmailQueueService emailQueue,
        IEmailConfigService emailConfig,
        IFrontendPublicUrlBuilder frontendUrls,
        IMemoryCache cache,
        ILogger<AdmissaoPortalRhNotificacaoService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _emailQueue = emailQueue;
        _emailConfig = emailConfig;
        _frontendUrls = frontendUrls;
        _cache = cache;
        _logger = logger;
    }

    public async Task NotifyAtualizacaoAsync(Guid preAdmissaoId, string triggerAction, CancellationToken ct)
    {
        try
        {
            if (ShouldThrottle(preAdmissaoId, triggerAction))
                return;

            var pa = await LoadPreAdmissaoAsync(preAdmissaoId, ct);
            if (pa is null) return;

            var analista = await AdmissaoPortalAnalistaResolver.ResolveAsync(_db, pa.VagaId, pa.CandidatoId, ct);
            var recipient = await ResolveRecipientAsync(analista.Email, preAdmissaoId, ct);
            if (recipient is null)
                return;

            var (toEmail, usedTestFallback) = recipient.Value;

            var vagaTitulo = pa.Vaga?.Titulo ?? pa.JobPosition?.Name ?? "Admissão";
            var actionLabel = DescribeAction(triggerAction);
            var subjectPrefix = usedTestFallback ? "[Sem analista RH] " : string.Empty;
            var subject = $"{subjectPrefix}[Portal Admissão] {pa.Nome} — {actionLabel}";
            var bodyHtml = AdmissaoPortalChecklistEmailBuilder.Build(pa, vagaTitulo, actionLabel, triggerAction, _frontendUrls);

            await _emailQueue.EnqueueRawAsync(
                toEmail,
                subject,
                bodyHtml,
                null,
                isSystem: true,
                source: "admissao-portal-atualizacao",
                ct);

            if (ThrottledActions.Contains(triggerAction))
                SetThrottle(preAdmissaoId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Falha ao enfileirar notificação de admissão portal para PreAdmissao {PreAdmissaoId}",
                preAdmissaoId);
        }
    }

    public async Task<bool> SendAtendimentoAsync(
        Guid preAdmissaoId,
        string assunto,
        string mensagem,
        CancellationToken ct)
    {
        try
        {
            var pa = await LoadPreAdmissaoAsync(preAdmissaoId, ct);
            if (pa is null) return false;

            var analista = await AdmissaoPortalAnalistaResolver.ResolveAsync(_db, pa.VagaId, pa.CandidatoId, ct);
            var recipient = await ResolveRecipientAsync(analista.Email, preAdmissaoId, ct);
            if (recipient is null)
                return false;

            var (toEmail, usedTestFallback) = recipient.Value;

            var vagaTitulo = pa.Vaga?.Titulo ?? pa.JobPosition?.Name ?? "Admissão";
            var painelUrl = _frontendUrls.BuildAbsoluteUrl($"/app/admissao/nova?id={pa.Id}");
            var subjectPrefix = usedTestFallback ? "[Sem analista RH] " : string.Empty;
            var subject = $"{subjectPrefix}[Portal Admissão] Atendimento — {assunto.Trim()}";
            var bodyHtml = $"""
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;max-width:640px;">
                  <p>Olá{(!usedTestFallback && !string.IsNullOrWhiteSpace(analista.Nome) ? $" <b>{WebUtility.HtmlEncode(analista.Nome)}</b>" : "")},</p>
                  <p>O candidato <b>{WebUtility.HtmlEncode(pa.Nome)}</b> solicitou atendimento pelo portal de admissão.</p>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;">
                    <tr><td style="padding:12px 16px;"><strong>Vaga:</strong> {WebUtility.HtmlEncode(vagaTitulo)}</td></tr>
                    <tr><td style="padding:0 16px 12px;"><strong>Assunto:</strong> {WebUtility.HtmlEncode(assunto.Trim())}</td></tr>
                    <tr><td style="padding:0 16px 12px;"><strong>E-mail do candidato:</strong> {WebUtility.HtmlEncode(pa.Email ?? "—")}</td></tr>
                    <tr><td style="padding:0 16px 12px;"><strong>Telefone:</strong> {WebUtility.HtmlEncode(pa.Celular ?? pa.Telefone ?? "—")}</td></tr>
                  </table>
                  <p style="font-weight:bold;margin-bottom:8px;">Mensagem:</p>
                  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;white-space:pre-wrap;">{WebUtility.HtmlEncode(mensagem.Trim())}</div>
                  <p style="margin:24px 0;">
                    <a href="{WebUtility.HtmlEncode(painelUrl)}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                      Abrir admissão no portal RH
                    </a>
                  </p>
                </div>
                """;

            await _emailQueue.EnqueueRawAsync(
                toEmail,
                subject,
                bodyHtml,
                mensagem.Trim(),
                isSystem: true,
                source: "admissao-portal-atendimento",
                ct);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Falha ao enfileirar atendimento de admissão portal para PreAdmissao {PreAdmissaoId}",
                preAdmissaoId);
            return false;
        }
    }

    private bool ShouldThrottle(Guid preAdmissaoId, string triggerAction)
    {
        if (!ThrottledActions.Contains(triggerAction))
            return false;

        var key = CacheKey(preAdmissaoId);
        return _cache.TryGetValue(key, out _);
    }

    private void SetThrottle(Guid preAdmissaoId)
        => _cache.Set(CacheKey(preAdmissaoId), true, AutoSaveThrottle);

    private string CacheKey(Guid preAdmissaoId)
        => $"admissao-portal-rh-email:{_tenantContext.TenantId}:{preAdmissaoId}";

    /// <summary>
    /// Resolve o destinatário da notificação. Quando não há analista RH, usa o e-mail de teste SMTP
    /// (modo homologação) para que o redirecionamento global continue funcionando em UAT.
    /// </summary>
    private async Task<(string Email, bool UsedTestFallback)?> ResolveRecipientAsync(
        string? analistaEmail,
        Guid preAdmissaoId,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(analistaEmail))
            return (analistaEmail.Trim(), false);

        var cfg = await _emailConfig.GetDecryptedAsync(ct);
        if (cfg?.SmtpUseTestRedirect == true && !string.IsNullOrWhiteSpace(cfg.SmtpTestRedirectAddress))
        {
            _logger.LogWarning(
                "Analista RH não encontrada para PreAdmissao {PreAdmissaoId}; enviando para e-mail de teste SMTP {TestEmail}",
                preAdmissaoId,
                cfg.SmtpTestRedirectAddress.Trim());
            return (cfg.SmtpTestRedirectAddress.Trim(), true);
        }

        _logger.LogWarning(
            "Notificação portal admissão ignorada: analista RH não encontrada para PreAdmissao {PreAdmissaoId}",
            preAdmissaoId);
        return null;
    }

    private async Task<Domain.Entities.PreAdmissao?> LoadPreAdmissaoAsync(Guid preAdmissaoId, CancellationToken ct)
        => await _db.Set<Domain.Entities.PreAdmissao>()
            .AsNoTracking()
            .Include(x => x.Documentos)
            .Include(x => x.DocumentosSolicitados)
            .Include(x => x.Dependentes)
            .Include(x => x.Vaga)
            .Include(x => x.JobPosition)
            .Include(x => x.CentroCusto)
            .FirstOrDefaultAsync(x => x.Id == preAdmissaoId, ct);

    private static string DescribeAction(string triggerAction) => triggerAction switch
    {
        "save_dados" => "atualizou dados no formulário",
        "submit" => "finalizou o preenchimento",
        "upload_doc" => "enviou um documento",
        "delete_doc" => "removeu um documento",
        "add_dependente" => "cadastrou um dependente",
        "update_dependente" => "atualizou um dependente",
        "remove_dependente" => "removeu um dependente",
        _ => "atualizou o formulário de admissão",
    };
}

internal static class AdmissaoPortalChecklistEmailBuilder
{
    public static string Build(
        Domain.Entities.PreAdmissao pa,
        string vagaTitulo,
        string actionLabel,
        string triggerAction,
        IFrontendPublicUrlBuilder frontendUrls)
    {
        var sb = new StringBuilder();
        var painelUrl = frontendUrls.BuildAbsoluteUrl($"/app/admissao/nova?id={pa.Id}");
        var progresso = pa.WizardCompletionPercent.HasValue ? $"{pa.WizardCompletionPercent}%" : "—";
        var etapa = WizardStepLabel(pa.WizardCurrentStep);

        sb.Append($"""
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;max-width:720px;">
              <p>Olá,</p>
              <p>O candidato <strong>{Esc(pa.Nome)}</strong> <strong>{Esc(actionLabel)}</strong> no portal de admissão.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;">
                <tr><td style="padding:12px 16px;"><strong>Vaga:</strong> {Esc(vagaTitulo)}</td></tr>
                <tr><td style="padding:0 16px 12px;"><strong>Progresso:</strong> {Esc(progresso)} — etapa {Esc(etapa)}</td></tr>
                <tr><td style="padding:0 16px 12px;"><strong>Status:</strong> {Esc(StatusLabel(pa.Status))}</td></tr>
              </table>
              <p style="margin:20px 0 8px;font-size:15px;"><strong>Checklist — dados preenchidos</strong></p>
            """);

        AppendSection(sb, "Dados pessoais", new (string Label, string? Value)[]
        {
            ("Nome completo", pa.Nome),
            ("Nome social", pa.NomeSocial),
            ("CPF", FormatCpf(pa.Cpf)),
            ("RG", pa.Rg),
            ("Órgão expedidor / UF", JoinNonEmpty(pa.RgOrgaoExpedidor, pa.RgUfExpedidor, " / ")),
            ("Data expedição RG", FormatDate(pa.RgDataExpedicao)),
            ("Data de nascimento", FormatDate(pa.DataNascimento)),
            ("Sexo", EnumLabel<Sexo>((int)pa.Sexo)),
            ("Estado civil", EnumLabel<EstadoCivil>((int)pa.EstadoCivil)),
            ("Nacionalidade", pa.Nacionalidade),
            ("Nome da mãe", pa.NomeMae),
            ("Nome do pai", pa.NomePai),
            ("Naturalidade", JoinNonEmpty(pa.NaturalCidade, pa.NaturalUf, "/")),
        });

        AppendSection(sb, "Endereço e contato", new (string Label, string? Value)[]
        {
            ("CEP", pa.Cep),
            ("Logradouro", pa.Logradouro),
            ("Número", pa.Numero),
            ("Complemento", pa.Complemento),
            ("Bairro", pa.Bairro),
            ("Cidade / UF", JoinNonEmpty(pa.Cidade, pa.Uf, "/")),
            ("E-mail", pa.Email),
            ("Celular", FormatPhone(pa.DddTelefone, pa.Celular)),
            ("Telefone", FormatPhone(pa.DddTelContato, pa.Telefone)),
            ("Contato de emergência", JoinNonEmpty(pa.ContatoEmergenciaNome, pa.ContatoEmergenciaFone, " — ")),
        });

        AppendSection(sb, "Informações bancárias", new (string Label, string? Value)[]
        {
            ("Banco", JoinNonEmpty(pa.BancoCodigo, pa.BancoNome, " — ")),
            ("Agência", JoinNonEmpty(pa.Agencia, pa.AgenciaDigito, "-")),
            ("Conta", JoinNonEmpty(pa.Conta, pa.ContaDigito, "-")),
            ("Tipo de conta", pa.TipoConta.HasValue ? EnumLabel<TipoContaBancaria>((int)pa.TipoConta.Value) : null),
        });

        AppendDocumentosSection(sb, pa);
        AppendDependentesSection(sb, pa);

        sb.Append($"""
              <p style="margin:24px 0;">
                <a href="{EscAttr(painelUrl)}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                  Abrir admissão no portal RH
                </a>
              </p>
              <p style="color:#6b7280;font-size:12px;">
                Notificação automática — ação: {Esc(triggerAction)} · {DateTimeOffset.UtcNow:dd/MM/yyyy HH:mm} UTC
              </p>
            </div>
            """);

        return sb.ToString();
    }

    private static void AppendSection(StringBuilder sb, string title, IEnumerable<(string Label, string? Value)> items)
    {
        sb.Append($"""<p style="margin:18px 0 6px;font-weight:bold;color:#374151;">{Esc(title)}</p>""");
        sb.Append("""<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">""");
        foreach (var (label, value) in items)
            AppendRow(sb, label, value);
        sb.Append("</table>");
    }

    private static void AppendRow(StringBuilder sb, string label, string? value)
    {
        var filled = !string.IsNullOrWhiteSpace(value);
        var icon = filled ? "✅" : "⬜";
        var display = filled ? Esc(value!) : "<span style=\"color:#9ca3af;\">Não informado</span>";
        sb.Append($"""
            <tr>
              <td style="width:28px;padding:4px 8px 4px 0;vertical-align:top;">{icon}</td>
              <td style="padding:4px 0;vertical-align:top;"><strong>{Esc(label)}:</strong> {display}</td>
            </tr>
            """);
    }

    private static void AppendDocumentosSection(StringBuilder sb, Domain.Entities.PreAdmissao pa)
    {
        sb.Append("""<p style="margin:18px 0 6px;font-weight:bold;color:#374151;">Documentos</p>""");
        sb.Append("""<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">""");

        if (pa.DocumentosSolicitados.Count == 0)
        {
            sb.Append("""<tr><td style="color:#9ca3af;padding:4px 0;">Nenhum documento solicitado configurado.</td></tr>""");
        }
        else
        {
            foreach (var ds in pa.DocumentosSolicitados.OrderBy(d => d.TipoDocumento))
            {
                var label = PreAdmissaoService.TipoDocumentoLabel(ds.TipoDocumento);
                var enviado = pa.Documentos.Any(d => d.Tipo == ds.TipoDocumento);
                var suffix = ds.Obrigatorio ? " (obrigatório)" : "";
                AppendRow(sb, label + suffix, enviado ? "Enviado" : null);
            }
        }

        sb.Append("</table>");
    }

    private static void AppendDependentesSection(StringBuilder sb, Domain.Entities.PreAdmissao pa)
    {
        sb.Append("""<p style="margin:18px 0 6px;font-weight:bold;color:#374151;">Dependentes</p>""");
        sb.Append("""<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">""");

        if (pa.Dependentes.Count == 0)
        {
            AppendRow(sb, "Dependentes cadastrados", null);
        }
        else
        {
            var idx = 1;
            foreach (var dep in pa.Dependentes.OrderBy(d => d.NomeCompleto))
            {
                var pcd = dep.IsPcd ? " — PCD" : "";
                var info = $"{dep.NomeCompleto} ({EnumLabel<Parentesco>((int)dep.Parentesco)}){pcd}";
                AppendRow(sb, $"Dependente {idx++}", info);
            }
        }

        sb.Append("</table>");
    }

    private static string WizardStepLabel(int? step) => step switch
    {
        0 => "Boas-vindas",
        1 => "Dados Pessoais",
        2 => "Dados Gerais",
        3 => "Documentos",
        4 => "Informações Bancárias",
        5 => "Revisão",
        6 => "Conclusão",
        _ => "—",
    };

    private static string StatusLabel(PreAdmissaoStatus status) => status switch
    {
        PreAdmissaoStatus.Enviado => "Link enviado",
        PreAdmissaoStatus.Acessado => "Candidato acessou",
        PreAdmissaoStatus.PreenchidoParcial => "Preenchimento parcial",
        PreAdmissaoStatus.Preenchido => "Preenchimento concluído",
        _ => status.ToString(),
    };

    private static string? FormatDate(DateOnly? date)
        => date?.ToString("dd/MM/yyyy");

    private static string? FormatCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return cpf;
        return $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}";
    }

    private static string? FormatPhone(int? ddd, string? number)
    {
        if (string.IsNullOrWhiteSpace(number)) return null;
        return ddd.HasValue ? $"({ddd}) {number}" : number;
    }

    private static string? JoinNonEmpty(string? a, string? b, string separator)
    {
        var parts = new[] { a?.Trim(), b?.Trim() }.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
        return parts.Length == 0 ? null : string.Join(separator, parts);
    }

    private static string EnumLabel<TEnum>(int value) where TEnum : struct, Enum
    {
        if (!Enum.IsDefined(typeof(TEnum), value))
            return "—";

        var name = Enum.GetName(typeof(TEnum), value) ?? "—";
        return name switch
        {
            "NaoInformado" => "—",
            "UniaoEstavel" => "União estável",
            "ContaCorrente" => "Conta corrente",
            "ContaPoupanca" => "Conta poupança",
            "ContaSalario" => "Conta salário",
            _ => HumanizeEnumName(name),
        };
    }

    private static string HumanizeEnumName(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var sb = new StringBuilder(name.Length + 8);
        foreach (var ch in name)
        {
            if (char.IsUpper(ch) && sb.Length > 0)
                sb.Append(' ');
            sb.Append(sb.Length == 0 ? char.ToUpper(ch) : char.ToLower(ch));
        }
        return sb.ToString();
    }

    private static string Esc(string? value)
        => WebUtility.HtmlEncode(value ?? string.Empty);

    private static string EscAttr(string value)
        => WebUtility.HtmlEncode(value);
}
