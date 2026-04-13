Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Sindicato                                                                    */
/********************************************************************************/

DEF BUFFER btab FOR sindicato.

DEF VAR Cdelimiter1 AS CHAR INIT '"' NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio AS CHAR NO-UNDO.

DEFINE VARIABLE h-acomp AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont  AS INT    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - CADASTRO SINDICATO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '15 - Sindicato.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"                Cdelimiter2 
        Cdelimiter1 "code"                      Cdelimiter2 
        Cdelimiter1 "payScaleType"              Cdelimiter2
        Cdelimiter1 "externalName.en_US"        Cdelimiter2
        Cdelimiter1 "externalName.defaultValue" Cdelimiter2
        Cdelimiter1 "externalName.pt_BR"        Cdelimiter2
        Cdelimiter1 "externalName.en_DEBUG"     Cdelimiter2
        Cdelimiter1 "country.code"              Cdelimiter2
        Cdelimiter1 "mdfSystemStatus"           Cdelimiter1 
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Operadores Permitidos: Delimit, Clear e Delete"   Cdelimiter2 
        Cdelimiter1 "C¢digo*"                                          Cdelimiter2 
        Cdelimiter1 "Tipo de Acordo Coletivo*"                         Cdelimiter2
        Cdelimiter1 "Inglàs dos EUA"                                   Cdelimiter2 
        Cdelimiter1 "Valor Padr∆o"                                     Cdelimiter2 
        Cdelimiter1 "Portuguàs do Brasil"                              Cdelimiter2 
        Cdelimiter1 "English Debug"                                    Cdelimiter2 
        Cdelimiter1 "Pa°s/Regi∆o. C¢digo do Pa°s/Regi∆o(3 caracteres)" Cdelimiter2
        Cdelimiter1 "Status(Valid Values: A/I A=Ativo I=Inativo)*"     Cdelimiter1 
        SKIP.

    FOR EACH btab NO-LOCK.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        PUT UNFORMATTED
             Cdelimiter1 'Delimit'              Cdelimiter2 //"[OPERATOR]"                Operadores permitidos: Delimit, Clear e Delet   
             Cdelimiter1 btab.cdn_sindicato     Cdelimiter2 //"code"                      C¢digo                                          
             Cdelimiter1 btab.nom_pessoa_jurid  Cdelimiter2 //"payScaleType"              Nome
             Cdelimiter1 ""                     Cdelimiter2 //"externalName.en_US"        Inglàs dos EUA"
             Cdelimiter1 ""                     Cdelimiter2 //"externalName.defaultValue" Valor Padr∆o"
             Cdelimiter1 "BRA"                  Cdelimiter2 //"externalName.pt_BR"        Portuguàs do Brasil"
             Cdelimiter1 ""                     Cdelimiter2 //"externalName.en_DEBUG"     English Debug"
             Cdelimiter1 btab.cod_pais          Cdelimiter2 //"country.code"              Pa°s/Regi∆o.C¢digo do pa°s/regi∆o (3 caracteres)
             Cdelimiter1 "A"                    Cdelimiter1 //"mdfSystemStatus"           Status(Valid Values: A/I A=Ativo I=Inativo)
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp. 
