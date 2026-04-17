using Microsoft.EntityFrameworkCore;
using Npgsql;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Infrastructure.Scheduling;

/// <summary>
/// BackgroundService que percorre etapas de aprovação pendentes e dispara
/// lembretes/escalações conforme o SLA configurado por tenant ou por etapa.
///
/// - Após SlaAprovacaoHoras sem ação: envia lembrete ao aprovador.
/// - Após SlaEscalacaoHoras sem ação: escala ao gestor do aprovador.
/// Roda a cada 1 hora.
/// </summary>
public sealed class ApprovalReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ApprovalReminderService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    public ApprovalReminderService(IServiceScopeFactory scopeFactory, ILogger<ApprovalReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (ObjectDisposedException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ApprovalReminderService batch failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        List<string> tenantIds;
        using (var masterScope = _scopeFactory.CreateScope())
        {
            var masterDb = masterScope.ServiceProvider.GetRequiredService<MasterDbContext>();
            tenantIds = await masterDb.Tenants
                .AsNoTracking()
                .Where(t => t.IsActive)
                .Select(t => t.TenantId)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            try
            {
                await ProcessTenantAsync(tenantId, ct);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                _logger.LogWarning(
                    "Tenant {TenantId}: schema missing (SolicitacoesAprovacaoEtapa). Run migrations.",
                    tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ApprovalReminderService failed for tenant {TenantId}.", tenantId);
            }
        }
    }

    private async Task ProcessTenantAsync(string tenantId, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tenantId);

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var emailQueue = scope.ServiceProvider.GetRequiredService<IEmailQueueService>();
        var notifications = scope.ServiceProvider.GetRequiredService<NotificationPublisher>();

        // Carrega config do tenant (ou defaults)
        var config = await db.Set<TenantConfiguracao>().AsNoTracking().FirstOrDefaultAsync(ct);
        var slaLembreteHoras = config?.SlaAprovacaoHoras ?? 48;
        var slaEscalacaoHoras = config?.SlaEscalacaoHoras ?? 96;

        var now = DateTimeOffset.UtcNow;

        // Busca etapas pendentes com aprovador resolvido (ignora filas sem aprovador)
        var pendentes = await db.Set<SolicitacaoAprovacaoEtapa>()
            .Where(e => e.Status == StatusAprovacao.Pendente && e.AprovadorId != null)
            .ToListAsync(ct);

        if (pendentes.Count == 0) return;

        // Carrega overrides de SLA por etapa (config)
        var tiposFluxo = pendentes.Select(e => e.TipoFluxo).Distinct().ToList();
        var configs = await db.Set<EtapaConfigAprovacao>()
            .AsNoTracking()
            .Where(c => c.Ativo && tiposFluxo.Contains(c.TipoFluxo))
            .ToListAsync(ct);

        foreach (var etapa in pendentes)
        {
            var slaConfig = configs
                .FirstOrDefault(c => c.TipoFluxo == etapa.TipoFluxo && c.Ordem == etapa.Ordem)
                ?.SlaHoras;
            var slaEfetivo = slaConfig ?? slaLembreteHoras;

            var idadeHoras = (now - etapa.CreatedAtUtc).TotalHours;

            try
            {
                if (idadeHoras >= slaEscalacaoHoras && etapa.EscaladoEmUtc is null)
                {
                    await EscalarAsync(db, emailQueue, notifications, tenantId, etapa, ct);
                }
                else if (idadeHoras >= slaEfetivo && etapa.LembretesEnviados == 0)
                {
                    await LembrarAsync(db, emailQueue, notifications, tenantId, etapa, ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Falha ao processar lembrete/escalação da etapa {EtapaId} no tenant {TenantId}.",
                    etapa.Id, tenantId);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task LembrarAsync(
        AppDbContext db, IEmailQueueService emailQueue, NotificationPublisher notifications,
        string tenantId, SolicitacaoAprovacaoEtapa etapa, CancellationToken ct)
    {
        var aprovador = await db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == etapa.AprovadorId!.Value, ct);
        if (aprovador is null) return;

        var titulo = $"Lembrete: aprovação pendente há mais de {HorasLabel(etapa.CreatedAtUtc)}";
        var mensagem = $"A etapa \"{etapa.Label}\" está pendente aguardando sua ação.";

        if (aprovador.UserId.HasValue)
        {
            await notifications.PublishToUsersAsync(
                tenantId, new[] { aprovador.UserId.Value },
                titulo, mensagem, "/gestao/aprovacoes", "warning", ct);
        }

        if (!string.IsNullOrWhiteSpace(aprovador.Email))
        {
            var html = $"<p>Olá {aprovador.Name},</p>" +
                       $"<p>Você tem uma <strong>aprovação pendente</strong> há mais de {HorasLabel(etapa.CreatedAtUtc)}.</p>" +
                       $"<p>Etapa: <strong>{etapa.Label}</strong></p>" +
                       $"<p>Acesse o portal para revisar.</p>";
            await emailQueue.EnqueueRawAsync(
                aprovador.Email, titulo, html, null, true, "ApprovalReminder", ct);
        }

        etapa.LembretesEnviados++;
        etapa.UltimoLembreteUtc = DateTimeOffset.UtcNow;
    }

    private static async Task EscalarAsync(
        AppDbContext db, IEmailQueueService emailQueue, NotificationPublisher notifications,
        string tenantId, SolicitacaoAprovacaoEtapa etapa, CancellationToken ct)
    {
        var aprovador = await db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == etapa.AprovadorId!.Value, ct);
        if (aprovador?.GestorDiretoId is null)
        {
            // Sem gestor para escalar — apenas marca para não tentar de novo
            etapa.EscaladoEmUtc = DateTimeOffset.UtcNow;
            return;
        }

        var gestor = await db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == aprovador.GestorDiretoId.Value, ct);
        if (gestor is null)
        {
            etapa.EscaladoEmUtc = DateTimeOffset.UtcNow;
            return;
        }

        var titulo = $"Escalação: aprovação travada há mais de {HorasLabel(etapa.CreatedAtUtc)}";
        var mensagem = $"A etapa \"{etapa.Label}\" está pendente com {aprovador.Name} há mais de {HorasLabel(etapa.CreatedAtUtc)}.";

        if (gestor.UserId.HasValue)
        {
            await notifications.PublishToUsersAsync(
                tenantId, new[] { gestor.UserId.Value },
                titulo, mensagem, "/gestao/aprovacoes", "warning", ct);
        }

        if (!string.IsNullOrWhiteSpace(gestor.Email))
        {
            var html = $"<p>Olá {gestor.Name},</p>" +
                       $"<p>Uma aprovação pendente com <strong>{aprovador.Name}</strong> passou do prazo.</p>" +
                       $"<p>Etapa: <strong>{etapa.Label}</strong></p>" +
                       $"<p>Pedimos que acompanhe ou assuma a aprovação diretamente no portal.</p>";
            await emailQueue.EnqueueRawAsync(
                gestor.Email, titulo, html, null, true, "ApprovalEscalation", ct);
        }

        etapa.EscaladoEmUtc = DateTimeOffset.UtcNow;
    }

    private static string HorasLabel(DateTimeOffset desde)
    {
        var horas = (DateTimeOffset.UtcNow - desde).TotalHours;
        if (horas < 24) return $"{(int)horas}h";
        return $"{(int)(horas / 24)} dia(s)";
    }
}
