Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Estabilidades                                                                */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bef  FOR estabil_func.

DEF VAR Cdelimiter1 AS CHAR INIT '"' NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEF VAR c-saldo AS CHAR NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.

DEFINE VARIABLE WContratacao AS CHAR   NO-UNDO.
DEFINE VARIABLE DtIniEstab   AS CHAR   NO-UNDO.
DEFINE VARIABLE DtFimEstab   AS CHAR   NO-UNDO.
DEFINE VARIABLE h-acomp      AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont       AS INT    NO-UNDO.


RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - ESTABILIDADES 21.5").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '21.5 - Estabilidades.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"                                      Cdelimiter2  //"[OPERATOR]"                                      "Operadores permitidos: Delimit, Clear e Delete"    
        Cdelimiter1 "externalCode"                                    Cdelimiter2  //"externalCode"                                    "Matricula"                                       
        Cdelimiter1 "effectiveStartDate"                              Cdelimiter2  //"effectiveStartDate"                              "Data"                                       
        Cdelimiter1 "cust_stability1.externalCode"                    Cdelimiter2  //"cust_stability1.externalCode"                    "C¢digo"                                       
        Cdelimiter1 "cust_stability1.externalName"                    Cdelimiter2  //"cust_stability1.externalName"                    "Colaborador"                                       
        Cdelimiter1 "cust_stability1.cust_stabilityinitialdate"       Cdelimiter2  //"cust_stability1.cust_stabilityinitialdate"       "Data Inicial da Estabilidade"                                       
        Cdelimiter1 "cust_stability1.cust_stabilityfinaldate"         Cdelimiter2  //"cust_stability1.cust_stabilityfinaldate"         "Data Final da Estabilidade"                                       
        Cdelimiter1 "cust_stability1.cust_stabilitytype.externalCode" Cdelimiter1  //"cust_stability1.cust_stabilitytype.externalCode" "C¢digo da Estabilidade"                                
        SKIP. 

     PUT UNFORMATTED
        Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete"  Cdelimiter2  //"[OPERATOR]"                                      "Operadores permitidos: Delimit, Clear e Delete"    
        Cdelimiter1 "Matricula*"                                      Cdelimiter2  //"externalCode"                                    "Matricula"                                       
        Cdelimiter1 "Data*"                                           Cdelimiter2  //"effectiveStartDate"                              "Data"                                       
        Cdelimiter1 "C¢digo*"                                         Cdelimiter2  //"cust_stability1.externalCode"                    "C¢digo"                                       
        Cdelimiter1 "Colaborador"                                     Cdelimiter2  //"cust_stability1.externalName"                    "Colaborador"                                       
        Cdelimiter1 "Data Inicial da Estabilidade"                    Cdelimiter2  //"cust_stability1.cust_stabilityinitialdate"       "Data Inicial da Estabilidade"                                       
        Cdelimiter1 "Data Final da Estabilidade"                      Cdelimiter2  //"cust_stability1.cust_stabilityfinaldate"         "Data Final da Estabilidade"                                       
        Cdelimiter1 "C¢digo da Estabilidade"                          Cdelimiter1  //"cust_stability1.cust_stabilitytype.externalCode" "C¢digo da Estabilidade"                                
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
        EACH bef OF btab.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /***** Data Admiss∆o | Data Inicio Estab | Data Fim Estab *****/
        ASSIGN WContratacao = STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999')
               DtIniEstab   = STRING(MONTH(bef.dat_inic_estabil),'99') + "/" + STRING(DAY(bef.dat_inic_estabil),'99') + "/" + STRING(YEAR(bef.dat_inic_estabil),'9999')
               DtFimEstab   = STRING(MONTH(bef.dat_term_estabil),'99') + "/" + STRING(DAY(bef.dat_term_estabil),'99') + "/" + STRING(YEAR(bef.dat_term_estabil),'9999').

        PUT UNFORMATTED
            Cdelimiter1 "Delimit"                   Cdelimiter2  //"Operadores permitidos: Delimit, Clear e Delete"   
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)        Cdelimiter2  //"Matricula"                                      
            Cdelimiter1 WContratacao                Cdelimiter2  //"Data"                                           
            Cdelimiter1 "1"                         Cdelimiter2  //"C¢digo"                                         
            Cdelimiter1 ""                          Cdelimiter2  //"Colaborador"                                      
            Cdelimiter1 DtIniEstab                  Cdelimiter2  //"Data Inicial da Estabilidade"                                      
            Cdelimiter1 DtFimEstab                  Cdelimiter2  //"Data Final da Estabilidade"                                      
            Cdelimiter1 bef.cdn_motiv_estabil_func  Cdelimiter1  //"C¢digo da Estabilidade"                               
            SKIP.
    END.

OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    


