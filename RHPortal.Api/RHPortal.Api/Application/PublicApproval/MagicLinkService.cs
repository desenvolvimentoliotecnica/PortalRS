using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.PublicApproval;

public sealed class MagicLinkService : IMagicLinkService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IEmailQueueService _emailQueue;

    private static readonly TimeSpan TokenTtl = TimeSpan.FromHours(72);

    public MagicLinkService(AppDbContext db, ITenantContext tenantContext, IEmailQueueService emailQueue)
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
            .Replace('+', '-').Replace('/', '_').TrimEnd('='); // URL-safe
    }

    // ── Public interface ──────────────────────────────────────────────

    public async Task CreateAndSendAsync(
        SolicitacaoAprovacaoEtapa etapa,
        TipoFluxoAprovacao tipoFluxo,
        Guid solicitacaoId,
        string tituloSolicitacao,
        string solicitanteNome,
        string? httpScheme,
        string? httpHost,
        CancellationToken ct)
    {
        if (!etapa.AprovadorId.HasValue) return;

        var aprovadorFuncionarioId = etapa.AprovadorId.Value;

        var aprovador = await _db.Set<Funcionario>()
            .AsNoTracking()
            .Where(f => f.Id == aprovadorFuncionarioId)
            .Select(f => new { f.Name, f.Email })
            .FirstOrDefaultAsync(ct);

        if (aprovador is null || string.IsNullOrWhiteSpace(aprovador.Email)) return;

        var token = GenerateToken();
        var now = DateTimeOffset.UtcNow;

        _db.Set<ApprovalMagicLink>().Add(new ApprovalMagicLink
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Token = token,
            EtapaId = etapa.Id,
            SolicitacaoId = solicitacaoId,
            TipoFluxo = tipoFluxo,
            AprovadorFuncionarioId = aprovadorFuncionarioId,
            ExpiresAtUtc = now.Add(TokenTtl),
            CreatedAtUtc = now,
        });
        await _db.SaveChangesAsync(ct);

        var scheme = httpScheme ?? "http";
        var host = httpHost ?? "localhost";
        var baseUrl = $"{scheme}://{host}:3000";
        var approveUrl = $"{baseUrl}/app/public/approve?token={token}&action=approve";
        var rejectUrl  = $"{baseUrl}/app/public/approve?token={token}&action=reject";
        var portalUrl  = $"{baseUrl}/rs/solicitacoes/{solicitacaoId}";
        var tipoLabel  = TipoFluxoLabel(tipoFluxo);

        var body = $@"<p>Olá <b>{aprovador.Name}</b>,</p>
<p>Você tem uma solicitação de <strong>{tipoLabel}</strong> aguardando sua decisão.</p>
<p><strong>Título:</strong> {tituloSolicitacao}<br/><strong>Solicitante:</strong> {solicitanteNome}</p>
<table cellpadding=""0"" cellspacing=""0"" style=""margin:24px 0;""><tr>
  <td style=""padding-right:12px;"">
    <a href=""{approveUrl}"" style=""background:#16a34a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;"">✅ Aprovar</a>
  </td>
  <td>
    <a href=""{rejectUrl}"" style=""background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;"">❌ Reprovar</a>
  </td>
</tr></table>
<p style=""font-size:13px;color:#666;"">Para solicitar ajustes ou ver detalhes, <a href=""{portalUrl}"">acesse o portal</a>.</p>
<p style=""font-size:12px;color:#999;"">Este link expira em 72 horas. Não compartilhe com terceiros.</p>";

        try
        {
            await _emailQueue.EnqueueRawAsync(
                aprovador.Email,
                $"[Aprovação pendente] {tipoLabel}: {tituloSolicitacao}",
                body, null, false, "magic-link-aprovacao", ct);
        }
        catch { /* best-effort */ }
    }

    public async Task<MagicLinkSummary?> GetSummaryAsync(string token, CancellationToken ct)
    {
        var link = await _db.Set<ApprovalMagicLink>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Token == token, ct);

        if (link is null) return null;

        return new MagicLinkSummary(
            link.SolicitacaoId,
            TipoFluxoLabel(link.TipoFluxo),
            await GetTituloAsync(link, ct) ?? "—",
            await GetSolicitanteNomeAsync(link, ct) ?? "—",
            Expirado: link.ExpiresAtUtc < DateTimeOffset.UtcNow,
            JaUtilizado: link.UsedAtUtc.HasValue);
    }

    public async Task<MagicLinkResultado> ProcessarAcaoAsync(
        string token, MagicLinkAcao acao, string? observacao,
        string? ipAddress, string? userAgent, CancellationToken ct)
    {
        var link = await _db.Set<ApprovalMagicLink>()
            .FirstOrDefaultAsync(x => x.Token == token, ct);

        if (link is null)                              return MagicLinkResultado.TokenInvalido;
        if (link.UsedAtUtc.HasValue)                   return MagicLinkResultado.JaUtilizado;
        if (link.ExpiresAtUtc < DateTimeOffset.UtcNow) return MagicLinkResultado.Expirado;

        var etapa = await _db.SolicitacoesAprovacaoEtapa
            .FirstOrDefaultAsync(e => e.Id == link.EtapaId, ct);

        if (etapa is null || etapa.Status != StatusAprovacao.Pendente)
            return MagicLinkResultado.EtapaJaProcessada;

        var now = DateTimeOffset.UtcNow;

        etapa.AprovadorId = link.AprovadorFuncionarioId;
        etapa.DataUtc = now;
        etapa.Observacao = observacao;

        if (acao == MagicLinkAcao.Aprovar)
        {
            etapa.Status = StatusAprovacao.Aprovado;
            await ProcessarAprovacaoAsync(link, observacao, now, ct);
        }
        else // Reprovar
        {
            etapa.Status = StatusAprovacao.Rejeitado;

            // Cancelar demais etapas pendentes
            var outrasPendentes = await _db.SolicitacoesAprovacaoEtapa
                .Where(e => e.SolicitacaoId == link.SolicitacaoId
                         && e.TipoFluxo == link.TipoFluxo
                         && e.Id != link.EtapaId
                         && e.Status == StatusAprovacao.Pendente)
                .ToListAsync(ct);
            foreach (var ep in outrasPendentes) ep.Status = StatusAprovacao.Cancelado;

            await ProcessarReprovacaoAsync(link, observacao, now, ct);
        }

        link.UsedAtUtc = now;
        link.AcaoRealizada = acao;
        link.IpAddress = ipAddress;
        link.UserAgent = userAgent;

        await _db.SaveChangesAsync(ct);
        return MagicLinkResultado.Sucesso;
    }

    // ── Status update helpers ─────────────────────────────────────────

    private async Task ProcessarAprovacaoAsync(
        ApprovalMagicLink link, string? observacao, DateTimeOffset now, CancellationToken ct)
    {
        // Verificar se TODAS as etapas do fluxo estão aprovadas após esta atualização
        var todasEtapas = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == link.SolicitacaoId && e.TipoFluxo == link.TipoFluxo)
            .ToListAsync(ct);

        // A etapa atual ainda está como Pendente no contexto do EF (antes do SaveChanges),
        // mas foi atribuída como Aprovado no objeto rastreado acima
        var todasAprovadas = todasEtapas.All(e =>
            e.Id == link.EtapaId
                ? e.Status == StatusAprovacao.Aprovado // já foi atribuído acima
                : e.Status == StatusAprovacao.Aprovado);

        if (!todasAprovadas) return; // ainda há etapas futuras — status permanece PendenteAprovacao

        switch (link.TipoFluxo)
        {
            case TipoFluxoAprovacao.RequisicaoPessoal:
            {
                var sol = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoVagaStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
            default:
                await MarcarSolicitacaoGenericaAprovadaAsync(link, now, ct);
                break;
        }
    }

    private async Task ProcessarReprovacaoAsync(
        ApprovalMagicLink link, string? observacao, DateTimeOffset now, CancellationToken ct)
    {
        switch (link.TipoFluxo)
        {
            case TipoFluxoAprovacao.RequisicaoPessoal:
            {
                var sol = await _db.SolicitacoesVaga.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoVagaStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.MovimentacaoPessoal:
            {
                var sol = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Desligamento:
            {
                var sol = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Ferias:
            {
                var sol = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Beneficio:
            {
                var sol = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Dependente:
            {
                var sol = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Endereco:
            {
                var sol = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Reprovada;
                sol.ObservacaoAprovador = observacao;
                sol.UpdatedAtUtc = now;
                break;
            }
        }
    }

    private async Task MarcarSolicitacaoGenericaAprovadaAsync(ApprovalMagicLink link, DateTimeOffset now, CancellationToken ct)
    {
        switch (link.TipoFluxo)
        {
            case TipoFluxoAprovacao.MovimentacaoPessoal:
            {
                var sol = await _db.SolicitacoesPromocao.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Desligamento:
            {
                var sol = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Ferias:
            {
                var sol = await _db.SolicitacoesFerias.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Beneficio:
            {
                var sol = await _db.SolicitacoesBeneficio.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Dependente:
            {
                var sol = await _db.SolicitacoesDependente.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
            case TipoFluxoAprovacao.Endereco:
            {
                var sol = await _db.SolicitacoesEndereco.FirstOrDefaultAsync(x => x.Id == link.SolicitacaoId, ct);
                if (sol is null) break;
                sol.Status = SolicitacaoStatus.Aprovada;
                sol.ApprovedAtUtc = now;
                sol.UpdatedAtUtc = now;
                break;
            }
        }
    }

    // ── Lookup helpers ────────────────────────────────────────────────

    private async Task<string?> GetTituloAsync(ApprovalMagicLink link, CancellationToken ct) =>
        link.TipoFluxo switch
        {
            TipoFluxoAprovacao.RequisicaoPessoal =>
                await _db.SolicitacoesVaga.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => x.Titulo).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.MovimentacaoPessoal =>
                await _db.SolicitacoesPromocao.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => x.Justificativa ?? "Movimentação").FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Desligamento =>
                await _db.SolicitacoesDesligamento.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (string?)"Desligamento").FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Ferias =>
                await _db.SolicitacoesFerias.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (string?)"Férias").FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Beneficio =>
                await _db.SolicitacoesBeneficio.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => x.TipoBeneficio.ToString()).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Dependente =>
                await _db.SolicitacoesDependente.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => x.NomeCompleto).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Endereco =>
                await _db.SolicitacoesEndereco.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (string?)"Alteração de endereço").FirstOrDefaultAsync(ct),
            _ => "Solicitação"
        };

    private async Task<string?> GetSolicitanteNomeAsync(ApprovalMagicLink link, CancellationToken ct)
    {
        Guid? solicitanteId = link.TipoFluxo switch
        {
            TipoFluxoAprovacao.RequisicaoPessoal =>
                await _db.SolicitacoesVaga.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.MovimentacaoPessoal =>
                await _db.SolicitacoesPromocao.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Desligamento =>
                await _db.SolicitacoesDesligamento.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Ferias =>
                await _db.SolicitacoesFerias.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Beneficio =>
                await _db.SolicitacoesBeneficio.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Dependente =>
                await _db.SolicitacoesDependente.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            TipoFluxoAprovacao.Endereco =>
                await _db.SolicitacoesEndereco.AsNoTracking()
                    .Where(x => x.Id == link.SolicitacaoId).Select(x => (Guid?)x.SolicitanteId).FirstOrDefaultAsync(ct),
            _ => null
        };

        if (!solicitanteId.HasValue) return null;
        return await _db.Set<Funcionario>().AsNoTracking()
            .Where(f => f.Id == solicitanteId.Value).Select(f => f.Name).FirstOrDefaultAsync(ct);
    }

    private static string TipoFluxoLabel(TipoFluxoAprovacao tipo) => tipo switch
    {
        TipoFluxoAprovacao.RequisicaoPessoal   => "Requisição de Pessoal",
        TipoFluxoAprovacao.MovimentacaoPessoal => "Movimentação / Promoção",
        TipoFluxoAprovacao.Desligamento        => "Desligamento",
        TipoFluxoAprovacao.Ferias              => "Férias",
        TipoFluxoAprovacao.Beneficio           => "Benefício",
        TipoFluxoAprovacao.Dependente          => "Dependente",
        TipoFluxoAprovacao.Endereco            => "Alteração de Endereço",
        _                                      => "Solicitação"
    };
}
