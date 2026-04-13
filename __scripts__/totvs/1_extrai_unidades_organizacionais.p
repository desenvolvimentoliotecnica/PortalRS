/***********************************************************************************************************/
/* Data.....: 12/04/2026                                                                                   */
/* Descricao: Extrai unidades de lotacao com hierarquia e nivel para importacao no RHPortal.               */
/*            Exporta unidades de TODOS os planos que possuem ao menos um funcionario ativo lotado.        */
/*            Chave composta: cdn_plano_lotac + cod_unid_lotac                                             */
/*                                                                                                         */
/* Saida CSV (separado por pipe |):                                                                        */
/*   cdn_plano_lotac | cod_unid_lotac | des_unid_lotac | cod_unid_lotac_pai | num_niv | num_seq            */
/*                                                                                                         */
/* O responsavel de cada unidade e extraido separadamente pelo script 3_extrai_resp_unidades.p.            */
/*                                                                                                         */
/* Ordem de importacao recomendada no RHPortal:                                                            */
/*   1. [ESTE SCRIPT] UnidadesLotacao — ordenado por num_niv_unid_lotac ASC (raizes primeiro)             */
/*   2. Colaboradores  (2_extrai_colaboradores_unidade.p)                                                  */
/*   3. Responsaveis   (3_extrai_resp_unidades.p)                                                          */
/***********************************************************************************************************/

DEFINE VARIABLE cArquivoSaida AS CHARACTER NO-UNDO INITIAL "\\10.0.211.36\proj\F739_F798_F830\scripts_carga\cargas_homolog\unid_lotac\unidades_organizacionais.csv".
DEFINE VARIABLE cEmpresa      AS CHARACTER NO-UNDO INITIAL "1".
DEFINE VARIABLE iLinhas       AS INTEGER   NO-UNDO.
DEFINE VARIABLE iErros        AS INTEGER   NO-UNDO.
DEFINE VARIABLE cCodPai       AS CHARACTER NO-UNDO.

/* Unidades que possuem ao menos um funcionario ativo */
DEFINE TEMP-TABLE tt_unid_com_func NO-UNDO
    FIELD cod_unid_lotac AS CHARACTER
    INDEX ix_cod IS PRIMARY UNIQUE cod_unid_lotac.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 1: Coleta unidades com funcionarios ativos                            */
/* ─────────────────────────────────────────────────────────────────────────── */
FOR EACH funcionario NO-LOCK
    WHERE funcionario.dat_desligto_func = ?
      AND funcionario.cdn_empresa       = cEmpresa
      AND funcionario.cod_unid_lotac   <> "":

    FIND tt_unid_com_func
        WHERE tt_unid_com_func.cod_unid_lotac = STRING(funcionario.cod_unid_lotac)
        NO-ERROR.
    IF NOT AVAIL tt_unid_com_func THEN DO:
        CREATE tt_unid_com_func.
        ASSIGN tt_unid_com_func.cod_unid_lotac = STRING(funcionario.cod_unid_lotac).
    END.
END.

/* ─────────────────────────────────────────────────────────────────────────── */
/* PASSO 2: Exporta unidades com funcionarios ativos de TODOS os planos        */
/* ─────────────────────────────────────────────────────────────────────────── */
OUTPUT TO VALUE(cArquivoSaida) CONVERT TARGET "iso8859-1".

PUT UNFORMATTED
    "CdnPlanoLotac" "|"
    "Codigo"        "|"
    "Descricao"     "|"
    "Pai"           "|"
    "Nivel"         "|"
    "Sequencia"
    SKIP.

blk_principal:
FOR EACH unid_lotac_plano NO-LOCK
    BREAK BY unid_lotac_plano.cdn_plano_lotac
          BY unid_lotac_plano.num_niv_unid_lotac
          BY unid_lotac_plano.num_seq_unid_lotac
          BY unid_lotac_plano.cod_unid_lotac:

    /* Filtra: so exporta se tiver funcionario ativo */
    FIND tt_unid_com_func
        WHERE tt_unid_com_func.cod_unid_lotac = STRING(unid_lotac_plano.cod_unid_lotac)
        NO-ERROR.
    IF NOT AVAIL tt_unid_com_func THEN NEXT blk_principal.

    ASSIGN cCodPai = "".

    FIND unid_lotac OF unid_lotac_plano NO-LOCK NO-ERROR.
    IF NOT AVAIL unid_lotac THEN DO:
        ASSIGN iErros = iErros + 1.
        NEXT blk_principal.
    END.

    /* Busca pai no mesmo plano */
    FOR FIRST estrut_plano_lotac
        WHERE estrut_plano_lotac.cdn_plano_lotac     = unid_lotac_plano.cdn_plano_lotac
          AND estrut_plano_lotac.cod_unid_lotac_filho = unid_lotac_plano.cod_unid_lotac
        NO-LOCK:
        ASSIGN cCodPai = estrut_plano_lotac.cod_unid_lotac_pai.
    END.

    PUT UNFORMATTED
        STRING(unid_lotac_plano.cdn_plano_lotac)     "|"
        STRING(unid_lotac_plano.cod_unid_lotac)      "|"
        STRING(unid_lotac.des_unid_lotac)            "|"
        cCodPai                                      "|"
        STRING(unid_lotac_plano.num_niv_unid_lotac)  "|"
        STRING(unid_lotac_plano.num_seq_unid_lotac)
        SKIP.

    ASSIGN iLinhas = iLinhas + 1.

END. /* blk_principal */

OUTPUT CLOSE.

MESSAGE
    "Extracao concluida!" SKIP
    "Unidades exportadas (com func. ativo): " iLinhas SKIP
    "Erros (unid_lotac nao encontrada): "     iErros  SKIP
    "Arquivo: " cArquivoSaida                         SKIP
    SKIP
    "Importe este CSV no RHPortal via:"               SKIP
    "  POST /api/unidades-lotacao/import"             SKIP
    SKIP
    "Em seguida execute extrai_resp_unidades.p e importe:" SKIP
    "  POST /api/unidades-lotacao/import-owners"
    VIEW-AS ALERT-BOX INFORMATION.
