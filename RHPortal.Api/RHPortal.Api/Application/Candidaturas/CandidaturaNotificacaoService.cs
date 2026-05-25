using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RhPortal.Api.Messaging.WhatsApp;

namespace RhPortal.Api.Application.Candidaturas;

public interface ICandidaturaNotificacaoService
{
    /// <summary>
    /// Dispara notificações (e-mail + WhatsApp, conforme opt-in do candidato) para
    /// uma transição de etapa macro da candidatura. Registra log de auditoria em
    /// <c>NotificacoesCandidaturaLogs</c> para cada canal avaliado — mesmo quando
    /// o envio é pulado por falta de destino ou opt-in.
    /// </summary>
    Task NotificarMudancaEtapaAsync(
        Guid candidaturaId,
        EtapaMacroCandidatura etapaAnterior,
        EtapaMacroCandidatura etapaNova,
        CancellationToken ct);

    /// <summary>
    /// Lista os logs de auditoria de notificação (e-mail + WhatsApp) com filtros opcionais
    /// por candidato, candidatura, canal, status, etapa e intervalo de data. Ordena
    /// sempre por <c>CriadoEmUtc</c> desc. Paginação server-side.
    /// </summary>
    Task<NotificacaoCandidaturaLogsResponse> ListarLogsAsync(
        Guid? candidatoId,
        Guid? candidaturaId,
        CanalNotificacao? canal,
        NotificacaoStatus? status,
        EtapaMacroCandidatura? etapa,
        DateTimeOffset? dataInicioUtc,
        DateTimeOffset? dataFimUtc,
        int page,
        int pageSize,
        CancellationToken ct);
}

public sealed class CandidaturaNotificacaoService : ICandidaturaNotificacaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;
    private readonly IWhatsAppMessageSender _whatsAppSender;
    private readonly ILogger<CandidaturaNotificacaoService> _logger;
    private readonly INotificacaoTemplateService? _templateService;
    private readonly WhatsAppOptions _waOptions;

    /// <summary>Compat: ctor original usado por testes legados; cria WhatsAppOptions com defaults.</summary>
    public CandidaturaNotificacaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IEmailQueueService emailQueue,
        IWhatsAppMessageSender whatsAppSender,
        ILogger<CandidaturaNotificacaoService> logger,
        INotificacaoTemplateService? templateService = null)
        : this(db, tenantContext, emailQueue, whatsAppSender, logger, Options.Create(new WhatsAppOptions()), templateService)
    {
    }

    public CandidaturaNotificacaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IEmailQueueService emailQueue,
        IWhatsAppMessageSender whatsAppSender,
        ILogger<CandidaturaNotificacaoService> logger,
        IOptions<WhatsAppOptions> waOptions,
        INotificacaoTemplateService? templateService = null)
    {
        _db = db;
        _tenantContext = tenantContext;
        _emailQueue = emailQueue;
        _whatsAppSender = whatsAppSender;
        _logger = logger;
        _templateService = templateService;
        _waOptions = waOptions.Value ?? new WhatsAppOptions();
    }

    public async Task NotificarMudancaEtapaAsync(
        Guid candidaturaId,
        EtapaMacroCandidatura etapaAnterior,
        EtapaMacroCandidatura etapaNova,
        CancellationToken ct)
    {
        if (etapaAnterior == etapaNova) return;
        if (etapaNova == EtapaMacroCandidatura.Proposta)
            return;

        var cand = await _db.Candidaturas
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == candidaturaId, ct);
        if (cand is null) return;

        var candidato = await _db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == cand.CandidatoId, ct);
        if (candidato is null) return;

        var pref = await _db.Set<CandidatoNotificacaoPreferencia>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == candidato.Id, ct);

        var vagaTitulo = await _db.Vagas
            .AsNoTracking()
            .Where(v => v.Id == cand.VagaId)
            .Select(v => v.Titulo)
            .FirstOrDefaultAsync(ct);

        var idiomaCandidato = string.IsNullOrWhiteSpace(pref?.Idioma) ? _waOptions.IdiomaDefault : pref!.Idioma;
        var (assuntoEmail, mensagemEmail) = await ResolverTemplateAsync(etapaNova, CanalNotificacao.Email, candidato.Nome, vagaTitulo, idiomaCandidato, ct);
        var (_, mensagemWhats) = await ResolverTemplateAsync(etapaNova, CanalNotificacao.WhatsApp, candidato.Nome, vagaTitulo, idiomaCandidato, ct);
        var now = DateTimeOffset.UtcNow;
        var tenantId = _tenantContext.TenantId ?? "";

        // ── Canal E-mail ──────────────────────────────────────────
        await EnviarEmailComLogAsync(cand, candidato, pref, etapaNova, assuntoEmail ?? "", mensagemEmail, tenantId, now, ct);

        // ── Canal WhatsApp ────────────────────────────────────────
        await EnviarWhatsAppComLogAsync(cand, candidato, pref, etapaNova, mensagemWhats, tenantId, now, ct);

        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Resolve o template efetivo (override do tenant, ou default hardcoded) e aplica
    /// placeholders. Se <see cref="INotificacaoTemplateService"/> não estiver injetado
    /// (testes legados), cai no default hardcoded local.
    /// </summary>
    private async Task<(string? Assunto, string Mensagem)> ResolverTemplateAsync(
        EtapaMacroCandidatura etapa,
        CanalNotificacao canal,
        string? candidatoNome,
        string? vagaTitulo,
        string? idioma,
        CancellationToken ct)
    {
        if (_templateService is not null)
        {
            var ef = await _templateService.GetEfetivoAsync(etapa, canal, idioma, ct);
            var assunto = string.IsNullOrWhiteSpace(ef.Assunto) ? null : NotificacaoTemplateService.ResolverPlaceholders(ef.Assunto, candidatoNome, vagaTitulo);
            var mensagem = NotificacaoTemplateService.ResolverPlaceholders(ef.Corpo, candidatoNome, vagaTitulo);
            return (assunto, mensagem);
        }
        // Fallback legado: template hardcoded in-memory.
        var (a, m) = BuildTemplate(etapa, candidatoNome ?? string.Empty, vagaTitulo ?? "(vaga)");
        return (canal == CanalNotificacao.WhatsApp ? null : a, m);
    }

    private async Task EnviarEmailComLogAsync(
        Candidatura cand,
        Candidato candidato,
        CandidatoNotificacaoPreferencia? pref,
        EtapaMacroCandidatura etapa,
        string assunto,
        string mensagem,
        string tenantId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var emailOptIn = pref?.CanalEmail ?? true; // default = opt-in quando sem preferência
        var email = (pref?.Email ?? candidato.Email)?.Trim();

        if (!emailOptIn)
        {
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.Email, NotificacaoStatus.IgnoradoSemOptIn, email, mensagem, null, tenantId, now));
            return;
        }
        if (string.IsNullOrWhiteSpace(email))
        {
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.Email, NotificacaoStatus.IgnoradoSemDestino, null, mensagem, null, tenantId, now));
            return;
        }

        // ── Onda 12 — Janela de silêncio aplicada ao canal e-mail ─────────────
        // Originalmente (Onda 10) o silêncio só bloqueava WhatsApp. O enum
        // IgnoradoSilencio é canal-agnóstico — e o candidato que configurou
        // "não quero ser notificado entre X e Y" tipicamente quer valer pro
        // e-mail também (push no celular, marca "não lido" etc.).
        // Permanece controlado pela flag global WhatsAppOptions.RespeitarSilencio
        // (nome histórico; nessa revisão ela passa a cobrir ambos os canais).
        if (_waOptions.RespeitarSilencio && EstaDentroSilencio(pref, now, out var silencioDescricao))
        {
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.Email, NotificacaoStatus.IgnoradoSilencio, email, mensagem, silencioDescricao, tenantId, now));
            return;
        }

        try
        {
            var bodyHtml = $"<p>{System.Net.WebUtility.HtmlEncode(mensagem).Replace("\n", "<br />")}</p>";
            await _emailQueue.EnqueueRawAsync(email!, assunto, bodyHtml, mensagem, isSystem: true, source: "candidatura-etapa", ct);
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.Email, NotificacaoStatus.Enviado, email, mensagem, null, tenantId, now));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enfileirar e-mail de etapa {Etapa} para candidatura {CandidaturaId}", etapa, cand.Id);
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.Email, NotificacaoStatus.Falhou, email, mensagem, ex.Message, tenantId, now));
        }
    }

    private async Task EnviarWhatsAppComLogAsync(
        Candidatura cand,
        Candidato candidato,
        CandidatoNotificacaoPreferencia? pref,
        EtapaMacroCandidatura etapa,
        string mensagem,
        string tenantId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var waOptIn = pref?.CanalWhatsapp ?? false; // default = NÃO opt-in enquanto provedor não está configurado
        var telefone = NormalizaTelefoneE164(pref?.Telefone ?? candidato.Fone);

        if (!waOptIn)
        {
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.WhatsApp, NotificacaoStatus.IgnoradoSemOptIn, telefone, mensagem, null, tenantId, now));
            return;
        }
        if (string.IsNullOrWhiteSpace(telefone))
        {
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.WhatsApp, NotificacaoStatus.IgnoradoSemDestino, null, mensagem, null, tenantId, now));
            return;
        }

        // ── Onda 10 — Janela de silêncio ──────────────────────────────────────
        if (_waOptions.RespeitarSilencio && EstaDentroSilencio(pref, now, out var silencioDescricao))
        {
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.WhatsApp, NotificacaoStatus.IgnoradoSilencio, telefone, mensagem, silencioDescricao, tenantId, now));
            return;
        }

        // ── Onda 9 — Rate limit por candidato ─────────────────────────────────
        var maxMensagens = pref?.WhatsAppRateLimitMaxMensagens ?? _waOptions.RateLimitMaxMensagens;
        var janelaMinutos = pref?.WhatsAppRateLimitJanelaMinutos ?? _waOptions.RateLimitJanelaMinutos;
        if (maxMensagens > 0 && janelaMinutos > 0)
        {
            var inicioJanela = now - TimeSpan.FromMinutes(janelaMinutos);
            var enviadasNaJanela = await _db.NotificacoesCandidaturaLogs
                .AsNoTracking()
                .Where(l => l.CandidatoId == candidato.Id
                    && l.Canal == CanalNotificacao.WhatsApp
                    && l.Status == NotificacaoStatus.Enviado
                    && l.CriadoEmUtc >= inicioJanela)
                .CountAsync(ct);
            if (enviadasNaJanela >= maxMensagens)
            {
                var detalhe = $"limit={maxMensagens}/janela={janelaMinutos}min/atingido={enviadasNaJanela}";
                _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.WhatsApp, NotificacaoStatus.IgnoradoRateLimit, telefone, mensagem, detalhe, tenantId, now));
                return;
            }
        }

        try
        {
            var result = await _whatsAppSender.SendAsync(telefone!, mensagem, ct);
            var status = result.Accepted ? NotificacaoStatus.Enviado : NotificacaoStatus.Falhou;
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.WhatsApp, status, telefone, mensagem, result.ErrorMessage, tenantId, now));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enviar WhatsApp de etapa {Etapa} para candidatura {CandidaturaId}", etapa, cand.Id);
            _db.NotificacoesCandidaturaLogs.Add(NovoLog(cand, candidato, etapa, CanalNotificacao.WhatsApp, NotificacaoStatus.Falhou, telefone, mensagem, ex.Message, tenantId, now));
        }
    }

    /// <summary>
    /// Verifica se o instante <paramref name="now"/> cai dentro da janela de silêncio
    /// configurada pelo candidato. Aceita formatos "HH:mm" (ex.: "22:00") em
    /// <c>SilencioInicio</c> e <c>SilencioFim</c>. Janelas que cruzam meia-noite
    /// (ex.: 22:00 → 07:00) são suportadas.
    /// </summary>
    public static bool EstaDentroSilencio(CandidatoNotificacaoPreferencia? pref, DateTimeOffset now, out string descricao)
    {
        descricao = "";
        if (pref is null) return false;
        if (!string.Equals(pref.SilencioAtivo, "true", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(pref.SilencioAtivo, "1", StringComparison.OrdinalIgnoreCase)
            && pref.SilencioAtivo is not null)
        {
            // qualquer outro valor (false/0/"") = silêncio desligado
            if (!string.Equals(pref.SilencioAtivo, "on", StringComparison.OrdinalIgnoreCase))
                return false;
        }
        // Sem SilencioAtivo definido, mas com janelas: ainda assim respeita.
        if (string.IsNullOrWhiteSpace(pref.SilencioInicio) || string.IsNullOrWhiteSpace(pref.SilencioFim))
            return false;

        if (!TryParseHoraMinuto(pref.SilencioInicio, out var inicio) ||
            !TryParseHoraMinuto(pref.SilencioFim, out var fim))
            return false;

        var agora = now.LocalDateTime.TimeOfDay;
        bool dentro;
        if (inicio == fim)
        {
            dentro = false;
        }
        else if (inicio < fim)
        {
            dentro = agora >= inicio && agora < fim;
        }
        else
        {
            // janela cruza meia-noite (ex.: 22:00 → 07:00)
            dentro = agora >= inicio || agora < fim;
        }
        if (dentro)
            descricao = $"silencio={pref.SilencioInicio}-{pref.SilencioFim}";
        return dentro;
    }

    private static bool TryParseHoraMinuto(string? value, out TimeSpan ts)
    {
        ts = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (TimeSpan.TryParse(value, out var parsed))
        {
            ts = parsed;
            return true;
        }
        var parts = value.Split(':', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2 && int.TryParse(parts[0], out var h) && int.TryParse(parts[1], out var m)
            && h >= 0 && h < 24 && m >= 0 && m < 60)
        {
            ts = new TimeSpan(h, m, 0);
            return true;
        }
        return false;
    }

    private static NotificacaoCandidaturaLog NovoLog(
        Candidatura cand,
        Candidato candidato,
        EtapaMacroCandidatura etapa,
        CanalNotificacao canal,
        NotificacaoStatus status,
        string? destino,
        string mensagem,
        string? erro,
        string tenantId,
        DateTimeOffset now) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CandidaturaId = cand.Id,
            CandidatoId = candidato.Id,
            EtapaMacro = etapa,
            Canal = canal,
            Status = status,
            Destino = destino,
            Mensagem = mensagem,
            ErroMensagem = erro,
            CriadoEmUtc = now,
        };

    /// <summary>
    /// Templates em memória — versão MVP. Quando houver UI de editor de templates,
    /// mover para <c>EmailTemplates</c> com uma coluna para canal WhatsApp.
    /// </summary>
    private static (string Assunto, string Mensagem) BuildTemplate(EtapaMacroCandidatura etapa, string nome, string vaga) => etapa switch
    {
        EtapaMacroCandidatura.EmTriagem => (
            $"Sua candidatura para {vaga} está em triagem",
            $"Olá, {nome}!\nSua candidatura para a vaga {vaga} está em triagem. Em breve avaliaremos seu perfil e daremos um retorno."),
        EtapaMacroCandidatura.Entrevista => (
            $"Próximo passo: entrevista para {vaga}",
            $"Olá, {nome}!\nVocê avançou para a etapa de entrevista na vaga {vaga}. Nossa equipe entrará em contato para agendar."),
        EtapaMacroCandidatura.EntrevistaTecnica => (
            $"Próximo passo: entrevista técnica para {vaga}",
            $"Olá, {nome}!\nVocê avançou para a etapa de entrevista técnica na vaga {vaga}. Nossa equipe entrará em contato com os detalhes."),
        EtapaMacroCandidatura.Teste => (
            $"Teste técnico liberado — {vaga}",
            $"Olá, {nome}!\nLiberamos a etapa de testes para a vaga {vaga}. Acompanhe seu e-mail para as instruções."),
        EtapaMacroCandidatura.Proposta => (
            $"Proposta enviada — {vaga}",
            $"Olá, {nome}!\nTemos uma proposta para você na vaga {vaga}. Verifique seu portal ou e-mail para os detalhes."),
        EtapaMacroCandidatura.Contratado => (
            $"Contratação confirmada — {vaga}",
            $"Parabéns, {nome}!\nSua contratação para a vaga {vaga} foi confirmada. Boas-vindas ao time!"),
        EtapaMacroCandidatura.Recusado => (
            $"Atualização sobre sua candidatura — {vaga}",
            $"Olá, {nome}.\nAgradecemos seu interesse na vaga {vaga}, mas seguiremos com outro candidato neste processo. Sucesso na jornada!"),
        EtapaMacroCandidatura.Desistiu => (
            $"Candidatura encerrada — {vaga}",
            $"Olá, {nome}.\nRegistramos sua desistência do processo da vaga {vaga}. Esperamos você em uma próxima oportunidade."),
        _ => (
            $"Atualização da sua candidatura — {vaga}",
            $"Olá, {nome}!\nHouve uma atualização no processo da vaga {vaga}. Acompanhe pelo seu portal."),
    };

    private static string? NormalizaTelefoneE164(string? telefone)
    {
        if (string.IsNullOrWhiteSpace(telefone)) return null;
        var somenteDigitos = new string(telefone.Where(char.IsDigit).ToArray());
        if (somenteDigitos.Length == 0) return null;
        // Heurística simples: se não começar com DDI, assume Brasil (+55).
        return telefone.TrimStart().StartsWith('+') ? "+" + somenteDigitos : "+55" + somenteDigitos;
    }

    public async Task<NotificacaoCandidaturaLogsResponse> ListarLogsAsync(
        Guid? candidatoId,
        Guid? candidaturaId,
        CanalNotificacao? canal,
        NotificacaoStatus? status,
        EtapaMacroCandidatura? etapa,
        DateTimeOffset? dataInicioUtc,
        DateTimeOffset? dataFimUtc,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        // `AppDbContext` já aplica filtro global por `TenantId` em toda `ITenantEntity`.
        var q = _db.NotificacoesCandidaturaLogs.AsNoTracking();

        if (candidatoId is { } cid && cid != Guid.Empty)
            q = q.Where(l => l.CandidatoId == cid);
        if (candidaturaId is { } cdid && cdid != Guid.Empty)
            q = q.Where(l => l.CandidaturaId == cdid);
        if (canal is { } cn) q = q.Where(l => l.Canal == cn);
        if (status is { } st) q = q.Where(l => l.Status == st);
        if (etapa is { } ep) q = q.Where(l => l.EtapaMacro == ep);
        if (dataInicioUtc is { } ini) q = q.Where(l => l.CriadoEmUtc >= ini);
        if (dataFimUtc is { } fim) q = q.Where(l => l.CriadoEmUtc <= fim);

        var total = await q.CountAsync(ct);

        // Join em memória com Candidatos/Vagas/Candidaturas para enriquecer a resposta.
        var pageData = await q
            .OrderByDescending(l => l.CriadoEmUtc)
            .ThenBy(l => l.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                Log = l,
                Candidato = _db.Candidatos.AsNoTracking().Where(c => c.Id == l.CandidatoId)
                    .Select(c => new { c.Nome, c.Email, c.Fone }).FirstOrDefault(),
                Vaga = _db.Candidaturas.AsNoTracking().Where(cd => cd.Id == l.CandidaturaId)
                    .Select(cd => new
                    {
                        cd.VagaId,
                        VagaCodigo = cd.Vaga != null ? cd.Vaga.Codigo : null,
                        VagaTitulo = cd.Vaga != null ? cd.Vaga.Titulo : null,
                    })
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        var items = pageData.Select(row => new NotificacaoCandidaturaLogItem(
            Id: row.Log.Id,
            CandidaturaId: row.Log.CandidaturaId,
            CandidatoId: row.Log.CandidatoId,
            CandidatoNome: row.Candidato?.Nome,
            CandidatoEmail: row.Candidato?.Email,
            CandidatoFone: row.Candidato?.Fone,
            VagaId: row.Vaga?.VagaId,
            VagaCodigo: row.Vaga?.VagaCodigo,
            VagaTitulo: row.Vaga?.VagaTitulo,
            EtapaMacro: row.Log.EtapaMacro,
            Canal: row.Log.Canal,
            Status: row.Log.Status,
            Destino: row.Log.Destino,
            Mensagem: row.Log.Mensagem,
            ErroMensagem: row.Log.ErroMensagem,
            CriadoEmUtc: row.Log.CriadoEmUtc
        )).ToList();

        var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize);

        return new NotificacaoCandidaturaLogsResponse(
            Items: items,
            Total: total,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages);
    }
}
