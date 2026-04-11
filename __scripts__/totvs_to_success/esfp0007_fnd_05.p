Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Centro de Custo                                                              */
/********************************************************************************/

DEF BUFFER bun  FOR hcm.unid_negoc.
DEF BUFFER btab FOR rh_ccusto.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio AS CHAR NO-UNDO.

DEFINE VARIABLE h-acomp  AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont   AS INT    NO-UNDO.
DEFINE VARIABLE cDataIni AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - CADASTRO CENTRO CUSTO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '5 - Centro de Custo.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED    
        Cdelimiter1 "[OPERATOR]"                       Cdelimiter2 
        Cdelimiter1 "effectiveStartDate"               Cdelimiter2 
        Cdelimiter1 "cust_CodigoCC"                    Cdelimiter2 
        Cdelimiter1 "externalCode"                     Cdelimiter2 
        Cdelimiter1 "name.en_US"                       Cdelimiter2 
        Cdelimiter1 "name.defaultValue"                Cdelimiter2 
        Cdelimiter1 "name.pt_BR"                       Cdelimiter2 
        Cdelimiter1 "name.en_DEBUG"                    Cdelimiter2 
        Cdelimiter1 "description.en_US"                Cdelimiter2 
        Cdelimiter1 "description.defaultValue"         Cdelimiter2 
        Cdelimiter1 "description.pt_BR"                Cdelimiter2 
        Cdelimiter1 "description.en_DEBUG"             Cdelimiter2 
        Cdelimiter1 "effectiveStatus"                  Cdelimiter2 
        Cdelimiter1 "cust_toBusinessUnit.externalCode" Cdelimiter1 
        SKIP.

    PUT UNFORMATTED    
        Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete" Cdelimiter2 
        Cdelimiter1 "Data Inicial*"                                  Cdelimiter2 
        Cdelimiter1 "C¢digo Ènico"                                   Cdelimiter2 
        Cdelimiter1 "C¢digo*"                                        Cdelimiter2 
        Cdelimiter1 "Inglàs dos EUA"                                 Cdelimiter2 
        Cdelimiter1 "Valor Padr∆o"                                   Cdelimiter2 
        Cdelimiter1 "Portuguàs do Brasil"                            Cdelimiter2 
        Cdelimiter1 "English Debug"                                  Cdelimiter2 
        Cdelimiter1 "Inglàs dos EUA"                                 Cdelimiter2 
        Cdelimiter1 "Valor Padr∆o"                                   Cdelimiter2 
        Cdelimiter1 "Portuguàs do Brasil"                            Cdelimiter2 
        Cdelimiter1 "English Debug"                                  Cdelimiter2 
        Cdelimiter1 "Status(Valid Values: A/I A=Ativo I=Inativo)*"   Cdelimiter2 
        Cdelimiter1 "Centro de Custo Unidade de Neg¢cios"            Cdelimiter1 
        SKIP.

    FOR EACH btab NO-LOCK 
       WHERE btab.log_livre_2 = YES.
    
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        ASSIGN cDataIni = STRING(MONTH(btab.dat_inic_valid),'99') + "/" + STRING(DAY(btab.dat_inic_valid),'99') + "/" + STRING(YEAR(btab.dat_inic_valid),'9999').

        PUT UNFORMATTED
             Cdelimiter1 'Delimit'                                Cdelimiter2 //[OPERATOR]                          Operadores permitidos: Delimit, Clear e Delete           
             Cdelimiter1 cDataIni /*btab.dat_inic_valid*/        Cdelimiter2 //effectiveStartDate                  Data incial                                              
             Cdelimiter1 btab.cod_rh_ccusto                       Cdelimiter2 //cust_CodigoCC                       C¢digo £nico                                             
             Cdelimiter1 btab.cod_rh_ccusto                       Cdelimiter2 //externalCode                        C¢digo                                                   
             Cdelimiter1 ""                                       Cdelimiter2 //name.en_US                          Inglàs dos EUA                                           
             Cdelimiter1 btab.des_rh_ccusto                       Cdelimiter2 //name.defaultValue                   Valor Padr∆o                                             
             Cdelimiter1 btab.des_rh_ccusto                       Cdelimiter2 //name.pt_BR                          Portuguàs do Brasil                                      
             Cdelimiter1 ""                                       Cdelimiter2 //name.en_DEBUG                       English Debug                                            
             Cdelimiter1 ""                                       Cdelimiter2 //description.en_US                   Inglàs dos EUA                                           
             Cdelimiter1 btab.des_rh_ccusto                       Cdelimiter2 //description.defaultValue            Valor Padr∆o                                             
             Cdelimiter1 btab.des_rh_ccusto                       Cdelimiter2 //description.pt_BR                   Portuguàs do Brasil                                      
             Cdelimiter1 ""                                       Cdelimiter2 //description.en_DEBUG                English Debug                                            
             Cdelimiter1 IF btab.log_livre_1 THEN "A" ELSE "I"    Cdelimiter2 //effectiveStatus                     Status(Valid Values : A/I   A for Ativo  I for Inativo  )
             Cdelimiter1 ""                                       Cdelimiter1 //cust_toBusinessUnit.externalCode    Centro de custo.Unidade de neg¢cios                      
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp. 
