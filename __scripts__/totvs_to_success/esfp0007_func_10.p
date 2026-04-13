Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes de Telefone                                                      */
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
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES TELEFONE").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '10 - Informacoes de Telefone.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "personInfo.person-id-external" Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"
            Cdelimiter1 "phone-number"                  Cdelimiter2  //"phone-number"                  "N£mero de telefone"
            Cdelimiter1 "phone-type"                    Cdelimiter2  //"phone-type"                    "Tipo do telefone"  
            Cdelimiter1 "isPrimary"                     Cdelimiter2  //"isPrimary"                     "ê prim†rio"        
            Cdelimiter1 "country-code"                  Cdelimiter2  //"country-code"                  "C¢digo do pa°s"    
            Cdelimiter1 "area-code"                     Cdelimiter2  //"area-code"                     "C¢digo de †rea"    
            Cdelimiter1 "operation"                     Cdelimiter1  //"operation"                     "Operaá∆o"          
            SKIP.

        PUT UNFORMATTED
            Cdelimiter1 "ID Pessoal Externa*" Cdelimiter2  
            Cdelimiter1 "N£mero de Telefone*" Cdelimiter2  
            Cdelimiter1 "Tipo do Telefone*"   Cdelimiter2  
            Cdelimiter1 "ê Prim†rio*"         Cdelimiter2  
            Cdelimiter1 "C¢digo do Pa°s"      Cdelimiter2  
            Cdelimiter1 "C¢digo de µrea"      Cdelimiter2  
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


        IF bpf.num_telef_contat <> 0 THEN do:
            PUT UNFORMATTED
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                            Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"
                Cdelimiter1 bpf.num_telef_contat                            Cdelimiter2  //"phone-number"                  "N£mero de telefone"
                Cdelimiter1 ""                                              Cdelimiter2  //"phone-type"                    "Tipo do telefone"  
                Cdelimiter1 (IF bpf.num_telefone = 0 THEN "TRUE" ELSE "FALSE")  Cdelimiter2  //"isPrimary"                     "ê prim†rio"        
                Cdelimiter1 "55"                                            Cdelimiter2  //"country-code"                  "C¢digo do pa°s"    
                Cdelimiter1 bpf.num_ddd_contat                              Cdelimiter2  //"area-code"                     "C¢digo de †rea"    
                Cdelimiter1 ""                                              Cdelimiter1  //"operation"                     "Operaá∆o"          
                SKIP.
        END.
        ELSE DO:

            PUT UNFORMATTED
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                            Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"
                Cdelimiter1 bpf.num_telefone                                Cdelimiter2  //"phone-number"                  "N£mero de telefone"
                Cdelimiter1 ""                                              Cdelimiter2  //"phone-type"                    "Tipo do telefone"  
                Cdelimiter1 (IF bpf.num_telefone = 0 THEN "TRUE" ELSE "FALSE")  Cdelimiter2  //"isPrimary"                     "ê prim†rio"        
                Cdelimiter1 "55"                                            Cdelimiter2  //"country-code"                  "C¢digo do pa°s"    
                Cdelimiter1 bpf.num_ddd                                     Cdelimiter2  //"area-code"                     "C¢digo de †rea"    
                Cdelimiter1 ""                                              Cdelimiter1  //"operation"                     "Operaá∆o"          
                SKIP.

        END.

        /*
        IF bpf.num_fax <> 0 THEN do:
            PUT UNFORMATTED
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"
                Cdelimiter1 bpf.num_fax                                         Cdelimiter2  //"phone-number"                  "N£mero de telefone"
                Cdelimiter1 "Other"                                             Cdelimiter2  //"phone-type"                    "Tipo do telefone"  
                Cdelimiter1 (IF bpf.num_telefone = 0 and
                                bpf.num_telef_contat = 0 THEN "Yes" ELSE "No")  Cdelimiter2  //"isPrimary"                     "ê prim†rio"        
                Cdelimiter1 "55"                                                Cdelimiter2  //"country-code"                  "C¢digo do pa°s"    
                Cdelimiter1 bpf.num_ddd_contat                                  Cdelimiter2  //"area-code"                     "C¢digo de †rea"    
                Cdelimiter1 ""                                                  Cdelimiter1  //"operation"                     "Operaá∆o"          
                SKIP.
        END.
        */

    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    









