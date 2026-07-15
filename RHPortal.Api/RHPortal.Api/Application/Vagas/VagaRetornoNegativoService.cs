using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.Vagas;

public interface IVagaRetornoNegativoService
{
    Task<VagaRetornoNegativoPreviewResponse?> PreviewAsync(Guid vagaId, CancellationToken ct, string? emailTemplateCode = null);
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
    private readonly ICandidateEmailTemplateService _candidateEmailTemplates;

    public VagaRetornoNegativoService(
        AppDbContext db,
        ICandidaturaService candidaturaService,
        ICandidateEmailTemplateService candidateEmailTemplates)
    {
        _db = db;
        _candidaturaService = candidaturaService;
        _candidateEmailTemplates = candidateEmailTemplates;
    }

    public async Task<VagaRetornoNegativoPreviewResponse?> PreviewAsync(
        Guid vagaId,
        CancellationToken ct,
        string? emailTemplateCode = null)
    {
        var vaga = await _db.Vagas.AsNoTracking().FirstOrDefaultAsync(v => v.Id == vagaId, ct);
        if (vaga is null) return null;

        var destinatarios = await ListarElegiveisAsync(vagaId, ct);
        var code = string.IsNullOrWhiteSpace(emailTemplateCode)
            ? CandidateEmailTemplateCodes.EtapaRecusado
            : emailTemplateCode.Trim();
        if (!CandidateEmailTemplateCatalog.TryGet(code, out _))
            code = CandidateEmailTemplateCodes.EtapaRecusado;

        var empresaNome = await _db.TenantBrandings
            .AsNoTracking()
            .Select(x => x.NomePortal)
            .FirstOrDefaultAsync(ct) ?? "Portal de RH";

        var tokens = new Dictionary<string, string?>
        {
            ["CandidatoNome"] = "[Nome do candidato]",
            ["VagaTitulo"] = vaga.Titulo,
            ["EmpresaNome"] = empresaNome,
        };
        var rendered = await _candidateEmailTemplates.ResolveRenderedAsync(code, tokens, ct);

        return new VagaRetornoNegativoPreviewResponse(
            vagaId,
            vaga.Titulo,
            destinatarios,
            rendered.Subject,
            EmailTemplateRenderer.StripHtmlToText(rendered.BodyHtml));
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
        var templateCode = string.IsNullOrWhiteSpace(request.EmailTemplateCode)
            ? CandidateEmailTemplateCodes.EtapaRecusado
            : request.EmailTemplateCode.Trim();
        if (!CandidateEmailTemplateCatalog.TryGet(templateCode, out _))
            templateCode = CandidateEmailTemplateCodes.EtapaRecusado;

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
                    entrevista: null,
                    notificar: true,
                    ct,
                    emailTemplateCode: templateCode,
                    emailSubjectOverride: request.EmailSubjectOverride,
                    emailBodyHtmlOverride: request.EmailBodyHtmlOverride);
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
                cand.Fone,
                cand.Celular,
                c.EtapaMacro))
            .ToListAsync(ct);

        return rows;
    }
}
