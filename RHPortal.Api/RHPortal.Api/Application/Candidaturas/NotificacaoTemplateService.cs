using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Candidaturas;

public interface INotificacaoTemplateService
{
    /// <summary>
    /// Devolve os defaults hardcoded (em memória) para uma combinação etapa × canal.
    /// Usado como fallback quando não há override no banco.
    /// </summary>
    (string? Assunto, string Corpo) GetDefault(EtapaMacroCandidatura etapa, CanalNotificacao canal);

    /// <summary>
    /// Devolve o template efetivo (override do banco, ou default). Nunca retorna null.
    /// </summary>
    Task<NotificacaoTemplateEfetivo> GetEfetivoAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, CancellationToken ct);

    /// <summary>
    /// Devolve o template efetivo, preferindo override no idioma <paramref name="idioma"/>.
    /// Fallback: override no idioma null → default hardcoded. Nunca retorna null.
    /// </summary>
    Task<NotificacaoTemplateEfetivo> GetEfetivoAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, string? idioma, CancellationToken ct);

    /// <summary>
    /// Lista a matriz completa (7 etapas × 2 canais = 14 linhas), cada linha indicando
    /// se o tenant tem override ou está usando o default hardcoded.
    /// </summary>
    Task<IReadOnlyList<NotificacaoTemplateItem>> ListarMatrizAsync(CancellationToken ct);

    /// <summary>
    /// Salva (upsert) um template. Se <paramref name="corpo"/> for igual ao default hardcoded
    /// e <paramref name="assunto"/> também, remove o override (volta ao default).
    /// Idempotente.
    /// </summary>
    Task<NotificacaoTemplateItem> SaveAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, string? assunto, string corpo, CancellationToken ct);

    /// <summary>
    /// Remove o override de uma combinação etapa × canal (volta ao default hardcoded).
    /// Idempotente — não falha se já não havia override.
    /// </summary>
    Task RestoreDefaultAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, CancellationToken ct);
}

public sealed record NotificacaoTemplateEfetivo(
    EtapaMacroCandidatura Etapa,
    CanalNotificacao Canal,
    string? Assunto,
    string Corpo,
    bool UsaDefault);

public sealed class NotificacaoTemplateService : INotificacaoTemplateService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;

    // Todas as etapas que disparam notificação em AvancarEtapa. "Aplicada" é o
    // estado inicial e não dispara notificação — excluímos da matriz do editor.
    private static readonly EtapaMacroCandidatura[] EtapasEditaveis =
    {
        EtapaMacroCandidatura.EmTriagem,
        EtapaMacroCandidatura.Entrevista,
        EtapaMacroCandidatura.EntrevistaTecnica,
        EtapaMacroCandidatura.Teste,
        EtapaMacroCandidatura.Proposta,
        EtapaMacroCandidatura.Contratado,
        EtapaMacroCandidatura.Recusado,
        EtapaMacroCandidatura.Desistiu,
    };

    private static readonly CanalNotificacao[] CanaisEditaveis =
    {
        CanalNotificacao.Email,
        CanalNotificacao.WhatsApp,
    };

    public NotificacaoTemplateService(AppDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public (string? Assunto, string Corpo) GetDefault(EtapaMacroCandidatura etapa, CanalNotificacao canal)
    {
        var (assunto, corpo) = BuildDefaultTemplate(etapa);
        if (canal == CanalNotificacao.WhatsApp)
        {
            // WhatsApp não tem assunto. Mensagem é a mesma base.
            return (null, corpo);
        }
        return (assunto, corpo);
    }

    public Task<NotificacaoTemplateEfetivo> GetEfetivoAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, CancellationToken ct)
        => GetEfetivoAsync(etapa, canal, idioma: null, ct);

    public async Task<NotificacaoTemplateEfetivo> GetEfetivoAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, string? idioma, CancellationToken ct)
    {
        var idiomaNorm = string.IsNullOrWhiteSpace(idioma) ? null : idioma.Trim();

        // Prefere override por idioma exato; depois override sem idioma (default por canal); depois hardcoded.
        var overrides = await _db.NotificacoesTemplates
            .AsNoTracking()
            .Where(t => t.Etapa == etapa && t.Canal == canal && (t.Idioma == idiomaNorm || t.Idioma == null))
            .ToListAsync(ct);

        var match = overrides.FirstOrDefault(t => t.Idioma == idiomaNorm)
                    ?? overrides.FirstOrDefault(t => t.Idioma == null);

        if (match is not null)
        {
            return new NotificacaoTemplateEfetivo(etapa, canal,
                canal == CanalNotificacao.WhatsApp ? null : match.Assunto,
                match.Corpo,
                UsaDefault: false);
        }

        var def = GetDefault(etapa, canal);
        return new NotificacaoTemplateEfetivo(etapa, canal, def.Assunto, def.Corpo, UsaDefault: true);
    }

    public async Task<IReadOnlyList<NotificacaoTemplateItem>> ListarMatrizAsync(CancellationToken ct)
    {
        var overrides = await _db.NotificacoesTemplates
            .AsNoTracking()
            .ToListAsync(ct);

        var lookup = overrides.ToDictionary(o => (o.Etapa, o.Canal));

        var list = new List<NotificacaoTemplateItem>(EtapasEditaveis.Length * CanaisEditaveis.Length);

        foreach (var etapa in EtapasEditaveis)
        {
            foreach (var canal in CanaisEditaveis)
            {
                if (lookup.TryGetValue((etapa, canal), out var ov))
                {
                    list.Add(new NotificacaoTemplateItem(
                        Etapa: etapa,
                        Canal: canal,
                        Assunto: canal == CanalNotificacao.WhatsApp ? null : ov.Assunto,
                        Corpo: ov.Corpo,
                        UsaDefault: false,
                        AtualizadoEmUtc: ov.UpdatedAtUtc));
                }
                else
                {
                    var def = GetDefault(etapa, canal);
                    list.Add(new NotificacaoTemplateItem(
                        Etapa: etapa,
                        Canal: canal,
                        Assunto: def.Assunto,
                        Corpo: def.Corpo,
                        UsaDefault: true,
                        AtualizadoEmUtc: null));
                }
            }
        }

        return list;
    }

    public async Task<NotificacaoTemplateItem> SaveAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, string? assunto, string corpo, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(corpo))
            throw new InvalidOperationException("Corpo do template não pode ser vazio.");
        if (corpo.Length > 4000)
            throw new InvalidOperationException("Corpo do template excede 4000 caracteres.");
        if (!string.IsNullOrWhiteSpace(assunto) && assunto.Length > 240)
            throw new InvalidOperationException("Assunto excede 240 caracteres.");

        var assuntoNormalizado = canal == CanalNotificacao.WhatsApp ? null : (string.IsNullOrWhiteSpace(assunto) ? null : assunto.Trim());
        var corpoNormalizado = corpo.Trim();

        var def = GetDefault(etapa, canal);
        // Se o usuário salvou valores iguais ao default → remove override (volta ao default).
        if (corpoNormalizado == def.Corpo
            && string.Equals(assuntoNormalizado ?? "", def.Assunto ?? "", StringComparison.Ordinal))
        {
            await RestoreDefaultAsync(etapa, canal, ct);
            return new NotificacaoTemplateItem(etapa, canal,
                canal == CanalNotificacao.WhatsApp ? null : def.Assunto,
                def.Corpo, UsaDefault: true, AtualizadoEmUtc: null);
        }

        var entity = await _db.NotificacoesTemplates
            .AsTracking()
            .FirstOrDefaultAsync(t => t.Etapa == etapa && t.Canal == canal, ct);

        var now = DateTimeOffset.UtcNow;
        if (entity is null)
        {
            entity = new NotificacaoTemplate
            {
                Id = Guid.NewGuid(),
                TenantId = _tenant.TenantId ?? string.Empty,
                Etapa = etapa,
                Canal = canal,
                Assunto = assuntoNormalizado,
                Corpo = corpoNormalizado,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            };
            _db.NotificacoesTemplates.Add(entity);
        }
        else
        {
            entity.Assunto = assuntoNormalizado;
            entity.Corpo = corpoNormalizado;
            entity.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);

        return new NotificacaoTemplateItem(etapa, canal,
            canal == CanalNotificacao.WhatsApp ? null : assuntoNormalizado,
            corpoNormalizado, UsaDefault: false, AtualizadoEmUtc: entity.UpdatedAtUtc);
    }

    public async Task RestoreDefaultAsync(EtapaMacroCandidatura etapa, CanalNotificacao canal, CancellationToken ct)
    {
        var entity = await _db.NotificacoesTemplates
            .AsTracking()
            .FirstOrDefaultAsync(t => t.Etapa == etapa && t.Canal == canal, ct);
        if (entity is null) return;
        _db.NotificacoesTemplates.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Templates default in-memory — mantidos aqui para ter uma fonte única de verdade.
    /// Placeholders: <c>{candidatoNome}</c>, <c>{vagaTitulo}</c>.
    /// </summary>
    private static (string Assunto, string Corpo) BuildDefaultTemplate(EtapaMacroCandidatura etapa) => etapa switch
    {
        EtapaMacroCandidatura.EmTriagem => (
            "Sua candidatura para {vagaTitulo} está em triagem",
            "Olá, {candidatoNome}!\nSua candidatura para a vaga {vagaTitulo} está em triagem. Em breve avaliaremos seu perfil e daremos um retorno."),
        EtapaMacroCandidatura.Entrevista => (
            "Próximo passo: entrevista para {vagaTitulo}",
            "Olá, {candidatoNome}!\nVocê avançou para a etapa de entrevista na vaga {vagaTitulo}. Nossa equipe entrará em contato para agendar."),
        EtapaMacroCandidatura.EntrevistaTecnica => (
            "Próximo passo: entrevista técnica para {vagaTitulo}",
            "Olá, {candidatoNome}!\nVocê avançou para a etapa de entrevista técnica na vaga {vagaTitulo}. Nossa equipe entrará em contato com os detalhes."),
        EtapaMacroCandidatura.Teste => (
            "Teste técnico liberado — {vagaTitulo}",
            "Olá, {candidatoNome}!\nLiberamos a etapa de testes para a vaga {vagaTitulo}. Acompanhe seu e-mail para as instruções."),
        EtapaMacroCandidatura.Proposta => (
            "Proposta enviada — {vagaTitulo}",
            "Olá, {candidatoNome}!\nTemos uma proposta para você na vaga {vagaTitulo}. Verifique seu portal ou e-mail para os detalhes."),
        EtapaMacroCandidatura.Contratado => (
            "Contratação confirmada — {vagaTitulo}",
            "Parabéns, {candidatoNome}!\nSua contratação para a vaga {vagaTitulo} foi confirmada. Boas-vindas ao time!"),
        EtapaMacroCandidatura.Recusado => (
            "Atualização sobre sua candidatura — {vagaTitulo}",
            "Olá, {candidatoNome}.\nAgradecemos seu interesse na vaga {vagaTitulo}, mas seguiremos com outro candidato neste processo. Sucesso na jornada!"),
        EtapaMacroCandidatura.Desistiu => (
            "Candidatura encerrada — {vagaTitulo}",
            "Olá, {candidatoNome}.\nRegistramos sua desistência do processo da vaga {vagaTitulo}. Esperamos você em uma próxima oportunidade."),
        _ => (
            "Atualização da sua candidatura — {vagaTitulo}",
            "Olá, {candidatoNome}!\nHouve uma atualização no processo da vaga {vagaTitulo}. Acompanhe pelo seu portal."),
    };

    /// <summary>
    /// Substitui placeholders <c>{candidatoNome}</c> / <c>{vagaTitulo}</c> em um texto.
    /// Usado por <see cref="CandidaturaNotificacaoService"/>.
    /// </summary>
    public static string ResolverPlaceholders(string template, string? candidatoNome, string? vagaTitulo)
    {
        return template
            .Replace("{candidatoNome}", candidatoNome ?? string.Empty)
            .Replace("{vagaTitulo}", vagaTitulo ?? "(vaga)");
    }
}
