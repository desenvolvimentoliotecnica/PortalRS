using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Vagas;

public interface IVagaRetornoNegativoService
{
    Task<VagaRetornoNegativoPreviewResponse?> PreviewAsync(Guid vagaId, CancellationToken ct);
    Task<VagaRetornoNegativoEnviarResponse> EnviarAsync(Guid vagaId, VagaRetornoNegativoEnviarRequest request, CancellationToken ct);
}

public sealed class VagaRetornoNegativoService : IVagaRetornoNegativoService
{
    private static readonly EtapaMacroCandidatura[] EtapasExcluidas =
    [
        EtapaMacroCandidatura.Contratado,
        EtapaMacroCandidatura.ReprovadoRh,
        EtapaMacroCandidatura.ReprovadoGestor,
        EtapaMacroCandidatura.Recusado,
        EtapaMacroCandidatura.Desistiu,
    ];

    private readonly AppDbContext _db;
    private readonly ICandidaturaService _candidaturaService;
    private readonly INotificacaoTemplateService _templateService;

    public VagaRetornoNegativoService(
        AppDbContext db,
        ICandidaturaService candidaturaService,
        INotificacaoTemplateService templateService)
    {
        _db = db;
        _candidaturaService = candidaturaService;
        _templateService = templateService;
    }

    public async Task<VagaRetornoNegativoPreviewResponse?> PreviewAsync(Guid vagaId, CancellationToken ct)
    {
        var vaga = await _db.Vagas.AsNoTracking().FirstOrDefaultAsync(v => v.Id == vagaId, ct);
        if (vaga is null) return null;

        var destinatarios = await ListarElegiveisAsync(vagaId, ct);
        var tpl = await _templateService.GetEfetivoAsync(EtapaMacroCandidatura.Recusado, CanalNotificacao.Email, ct);

        return new VagaRetornoNegativoPreviewResponse(
            vagaId,
            vaga.Titulo,
            destinatarios,
            tpl.Assunto,
            tpl.Corpo);
    }

    public async Task<VagaRetornoNegativoEnviarResponse> EnviarAsync(
        Guid vagaId,
        VagaRetornoNegativoEnviarRequest request,
        CancellationToken ct)
    {
        if (request.CandidaturaIds is null || request.CandidaturaIds.Count == 0)
            return new VagaRetornoNegativoEnviarResponse(0, 0, Array.Empty<VagaRetornoNegativoEnviarItemResult>());

        var elegiveis = await ListarElegiveisAsync(vagaId, ct);
        var elegivelSet = elegiveis.Select(d => d.CandidaturaId).ToHashSet();

        var resultados = new List<VagaRetornoNegativoEnviarItemResult>();
        var enviados = 0;
        var falhas = 0;

        foreach (var candidaturaId in request.CandidaturaIds.Distinct())
        {
            if (!elegivelSet.Contains(candidaturaId))
            {
                falhas++;
                resultados.Add(new VagaRetornoNegativoEnviarItemResult(candidaturaId, false, "Candidatura não elegível para retorno negativo."));
                continue;
            }

            try
            {
                var res = await _candidaturaService.AvancarEtapaAsync(
                    candidaturaId,
                    EtapaMacroCandidatura.Recusado,
                    "Retorno automático — vaga encerrada.",
                    ct);
                if (res is null)
                {
                    falhas++;
                    resultados.Add(new VagaRetornoNegativoEnviarItemResult(candidaturaId, false, "Candidatura não encontrada."));
                }
                else
                {
                    enviados++;
                    resultados.Add(new VagaRetornoNegativoEnviarItemResult(candidaturaId, true, null));
                }
            }
            catch (Exception ex)
            {
                falhas++;
                resultados.Add(new VagaRetornoNegativoEnviarItemResult(candidaturaId, false, ex.Message));
            }
        }

        return new VagaRetornoNegativoEnviarResponse(enviados, falhas, resultados);
    }

    private async Task<IReadOnlyList<VagaRetornoNegativoPreviewItem>> ListarElegiveisAsync(Guid vagaId, CancellationToken ct)
    {
        var rows = await (
            from c in _db.Candidaturas.AsNoTracking()
            where c.VagaId == vagaId
                  && !EtapasExcluidas.Contains(c.EtapaMacro)
                  && c.Status != CandidaturaStatus.Contratado
            join cand in _db.Candidatos.AsNoTracking() on c.CandidatoId equals cand.Id
            orderby cand.Nome
            select new VagaRetornoNegativoPreviewItem(
                c.Id,
                c.CandidatoId,
                cand.Nome,
                cand.Email,
                c.EtapaMacro))
            .ToListAsync(ct);

        return rows;
    }
}
