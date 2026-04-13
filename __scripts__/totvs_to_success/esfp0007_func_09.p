Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes de E-mail                                                        */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.

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

DEFINE VARIABLE h-acomp AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont  AS INT    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES DE E-MAIL").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '9 - Informacoes de E-mail.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "email-address"                 Cdelimiter2  //"email-address"                 "Endereáo de e-mail"
            Cdelimiter1 "personInfo.person-id-external" Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"
            Cdelimiter1 "email-type"                    Cdelimiter2  //"email-type"                    "Tipo de e-mail"    
            Cdelimiter1 "isPrimary"                     Cdelimiter2  //"isPrimary"                     "ê prim†rio"        
            Cdelimiter1 "operation"                     Cdelimiter1  //"operation"                     "Operaá∆o"          
            SKIP.

        PUT UNFORMATTED
            Cdelimiter1 "Endereáo de E-mail*" Cdelimiter2  
            Cdelimiter1 "ID Pessoal Externa*" Cdelimiter2  
            Cdelimiter1 "Tipo de E-mail*"     Cdelimiter2  
            Cdelimiter1 "ê Prim†rio*"         Cdelimiter2  
            Cdelimiter1 "Operaá∆o"            Cdelimiter1  
            SKIP.

    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bpf OF btab NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        PUT UNFORMATTED
            Cdelimiter1 TRIM(bpf.nom_mail_contat)    Cdelimiter2  //"email-address"                 "Endereáo de e-mail"
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)    Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"
            Cdelimiter1 ""                      Cdelimiter2  //"email-type"                    "Tipo de e-mail"    
            Cdelimiter1 "TRUE"                  Cdelimiter2  //"isPrimary"                     "ê prim†rio"        
            Cdelimiter1 ""                      Cdelimiter1  //"operation"                     "Operaá∆o"          
            SKIP.

    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    











