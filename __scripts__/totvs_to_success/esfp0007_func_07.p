Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes de Compensacao                                                   */
/********************************************************************************/

DEF BUFFER btab  FOR funcionario.
DEF BUFFER bfp   FOR func_ptoelet.
DEF BUFFER bper  FOR param_empres_rh.
DEF BUFFER bhsf  FOR histor_sal_func.
DEF BUFFER bpaf  FOR period_aqst_ferias.
DEF BUFFER bhcsf FOR histor_contrib_sindic_func.
DEF BUFFER bfse  FOR func_sind_estab.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE VARIABLE c-saldo   AS CHAR                     NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.
DEFINE INPUT PARAMETER p-dt-golive     AS DATE NO-UNDO.

DEFINE VARIABLE h-acomp    AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont     AS INT    NO-UNDO.
DEFINE VARIABLE Wdtatadmis AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMA€åES COMPENSA€ÇO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '7 - Informacoes de Compensacao.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "start-date"     Cdelimiter2  //"start-date"     "Data do evento"     
        Cdelimiter1 "user-id"        Cdelimiter2  //"user-id"        "ID do Usu rio"      
        Cdelimiter1 "custom-string2" Cdelimiter2  //"custom-string2" "Motivo da Altera‡Æo"
        Cdelimiter1 "event-reason"   Cdelimiter2  //"event-reason"   "Motivo do evento"   
        Cdelimiter1 "pay-grade"      Cdelimiter2  //"pay-grade"      "Öndice salarial"    
        Cdelimiter1 "custom-string1" Cdelimiter2  //"custom-string1" "Escalonamento"      
        Cdelimiter1 "custom-double8" Cdelimiter2  //"custom-double8" "PPR"      
        Cdelimiter1 "custom-double9" Cdelimiter2  //"custom-double9" "Target RV"      
        Cdelimiter1 "operation"      Cdelimiter1  //"operation"      "Opera‡Æo"           
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Data do evento*"      Cdelimiter2  
        Cdelimiter1 "ID do Usu rio*"       Cdelimiter2  
        Cdelimiter1 "Motivo da Altera‡Æo*" Cdelimiter2  
        Cdelimiter1 "Motivo do evento*"    Cdelimiter2  
        Cdelimiter1 "Öndice salarial"      Cdelimiter2  
        Cdelimiter1 "Escalonamento*"       Cdelimiter2  
        Cdelimiter1 "PPR"                  Cdelimiter2  
        Cdelimiter1 "Target RV"            Cdelimiter2  
        Cdelimiter1 "Opera‡Æo"             Cdelimiter1  
        SKIP.

    FOR EACH btab NO-LOCK 
       WHERE btab.dat_desligto_func = ?
         AND btab.cdn_empresa       >= p-emp-ini
         AND btab.cdn_empresa       <= p-emp-fim 
         AND btab.cdn_estab         >= p-estab-ini
         AND btab.cdn_estab         <= p-estab-fim
         AND btab.cdn_funcionario   >= p-matricula-ini
         AND btab.cdn_funcionario   <= p-matricula-fim
         AND btab.dat_admis_func    >= p-dt-admissao,
        FIRST bper OF btab NO-LOCK,
        LAST bhsf OF btab NO-LOCK.

        ASSIGN c-saldo = ''.
        FOR FIRST bpaf OF btab NO-LOCK WHERE bpaf.idi_sit_period_aqst_ferias = 1
            BREAK BY bpaf.dat_inic_period_aqst_ferias.
        END.
        IF NOT AVAIL bpaf THEN NEXT.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).
    
        FOR LAST bhcsf OF btab NO-LOCK
            BREAK BY bhcsf.num_ano_refer_contrib_sindic
                  BY bhcsf.num_mes_refer_contrib_sindic.
        END.
        FOR FIRST bfse OF btab NO-LOCK WHERE
                  MONTH(bfse.dat_inic_lotac_func) >= bhcsf.num_ano_refer_contrib_sindic AND
                  YEAR(bfse.dat_inic_lotac_func)  >= bhcsf.num_ano_refer_contrib_sindic AND
                  MONTH(bfse.dat_fim_lotac_func)  >= bhcsf.num_ano_refer_contrib_sindic AND
                  YEAR(bfse.dat_fim_lotac_func)   >= bhcsf.num_ano_refer_contrib_sindic
            BREAK BY bfse.dat_fim_lotac_func.
        END.

        ASSIGN Wdtatadmis = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').
        
        FOR LAST bfp OF btab NO-LOCK.
            PUT UNFORMATTED
                Cdelimiter1 Wdtatadmis                  Cdelimiter2  //"start-date"     "Data do evento"     
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)        Cdelimiter2  //"user-id"        "ID do Usu rio"      
                Cdelimiter1 ""                          Cdelimiter2  //"custom-string2" "Motivo da Altera‡Æo"
                Cdelimiter1 "Z"                         Cdelimiter2  //"event-reason"   "Motivo do evento"   
                Cdelimiter1 bfp.cdn_categ_sal           Cdelimiter2  //"pay-grade"      "Öndice salarial"    
                Cdelimiter1 "NÆo"                       Cdelimiter2  //"custom-string1" "Escalonamento"      
                Cdelimiter1 ""                          Cdelimiter2  //"custom-double8" "PPR"     
                Cdelimiter1 ""                          Cdelimiter2  //"custom-double9" "Target RV"     
                Cdelimiter1 ""                          Cdelimiter1  //"operation"      "Opera‡Æo"           
                SKIP. 

            PUT UNFORMATTED
                Cdelimiter1 STRING(DAY(p-dt-golive),'99') + "/" + STRING(MONTH(p-dt-golive),'99') + "/" + STRING(YEAR(p-dt-golive),'9999') Cdelimiter2  //"start-date"     "Data do evento"     
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)        Cdelimiter2  //"user-id"        "ID do Usu rio"      
                Cdelimiter1 ""                          Cdelimiter2  //"custom-string2" "Motivo da Altera‡Æo"
                Cdelimiter1 "AZ"                        Cdelimiter2  //"event-reason"   "Motivo do evento"   
                Cdelimiter1 bfp.cdn_categ_sal           Cdelimiter2  //"pay-grade"      "Öndice salarial"    
                Cdelimiter1 "NÆo"                       Cdelimiter2  //"custom-string1" "Escalonamento"      
                Cdelimiter1 ""                          Cdelimiter2  //"custom-double8" "PPR"     
                Cdelimiter1 ""                          Cdelimiter2  //"custom-double9" "Target RV"     
                Cdelimiter1 ""                          Cdelimiter1  //"operation"      "Opera‡Æo"           
                SKIP.

        END.
    END.

OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    


