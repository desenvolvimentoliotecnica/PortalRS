Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Cargo                                                                        */
/********************************************************************************/

DEF BUFFER btab FOR cargo.
DEF BUFFER bgra FOR grau_instruc.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio AS CHAR NO-UNDO.

DEFINE VARIABLE h-acomp  AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont   AS INT    NO-UNDO.
DEFINE VARIABLE cDataIni AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - CADASTRO CARGO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '9 - Cargo.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"                                 Cdelimiter2 
        Cdelimiter1 "effectiveStartDate"                         Cdelimiter2 
        Cdelimiter1 "externalCode"                               Cdelimiter2 
        Cdelimiter1 "name.en_US"                                 Cdelimiter2 
        Cdelimiter1 "name.defaultValue"                          Cdelimiter2 
        Cdelimiter1 "name.pt_BR"                                 Cdelimiter2 
        Cdelimiter1 "name.en_DEBUG"                              Cdelimiter2 
        Cdelimiter1 "description.en_US"                          Cdelimiter2 
        Cdelimiter1 "description.defaultValue"                   Cdelimiter2 
        Cdelimiter1 "description.pt_BR"                          Cdelimiter2 
        Cdelimiter1 "description.en_DEBUG"                       Cdelimiter2 
        Cdelimiter1 "cust_descCompleta"                          Cdelimiter2 
        Cdelimiter1 "effectiveStatus"                            Cdelimiter2 
        Cdelimiter1 "defaultJobLevel.externalCode"               Cdelimiter2 
        Cdelimiter1 "cust_jobClassificationProfile.externalCode" Cdelimiter2 
        Cdelimiter1 "payGrade.externalCode"                      Cdelimiter2 
        Cdelimiter1 "cust_schoolLevel.externalCode"              Cdelimiter2 
        Cdelimiter1 "cust_PPR.externalCode"                      Cdelimiter2 
        Cdelimiter1 "cust_TargetRV.externalCode"                 Cdelimiter2 
        Cdelimiter1 "cust_CotaAprendiz"                          Cdelimiter1 
        Cdelimiter1 "cust_usuarioDeSistema"                      Cdelimiter1 
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete" Cdelimiter2 
        Cdelimiter1 "Data Inicial*"                                  Cdelimiter2 
        Cdelimiter1 "C¢digo*"                                        Cdelimiter2 
        Cdelimiter1 "Inglàs dos EUA"                                 Cdelimiter2 
        Cdelimiter1 "Valor Padr∆o"                                   Cdelimiter2 
        Cdelimiter1 "Portuguàs do Brasil"                            Cdelimiter2 
        Cdelimiter1 "English Debug"                                  Cdelimiter2 
        Cdelimiter1 "Inglàs dos EUA"                                 Cdelimiter2 
        Cdelimiter1 "Valor Padr∆o"                                   Cdelimiter2 
        Cdelimiter1 "Portuguàs do Brasil*"                           Cdelimiter2 
        Cdelimiter1 "English Debug"                                  Cdelimiter2 
        Cdelimiter1 "Descriá∆o Completa"                             Cdelimiter2 
        Cdelimiter1 "Status(Valid Values: A/I A=Ativo I=Inativo)*"   Cdelimiter2 
        Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"        Cdelimiter2 
        Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"        Cdelimiter2 
        Cdelimiter1 "PayGrade.ExternalCode"                          Cdelimiter2 
        Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"        Cdelimiter2 
        Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"        Cdelimiter2 
        Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"        Cdelimiter2 
        Cdelimiter1 "Cota Aprendiz(Valid Values: TRUE/FALSE)"        Cdelimiter1 
        Cdelimiter1 "Usu†rio Sistema(Valid Values : TRUE/FALSE)"     Cdelimiter1
        SKIP.

    FOR EACH btab NO-LOCK,
        FIRST bgra OF btab NO-LOCK.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        ASSIGN cDataIni = STRING(MONTH(btab.dat_descr_cargo),'99') + "/" + STRING(DAY(btab.dat_descr_cargo),'99') + "/" + STRING(YEAR(btab.dat_descr_cargo),'9999').

        PUT UNFORMATTED
             Cdelimiter1 "Delimit"                         Cdelimiter2 //[OPERATOR]                                 Operadores permitidos: Delimit, Clear e Delete
             Cdelimiter1 cDataIni /*btab.dat_descr_cargo*/ Cdelimiter2 //effectiveStartDate                         Data inicial
             Cdelimiter1 btab.cdn_cargo_basic              Cdelimiter2 //externalCode                               C¢digo
             Cdelimiter1 ""                                Cdelimiter2 //name.en_US                                 Inglàs dos EUA
             Cdelimiter1 btab.des_envel_pagto              Cdelimiter2 //name.defaultValue                          Valor Padr∆o
             Cdelimiter1 btab.des_envel_pagto              Cdelimiter2 //name.pt_BR                                 Portuguàs do Brasil
             Cdelimiter1 ""                                Cdelimiter2 //name.en_DEBUG                              English Debug
             Cdelimiter1 ""                                Cdelimiter2 //description.en_US                          Inglàs dos EUA
             Cdelimiter1 btab.des_cargo                    Cdelimiter2 //description.defaultValue                   Valor Padr∆o
             Cdelimiter1 btab.des_cargo                    Cdelimiter2 //description.pt_BR                          Portuguàs do Brasil
             Cdelimiter1 ""                                Cdelimiter2 //description.en_DEBUG                       English Debug
             Cdelimiter1 btab.des_cargo                    Cdelimiter2 //cust_descCompleta                          Descriá∆o Completa
             Cdelimiter1 "A"                               Cdelimiter2 //effectiveStatus                            Status(Valid Values : A/I   A for Ativo  I for Inativo  )
             Cdelimiter1 ""                                Cdelimiter2 //defaultJobLevel.externalCode               Valor da lista de opá‰es.C¢digo externo
             Cdelimiter1 ""                                Cdelimiter2 //cust_jobClassificationProfile.externalCode Valor da lista de opá‰es.C¢digo externo
             Cdelimiter1 ""                                Cdelimiter2 //payGrade.externalCode                      payGrade.externalCode
             Cdelimiter1 bgra.des_grau_instruc             Cdelimiter2 //cust_schoolLevel.externalCode              Valor da lista de opá‰es.C¢digo externo
             Cdelimiter1 ""                                Cdelimiter2 //cust_PPR.externalCode                      Valor da lista de opá‰es.C¢digo externo
             Cdelimiter1 ""                                Cdelimiter2 //cust_TargetRV.externalCode                 Valor da lista de opá‰es.C¢digo externo
             Cdelimiter1 ""                                Cdelimiter1 //cust_CotaAprendiz                          Cota Aprendiz(Valid Values : TRUE/FALSE)
             Cdelimiter1 ""                                Cdelimiter1 //cust_usuarioDeSistema                      Usu†rio Sistema(Valid Values : TRUE/FALSE)
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp. 


