using Microsoft.EntityFrameworkCore;
using Npgsql;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Infrastructure.Scheduling;

/// <summary>
/// BackgroundService que detecta integrações TOTVS com falha e aplica retry automático
/// com backoff exponencial.
///
/// Backoff: 5min → 15min → 1h → 6h (4 ciclos = 5 tentativas máximas).
/// Após 5 tentativas: marca IntegracaoResultado = FalhaDefinitiva e notifica o solicitante.
///
/// Roda a cada 15 minutos.
///
/// Nota: o reenvio real do payload ao endpoint TOTVS requer configuração de
/// TotvsEndpointUrl na TenantConfiguracao. Por ora, o serviço apenas gerencia
/// o backoff/contador — a integração permanece visível no painel para ação manual.
/// </summary>
public sealed class IntegracaoRetryService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IntegracaoRetryService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);
    private const int MaxTentativas = 5;

    // Backoff exponencial: índice = TentativasIntegracao atual (antes do próximo retry)
    private static readonly TimeSpan[] BackoffSchedule =
    [
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(6),
        TimeSpan.FromHours(24),
    ];

    public IntegracaoRetryService(
        IServiceScopeFactory scopeFactory,
        ILogger<IntegracaoRetryService> logger)
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
                _logger.LogError(ex, "IntegracaoRetryService batch failed.");
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
                _logger.LogWarning("Tenant {TenantId}: schema missing. Run migrations.", tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "IntegracaoRetryService failed for tenant {TenantId}.", tenantId);
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
        var workflow = scope.ServiceProvider.GetRequiredService<ApprovalWorkflowHelper>();

        var now = DateTimeOffset.UtcNow;
        var candidatos = await GetFalhasAsync(db, now, ct);
        if (candidatos.Count == 0) return;

        _logger.LogInformation(
            "IntegracaoRetryService: {Count} integrações com falha para tenant {TenantId}.",
            candidatos.Count, tenantId);

        foreach (var item in candidatos)
        {
            var novaTentativa = item.TentativasIntegracao + 1;

            if (novaTentativa >= MaxTentativas)
            {
                item.MarcarFalhaDefinitiva();

                _logger.LogWarning(
                    "Integração {Tipo} {Id} atingiu {Max} tentativas — FalhaDefinitiva.",
                    item.Tipo, item.Id, MaxTentativas);

                // Notifica solicitante (best-effort)
                if (item.SolicitanteId.HasValue)
                {
                    try
                    {
                        var titulo = $"Falha definitiva na integração de {item.TipoLabel}";
                        var msg = $"A integração de {item.TipoLabel} ({item.Resumo}) atingiu {MaxTentativas} tentativas sem sucesso. Acesse o painel de integração para resolver manualmente.";
                        await workflow.NotifyByFuncionarioIdAsync(
                            item.SolicitanteId.Value, titulo, msg,
                            "/gestao/integracao-totvs", ct, "error");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Falha ao notificar solicitante sobre FalhaDefinitiva.");
                    }
                }
            }
            else
            {
                item.Incrementar();

                _logger.LogInformation(
                    "Integração {Tipo} {Id}: tentativa {N}/{Max}.",
                    item.Tipo, item.Id, novaTentativa, MaxTentativas);

                // TODO: quando TotvsEndpointUrl estiver configurado em TenantConfiguracao,
                // reenviar o payload ao ERP aqui via ITotvsClient (HttpClient tipado + Polly).
            }
        }

        await db.SaveChangesAsync(ct);
    }

    // ── Helpers de backoff ──

    private static bool DeveTentar(int tentativas, DateTimeOffset? ultimaTentativa, DateTimeOffset now)
    {
        if (tentativas >= MaxTentativas) return false;
        if (ultimaTentativa is null) return true;
        var backoff = BackoffSchedule[Math.Min(tentativas, BackoffSchedule.Length - 1)];
        return now - ultimaTentativa.Value >= backoff;
    }

    // ── Coleta todas as 8 entidades com falha e backoff vencido ──

    private async Task<List<IntegracaoFalhaItem>> GetFalhasAsync(AppDbContext db, DateTimeOffset now, CancellationToken ct)
    {
        var result = new List<IntegracaoFalhaItem>();

        // PreAdmissão
        foreach (var x in await db.PreAdmissoes
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.Admissao, "Admissão", x.Nome,
                x.TentativasIntegracao, x.AprovadoPorId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Desligamento
        foreach (var x in await db.SolicitacoesDesligamento
            .Include(e => e.Funcionario)
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.Desligamento, "Desligamento", x.Funcionario?.Name ?? "—",
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Promoção
        foreach (var x in await db.SolicitacoesPromocao
            .Include(e => e.Funcionario)
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.Promocao, "Promoção", x.Funcionario?.Name ?? "—",
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Pagamento Extra
        foreach (var x in await db.SolicitacoesPagamentoExtra
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.PagamentoExtra, "Pagamento Extra", x.TipoPagamentoExtra.ToString(),
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Alteração de Endereço
        foreach (var x in await db.SolicitacoesEndereco
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.AlteracaoEndereco, "Alt. Endereço", $"{x.Cidade}/{x.Uf}",
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Dependente
        foreach (var x in await db.SolicitacoesDependente
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.Dependente, "Dependente", x.NomeCompleto,
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Benefício
        foreach (var x in await db.SolicitacoesBeneficio
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.Beneficio, "Benefício", x.TipoBeneficio.ToString(),
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        // Férias
        foreach (var x in await db.SolicitacoesFerias
            .Where(e => e.IntegracaoResultado == IntegracaoResultado.Falha && e.TentativasIntegracao < MaxTentativas)
            .ToListAsync(ct))
        {
            if (!DeveTentar(x.TentativasIntegracao, x.UltimaTentativaUtc, now)) continue;
            result.Add(new IntegracaoFalhaItem(
                x.Id, TipoIntegracao.Ferias, "Férias", $"{x.DataInicio:dd/MM/yyyy}",
                x.TentativasIntegracao, x.SolicitanteId,
                () => { x.TentativasIntegracao++; x.UltimaTentativaUtc = now; },
                () => { x.IntegracaoResultado = IntegracaoResultado.FalhaDefinitiva; x.UltimaTentativaUtc = now; }));
        }

        return result;
    }

    // ── DTO interno para abstrair os 8 tipos de entidade ──

    private sealed class IntegracaoFalhaItem
    {
        public Guid Id { get; }
        public TipoIntegracao Tipo { get; }
        public string TipoLabel { get; }
        public string Resumo { get; }
        public int TentativasIntegracao { get; }
        public Guid? SolicitanteId { get; }

        private readonly Action _incrementar;
        private readonly Action _marcarFalhaDefinitiva;

        public IntegracaoFalhaItem(
            Guid id, TipoIntegracao tipo, string tipoLabel, string resumo,
            int tentativas, Guid? solicitanteId,
            Action incrementar, Action marcarFalhaDefinitiva)
        {
            Id = id;
            Tipo = tipo;
            TipoLabel = tipoLabel;
            Resumo = resumo;
            TentativasIntegracao = tentativas;
            SolicitanteId = solicitanteId;
            _incrementar = incrementar;
            _marcarFalhaDefinitiva = marcarFalhaDefinitiva;
        }

        public void Incrementar() => _incrementar();
        public void MarcarFalhaDefinitiva() => _marcarFalhaDefinitiva();
    }
}
