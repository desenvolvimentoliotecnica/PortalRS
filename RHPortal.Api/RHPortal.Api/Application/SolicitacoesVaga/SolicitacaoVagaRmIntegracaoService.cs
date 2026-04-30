using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public sealed class SolicitacaoVagaRmIntegracaoService : ISolicitacaoVagaRmIntegracaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IRmRequisicaoCreateClient _rmCreate;
    private readonly IOptions<RmRequisicaoCreateOptions> _options;
    private readonly StatusHistoricoService _statusHistorico;
    private readonly ICurrentUserContext _currentUser;

    public SolicitacaoVagaRmIntegracaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IRmRequisicaoCreateClient rmCreate,
        IOptions<RmRequisicaoCreateOptions> options,
        StatusHistoricoService statusHistorico,
        ICurrentUserContext currentUser)
    {
        _db = db;
        _tenantContext = tenantContext;
        _rmCreate = rmCreate;
        _options = options;
        _statusHistorico = statusHistorico;
        _currentUser = currentUser;
    }

    public async Task ExecutarCriacaoRequisicaoRmAsync(Guid solicitacaoVagaId, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga
            .FirstOrDefaultAsync(x => x.Id == solicitacaoVagaId, ct);

        if (entity is null)
            throw new KeyNotFoundException($"SolicitacaoVaga {solicitacaoVagaId} não encontrada.");

        var ctxTenant = _tenantContext.TenantId;
        if (!string.IsNullOrEmpty(ctxTenant) && entity.TenantId != ctxTenant)
            throw new InvalidOperationException("Tenant da solicitação não confere com o contexto atual.");

        static bool EstadoPermiteRm(SolicitacaoStatus st) =>
            st is SolicitacaoStatus.Aprovada
                or SolicitacaoStatus.PendenteIntegracaoRm
                or SolicitacaoStatus.AguardandoReprocessamentoRm
                or SolicitacaoStatus.ErroIntegracaoRm;

        if (!EstadoPermiteRm(entity.Status))
            throw new InvalidOperationException(
                $"Envio ao RM só é permitido a partir de Aprovada ou estados de reprocessamento (atual: {entity.Status}).");

        if (entity.IntegracaoResultado == IntegracaoResultado.Sucesso
            && !string.IsNullOrWhiteSpace(entity.RmRequisicaoCodigo))
            return;

        RmRequisicaoPayloadBuilder.EnsureCanBuild(entity);

        var resumo = RmRequisicaoPayloadBuilder.TruncateResumo(RmRequisicaoPayloadBuilder.BuildResumoJson(entity));
        var idempotencyKey = $"{entity.TenantId}:{entity.Id:N}";
        var statusAntesRm = entity.Status.ToString();

        entity.TentativasIntegracao += 1;
        entity.UltimaTentativaUtc = DateTimeOffset.UtcNow;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var max = Math.Max(1, _options.Value.MaxTentativas);
        RmCreateRequisicaoOutcome outcome;

        try
        {
            outcome = await _rmCreate.EnviarOuObterJaCriadoAsync(entity, idempotencyKey, resumo, ct);
        }
        catch (Exception ex)
        {
            outcome = new RmCreateRequisicaoOutcome(false, false, null, null, ex.Message, null);
        }

        var tentativa = new SolicitacaoVagaIntegracaoTentativa
        {
            Id = Guid.NewGuid(),
            TenantId = entity.TenantId,
            SolicitacaoVagaId = entity.Id,
            TentativaEmUtc = DateTimeOffset.UtcNow,
            Sucesso = outcome.Sucesso,
            PayloadResumo = resumo,
            MensagemErro = outcome.MensagemErro,
            CodigoTecnico = outcome.CodigoTecnico,
            CodigoRmRetornado = outcome.CodigoRm
        };
        _db.SolicitacoesVagaIntegracaoTentativas.Add(tentativa);

        if (outcome.Sucesso)
        {
            if (!string.IsNullOrWhiteSpace(outcome.CodigoRm))
                entity.RmRequisicaoCodigo = outcome.CodigoRm[..Math.Min(outcome.CodigoRm.Length, 120)];
            entity.RmCodStatus = outcome.CodStatusRm;
            entity.RmUltimaSincronizacaoUtc = DateTimeOffset.UtcNow;
            entity.IntegracaoResultado = IntegracaoResultado.Sucesso;
            entity.IntegracaoMensagem = outcome.JaExistiaNoRm
                ? "Requisição já existente no RM (confirmação idempotente)."
                : "Requisição criada no RM.";
            entity.IntegradaEmUtc = DateTimeOffset.UtcNow;
            entity.Status = SolicitacaoStatus.EmIntegracao;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                statusAntesRm, entity.Status.ToString(),
                _currentUser, outcome.JaExistiaNoRm ? "RM: idempotente" : "RM: criação concluída", ct);
        }
        else
        {
            var definitiva = entity.TentativasIntegracao >= max;
            entity.IntegracaoResultado = definitiva
                ? IntegracaoResultado.FalhaDefinitiva
                : IntegracaoResultado.Falha;

            entity.IntegracaoMensagem = outcome.MensagemErro is { Length: > 2000 }
                ? outcome.MensagemErro[..2000]
                : outcome.MensagemErro;
            entity.IntegradaEmUtc = null;

            var statusNovo = definitiva ? SolicitacaoStatus.ErroIntegracaoRm : SolicitacaoStatus.AguardandoReprocessamentoRm;
            entity.Status = statusNovo;

            await _statusHistorico.RegistrarAsync(
                TipoEntidadeStatus.SolicitacaoVaga, entity.Id,
                statusAntesRm, entity.Status.ToString(),
                _currentUser, $"RM falhou ({(definitiva ? "definitivo" : "reprocessável")})", ct);
        }

        await _db.SaveChangesAsync(ct);
    }
}
