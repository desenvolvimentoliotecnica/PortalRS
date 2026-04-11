Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes de pagamento                                                     */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bcf  FOR contrat_func.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bcpf FOR compl_pessoa_fisic.

DEF VAR Cdelimiter1 AS CHAR INIT '"' NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.

DEFINE VARIABLE h-acomp   AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont    AS INT    NO-UNDO.
DEFINE VARIABLE DtInicial AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES PAGAMENTO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '18 - Informacoes de pagamento.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"         Cdelimiter2  //"[OPERATOR]"         "Operadores permitidos: Delimit, Clear e Delete"  
            Cdelimiter1 "worker"             Cdelimiter2  //"worker"             "Funcion†rio"                                     
            Cdelimiter1 "jobCountry.code"    Cdelimiter2  //"jobCountry.code"    "Pa°s/Regi∆o.C¢digo do pa°s/regi∆o (3 caracteres)"
            Cdelimiter1 "effectiveStartDate" Cdelimiter1  //"effectiveStartDate" "Data inicial efetiva"                            
            SKIP.   

        PUT UNFORMATTED
            Cdelimiter1 "Operadores Permitidos: Delimit, Clear e Delete"   Cdelimiter2 
            Cdelimiter1 "Funcion†rio*"                                     Cdelimiter2 
            Cdelimiter1 "Pa°s/Regi∆o.C¢digo do Pa°s/Regi∆o(3 caracteres)*" Cdelimiter2 
            Cdelimiter1 "Data Inicial Efetiva*"                            Cdelimiter1 
            SKIP.

    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bcf OF btab NO-LOCK,
        FIRST bpf OF btab NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        ASSIGN DtInicial = STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        PUT UNFORMATTED
            Cdelimiter1 "Delimit"            Cdelimiter2  //"[OPERATOR]"         "Operadores permitidos: Delimit, Clear e Delete"  
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario) Cdelimiter2  //"worker"             "Funcion†rio"                                     
            Cdelimiter1 bpf.cod_pais_ender   Cdelimiter2  //"jobCountry.code"    "Pa°s/Regi∆o.C¢digo do pa°s/regi∆o (3 caracteres)"
            Cdelimiter1 DtInicial            Cdelimiter1 //"effectiveStartDate" "Data inicial efetiva"                            
            SKIP.                                                                                                                    
                       
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    










