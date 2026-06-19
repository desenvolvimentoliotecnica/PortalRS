namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>Unificação de requisições RM — mesma semântica da consulta analítica (views VREQ*).</summary>
internal static class RmRequisicoesQueries
{
    /// <summary>
    /// CTE + projeção com joins (sem ORDER/WHERE final). Prefixo para COUNT ou página.
    /// </summary>
    internal const string CteAndBase = """
WITH REQUISICOES AS
(
    SELECT
        'AUMENTO_QUADRO' AS TIPO_REQUISICAO,
        R.CODCOLREQUISICAO,
        R.IDREQ,
        R.JUSTIFICATIVA,
        R.DATAABERTURA,
        R.DATAPREVISTA,
        R.DATACONCLUSAO,
        R.DATACANCELAMENTO,
        R.CODSTATUS,
        R.CODCOLREQUISITANTE,
        R.CHAPAREQUISITANTE,
        R.CODATENDIMENTO,
        R.CODLOCAL,
        CAST(NULL AS VARCHAR(20)) AS TIPOREQPAI,
        CAST(NULL AS INT) AS IDREQPAI,
        CAST(NULL AS VARCHAR(30)) AS CHAPA_FUNCIONARIO,
        CAST(NULL AS VARCHAR(30)) AS CHAPA_SUBSTITUTO,
        R.NUMVAGAS,
        R.CODFILIAL,
        R.CODSECAO,
        R.CODFUNCAO,
        R.VLRSALARIO,
        R.CODCCUSTO,
        R.RECCREATEDBY,
        R.RECCREATEDON,
        R.RECMODIFIEDBY,
        R.RECMODIFIEDON
    FROM VREQAUMENTOQUADRO R
    UNION ALL
    SELECT
        'SUBSTITUICAO',
        R.CODCOLREQUISICAO,
        R.IDREQ,
        R.JUSTIFICATIVA,
        R.DATAABERTURA,
        R.DATAPREVISTA,
        R.DATACONCLUSAO,
        R.DATACANCELAMENTO,
        R.CODSTATUS,
        R.CODCOLREQUISITANTE,
        R.CHAPAREQUISITANTE,
        R.CODATENDIMENTO,
        R.CODLOCAL,
        R.TIPOREQPAI,
        R.IDREQPAI,
        CAST(NULL AS VARCHAR(30)),
        R.CHAPASUBSTITUTO,
        CAST(NULL AS INT),
        R.CODFILIAL,
        R.CODSECAO,
        R.CODFUNCAO,
        R.VLRSALARIO,
        R.CODCCUSTO,
        R.RECCREATEDBY,
        R.RECCREATEDON,
        R.RECMODIFIEDBY,
        R.RECMODIFIEDON
    FROM VREQSUBSTITUICAO R
    UNION ALL
    SELECT
        'DESLIGAMENTO',
        R.CODCOLREQUISICAO,
        R.IDREQ,
        R.JUSTIFICATIVA,
        R.DATAABERTURA,
        R.DATAPREVISTA,
        R.DATACONCLUSAO,
        R.DATACANCELAMENTO,
        R.CODSTATUS,
        R.CODCOLREQUISITANTE,
        R.CHAPAREQUISITANTE,
        R.CODATENDIMENTO,
        R.CODLOCAL,
        CAST(NULL AS VARCHAR(20)),
        CAST(NULL AS INT),
        R.CHAPA,
        CAST(NULL AS VARCHAR(30)),
        CAST(NULL AS INT),
        CAST(NULL AS VARCHAR(30)),
        CAST(NULL AS VARCHAR(30)),
        CAST(NULL AS VARCHAR(30)),
        CAST(NULL AS DECIMAL(18,2)),
        R.CODCCUSTO,
        R.RECCREATEDBY,
        R.RECCREATEDON,
        R.RECMODIFIEDBY,
        R.RECMODIFIEDON
    FROM VREQDESLIGAMENTO R
),
Base AS (
    SELECT
        Q.TIPO_REQUISICAO,
        Q.CODCOLREQUISICAO,
        Q.IDREQ,
        Q.JUSTIFICATIVA,
        Q.DATAABERTURA,
        Q.DATAPREVISTA,
        Q.DATACONCLUSAO,
        Q.DATACANCELAMENTO,
        Q.CODSTATUS,
        S.DESCRICAO AS STATUS_DESCRICAO,
        S.PODEALTERAR AS STATUS_PERMITE_ALTERAR,
        Q.CODCOLREQUISITANTE,
        Q.CHAPAREQUISITANTE,
        FREQ.NOME AS NOME_REQUISITANTE,
        Q.CODATENDIMENTO,
        Q.CODLOCAL,
        HEXT.ASSUNTOOC AS ATENDIMENTO_ASSUNTO,
        Q.TIPOREQPAI,
        Q.IDREQPAI,
        Q.CHAPA_FUNCIONARIO,
        FFUNC.NOME AS NOME_FUNCIONARIO_ENVOLVIDO,
        Q.CHAPA_SUBSTITUTO,
        FSUB.NOME AS NOME_FUNCIONARIO_SUBSTITUTO,
        Q.NUMVAGAS,
        Q.CODFILIAL,
        Q.CODSECAO,
        Q.CODFUNCAO,
        FUN.NOME AS NOME_FUNCAO,
        FUN.DESCRICAO AS DESCRICAO_FUNCAO,
        Q.VLRSALARIO,
        Q.CODCCUSTO,
        Q.RECCREATEDBY,
        Q.RECCREATEDON,
        Q.RECMODIFIEDBY,
        Q.RECMODIFIEDON
    FROM REQUISICOES Q
    LEFT JOIN VREQSTATUS S ON S.CODINTERNO = Q.CODSTATUS
    LEFT JOIN PFUNC FREQ ON FREQ.CODCOLIGADA = Q.CODCOLREQUISITANTE AND FREQ.CHAPA = Q.CHAPAREQUISITANTE
    LEFT JOIN PFUNC FFUNC ON FFUNC.CODCOLIGADA = Q.CODCOLREQUISICAO AND FFUNC.CHAPA = Q.CHAPA_FUNCIONARIO
    LEFT JOIN PFUNC FSUB ON FSUB.CODCOLIGADA = Q.CODCOLREQUISICAO AND FSUB.CHAPA = Q.CHAPA_SUBSTITUTO
    LEFT JOIN PFUNCAO FUN ON FUN.CODCOLIGADA = Q.CODCOLREQUISICAO AND FUN.CODIGO = Q.CODFUNCAO
    LEFT JOIN HATENDIMENTOBASE HEXT ON HEXT.CODCOLIGADA = Q.CODCOLREQUISICAO AND HEXT.CODLOCAL = Q.CODLOCAL AND HEXT.CODATENDIMENTO = Q.CODATENDIMENTO
)
""";

    internal static string SqlCount => $"{CteAndBase}\nSELECT COUNT(1) FROM Base WHERE {WhereClause};";

    internal static string SqlPage(string? sortBy, string? sortDir)
        => $"{CteAndBase}\nSELECT * FROM Base WHERE {WhereClause} ORDER BY {BuildOrderBy(sortBy, sortDir)} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;";

    /// <summary>Vínculo portal (TIPO_REQUISICAO|CODCOLREQUISICAO|IDREQ) — um registo.</summary>
    internal static string SqlCodStatusPorVinculo =>
        $"{CteAndBase}\nSELECT TOP 1 CODSTATUS, STATUS_DESCRICAO, TIPO_REQUISICAO, CODCOLREQUISICAO, IDREQ FROM Base WHERE TIPO_REQUISICAO = @Tipo AND CODCOLREQUISICAO = @CodCol AND IDREQ = @IdReq;";

    private const string WhereClause =
        """
        (@Tipo IS NULL OR TIPO_REQUISICAO = @Tipo)
        AND (@DataDe IS NULL OR DATAABERTURA >= @DataDe)
        AND (@DataAte IS NULL OR DATAABERTURA < DATEADD(day, 1, @DataAte))
        AND (@CodStatusCsv IS NULL OR CHARINDEX(',' + CAST(CODSTATUS AS VARCHAR(20)) + ',', @CodStatusCsv) > 0)
        AND (@SearchPattern IS NULL OR (
            CAST(IDREQ AS VARCHAR(20)) LIKE @SearchPattern OR JUSTIFICATIVA LIKE @SearchPattern
        ))
        """;

    private static string BuildOrderBy(string? sortBy, string? sortDir)
    {
        var column = (sortBy ?? "").Trim().ToLowerInvariant() switch
        {
            "tipo" => "TIPO_REQUISICAO",
            "id" => "IDREQ",
            "status" => "CODSTATUS",
            "requisitante" => "NOME_REQUISITANTE",
            "funcao" => "NOME_FUNCAO",
            "salario" => "VLRSALARIO",
            "justificativa" => "JUSTIFICATIVA",
            _ => "DATAABERTURA"
        };

        var direction = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC";
        return $"{column} {direction}, IDREQ DESC";
    }
}
