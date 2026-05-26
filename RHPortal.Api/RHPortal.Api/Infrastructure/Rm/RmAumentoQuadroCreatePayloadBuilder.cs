using System.Globalization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Rm;

internal static class RmAumentoQuadroCreatePayloadBuilder
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public static RmAumentoQuadroCreateRequest Build(
        SolicitacaoVaga solicitacao,
        RmRequisicaoCreateOptions options,
        DateTimeOffset nowLocal)
    {
        if (solicitacao.TipoSolicitacao is not (TipoSolicitacaoVaga.VagaNova or TipoSolicitacaoVaga.AumentoQuadro))
            throw new InvalidOperationException("A criação RM via RhuReqAumentoQuadroData está restrita a solicitações de VagaNova e AumentoQuadro.");

        var codColRequisicao = options.CodColRequisicaoDefault
            ?? throw new InvalidOperationException("Configure RmRequisicaoCreate:CodColRequisicaoDefault para criar requisições no RM.");
        var codColRequisitante = options.CodColRequisitanteDefault ?? codColRequisicao;
        var codLocal = options.CodLocalDefault
            ?? throw new InvalidOperationException("Configure RmRequisicaoCreate:CodLocalDefault para criar requisições no RM.");

        var codFilial = TryParseShort(solicitacao.Empresa?.Code)
            ?? TryParseShort(solicitacao.Unit?.Code)
            ?? options.CodFilialDefault
            ?? throw new InvalidOperationException(
                "Não foi possível resolver CODFILIAL a partir de Empresa.Code/Unit.Code. Configure RmRequisicaoCreate:CodFilialDefault.");

        var chapaRequisitante = TrimRequired(
            solicitacao.Solicitante?.MatriculaRm,
            "Solicitante sem MatriculaRm. Vincule a CHAPA RM do requisitante antes de enviar.");
        var codSecao = TrimRequired(
            solicitacao.CentroCusto?.Code,
            "Solicitação sem CentroCusto.Code. CODSECAO é obrigatório para o RM.");
        var codFuncao = TrimRequired(
            solicitacao.CodFuncaoRm,
            "Solicitação sem CodFuncaoRm. CODFUNCAO é obrigatório para o RM.");

        var salario = solicitacao.FaixaSalarialMax ?? solicitacao.FaixaSalarialMin
            ?? throw new InvalidOperationException("Solicitação sem faixa salarial. VLRSALARIO é obrigatório para o RM.");

        var justificativa = TrimRequired(
            solicitacao.Justificativa ?? solicitacao.Titulo,
            "Solicitação sem justificativa/título para enviar ao RM.");

        var dataAbertura = solicitacao.CreatedAtUtc == default
            ? nowLocal
            : solicitacao.CreatedAtUtc.ToOffset(nowLocal.Offset);
        var dataModificacao = solicitacao.UpdatedAtUtc == default
            ? nowLocal
            : solicitacao.UpdatedAtUtc.ToOffset(nowLocal.Offset);
        var dataPrevista = new DateTimeOffset(
            dataAbertura.Date.AddDays(Math.Max(0, options.DiasPrevisaoPadrao)),
            dataAbertura.Offset);

        return new RmAumentoQuadroCreateRequest(
            CODCOLREQUISICAO: codColRequisicao,
            IDREQ: -1,
            JUSTIFICATIVA: justificativa,
            DATAABERTURA: dataAbertura,
            CODCOLREQUISITANTE: codColRequisitante,
            CHAPAREQUISITANTE: chapaRequisitante,
            CODLOCAL: codLocal,
            CODSTATUS: options.CodStatusInicial,
            DATAPREVISTA: dataPrevista,
            NUMVAGAS: Math.Max(1, solicitacao.QtdPosicoes),
            CODFILIAL: codFilial,
            CODSECAO: codSecao,
            CODFUNCAO: codFuncao,
            VLRSALARIO: salario.ToString("0.00", PtBr),
            RECCREATEDBY: TrimOrDefault(options.RecCreatedBy, "portal"),
            RECCREATEDON: dataAbertura,
            RECMODIFIEDBY: TrimOrDefault(options.RecModifiedBy, "portal"),
            RECMODIFIEDON: dataModificacao);
    }

    private static string TrimRequired(string? value, string errorMessage)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new InvalidOperationException(errorMessage);
        return trimmed;
    }

    private static string TrimOrDefault(string? value, string fallback)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? fallback : trimmed;
    }

    private static short? TryParseShort(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return short.TryParse(value.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }
}

internal sealed record RmAumentoQuadroCreateRequest(
    short CODCOLREQUISICAO,
    int IDREQ,
    string JUSTIFICATIVA,
    DateTimeOffset DATAABERTURA,
    short CODCOLREQUISITANTE,
    string CHAPAREQUISITANTE,
    int CODLOCAL,
    short CODSTATUS,
    DateTimeOffset DATAPREVISTA,
    int NUMVAGAS,
    short CODFILIAL,
    string CODSECAO,
    string CODFUNCAO,
    string VLRSALARIO,
    string RECCREATEDBY,
    DateTimeOffset RECCREATEDON,
    string RECMODIFIEDBY,
    DateTimeOffset RECMODIFIEDON);
