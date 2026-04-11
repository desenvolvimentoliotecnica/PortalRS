Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Componente de Pagamento Recorrente                                           */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bmcf FOR movto_calcul_func.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEF VAR genericNumber1      AS CHAR NO-UNDO.
DEF VAR c-pai               AS CHAR NO-UNDO.
DEF VAR c-mae               AS CHAR NO-UNDO.
DEF VAR genericString9      AS CHAR NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.
DEFINE INPUT PARAMETER p-dt-golive     AS DATE NO-UNDO.

DEFINE VARIABLE WContratacao AS CHAR   NO-UNDO.
DEFINE VARIABLE h-acomp      AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont       AS INT    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - COMPONENTE PAGAMENTO RECORRENTE").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '17 - Componente de Pagamento Recorrente.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "pay-component"  Cdelimiter2  //"pay-component"   "Componente de Pagamento"          
            Cdelimiter1 "start-date"     Cdelimiter2  //"start-date"      "Data Admiss∆o                   
            Cdelimiter1 "frequency"      Cdelimiter2  //"frequency"       "Frequància"                       
            Cdelimiter1 "user-id"        Cdelimiter2  //"user-id"         "Matricula"                    
            Cdelimiter1 "currency-code"  Cdelimiter2  //"currency-code"   "Moeda"                            
            Cdelimiter1 "paycompvalue"   Cdelimiter2  //"paycompvalue"    "Montante"                         
            Cdelimiter1 "seq-number"     Cdelimiter2  //"seq-number"      "N£mero da Sequància"              
            Cdelimiter1 "operation"      Cdelimiter1  //"operation"       "Operaá∆o"                                            
            SKIP.  

        PUT UNFORMATTED
            Cdelimiter1 "Componente de Pagamento*"  Cdelimiter2  //"pay-component"   "Componente de Pagamento"          
            Cdelimiter1 "Data Admiss∆o*"            Cdelimiter2  //"start-date"      "Data Admiss∆o"                   
            Cdelimiter1 "Frequància*"               Cdelimiter2  //"frequency"       "Frequància"                       
            Cdelimiter1 "Matricula*"                Cdelimiter2  //"user-id"         "Matricula"                    
            Cdelimiter1 "Moeda*"                    Cdelimiter2  //"currency-code"   "Moeda"                            
            Cdelimiter1 "Montante*"                 Cdelimiter2  //"paycompvalue"    "Montante"                         
            Cdelimiter1 "N£mero da Sequància*"      Cdelimiter2  //"seq-number"      "N£mero da Sequància"              
            Cdelimiter1 "Operaá∆o"                  Cdelimiter1  //"operation"       "Operaá∆o"                                            
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

            /* Data Admiss∆o */
            ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').
    
            FOR LAST bmcf OF btab NO-LOCK. END.
            
            PUT UNFORMATTED
                Cdelimiter1 ""                                                     Cdelimiter2  //"pay-component"   "Componente de Pagamento"          
                Cdelimiter1 WContratacao                                           Cdelimiter2  //"start-date"      "Data Admiss∆o"                   
                Cdelimiter1 IF AVAIL bmcf THEN bmcf.cdn_event_fp[1] ELSE ''        Cdelimiter2  //"frequency"       "Frequància"                       
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                   Cdelimiter2  //"user-id"         "Matricula"                    
                Cdelimiter1 "REAL"                                                 Cdelimiter2  //"currency-code"   "Moeda"                            
                Cdelimiter1 btab.val_salario_atual                                 Cdelimiter2  //"paycompvalue"    "Montante"                         
                Cdelimiter1 "1"                                                    Cdelimiter2  //"seq-number"      "N£mero da Sequància"              
                Cdelimiter1 ""                                                     Cdelimiter1  //"operation"       "Operaá∆o"                                            
                SKIP.

            PUT UNFORMATTED
                Cdelimiter1 ""                                                     Cdelimiter2  //"pay-component"   "Componente de Pagamento"          
                Cdelimiter1 STRING(DAY(p-dt-golive),'99') + "/" + STRING(MONTH(p-dt-golive),'99') + "/" + STRING(YEAR(p-dt-golive),'9999')                                            Cdelimiter2  //"start-date"      "Data Admiss∆o"                   
                Cdelimiter1 IF AVAIL bmcf THEN bmcf.cdn_event_fp[1] ELSE ''        Cdelimiter2  //"frequency"       "Frequància"                       
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                   Cdelimiter2  //"user-id"         "Matricula"                    
                Cdelimiter1 "REAL"                                                 Cdelimiter2  //"currency-code"   "Moeda"                            
                Cdelimiter1 btab.val_salario_atual                                 Cdelimiter2  //"paycompvalue"    "Montante"                         
                Cdelimiter1 "1"                                                    Cdelimiter2  //"seq-number"      "N£mero da Sequància"              
                Cdelimiter1 ""                                                     Cdelimiter1  //"operation"       "Operaá∆o"                                            
                SKIP.
                           
        END.

OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    










