Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes do Documento de Identificacao                                    */
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
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES DOCUMENTO IDENTIFICAÄ«O").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '14 - Informacoes do Documento de Identificacao.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "national-id"                   Cdelimiter2  //"national-id"                   "ID nacional"                  
            Cdelimiter1 "personInfo.person-id-external" Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"           
            Cdelimiter1 "country"                       Cdelimiter2  //"country"                       "Pa°s"                         
            Cdelimiter1 "card-type"                     Cdelimiter2  //"card-type"                     "Tipo de cart∆o de ID nacional"
            Cdelimiter1 "isPrimary"                     Cdelimiter2  //"isPrimary"                     "ê prim†rio"                   
            Cdelimiter1 "custom-date2"                  Cdelimiter2  //"custom-date2"                  "Data Validade"                
            Cdelimiter1 "custom-date1"                  Cdelimiter2  //"custom-date1"                  "Data de Emiss∆o"              
            Cdelimiter1 "operation"                     Cdelimiter1  //"operation"                     "Operaá∆o"                     
            SKIP.  

         PUT UNFORMATTED
            Cdelimiter1 "ID Nacional*"                   Cdelimiter2  
            Cdelimiter1 "ID Pessoal Externa*"            Cdelimiter2  
            Cdelimiter1 "Pa°s*"                          Cdelimiter2  
            Cdelimiter1 "Tipo de Cart∆o de ID Nacional*" Cdelimiter2  
            Cdelimiter1 "ê Prim†rio*"                    Cdelimiter2  
            Cdelimiter1 "Data Validade"                  Cdelimiter2  
            Cdelimiter1 "Data de Emiss∆o"                Cdelimiter2  
            Cdelimiter1 "Operaá∆o"                       Cdelimiter1  
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
            Cdelimiter1 bpf.cod_id_feder        Cdelimiter2  //"national-id"                   "ID nacional"                  
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)    Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"           
            Cdelimiter1 "BRA"                   Cdelimiter2  //"country"                       "Pa°s"                         
            Cdelimiter1 "CPF"                   Cdelimiter2  //"card-type"                     "Tipo de cart∆o de ID nacional"
            Cdelimiter1 "Y"                     Cdelimiter2  //"isPrimary"                     "ê prim†rio"                   
            Cdelimiter1 ""                      Cdelimiter2  //"custom-date2"                  "Data Validade"                
            Cdelimiter1 ""                      Cdelimiter2  //"custom-date1"                  "Data de Emiss∆o"              
            Cdelimiter1 ""                      Cdelimiter1  //"operation"                     "Operaá∆o"                     
            SKIP.

        /*
        IF btab.cod_pis <> '' THEN do:
            PUT UNFORMATTED
                Cdelimiter1 btab.cod_pis            Cdelimiter2  //"national-id"                   "ID nacional"                  
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)    Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"           
                Cdelimiter1 "BRA"                   Cdelimiter2  //"country"                       "Pa°s"                         
                Cdelimiter1 "PIS"                   Cdelimiter2  //"card-type"                     "Tipo de cart∆o de ID nacional"
                Cdelimiter1 "No"                    Cdelimiter2  //"isPrimary"                     "ê prim†rio"                   
                Cdelimiter1 ""                      Cdelimiter2  //"custom-date2"                  "Data Validade"                
                Cdelimiter1 STRING(DAY(btab.dat_pis_pasep),'99') + "/" + STRING(MONTH(btab.dat_pis_pasep),'99') + "/" + STRING(YEAR(btab.dat_pis_pasep),'9999')  Cdelimiter2  //"custom-date1"                  "Data de Emiss∆o"              
                Cdelimiter1 ""                      Cdelimiter1  //"operation"                     "Operaá∆o"                     
                SKIP.
        END.
        */
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    

