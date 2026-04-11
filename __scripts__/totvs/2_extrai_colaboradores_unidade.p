/***********************************************************************************************************/
/* Data.....: 12/04/2026                                                                                   */
/* Descricao: Extrai colaboradores ativos com dados completos de pessoa fisica para importacao no RHPortal.*/
/*            Todos os funcionarios sao exportados no mesmo arquivo — email pode ficar em branco.          */
/*                                                                                                         */
/* Saida CSV (separado por pipe |):                                                                        */
/*   cdn_funcionario | cdn_empresa | cdn_estab | nom_pessoa_fisic | nom_e_mail | cod_id_feder | dat_nascimento*/
/*   cod_id_estad_fisic | fone | cod_cep_rh | nom_ender_rh | cod_num_ender | nom_bairro_rh | nom_cidad_rh  */
/*   cod_unid_federac_rh | cod_unid_lotac | cdn_plano_lotac | dat_inic_cargo | cod_cargo | cod_ccusto | cdn_niv_cargo */
/*                                                                                                         */
/* Ordem de importacao recomendada no RHPortal:                                                            */
/*   1. UnidadesLotacao  (1_extrai_unidades_organizacionais.p) — importar ANTES deste script               */
/*   2. CentrosCusto     (importar ANTES deste script)                                                     */
/*   3. [ESTE SCRIPT] Colaboradores -> POST /api/funcionarios/import                                       */
/*   4. Responsaveis    (3_extrai_resp_unidades.p) -> POST /api/unidades-lotacao/import-owners             */
/***********************************************************************************************************/

DEFINE VARIABLE cArquivoSaida AS CHARACTER NO-UNDO INITIAL "\\10.0.211.36\proj\F739_F798_F830\scripts_carga\cargas_homolog\unid_lotac\colaboradores_unidade.csv".

/* ── Filtros ── */
DEFINE VARIABLE cEmpresa  AS CHARACTER NO-UNDO INITIAL "1".
DEFINE VARIABLE cCodEstab AS CHARACTER NO-UNDO INITIAL "".  /* "" = todos os estabs */

DEFINE VARIABLE iLinhas       AS INTEGER NO-UNDO.
DEFINE VARIABLE iSemPessoaFis AS INTEGER NO-UNDO.
DEFINE VARIABLE iSemEmail     AS INTEGER NO-UNDO.

DEFINE VARIABLE cEmail          AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCpf            AS CHARACTER NO-UNDO.
DEFINE VARIABLE cRg             AS CHARACTER NO-UNDO.
DEFINE VARIABLE cFone           AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCep            AS CHARACTER NO-UNDO.
DEFINE VARIABLE cLogradouro     AS CHARACTER NO-UNDO.
DEFINE VARIABLE cNumLogradouro  AS CHARACTER NO-UNDO.
DEFINE VARIABLE cBairro         AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCidade         AS CHARACTER NO-UNDO.
DEFINE VARIABLE cEstado         AS CHARACTER NO-UNDO.
DEFINE VARIABLE cDatNasc        AS CHARACTER NO-UNDO.
DEFINE VARIABLE cDatInic        AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCodCargo       AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCodCentroCusto AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCodNivCargo    AS CHARACTER NO-UNDO.
DEFINE VARIABLE cCodPlanoLotac  AS CHARACTER NO-UNDO.

OUTPUT TO VALUE(cArquivoSaida) CONVERT TARGET "iso8859-1".

PUT UNFORMATTED
    "cdn_funcionario"    "|"
    "cdn_empresa"        "|"
    "cdn_estab"          "|"
    "nom_pessoa_fisic"   "|"
    "nom_e_mail"         "|"
    "cod_id_feder"       "|"
    "dat_nascimento"     "|"
    "cod_id_estad_fisic" "|"
    "fone"               "|"
    "cod_cep_rh"         "|"
    "nom_ender_rh"       "|"
    "cod_num_ender"      "|"
    "nom_bairro_rh"      "|"
    "nom_cidad_rh"       "|"
    "cod_unid_federac_rh" "|"
    "cod_unid_lotac"     "|"
    "cdn_plano_lotac"    "|"
    "dat_inic_cargo"     "|"
    "cod_cargo"          "|"
    "cod_ccusto"         "|"
    "cdn_niv_cargo"
    SKIP.

OUTPUT CLOSE.

/* ── Loop principal ── */
blk_func:
FOR EACH funcionario NO-LOCK
    WHERE funcionario.dat_desligto_func = ?                              /* ativos */
    AND   funcionario.cdn_empresa       = cEmpresa                       /* empresa 1 */
    AND   funcionario.cod_unid_lotac   <> ""                             /* com unidade */
    AND   (cCodEstab = "" OR funcionario.cdn_estab = cCodEstab)
    BREAK BY funcionario.cdn_empresa
          BY funcionario.cdn_estab
          BY funcionario.cdn_funcionario:

    /* Reset variaveis */
    ASSIGN
        cEmail          = ""
        cCpf            = ""
        cRg             = ""
        cFone           = ""
        cCep            = ""
        cLogradouro     = ""
        cNumLogradouro  = ""
        cBairro         = ""
        cCidade         = ""
        cEstado         = ""
        cDatNasc        = ""
        cDatInic        = ""
        cCodCargo       = ""
        cCodCentroCusto = ""
        cCodNivCargo    = ""
        cCodPlanoLotac  = "".

    /* Busca pessoa fisica */
    FIND rh_pessoa_fisic
        WHERE rh_pessoa_fisic.num_pessoa_fisic = funcionario.num_pessoa_fisic NO-LOCK NO-ERROR.

    IF NOT AVAIL rh_pessoa_fisic THEN DO:
        ASSIGN iSemPessoaFis = iSemPessoaFis + 1.
        NEXT blk_func.
    END.

    /* Monta campos de pessoa fisica */
    ASSIGN
        cCpf           = TRIM(rh_pessoa_fisic.cod_id_feder)
        cRg            = TRIM(rh_pessoa_fisic.cod_id_estad_fisic)
        cCep           = TRIM(rh_pessoa_fisic.cod_cep_rh)
        cLogradouro    = TRIM(rh_pessoa_fisic.nom_ender_rh)
        cNumLogradouro = TRIM(rh_pessoa_fisic.cod_num_ender)
        cBairro        = TRIM(rh_pessoa_fisic.nom_bairro_rh)
        cCidade        = TRIM(rh_pessoa_fisic.nom_cidad_rh)
        cEstado        = TRIM(rh_pessoa_fisic.cod_unid_federac_rh).

    IF rh_pessoa_fisic.dat_nascimento <> ? THEN
        ASSIGN cDatNasc = STRING(rh_pessoa_fisic.dat_nascimento, "99/99/9999").

    IF rh_pessoa_fisic.num_ddd > 0 THEN
        ASSIGN cFone = "(" + TRIM(STRING(rh_pessoa_fisic.num_ddd)) + ") " + TRIM(STRING(rh_pessoa_fisic.num_telefone)).
    ELSE IF rh_pessoa_fisic.num_telefone > 0 THEN
        ASSIGN cFone = TRIM(STRING(rh_pessoa_fisic.num_telefone)).

    ASSIGN cEmail = TRIM(rh_pessoa_fisic.nom_e_mail).

    IF cEmail = "" OR cEmail = ? THEN
        ASSIGN iSemEmail = iSemEmail + 1.

    ASSIGN
        cCodCargo       = STRING(funcionario.cdn_cargo_basic)
        cCodCentroCusto = TRIM(funcionario.cod_rh_ccusto)
        cCodNivCargo    = STRING(funcionario.cdn_niv_cargo).

    IF funcionario.dat_admis_func <> ? THEN
        ASSIGN cDatInic = STRING(funcionario.dat_admis_func, "99/99/9999").

    /* Busca cdn_plano_lotac da unidade do funcionario */
    FOR FIRST unid_lotac_plano
        WHERE unid_lotac_plano.cod_unid_lotac = funcionario.cod_unid_lotac
        NO-LOCK:
        ASSIGN cCodPlanoLotac = STRING(unid_lotac_plano.cdn_plano_lotac).
    END.

    /* ── Grava no arquivo (todos, email pode estar vazio) ── */
    OUTPUT TO VALUE(cArquivoSaida) APPEND CONVERT TARGET "iso8859-1".
    PUT UNFORMATTED
        STRING(funcionario.cdn_funcionario)          "|"
        STRING(funcionario.cdn_empresa)              "|"
        STRING(funcionario.cdn_estab)                "|"
        STRING(rh_pessoa_fisic.nom_pessoa_fisic)     "|"
        cEmail                                       "|"
        cCpf                                         "|"
        cDatNasc                                     "|"
        cRg                                          "|"
        cFone                                        "|"
        cCep                                         "|"
        cLogradouro                                  "|"
        cNumLogradouro                               "|"
        cBairro                                      "|"
        cCidade                                      "|"
        cEstado                                      "|"
        STRING(funcionario.cod_unid_lotac)           "|"
        cCodPlanoLotac                               "|"
        cDatInic                                     "|"
        cCodCargo                                    "|"
        cCodCentroCusto                              "|"
        cCodNivCargo
        SKIP.
    OUTPUT CLOSE.

    ASSIGN iLinhas = iLinhas + 1.

END. /* blk_func */

MESSAGE
    "Extracao concluida!" SKIP
    "Exportados: "        iLinhas       SKIP
    "Sem email: "         iSemEmail     SKIP
    "Sem pessoa fisica: " iSemPessoaFis SKIP
    SKIP
    "Arquivo: " cArquivoSaida SKIP
    SKIP
    "Importe no RHPortal via:" SKIP
    "  POST /api/funcionarios/import"
    VIEW-AS ALERT-BOX INFORMATION.
