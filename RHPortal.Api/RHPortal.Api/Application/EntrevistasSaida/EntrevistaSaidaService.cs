using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.EntrevistasSaida;

public sealed class EntrevistaSaidaService : IEntrevistaSaidaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;

    private static readonly TimeSpan TokenTtl = TimeSpan.FromDays(30);

    public EntrevistaSaidaService(
        AppDbContext db,
        ITenantContext tenantContext,
        IEmailQueueService emailQueue)
    {
        _db = db;
        _tenantContext = tenantContext;
        _emailQueue = emailQueue;
    }

    // ── Token generation ──────────────────────────────────────────────

    private static string GenerateToken()
    {
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    // ── Public interface ──────────────────────────────────────────────

    public async Task CriarEEnviarAsync(
        Guid desligamentoId, Guid funcionarioId,
        string? httpScheme, string? httpHost, CancellationToken ct)
    {
        // Verificar se já existe entrevista para este desligamento
        var existente = await _db.Set<EntrevistaSaida>()
            .FirstOrDefaultAsync(e => e.DesligamentoId == desligamentoId, ct);
        if (existente is not null) return; // idempotente

        // Buscar template ativo do tenant
        var template = await _db.Set<TemplateEntrevistaSaida>()
            .AsNoTracking()
            .Where(t => t.Ativo)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        // Se não há template configurado, não criar entrevista
        if (template is null) return;

        var funcionario = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => new { f.Name, f.Email })
            .FirstOrDefaultAsync(ct);

        var token = GenerateToken();
        var now = DateTimeOffset.UtcNow;

        var entrevista = new EntrevistaSaida
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            DesligamentoId = desligamentoId,
            FuncionarioId = funcionarioId,
            TemplateId = template.Id,
            Token = token,
            ExpiresAtUtc = now.Add(TokenTtl),
            CreatedAtUtc = now,
        };
        _db.Set<EntrevistaSaida>().Add(entrevista);
        await _db.SaveChangesAsync(ct);

        // Enviar email ao funcionário
        if (funcionario is not null && !string.IsNullOrWhiteSpace(funcionario.Email))
        {
            var scheme = httpScheme ?? "http";
            var host = httpHost ?? "localhost";
            var url = $"{scheme}://{host}:3000/public/exit-interview/{token}";

            var body = $@"<p>Olá <b>{funcionario.Name}</b>,</p>
<p>Gostaríamos de ouvir sua opinião sobre sua experiência na empresa.
Por favor, reserve alguns minutos para responder nossa entrevista de saída.</p>
<p><a href=""{url}"" style=""background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;"">Responder entrevista de saída</a></p>
<p style=""font-size:12px;color:#999;"">Este link é válido por 30 dias. Suas respostas são confidenciais.</p>";

            try
            {
                await _emailQueue.EnqueueRawAsync(
                    funcionario.Email,
                    "Entrevista de saída — sua opinião é importante",
                    body, null, false, "entrevista-saida", ct);
            }
            catch { /* best-effort */ }
        }
    }

    public async Task<EntrevistaSaidaFormulario?> GetFormularioAsync(string token, CancellationToken ct)
    {
        var entrevista = await _db.Set<EntrevistaSaida>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Token == token, ct);

        if (entrevista is null) return null;

        var funcionario = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == entrevista.FuncionarioId)
            .Select(f => f.Name)
            .FirstOrDefaultAsync(ct) ?? "—";

        var perguntas = await _db.Set<PerguntaEntrevistaSaida>()
            .AsNoTracking()
            .Where(p => p.TemplateId == entrevista.TemplateId)
            .OrderBy(p => p.Ordem)
            .Select(p => new PerguntaDto(
                p.Id, p.Ordem, p.Texto,
                p.TipoResposta.ToString(),
                p.Opcoes != null ? p.Opcoes.Split(';', StringSplitOptions.RemoveEmptyEntries) : null,
                p.Obrigatoria))
            .ToListAsync(ct);

        return new EntrevistaSaidaFormulario(
            entrevista.Id,
            funcionario,
            Expirado: entrevista.ExpiresAtUtc < DateTimeOffset.UtcNow,
            JaPreenchido: entrevista.SubmittedAtUtc.HasValue,
            perguntas);
    }

    public async Task<EntrevistaSaidaResultado> SubmitAsync(
        string token, IReadOnlyList<RespostaDto> respostas, CancellationToken ct)
    {
        var entrevista = await _db.Set<EntrevistaSaida>()
            .FirstOrDefaultAsync(e => e.Token == token, ct);

        if (entrevista is null) return EntrevistaSaidaResultado.TokenInvalido;
        if (entrevista.SubmittedAtUtc.HasValue) return EntrevistaSaidaResultado.JaPreenchido;
        if (entrevista.ExpiresAtUtc < DateTimeOffset.UtcNow) return EntrevistaSaidaResultado.Expirado;

        var now = DateTimeOffset.UtcNow;

        foreach (var r in respostas)
        {
            _db.Set<RespostaEntrevistaSaida>().Add(new RespostaEntrevistaSaida
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                EntrevistaId = entrevista.Id,
                PerguntaId = r.PerguntaId,
                ValorTexto = r.ValorTexto,
                ValorEscala = r.ValorEscala,
                ValorOpcao = r.ValorOpcao,
            });
        }

        entrevista.SubmittedAtUtc = now;
        await _db.SaveChangesAsync(ct);

        return EntrevistaSaidaResultado.Sucesso;
    }

    public async Task<EntrevistaSaidaRelatorio> GetRelatorioAsync(
        DateOnly? de, DateOnly? ate, CancellationToken ct)
    {
        var query = _db.Set<EntrevistaSaida>().AsNoTracking();

        if (de.HasValue)
            query = query.Where(e => e.CreatedAtUtc >= de.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        if (ate.HasValue)
            query = query.Where(e => e.CreatedAtUtc <= ate.Value.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc));

        var entrevistas = await query
            .Include(e => e.Respostas)
            .ThenInclude(r => r.Pergunta)
            .ToListAsync(ct);

        var funcionarioIds = entrevistas.Select(e => e.FuncionarioId).Distinct().ToList();
        var funcionarios = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => funcionarioIds.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, f => f.Name, ct);

        var respondidas = entrevistas.Where(e => e.SubmittedAtUtc.HasValue).ToList();

        var itens = respondidas.Select(e => new EntrevistaSaidaRelatorioItem(
            e.Id,
            e.DesligamentoId,
            funcionarios.GetValueOrDefault(e.FuncionarioId, "—"),
            e.SubmittedAtUtc!.Value,
            e.Respostas.OrderBy(r => r.Pergunta?.Ordem).Select(r => new EntrevistaSaidaRespostaItem(
                r.Pergunta?.Texto ?? "—",
                r.ValorTexto,
                r.ValorEscala,
                r.ValorOpcao)).ToList()
        )).ToList();

        return new EntrevistaSaidaRelatorio(entrevistas.Count, respondidas.Count, itens);
    }
}
