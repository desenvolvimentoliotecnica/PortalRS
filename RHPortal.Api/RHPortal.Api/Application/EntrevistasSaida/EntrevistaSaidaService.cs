using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.EntrevistasSaida;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.EntrevistasSaida;

public sealed class EntrevistaSaidaService : IEntrevistaSaidaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;
    private readonly IFrontendPublicUrlBuilder _frontendUrls;

    private static readonly TimeSpan TokenTtl = TimeSpan.FromDays(30);

    public EntrevistaSaidaService(
        AppDbContext db,
        ITenantContext tenantContext,
        IEmailQueueService emailQueue,
        IFrontendPublicUrlBuilder frontendUrls)
    {
        _db = db;
        _tenantContext = tenantContext;
        _emailQueue = emailQueue;
        _frontendUrls = frontendUrls;
    }

    private static string GenerateToken()
    {
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    public async Task<EntrevistaSaidaEnvioResult> EnviarAsync(Guid solicitacaoDesligamentoId, CancellationToken ct)
    {
        var solicitacao = await _db.SolicitacoesDesligamento
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == solicitacaoDesligamentoId, ct);

        if (solicitacao is null)
            return EntrevistaSaidaEnvioResult.SolicitacaoNaoEncontrada;

        var template = await GetActiveTemplateAsync(ct);
        if (template is null)
            return EntrevistaSaidaEnvioResult.SemTemplate;

        var funcionario = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == solicitacao.FuncionarioId)
            .Select(f => new { f.Name, f.Email })
            .FirstOrDefaultAsync(ct);

        if (funcionario is null || string.IsNullOrWhiteSpace(funcionario.Email))
            return EntrevistaSaidaEnvioResult.SemEmail;

        var existente = await _db.Set<EntrevistaSaida>()
            .FirstOrDefaultAsync(e => e.DesligamentoId == solicitacaoDesligamentoId, ct);

        if (existente is not null)
        {
            if (existente.SubmittedAtUtc.HasValue)
                return EntrevistaSaidaEnvioResult.JaRespondida;

            if (existente.ExpiresAtUtc < DateTimeOffset.UtcNow)
                return EntrevistaSaidaEnvioResult.Expirada;

            await SendEmailAsync(funcionario.Name, funcionario.Email, existente.Token, ct);
            return EntrevistaSaidaEnvioResult.Sucesso;
        }

        var token = GenerateToken();
        var now = DateTimeOffset.UtcNow;

        var entrevista = new EntrevistaSaida
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            DesligamentoId = solicitacaoDesligamentoId,
            FuncionarioId = solicitacao.FuncionarioId,
            TemplateId = template.Id,
            Token = token,
            ExpiresAtUtc = now.Add(TokenTtl),
            CreatedAtUtc = now,
        };
        _db.Set<EntrevistaSaida>().Add(entrevista);
        await _db.SaveChangesAsync(ct);

        await SendEmailAsync(funcionario.Name, funcionario.Email, token, ct);
        return EntrevistaSaidaEnvioResult.Sucesso;
    }

    public async Task<EntrevistaSaidaEnvioResult> ReenviarAsync(Guid solicitacaoDesligamentoId, CancellationToken ct)
    {
        var entrevista = await _db.Set<EntrevistaSaida>()
            .FirstOrDefaultAsync(e => e.DesligamentoId == solicitacaoDesligamentoId, ct);

        if (entrevista is null)
            return EntrevistaSaidaEnvioResult.SolicitacaoNaoEncontrada;

        if (entrevista.SubmittedAtUtc.HasValue)
            return EntrevistaSaidaEnvioResult.JaRespondida;

        if (entrevista.ExpiresAtUtc < DateTimeOffset.UtcNow)
            return EntrevistaSaidaEnvioResult.Expirada;

        var funcionario = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == entrevista.FuncionarioId)
            .Select(f => new { f.Name, f.Email })
            .FirstOrDefaultAsync(ct);

        if (funcionario is null || string.IsNullOrWhiteSpace(funcionario.Email))
            return EntrevistaSaidaEnvioResult.SemEmail;

        await SendEmailAsync(funcionario.Name, funcionario.Email, entrevista.Token, ct);
        return EntrevistaSaidaEnvioResult.Sucesso;
    }

    public async Task<EntrevistaSaidaDetalheDto?> GetDetalheAsync(Guid solicitacaoDesligamentoId, CancellationToken ct)
    {
        var solicitacaoExists = await _db.SolicitacoesDesligamento
            .AsNoTracking()
            .AnyAsync(s => s.Id == solicitacaoDesligamentoId, ct);

        if (!solicitacaoExists)
            return null;

        var entrevista = await _db.Set<EntrevistaSaida>()
            .AsNoTracking()
            .Include(e => e.Respostas)
            .ThenInclude(r => r.Pergunta)
            .FirstOrDefaultAsync(e => e.DesligamentoId == solicitacaoDesligamentoId, ct);

        if (entrevista is null)
        {
            var funcionarioId = await _db.SolicitacoesDesligamento
                .AsNoTracking()
                .Where(s => s.Id == solicitacaoDesligamentoId)
                .Select(s => s.FuncionarioId)
                .FirstAsync(ct);

            var batch = await GetStatusBatchAsync([(solicitacaoDesligamentoId, funcionarioId)], ct);
            var grid = batch[solicitacaoDesligamentoId];
            return new EntrevistaSaidaDetalheDto(grid.Status, null, null, null, null);
        }

        var status = MapEntrevistaStatus(entrevista);
        IReadOnlyList<EntrevistaSaidaRespostaDetalhe>? respostas = null;

        if (entrevista.SubmittedAtUtc.HasValue)
        {
            respostas = entrevista.Respostas
                .OrderBy(r => r.Pergunta?.Ordem)
                .Select(r => new EntrevistaSaidaRespostaDetalhe(
                    r.Pergunta?.Texto ?? "—",
                    r.ValorTexto,
                    r.ValorEscala,
                    r.ValorOpcao))
                .ToList();
        }

        return new EntrevistaSaidaDetalheDto(
            status,
            entrevista.CreatedAtUtc,
            entrevista.SubmittedAtUtc,
            entrevista.ExpiresAtUtc,
            respostas);
    }

    public async Task<IReadOnlyDictionary<Guid, EntrevistaSaidaGridStatus>> GetStatusBatchAsync(
        IReadOnlyList<(Guid DesligamentoId, Guid FuncionarioId)> items,
        CancellationToken ct)
    {
        if (items.Count == 0)
            return new Dictionary<Guid, EntrevistaSaidaGridStatus>();

        var desligamentoIds = items.Select(i => i.DesligamentoId).Distinct().ToList();
        var funcionarioIds = items.Select(i => i.FuncionarioId).Distinct().ToList();

        var entrevistas = await _db.Set<EntrevistaSaida>()
            .AsNoTracking()
            .Where(e => desligamentoIds.Contains(e.DesligamentoId))
            .ToListAsync(ct);

        var entrevistaByDesl = entrevistas.ToDictionary(e => e.DesligamentoId);

        var hasActiveTemplate = await _db.Set<TemplateEntrevistaSaida>()
            .AsNoTracking()
            .AnyAsync(t => t.Ativo, ct);

        var emails = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => funcionarioIds.Contains(f.Id))
            .Select(f => new { f.Id, f.Email })
            .ToDictionaryAsync(f => f.Id, f => f.Email, ct);

        var result = new Dictionary<Guid, EntrevistaSaidaGridStatus>();

        foreach (var item in items)
        {
            if (entrevistaByDesl.TryGetValue(item.DesligamentoId, out var entrevista))
            {
                var status = MapEntrevistaStatus(entrevista);
                result[item.DesligamentoId] = new EntrevistaSaidaGridStatus(
                    status,
                    entrevista.CreatedAtUtc,
                    entrevista.SubmittedAtUtc);
                continue;
            }

            if (!hasActiveTemplate)
            {
                result[item.DesligamentoId] = new EntrevistaSaidaGridStatus(
                    EntrevistaSaidaStatusCode.SemTemplate, null, null);
                continue;
            }

            emails.TryGetValue(item.FuncionarioId, out var email);
            if (string.IsNullOrWhiteSpace(email))
            {
                result[item.DesligamentoId] = new EntrevistaSaidaGridStatus(
                    EntrevistaSaidaStatusCode.SemEmail, null, null);
                continue;
            }

            result[item.DesligamentoId] = new EntrevistaSaidaGridStatus(
                EntrevistaSaidaStatusCode.NaoEnviada, null, null);
        }

        return result;
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

    public async Task<TemplateEntrevistaSaidaResponse?> GetTemplateAtivoAsync(CancellationToken ct)
    {
        var template = await GetActiveTemplateWithPerguntasAsync(ct);
        return template is null ? null : MapTemplateResponse(template);
    }

    public async Task<TemplateEntrevistaSaidaResponse> UpsertTemplateAtivoAsync(
        TemplateEntrevistaSaidaUpsertRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
            throw new InvalidOperationException("Nome do template é obrigatório.");
        if (request.Perguntas is null || request.Perguntas.Count == 0)
            throw new InvalidOperationException("O template deve ter ao menos uma pergunta.");

        var now = DateTimeOffset.UtcNow;
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant não resolvido.");

        var existing = await _db.Set<TemplateEntrevistaSaida>()
            .Include(t => t.Perguntas)
            .FirstOrDefaultAsync(t => t.Ativo, ct);

        if (existing is null)
        {
            existing = new TemplateEntrevistaSaida
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Nome = request.Nome.Trim(),
                Ativo = true,
                CreatedAtUtc = now,
            };
            _db.Set<TemplateEntrevistaSaida>().Add(existing);
        }
        else
        {
            existing.Nome = request.Nome.Trim();
            _db.Set<PerguntaEntrevistaSaida>().RemoveRange(existing.Perguntas);
            existing.Perguntas.Clear();
        }

        foreach (var p in request.Perguntas.OrderBy(x => x.Ordem))
        {
            if (string.IsNullOrWhiteSpace(p.Texto))
                throw new InvalidOperationException("Texto da pergunta é obrigatório.");

            if (!Enum.TryParse<TipoRespostaEntrevista>(p.TipoResposta, true, out var tipo))
                throw new InvalidOperationException($"Tipo de resposta inválido: {p.TipoResposta}");

            existing.Perguntas.Add(new PerguntaEntrevistaSaida
            {
                Id = p.Id ?? Guid.NewGuid(),
                TenantId = tenantId,
                TemplateId = existing.Id,
                Ordem = p.Ordem,
                Texto = p.Texto.Trim(),
                TipoResposta = tipo,
                Opcoes = p.Opcoes is { Length: > 0 } ? string.Join(';', p.Opcoes) : null,
                Obrigatoria = p.Obrigatoria,
            });
        }

        await _db.SaveChangesAsync(ct);

        var reloaded = await GetActiveTemplateWithPerguntasAsync(ct);
        return MapTemplateResponse(reloaded!);
    }

    private async Task SendEmailAsync(string name, string email, string token, CancellationToken ct)
    {
        var url = _frontendUrls.BuildAbsoluteUrl($"/public/exit-interview/{token}");

        var body = $@"<p>Olá <b>{name}</b>,</p>
<p>Gostaríamos de ouvir sua opinião sobre sua experiência na empresa.
Por favor, reserve alguns minutos para responder nossa entrevista de saída.</p>
<p><a href=""{url}"" style=""background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;"">Responder entrevista de saída</a></p>
<p style=""font-size:12px;color:#999;"">Este link é válido por 30 dias. Suas respostas são confidenciais.</p>";

        await _emailQueue.EnqueueRawAsync(
            email,
            "Entrevista de saída — sua opinião é importante",
            body, null, false, "entrevista-saida", ct);
    }

    private async Task<TemplateEntrevistaSaida?> GetActiveTemplateAsync(CancellationToken ct)
        => await _db.Set<TemplateEntrevistaSaida>()
            .AsNoTracking()
            .Where(t => t.Ativo)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

    private async Task<TemplateEntrevistaSaida?> GetActiveTemplateWithPerguntasAsync(CancellationToken ct)
        => await _db.Set<TemplateEntrevistaSaida>()
            .Include(t => t.Perguntas)
            .AsNoTracking()
            .Where(t => t.Ativo)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

    private static TemplateEntrevistaSaidaResponse MapTemplateResponse(TemplateEntrevistaSaida template)
        => new(
            template.Id,
            template.Nome,
            template.Ativo,
            template.Perguntas
                .OrderBy(p => p.Ordem)
                .Select(p => new TemplatePerguntaResponse(
                    p.Id,
                    p.Ordem,
                    p.Texto,
                    p.TipoResposta.ToString(),
                    p.Opcoes?.Split(';', StringSplitOptions.RemoveEmptyEntries),
                    p.Obrigatoria))
                .ToList());

    private static EntrevistaSaidaStatusCode MapEntrevistaStatus(EntrevistaSaida entrevista)
    {
        if (entrevista.SubmittedAtUtc.HasValue)
            return EntrevistaSaidaStatusCode.Respondida;
        if (entrevista.ExpiresAtUtc < DateTimeOffset.UtcNow)
            return EntrevistaSaidaStatusCode.Expirada;
        return EntrevistaSaidaStatusCode.Enviada;
    }
}
