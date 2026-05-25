using System.Security.Cryptography;
using System.Globalization;
using System.Net;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.PropostaVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.PropostasVaga;

public interface IPropostaVagaService
{
    Task<PropostaVagaResponse> CreateAsync(PropostaVagaCreateRequest request, CancellationToken ct);
    Task<PropostaVagaResponse?> UpdateAsync(Guid id, PropostaVagaUpdateRequest request, CancellationToken ct);
    Task<PropostaVagaResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<PropostaVagaResponse>> ListAsync(Guid? vagaId, Guid? candidatoId, PropostaVagaStatus? status, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<PropostaVagaResponse?> EnviarAsync(Guid id, int? prazoDiasResposta, CancellationToken ct);
    Task<PropostaVagaResponse?> ReenviarEmailAsync(Guid id, CancellationToken ct);
    Task<PropostaVagaResponse?> CancelarAsync(Guid id, CancellationToken ct);

    // Fluxo público (via token)
    Task<PropostaVagaPublicaResponse?> GetPorTokenAsync(string token, CancellationToken ct);
    Task<PropostaVagaPublicaResponse?> AceitarPorTokenAsync(string token, string nomeConfirmado, string? ip, string? userAgent, CancellationToken ct);
    Task<PropostaVagaPublicaResponse?> RecusarPorTokenAsync(string token, string nomeConfirmado, string? motivo, string? ip, string? userAgent, CancellationToken ct);
}

public sealed class PropostaVagaService : IPropostaVagaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ICurrentUserContext _currentUser;
    private readonly ICandidaturaService _candidaturaService;
    private readonly IEmailQueueService _emailQueue;
    private readonly IFrontendPublicUrlBuilder _frontendUrls;

    public PropostaVagaService(
        AppDbContext db,
        ITenantContext tenant,
        ICurrentUserContext currentUser,
        ICandidaturaService candidaturaService,
        IEmailQueueService emailQueue,
        IFrontendPublicUrlBuilder frontendUrls)
    {
        _db = db;
        _tenant = tenant;
        _currentUser = currentUser;
        _candidaturaService = candidaturaService;
        _emailQueue = emailQueue;
        _frontendUrls = frontendUrls;
    }

    public async Task<PropostaVagaResponse> CreateAsync(PropostaVagaCreateRequest request, CancellationToken ct)
    {
        var vaga = await _db.Vagas.AsNoTracking().FirstOrDefaultAsync(v => v.Id == request.VagaId, ct)
                   ?? throw new InvalidOperationException("Vaga informada não encontrada.");
        var cand = await _db.Candidatos.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CandidatoId, ct)
                   ?? throw new InvalidOperationException("Candidato informado não encontrado.");

        var candidatura = await _candidaturaService.GetOrCreateAsync(
            request.CandidatoId, request.VagaId, fonte: "Proposta", obs: null, ct);

        var now = DateTimeOffset.UtcNow;
        var entity = new PropostaVaga
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            VagaId = request.VagaId,
            CandidatoId = request.CandidatoId,
            CandidaturaId = candidatura.Id,
            Status = PropostaVagaStatus.Rascunho,
            Moeda = request.Moeda,
            SalarioOferecido = request.SalarioOferecido,
            DescricaoBeneficios = request.DescricaoBeneficios,
            DataPrevistaInicio = request.DataPrevistaInicio,
            MensagemPersonalizada = request.MensagemPersonalizada,
            ObservacaoInternaRh = request.ObservacaoInternaRh,
            CriadaPorUserId = _currentUser.UserId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.Set<PropostaVaga>().Add(entity);
        await _db.SaveChangesAsync(ct);

        return await BuildResponse(entity.Id, ct)
               ?? throw new InvalidOperationException("Falha ao recuperar a proposta recém-criada.");
    }

    public async Task<PropostaVagaResponse?> UpdateAsync(Guid id, PropostaVagaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<PropostaVaga>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status is PropostaVagaStatus.Aceita or PropostaVagaStatus.Recusada or PropostaVagaStatus.Expirada)
            throw new InvalidOperationException("Proposta já foi respondida ou expirou — não é possível editar.");

        entity.Moeda = request.Moeda;
        entity.SalarioOferecido = request.SalarioOferecido;
        entity.DescricaoBeneficios = request.DescricaoBeneficios;
        entity.DataPrevistaInicio = request.DataPrevistaInicio;
        entity.MensagemPersonalizada = request.MensagemPersonalizada;
        entity.ObservacaoInternaRh = request.ObservacaoInternaRh;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await BuildResponse(id, ct);
    }

    public Task<PropostaVagaResponse?> GetByIdAsync(Guid id, CancellationToken ct) => BuildResponse(id, ct);

    public async Task<IReadOnlyList<PropostaVagaResponse>> ListAsync(Guid? vagaId, Guid? candidatoId, PropostaVagaStatus? status, CancellationToken ct)
    {
        var q = _db.Set<PropostaVaga>().AsNoTracking().AsQueryable();
        if (!_currentUser.IsAdmin)
        {
            var currentUserId = _currentUser.UserId;
            q = currentUserId.HasValue
                ? q.Where(p =>
                    p.CriadaPorUserId == currentUserId.Value
                    || _db.Vagas.Any(v => v.Id == p.VagaId && v.RecrutadorResponsavelUserId == currentUserId.Value))
                : q.Where(_ => false);
        }
        if (vagaId.HasValue) q = q.Where(p => p.VagaId == vagaId.Value);
        if (candidatoId.HasValue) q = q.Where(p => p.CandidatoId == candidatoId.Value);
        if (status.HasValue) q = q.Where(p => p.Status == status.Value);

        var ids = await q.OrderByDescending(p => p.CreatedAtUtc).Select(p => p.Id).ToListAsync(ct);
        var list = new List<PropostaVagaResponse>(ids.Count);
        foreach (var id in ids)
        {
            var r = await BuildResponse(id, ct);
            if (r is not null) list.Add(r);
        }
        return list;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Set<PropostaVaga>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return false;
        if (entity.Status != PropostaVagaStatus.Rascunho)
            throw new InvalidOperationException("Só é possível excluir propostas em rascunho.");
        _db.Set<PropostaVaga>().Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<PropostaVagaResponse?> EnviarAsync(Guid id, int? prazoDiasResposta, CancellationToken ct)
    {
        var entity = await _db.Set<PropostaVaga>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status != PropostaVagaStatus.Rascunho)
            throw new InvalidOperationException("Proposta já foi enviada — cancele e crie outra se precisar.");

        var now = DateTimeOffset.UtcNow;
        entity.Status = PropostaVagaStatus.Enviada;
        entity.AccessToken = GenerateSecureToken();
        entity.EnviadaEmUtc = now;
        entity.ExpiraEmUtc = prazoDiasResposta.HasValue && prazoDiasResposta.Value > 0
            ? now.AddDays(prazoDiasResposta.Value)
            : now.AddDays(7);
        entity.EnviadaPorUserId = _currentUser.UserId;
        entity.UpdatedAtUtc = now;

        await _db.SaveChangesAsync(ct);
        await EnfileirarEmailPropostaAsync(entity.Id, ct);
        return await BuildResponse(id, ct);
    }

    public async Task<PropostaVagaResponse?> ReenviarEmailAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Set<PropostaVaga>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return null;

        if (entity.Status is not (PropostaVagaStatus.Enviada or PropostaVagaStatus.Visualizada))
            throw new InvalidOperationException("Só é possível reenviar propostas já enviadas e ainda não respondidas.");
        if (string.IsNullOrWhiteSpace(entity.AccessToken))
            throw new InvalidOperationException("Proposta enviada sem token público. Cancele e crie uma nova proposta.");
        if (entity.ExpiraEmUtc.HasValue && entity.ExpiraEmUtc.Value < DateTimeOffset.UtcNow)
        {
            entity.Status = PropostaVagaStatus.Expirada;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
            throw new InvalidOperationException("Proposta expirada. Cancele e crie uma nova proposta para enviar novamente.");
        }

        await EnfileirarEmailPropostaAsync(entity.Id, ct);
        return await BuildResponse(id, ct);
    }

    public async Task<PropostaVagaResponse?> CancelarAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Set<PropostaVaga>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return null;
        if (entity.Status is PropostaVagaStatus.Aceita or PropostaVagaStatus.Recusada)
            throw new InvalidOperationException("Proposta já foi respondida — não é possível cancelar.");

        entity.Status = PropostaVagaStatus.Cancelada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await BuildResponse(id, ct);
    }

    // ── Fluxo público ───────────────────────────────────────────────

    public async Task<PropostaVagaPublicaResponse?> GetPorTokenAsync(string token, CancellationToken ct)
    {
        var entity = await FindAndMaybeExpireAsync(token, ct);
        if (entity is null) return null;

        if (entity.Status == PropostaVagaStatus.Enviada)
        {
            entity.Status = PropostaVagaStatus.Visualizada;
            entity.VisualizadaEmUtc = DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = entity.VisualizadaEmUtc.Value;
            await _db.SaveChangesAsync(ct);
        }

        return await BuildPublicResponse(entity.Id, ct);
    }

    public async Task<PropostaVagaPublicaResponse?> AceitarPorTokenAsync(string token, string nomeConfirmado, string? ip, string? userAgent, CancellationToken ct)
    {
        var entity = await FindAndMaybeExpireAsync(token, ct);
        if (entity is null) return null;

        if (entity.Status is PropostaVagaStatus.Aceita or PropostaVagaStatus.Recusada or PropostaVagaStatus.Expirada or PropostaVagaStatus.Cancelada)
            throw new InvalidOperationException($"Proposta está em status '{entity.Status}' e não pode mais ser aceita.");

        var now = DateTimeOffset.UtcNow;
        entity.Status = PropostaVagaStatus.Aceita;
        entity.RespondidaEmUtc = now;
        entity.NomeConfirmadoCandidato = nomeConfirmado;
        entity.IpOrigemResposta = Truncate(ip, 60);
        entity.UserAgentResposta = Truncate(userAgent, 400);
        entity.UpdatedAtUtc = now;

        await AplicarAceiteNoFunilAsync(entity, now, ct);
        await _db.SaveChangesAsync(ct);
        return await BuildPublicResponse(entity.Id, ct);
    }

    public async Task<PropostaVagaPublicaResponse?> RecusarPorTokenAsync(string token, string nomeConfirmado, string? motivo, string? ip, string? userAgent, CancellationToken ct)
    {
        var entity = await FindAndMaybeExpireAsync(token, ct);
        if (entity is null) return null;

        if (entity.Status is PropostaVagaStatus.Aceita or PropostaVagaStatus.Recusada or PropostaVagaStatus.Expirada or PropostaVagaStatus.Cancelada)
            throw new InvalidOperationException($"Proposta está em status '{entity.Status}' e não pode mais ser recusada.");

        var now = DateTimeOffset.UtcNow;
        entity.Status = PropostaVagaStatus.Recusada;
        entity.RespondidaEmUtc = now;
        entity.NomeConfirmadoCandidato = nomeConfirmado;
        entity.MotivoRecusa = motivo;
        entity.IpOrigemResposta = Truncate(ip, 60);
        entity.UserAgentResposta = Truncate(userAgent, 400);
        entity.UpdatedAtUtc = now;

        await _db.SaveChangesAsync(ct);
        return await BuildPublicResponse(entity.Id, ct);
    }

    // ── helpers ─────────────────────────────────────────────────────

    private async Task AplicarAceiteNoFunilAsync(PropostaVaga proposta, DateTimeOffset now, CancellationToken ct)
    {
        var candidatura = proposta.CandidaturaId.HasValue
            ? await _db.Candidaturas.FirstOrDefaultAsync(c => c.Id == proposta.CandidaturaId.Value, ct)
            : await _db.Candidaturas.FirstOrDefaultAsync(c => c.VagaId == proposta.VagaId && c.CandidatoId == proposta.CandidatoId, ct);

        if (candidatura is not null)
        {
            var etapaAnterior = candidatura.EtapaMacro;
            if (candidatura.Status != CandidaturaStatus.Contratado || candidatura.EtapaMacro != EtapaMacroCandidatura.Contratado)
            {
                candidatura.Status = CandidaturaStatus.Contratado;
                candidatura.EtapaMacro = EtapaMacroCandidatura.Contratado;
                candidatura.EtapaAtualDesdeUtc = now;
                candidatura.UpdatedAtUtc = now;
            }

            if (etapaAnterior != EtapaMacroCandidatura.Contratado)
            {
                _db.Set<CandidaturaEtapaHistorico>().Add(new CandidaturaEtapaHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = candidatura.TenantId,
                    CandidaturaId = candidatura.Id,
                    EtapaAnterior = etapaAnterior,
                    EtapaNova = EtapaMacroCandidatura.Contratado,
                    Observacao = "Proposta aceita pelo candidato.",
                    UserId = null,
                    EmUtc = now,
                });
            }
        }

        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == proposta.VagaId, ct);
        if (vaga is null || vaga.Status is VagaStatus.Preenchida or VagaStatus.Cancelada or VagaStatus.Encerrada)
            return;

        var acceptedCount = 1 + await _db.Set<PropostaVaga>()
            .AsNoTracking()
            .CountAsync(p => p.Id != proposta.Id && p.VagaId == proposta.VagaId && p.Status == PropostaVagaStatus.Aceita, ct);

        var headcountProvisorioAtivo = !vaga.HeadcountProvisorioExpiresAtUtc.HasValue
            || vaga.HeadcountProvisorioExpiresAtUtc.Value >= now
            ? vaga.HeadcountProvisorio
            : 0;
        var capacidade = Math.Max(1, Math.Max(vaga.QuantidadeVagas, vaga.HeadcountAutorizado + headcountProvisorioAtivo));

        if (acceptedCount >= capacidade)
        {
            vaga.Status = VagaStatus.Preenchida;
            vaga.UpdatedAtUtc = now;
        }
    }

    private async Task EnfileirarEmailPropostaAsync(Guid propostaId, CancellationToken ct)
    {
        var row = await (
            from prop in _db.Set<PropostaVaga>().AsNoTracking()
            where prop.Id == propostaId
            join vaga in _db.Vagas.AsNoTracking() on prop.VagaId equals vaga.Id into vagas
            from vaga in vagas.DefaultIfEmpty()
            join candidato in _db.Candidatos.AsNoTracking() on prop.CandidatoId equals candidato.Id into candidatos
            from candidato in candidatos.DefaultIfEmpty()
            select new { Proposta = prop, Vaga = vaga, Candidato = candidato })
            .FirstOrDefaultAsync(ct);

        if (row?.Candidato is null || string.IsNullOrWhiteSpace(row.Candidato.Email) || string.IsNullOrWhiteSpace(row.Proposta.AccessToken))
            return;

        var tenantId = _tenant.TenantId ?? "";
        var link = _frontendUrls.BuildAbsoluteUrl(
            $"/app/PortalVagas/Proposta?token={Uri.EscapeDataString(row.Proposta.AccessToken)}&tenantId={Uri.EscapeDataString(tenantId)}");
        var candidatoNome = row.Candidato.Nome?.Trim();
        var vagaTitulo = row.Vaga?.Titulo?.Trim();
        var empresaNome = await ResolverEmpresaNomeAsync(ct);
        var prazo = row.Proposta.ExpiraEmUtc.HasValue
            ? row.Proposta.ExpiraEmUtc.Value.ToLocalTime().ToString("dd/MM/yyyy HH:mm", CultureInfo.GetCultureInfo("pt-BR"))
            : "não informado";

        var subject = $"Proposta enviada — {SafeText(vagaTitulo, "vaga")}";
        var bodyText = $"""
            Olá, {SafeText(candidatoNome, "candidato")}!

            Ficamos felizes em te enviar uma proposta para o cargo de "{SafeText(vagaTitulo, "vaga")}".
            Você pode visualizar e aceitar pelo link abaixo:

            {link}

            Prazo: {prazo}

            {SafeText(empresaNome, "Portal de RH")} — RH
            """;

        var bodyHtml = $"""
            <p>Olá, {Html(candidatoNome, "candidato")}!</p>
            <p>Ficamos felizes em te enviar uma proposta para o cargo de &quot;{Html(vagaTitulo, "vaga")}&quot;.<br>
            Você pode visualizar e aceitar pelo link abaixo:</p>
            <p><a href="{WebUtility.HtmlEncode(link)}">{WebUtility.HtmlEncode(link)}</a></p>
            <p>Prazo: {WebUtility.HtmlEncode(prazo)}</p>
            <p>{Html(empresaNome, "Portal de RH")} — RH</p>
            """;

        await _emailQueue.EnqueueRawAsync(
            row.Candidato.Email.Trim(),
            subject,
            bodyHtml,
            bodyText,
            isSystem: true,
            source: "proposta-vaga",
            ct);
    }

    private async Task<string> ResolverEmpresaNomeAsync(CancellationToken ct)
    {
        var empresa = await _db.Empresas
            .AsNoTracking()
            .Where(e => e.IsActive && !string.IsNullOrWhiteSpace(e.Description))
            .OrderBy(e => e.Description)
            .Select(e => e.Description)
            .FirstOrDefaultAsync(ct);
        if (!string.IsNullOrWhiteSpace(empresa))
            return empresa.Trim();

        var branding = await _db.TenantBrandings
            .AsNoTracking()
            .Where(b => !string.IsNullOrWhiteSpace(b.NomePortal))
            .Select(b => b.NomePortal)
            .FirstOrDefaultAsync(ct);

        return string.IsNullOrWhiteSpace(branding) ? "Portal de RH" : branding.Trim();
    }

    private static string SafeText(string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static string Html(string? value, string fallback)
        => WebUtility.HtmlEncode(SafeText(value, fallback));

    private async Task<PropostaVaga?> FindAndMaybeExpireAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var entity = await _db.Set<PropostaVaga>().IgnoreQueryFilters().FirstOrDefaultAsync(p => p.AccessToken == token, ct);
        if (entity is null) return null;

        if (entity.Status is PropostaVagaStatus.Enviada or PropostaVagaStatus.Visualizada
            && entity.ExpiraEmUtc.HasValue
            && entity.ExpiraEmUtc.Value < DateTimeOffset.UtcNow)
        {
            entity.Status = PropostaVagaStatus.Expirada;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return entity;
    }

    private async Task<PropostaVagaResponse?> BuildResponse(Guid id, CancellationToken ct)
    {
        var q = from prop in _db.Set<PropostaVaga>().AsNoTracking()
                where prop.Id == id
                join v in _db.Vagas.AsNoTracking() on prop.VagaId equals v.Id into vj
                from v in vj.DefaultIfEmpty()
                join c in _db.Candidatos.AsNoTracking() on prop.CandidatoId equals c.Id into cj
                from c in cj.DefaultIfEmpty()
                select new { p = prop, v, c };
        var row = await q.FirstOrDefaultAsync(ct);
        if (row is null) return null;
        var p = row.p;
        return new PropostaVagaResponse(
            p.Id, p.VagaId, row.v == null ? null : row.v.Titulo,
            p.CandidatoId, row.c == null ? null : row.c.Nome, row.c == null ? null : row.c.Email,
            p.CandidaturaId,
            p.Status, p.Moeda, p.SalarioOferecido, p.DescricaoBeneficios,
            p.DataPrevistaInicio, p.MensagemPersonalizada, p.AccessToken,
            p.EnviadaEmUtc, p.ExpiraEmUtc, p.VisualizadaEmUtc, p.RespondidaEmUtc,
            p.NomeConfirmadoCandidato, p.MotivoRecusa, p.ObservacaoInternaRh,
            p.CreatedAtUtc, p.UpdatedAtUtc);
    }

    private async Task<PropostaVagaPublicaResponse?> BuildPublicResponse(Guid id, CancellationToken ct)
    {
        var q = from prop in _db.Set<PropostaVaga>().AsNoTracking().IgnoreQueryFilters()
                where prop.Id == id
                join v in _db.Vagas.IgnoreQueryFilters().AsNoTracking() on prop.VagaId equals v.Id into vj
                from v in vj.DefaultIfEmpty()
                join c in _db.Candidatos.IgnoreQueryFilters().AsNoTracking() on prop.CandidatoId equals c.Id into cj
                from c in cj.DefaultIfEmpty()
                select new { p = prop, v, c };
        var row = await q.FirstOrDefaultAsync(ct);
        if (row is null) return null;
        var p = row.p;
        return new PropostaVagaPublicaResponse(
            p.Id, row.v == null ? null : row.v.Titulo,
            row.c == null ? null : row.c.Nome,
            p.Status, p.Moeda, p.SalarioOferecido, p.DescricaoBeneficios,
            p.DataPrevistaInicio, p.MensagemPersonalizada,
            p.EnviadaEmUtc, p.ExpiraEmUtc, p.RespondidaEmUtc);
    }

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= max ? value : value.Substring(0, max);
    }
}
