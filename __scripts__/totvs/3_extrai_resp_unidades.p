/***********************************************************************************************************/
/* Data.....: 12/04/2026                                                                                   */
/* Descricao: Extrai o responsavel de cada unidade de lotacao para o passo 4 da importacao no RHPortal    */
/*            (POST /api/unidades-lotacao/import-owners).                                                  */
/*                                                                                                         */
/* Gera tres arquivos:                                                                                     */
/*   1. resp_unidades.csv          : import no RHPortal (CdnPlanoLotac|UnitCode|CdnEmpresa|CdnEstab|CdnFuncionario) */
/*   2. resp_unidades_arvore.csv   : arvore visual — cada filho aparece abaixo do pai                      */
/*   3. resp_unidades_sem_lotados.csv : unidades sem nenhum funcionario ativo                              */
/*                                                                                                         */
/* Logica:                                                                                                 */
/*   Para cada unidade, varre os funcionarios ativos lotados nela.                                         */
/*   Usa cdn_niv_cargo do funcionario para determinar o mais senior:                                       */
/*     menor cdn_niv_cargo = nivel mais alto na hierarquia (ex: 1=Diretor, 2=Gerente...)                   */
/*                                                                                                         */
/* Ordem de importacao recomendada no RHPortal:                                                            */
/*   1. UnidadesLotacao  (1_extrai_unidades_organizacionais.p)                                             */
/*   2. Colaboradores    (2_extrai_colaboradores_unidade.p)                                                 */
/*   3. [ESTE SCRIPT] Responsaveis -> POST /api/unidades-lotacao/import-owners                             */
/***********************************************************************************************************/

DEFINE BUFFER b_pai      FOR unid_lotac.
DEFINE BUFFER b_plano_pai FOR unid_lotac_plano.

DEFINE VARIABLE cArqImport      AS CHARACTER NO-UNDO INITIAL "\\10.0.211.36\proj\F739_F798_F830\scripts_carga\cargas_homolog\unid_lotac\resp_unidades.csv".
DEFINE VARIABLE cArqArvore      AS CHARACTER NO-UNDO INITIAL "\\10.0.211.36\proj\F739_F798_F830\scripts_carga\cargas_homolog\unid_lotac\resp_unidades_arvore.csv".
DEFINE VARIABLE cArqSemResp     AS CHARACTER NO-UNDO INITIAL "\\10.0.211.36\proj\F739_F798_F830\scripts_carga\cargas_homolog\unid_lotac\resp_unidades_sem_lotados.csv".
DEFINE VARIABLE cEmpresa        AS CHARACTER NO-UNDO INITIAL "1".
DEFINE VARIABLE iLinhas         AS INTEGER   NO-UNDO.
DEFINE VARIABLE iSemFuncionario AS INTEGER   NO-UNDO.
DEFINE VARIABLE cIndent         AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCodPai         AS CHARACTER NO-UNDO.
DEFINE VARIABLE cDesPai         AS CHARACTER NO-UNDO.
DEFINE VARIABLE iNiv            AS INTEGER   NO-UNDO.
DEFINE VARIABLE iPlano          AS INTEGER   NO-UNDO.
DEFINE VARIABLE cCurPai         AS CHARACTER NO-UNDO.
DEFINE VARIABLE i               AS INTEGER   NO-UNDO.

DEFINE TEMP-TABLE tt_resp NO-UNDO
    FIELD cod_unid_lotac   AS CHARACTER
    FIELD des_unid_lotac   AS CHARACTER
    FIELD cod_unid_pai     AS CHARACTER
    FIELD des_unid_pai     AS CHARACTER
    FIELD num_niv          AS INTEGER
    FIELD cdn_plano_lotac  AS INTEGER
    FIELD cCaminho         AS CHARACTER   /* caminho de ordenacao: pai/avo/.../este */
    FIELD cdn_funcionario  AS CHARACTER
    FIELD cdn_empresa      AS CHARACTER
    FIELD cdn_estab        AS CHARACTER
    FIELD nom_pessoa_fisic AS CHARACTER
    FIELD cdn_niv_cargo    AS INTEGER
    INDEX ix_unid    IS PRIMARY UNIQUE cod_unid_lotac
    INDEX ix_caminho cCaminho.

/* Buffer para percorrer a arvore de tt_resp ao montar o caminho */
DEFINE BUFFER b_anc FOR tt_resp.

DEFINE TEMP-TABLE tt_unidades NO-UNDO
    FIELD cod_unid_lotac AS CHARACTER
    INDEX ix_unid IS PRIMARY UNIQUE cod_unid_lotac.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 1: Registra todas as unidades existentes no plano de lotacao          */
/* ─────────────────────────────────────────────────────────────────────────── */
FOR EACH unid_lotac_plano NO-LOCK:
    FIND tt_unidades
        WHERE tt_unidades.cod_unid_lotac = STRING(unid_lotac_plano.cod_unid_lotac)
        NO-ERROR.
    IF NOT AVAIL tt_unidades THEN DO:
        CREATE tt_unidades.
        ASSIGN tt_unidades.cod_unid_lotac = STRING(unid_lotac_plano.cod_unid_lotac).
    END.
END.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 2: Varre funcionarios ativos e determina o mais senior por unidade    */
/* ─────────────────────────────────────────────────────────────────────────── */
FOR EACH funcionario NO-LOCK
    WHERE funcionario.dat_desligto_func = ?
      AND funcionario.cdn_empresa       = cEmpresa
      AND funcionario.cod_unid_lotac   <> "":

    FIND tt_unidades
        WHERE tt_unidades.cod_unid_lotac = STRING(funcionario.cod_unid_lotac)
        NO-ERROR.
    IF NOT AVAIL tt_unidades THEN NEXT.

    FIND tt_resp
        WHERE tt_resp.cod_unid_lotac = STRING(funcionario.cod_unid_lotac)
        NO-ERROR.

    IF NOT AVAIL tt_resp THEN DO:

        FIND unid_lotac
            WHERE unid_lotac.cod_unid_lotac = funcionario.cod_unid_lotac
            NO-LOCK NO-ERROR.

        ASSIGN cCodPai = "" cDesPai = "" iNiv = 0 iPlano = 0.

        FOR FIRST unid_lotac_plano
            WHERE unid_lotac_plano.cod_unid_lotac = funcionario.cod_unid_lotac
            NO-LOCK:
            ASSIGN
                iNiv   = unid_lotac_plano.num_niv_unid_lotac
                iPlano = unid_lotac_plano.cdn_plano_lotac.
        END.

        FOR FIRST estrut_plano_lotac
            WHERE estrut_plano_lotac.cod_unid_lotac_filho = funcionario.cod_unid_lotac
            NO-LOCK:
            ASSIGN cCodPai = estrut_plano_lotac.cod_unid_lotac_pai.
        END.

        IF cCodPai <> "" THEN DO:
            FIND b_pai
                WHERE b_pai.cod_unid_lotac = cCodPai
                NO-LOCK NO-ERROR.
            IF AVAIL b_pai THEN ASSIGN cDesPai = b_pai.des_unid_lotac.
        END.

        FIND rh_pessoa_fisic
            WHERE rh_pessoa_fisic.num_pessoa_fisic = funcionario.num_pessoa_fisic
            NO-LOCK NO-ERROR.

        CREATE tt_resp.
        ASSIGN
            tt_resp.cod_unid_lotac   = STRING(funcionario.cod_unid_lotac)
            tt_resp.des_unid_lotac   = IF AVAIL unid_lotac THEN unid_lotac.des_unid_lotac ELSE ""
            tt_resp.cod_unid_pai     = cCodPai
            tt_resp.des_unid_pai     = cDesPai
            tt_resp.num_niv          = iNiv
            tt_resp.cdn_plano_lotac  = iPlano
            tt_resp.cdn_funcionario  = STRING(funcionario.cdn_funcionario)
            tt_resp.cdn_empresa      = STRING(funcionario.cdn_empresa)
            tt_resp.cdn_estab        = STRING(funcionario.cdn_estab)
            tt_resp.nom_pessoa_fisic = IF AVAIL rh_pessoa_fisic THEN rh_pessoa_fisic.nom_pessoa_fisic ELSE ""
            tt_resp.cdn_niv_cargo    = INTEGER(funcionario.cdn_niv_cargo).
    END.
    ELSE DO:
        IF INTEGER(funcionario.cdn_niv_cargo) < tt_resp.cdn_niv_cargo THEN DO:
            FIND rh_pessoa_fisic
                WHERE rh_pessoa_fisic.num_pessoa_fisic = funcionario.num_pessoa_fisic
                NO-LOCK NO-ERROR.
            ASSIGN
                tt_resp.cdn_funcionario  = STRING(funcionario.cdn_funcionario)
                tt_resp.cdn_empresa      = STRING(funcionario.cdn_empresa)
                tt_resp.cdn_estab        = STRING(funcionario.cdn_estab)
                tt_resp.nom_pessoa_fisic = IF AVAIL rh_pessoa_fisic THEN rh_pessoa_fisic.nom_pessoa_fisic ELSE ""
                tt_resp.cdn_niv_cargo    = INTEGER(funcionario.cdn_niv_cargo).
        END.
    END.

END. /* FOR EACH funcionario */

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 2B: Constroi cCaminho para cada unidade (ordena arvore em DFS)        */
/*   Exemplo: "00001079/00001070/00001089"                                     */
/*   Ordenando por esse campo, filhos aparecem logo apos seus pais.            */
/* ─────────────────────────────────────────────────────────────────────────── */
FOR EACH tt_resp:
    ASSIGN
        tt_resp.cCaminho = tt_resp.cod_unid_lotac
        cCurPai          = tt_resp.cod_unid_pai.

    DO i = 1 TO 8:   /* maxima profundidade esperada */
        IF cCurPai = "" THEN LEAVE.
        ASSIGN tt_resp.cCaminho = cCurPai + "/" + tt_resp.cCaminho.
        FIND b_anc
            WHERE b_anc.cod_unid_lotac = cCurPai
            NO-LOCK NO-ERROR.
        IF NOT AVAIL b_anc THEN LEAVE.
        ASSIGN cCurPai = b_anc.cod_unid_pai.
    END.
END.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 3A: Arquivo de importacao (limpo, so o que o RHPortal precisa)        */
/* ─────────────────────────────────────────────────────────────────────────── */
OUTPUT TO VALUE(cArqImport) CONVERT TARGET "iso8859-1".

PUT UNFORMATTED
    "CdnPlanoLotac"  "|"
    "UnitCode"       "|"
    "CdnEmpresa"     "|"
    "CdnEstab"       "|"
    "CdnFuncionario"
    SKIP.

FOR EACH tt_resp NO-LOCK
    BY tt_resp.cdn_plano_lotac
    BY tt_resp.cod_unid_lotac:

    PUT UNFORMATTED
        STRING(tt_resp.cdn_plano_lotac) "|"
        tt_resp.cod_unid_lotac          "|"
        tt_resp.cdn_empresa             "|"
        tt_resp.cdn_estab               "|"
        tt_resp.cdn_funcionario
        SKIP.

    ASSIGN iLinhas = iLinhas + 1.

END.

OUTPUT CLOSE.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 3B: Arvore visual — ordenada por cCaminho (DFS: filho logo apos pai)  */
/* ─────────────────────────────────────────────────────────────────────────── */
OUTPUT TO VALUE(cArqArvore) CONVERT TARGET "iso8859-1".

PUT UNFORMATTED
    "Plano"          "|"
    "Nivel"          "|"
    "Hierarquia"     "|"
    "CodPai"         "|"
    "DesPai"         "|"
    "Responsavel"    "|"
    "Matricula"
    SKIP.

FOR EACH tt_resp NO-LOCK
    BY tt_resp.cCaminho:

    IF tt_resp.num_niv <= 1 THEN
        ASSIGN cIndent = "".
    ELSE
        ASSIGN cIndent = FILL("-", (tt_resp.num_niv - 1) * 3) + " ".

    PUT UNFORMATTED
        STRING(tt_resp.cdn_plano_lotac)                                        "|"
        STRING(tt_resp.num_niv)                                                "|"
        cIndent + "[" + tt_resp.cod_unid_lotac + "] " + tt_resp.des_unid_lotac "|"
        tt_resp.cod_unid_pai + " " + tt_resp.des_unid_pai                      "|"
        tt_resp.des_unid_pai                                                   "|"
        tt_resp.nom_pessoa_fisic                                               "|"
        tt_resp.cdn_funcionario
        SKIP.

END.

OUTPUT CLOSE.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 4: Log de unidades sem nenhum funcionario ativo                       */
/* ─────────────────────────────────────────────────────────────────────────── */
OUTPUT TO VALUE(cArqSemResp) CONVERT TARGET "iso8859-1".

PUT UNFORMATTED "cod_unid_lotac" SKIP.

FOR EACH tt_unidades NO-LOCK
    BY tt_unidades.cod_unid_lotac:

    FIND tt_resp
        WHERE tt_resp.cod_unid_lotac = tt_unidades.cod_unid_lotac
        NO-ERROR.

    IF NOT AVAIL tt_resp THEN DO:
        PUT UNFORMATTED tt_unidades.cod_unid_lotac SKIP.
        ASSIGN iSemFuncionario = iSemFuncionario + 1.
    END.

END.

OUTPUT CLOSE.

MESSAGE
    "Extracao de responsaveis concluida!" SKIP
    SKIP
    "Unidades com responsavel: " iLinhas          SKIP
    "Unidades sem funcionario: " iSemFuncionario  SKIP
    SKIP
    "Arquivos gerados:" SKIP
    "  [IMPORT]  " cArqImport  SKIP
    "  [ARVORE]  " cArqArvore  SKIP
    "  [SEM LOT] " cArqSemResp
    VIEW-AS ALERT-BOX INFORMATION.
