Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Detalhes do Empreg                                                           */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bsp  FOR sped_participan.
DEF BUFFER bfr  FOR func_reinteg.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE VARIABLE WContratacao AS CHAR                  NO-UNDO.
DEFINE VARIABLE DtReintegrac AS CHAR                  NO-UNDO.
DEFINE VARIABLE h-acomp      AS HANDLE                NO-UNDO.
DEFINE VARIABLE i-cont       AS INT                   NO-UNDO.
DEFINE VARIABLE cTipAdmissao AS CHAR                  NO-UNDO.
DEFINE VARIABLE cIndAdmissao AS CHAR                  NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - DETALHES EMPREGO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '3 - Detalhes do Emprego.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "start-date"              Cdelimiter2  //"start-date               "Data de Admiss∆o"    
        Cdelimiter1 "user-id"                 Cdelimiter2  //"user-id                  "ID Matricula"       
        Cdelimiter1 "person-id-external"      Cdelimiter2  //"person-id-external       "ID Pessoa Fisica"  
        Cdelimiter1 "custom-string1"          Cdelimiter2  //"custom-string1           "Indicados Admiss∆o eSocial"      
        Cdelimiter1 "custom-string2"          Cdelimiter2  //"custom-string2           "Tipo Admiss∆o eSocial"
        Cdelimiter1 "custom-date2"            Cdelimiter2  //"custom-date2             "Antiguidade"
        Cdelimiter1 "custom-date1"            Cdelimiter2  //"custom-date1             "Data da Reintegraá∆o"
        Cdelimiter1 "custom-string3"          Cdelimiter2  //"custom-string3           "N. da Lei de Anistia"
        Cdelimiter1 "custom-string4"          Cdelimiter2  //"custom-string4           "N. do Processo"
        Cdelimiter1 "jobNumber"               Cdelimiter2  //"jobNumber                "ID do emprego"
        Cdelimiter1 "employeeFirstEmployment" Cdelimiter1  //"employeeFirstEmployment  "Primeiro Emprego do Colaborador"      
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Data de Admissao*"               Cdelimiter2  //"start-date               "Data de Admiss∆o"                
        Cdelimiter1 "ID Matricula*"                   Cdelimiter2  //"user-id                  "ID Matricula"                   
        Cdelimiter1 "ID Pessoa Fisica*"               Cdelimiter2  //"person-id-external       "ID Pessoa Fisica"                       
        Cdelimiter1 "Indicador Admiss∆o eSocial*"     Cdelimiter2  //"custom-string1           "Indicados Admiss∆o eSocial"      
        Cdelimiter1 "Tipo Admiss∆o eSocial*"          Cdelimiter2  //"custom-string2           "Tipo Admiss∆o eSocial"
        Cdelimiter1 "Antiguidade"                     Cdelimiter2  //"custom-date2             "Antiguidade"
        Cdelimiter1 "Data da Reintegracao"            Cdelimiter2  //"custom-date1             "Data da Reintegraá∆o"            
        Cdelimiter1 "N. da Lei de Anistia"            Cdelimiter2  //"custom-string3           "N. da Lei de Anistia"            
        Cdelimiter1 "N. do Processo"                  Cdelimiter2  //"custom-string4           "N. do Processo"                  
        Cdelimiter1 "ID do emprego"                   Cdelimiter2  //"jobNumber                "ID do emprego"  
        Cdelimiter1 "Primeiro Emprego do Colaborador" Cdelimiter1  //"employeeFirstEmployment  "Primeiro Emprego do Colaborador" 
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
        FIRST bpf OF btab NO-LOCK
        BREAK BY btab.cdn_empresa
              BY btab.cdn_estab
              BY btab.cdn_funcionario.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /* Verifica Tipo Admiss∆o e Indicador Admiss∆o eSocial */
        FIND FIRST bsp
             WHERE bsp.cdn_empresa         = btab.cdn_empresa 
               AND bsp.cdn_estab           = btab.cdn_estab
               AND bsp.cdn_participan_sped = btab.cdn_funcionario NO-LOCK NO-ERROR.
        IF AVAIL bsp THEN DO:
           ASSIGN cTipAdmissao = string(bsp.idi_tip_admis_sped,"99") + "-" + replace(STRING({DATABASE/ingt/i02gt181.i 04 bsp.idi_tip_admis_sped}),";",","). /* Ajustado conforme solicitaá∆o da EPI-USE */

           IF bsp.idi_admis_funcao_fisc = 1 THEN
              ASSIGN cIndAdmissao = 'Normal'.

           IF bsp.idi_admis_funcao_fisc = 2 THEN
              ASSIGN cIndAdmissao = 'Decorrente de Aá∆o Fiscal'.
         
           IF bsp.idi_admis_funcao_fisc = 3 THEN
              ASSIGN cIndAdmissao = 'Decorrente de Decis∆o Judicial'.

           ASSIGN cIndAdmissao = string(bsp.idi_admis_funcao_fisc) + " - " + cIndAdmissao.

        END.
        ELSE
            ASSIGN cTipAdmissao = ""
                   cIndAdmissao = "".

        FIND FIRST bfr
             WHERE bfr.cdn_empresa     = btab.cdn_empresa
               AND bfr.cdn_estab       = btab.cdn_estab
               AND bfr.cdn_funcionario = btab.cdn_funcionario NO-LOCK NO-ERROR.

        /***** Data Admiss∆o | Data Reintegraá∆o *****/
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999')
               DtReintegrac = IF AVAIL bfr THEN STRING(DAY(bfr.dat_reinteg_func_fp),'99') + "/" + STRING(MONTH(bfr.dat_reinteg_func_fp),'99') + "/" + STRING(YEAR(bfr.dat_reinteg_func_fp),'9999') ELSE "".
        
        PUT UNFORMATTED
            Cdelimiter1 WContratacao                                      Cdelimiter2  //"start-date               "Data de Admiss∆o"                
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario) Cdelimiter2  //"user-id                  "ID Matricula"                   
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario) Cdelimiter2  //"person-id-external       "ID Pessoa Fisica"                       
            Cdelimiter1 STRING(cIndAdmissao)                              Cdelimiter2  //"custom-string1           "Indicados Admiss∆o eSocial"      
            Cdelimiter1 STRING(cTipAdmissao)                              Cdelimiter2  //"custom-string2           "Tipo Admiss∆o eSocial"           
            Cdelimiter1 ""                                                Cdelimiter2  //"custom-date2             "Antiguidade"  
            Cdelimiter1 DtReintegrac                                      Cdelimiter2  //"custom-date1             "Data da Reintegraá∆o"            
            Cdelimiter1 ""                                                Cdelimiter2  //"custom-string3           "N. da Lei de Anistia"            
            Cdelimiter1 ""                                                Cdelimiter2  //"custom-string4           "N. do Processo"                  
            Cdelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario) Cdelimiter2  //"jobNumber                "ID do emprego"  
            Cdelimiter1 ""                                                Cdelimiter1  //"employeeFirstEmployment  "Primeiro Emprego do Colaborador" 
            SKIP.

    END.

OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    












