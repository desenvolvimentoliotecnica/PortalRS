Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informaá‰es de Pagamento                                                     */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bbco FOR rh_bco.
DEF BUFFER bage FOR rh_agenc_bcia.
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

DEFINE VARIABLE WContratacao AS CHAR   NO-UNDO.
DEFINE VARIABLE h-acomp      AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont       AS INT    NO-UNDO.
DEFINE VARIABLE c-pagto      AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES PAGAMENTO 18.5").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '18.5 - Informaá‰es de Pagamento.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"                                                 Cdelimiter2  //"[OPERATOR]"                                                  "Operadores permitidos: Delimit, Clear e Delete"  
            Cdelimiter1 "worker"                                                     Cdelimiter2  //"worker"                                                      "Matricula"                                     
            Cdelimiter1 "effectiveStartDate"                                         Cdelimiter2  //"effectiveStartDate"                                          "Data"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.payType"                       Cdelimiter2  //"toPaymentInformationDetailV3.payType"                        "Tipo de pagamento(VALUES: MAIN/PAYROLL/BONUS/EXPENSES   MAIN for Forma de pagamento principal  PAYROLL for Folha de pagamento  BONUS for Gratificaá∆o  EXPENSES for Despesas)"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.customPayType.standardPayType" Cdelimiter2  //"toPaymentInformationDetailV3.customPayType.standardPayType"  "Tipo de pagamento personalizado.Tipo de pagamento padr∆o"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.paymentMethod.externalCode"    Cdelimiter2  //"toPaymentInformationDetailV3.paymentMethod.externalCode"     "Forma de pagamento.C¢digo externo"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.bankCountry.code"              Cdelimiter2  //"toPaymentInformationDetailV3.bankCountry.code"               "Pa°s/Regi∆o.C¢digo do pa°s/regi∆o"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.accountNumber"                 Cdelimiter2  //"toPaymentInformationDetailV3.accountNumber"                  "N£mero da Conta"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.routingNumber"                 Cdelimiter2  //"toPaymentInformationDetailV3.routingNumber"                  "N£mero do Banco"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.bank.externalCode"             Cdelimiter2  //"toPaymentInformationDetailV3.bank.externalCode"              "Banco.ID do banco"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.businessIdentifierCode"        Cdelimiter2  //"toPaymentInformationDetailV3.businessIdentifierCode"         "Agencia"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.paySequence"                   Cdelimiter2  //"toPaymentInformationDetailV3.paySequence"                    "Sequencia de Pagamento"                                     
            Cdelimiter1 "toPaymentInformationDetailV3.externalCode"                  Cdelimiter2  //"toPaymentInformationDetailV3.externalCode"                   "C¢digo"
            Cdelimiter1 "toPaymentInformationDetailV3.cust_digitoConta"              Cdelimiter1  //"toPaymentInformationDetailV3.cust_digitoConta"               "Digito da Conta"                            
            SKIP.  

        PUT UNFORMATTED
            Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete"            Cdelimiter2  //"[OPERATOR]"                                                  "Operadores permitidos: Delimit, Clear e Delete"  
            Cdelimiter1 "Matricula*"                                                Cdelimiter2  //"worker"                                                      "Matricula"                                     
            Cdelimiter1 "Data*"                                                     Cdelimiter2  //"effectiveStartDate"                                          "Data"                                     
            Cdelimiter1 "Tipo de pagamento(VALUES: MAIN/PAYROLL/BONUS/EXPENSES*"    Cdelimiter2  //"toPaymentInformationDetailV3.payType"                        "Tipo de pagamento(VALUES: MAIN/PAYROLL/BONUS/EXPENSES   MAIN for Forma de pagamento principal  PAYROLL for Folha de pagamento  BONUS for Gratificaá∆o  EXPENSES for Despesas)"                                     
            Cdelimiter1 "Tipo de pagamento personalizado.Tipo de pagamento padr∆o"  Cdelimiter2  //"toPaymentInformationDetailV3.customPayType.standardPayType"  "Tipo de pagamento personalizado.Tipo de pagamento padr∆o"                                     
            Cdelimiter1 "Forma de pagamento.C¢digo externo*"                        Cdelimiter2  //"toPaymentInformationDetailV3.paymentMethod.externalCode"     "Forma de pagamento.C¢digo externo"                                     
            Cdelimiter1 "Pa°s/Regi∆o.C¢digo do pa°s/regi∆o*"                        Cdelimiter2  //"toPaymentInformationDetailV3.bankCountry.code"               "Pa°s/Regi∆o.C¢digo do pa°s/regi∆o"                                     
            Cdelimiter1 "N£mero da Conta*"                                          Cdelimiter2  //"toPaymentInformationDetailV3.accountNumber"                  "N£mero da Conta"                                     
            Cdelimiter1 "N£mero do Banco*"                                          Cdelimiter2  //"toPaymentInformationDetailV3.routingNumber"                  "N£mero do Banco"                                     
            Cdelimiter1 "Banco.ID do banco*"                                        Cdelimiter2  //"toPaymentInformationDetailV3.bank.externalCode"              "Banco.ID do banco"                                     
            Cdelimiter1 "Agencia*"                                                  Cdelimiter2  //"toPaymentInformationDetailV3.businessIdentifierCode"         "Agencia"                                     
            Cdelimiter1 "Sequencia de Pagamento*"                                   Cdelimiter2  //"toPaymentInformationDetailV3.paySequence"                    "Sequencia de Pagamento"                                     
            Cdelimiter1 "C¢digo*"                                                   Cdelimiter2  //"toPaymentInformationDetailV3.externalCode"                   "C¢digo"
            Cdelimiter1 "Digito da Conta*"                                          Cdelimiter1  //"toPaymentInformationDetailV3.cust_digitoConta"               "Digito da Conta"                            
            SKIP.

        ASSIGN c-pagto = "".
        FOR EACH btab NO-LOCK
            WHERE btab.dat_desligto_func = ?
              AND btab.cdn_empresa       >= p-emp-ini
              AND btab.cdn_empresa       <= p-emp-fim 
              AND btab.cdn_estab         >= p-estab-ini
              AND btab.cdn_estab         <= p-estab-fim
              AND btab.cdn_funcionario   >= p-matricula-ini
              AND btab.cdn_funcionario   <= p-matricula-fim
              AND btab.dat_admis_func    >= p-dt-admissao.
            
            ASSIGN i-cont = i-cont + 1.
            RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

            /***** Data Admiss∆o *****/
            ASSIGN WContratacao = STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

            /***** Forma de Pagamento *****/
            IF btab.idi_forma_pagto = 1 THEN ASSIGN c-pagto = "L°quido".
            IF btab.idi_forma_pagto = 2 THEN ASSIGN c-pagto = "Cheque Sal†rio".
            IF btab.idi_forma_pagto = 3 THEN ASSIGN c-pagto = "Caixa".

            /***** Informaá‰es Banco *****/
            FIND bbco WHERE bbco.cdn_banco = btab.cdn_bco_liq NO-LOCK NO-ERROR.

            /***** Informaá‰es Agància *****/
            FIND bage WHERE 
                 bage.cdn_banco      = btab.cdn_bco_liq AND
                 bage.cdn_agenc_bcia = btab.cdn_agenc_bcia_liq NO-LOCK NO-ERROR.

            PUT UNFORMATTED
                Cdelimiter1 "Delimit"                                                  Cdelimiter2  // "Operadores permitidos: Delimit, Clear e Delete"  
                cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                       Cdelimiter2  // "Matricula"                                     
                Cdelimiter1 WContratacao                                               Cdelimiter2  // "Data"                                     
                Cdelimiter1 "MAIN"                                                     Cdelimiter2  // "Tipo de pagamento(VALUES: MAIN/PAYROLL/BONUS/EXPENSES   MAIN for Forma de pagamento principal  PAYROLL for Folha de pagamento  BONUS for Gratificaá∆o  EXPENSES for Despesas)"                                     
                Cdelimiter1 ""                                                         Cdelimiter2  // "Tipo de pagamento personalizado.Tipo de pagamento padr∆o"                                     
                Cdelimiter1 IF btab.idi_forma_pagto = 0 THEN 1 ELSE btab.idi_forma_pagto  Cdelimiter2  // "Forma de pagamento.C¢digo externo"                                     
                Cdelimiter1 IF AVAIL bage THEN bage.cod_pais ELSE ''                   Cdelimiter2  // "Pa°s/Regi∆o.C¢digo do pa°s/regi∆o"                                     
                Cdelimiter1 btab.cdn_cta_corren                                        Cdelimiter2  // "N£mero da Conta"                                     
                Cdelimiter1 FILL("0", 3 -  length(TRIM(string(btab.cdn_bco_liq)))) + trim(STRING(btab.cdn_bco_liq)) Cdelimiter2  // "N£mero do Banco"                                     
                Cdelimiter1 FILL("0", 7 -  length(TRIM(STRING(btab.cdn_bco_liq))   + TRIM(STRING(btab.cdn_agenc_bcia_liq)))) + TRIM(STRING(btab.cdn_bco_liq)) + TRIM(STRING(btab.cdn_agenc_bcia_liq)) Cdelimiter2  // "Banco.ID do banco"                                     
                Cdelimiter1 FILL("0", 4 -  length(TRIM(string(btab.cdn_agenc_bcia_liq)))) + STRING(btab.cdn_agenc_bcia_liq) Cdelimiter2  // "Agencia"                                     
                Cdelimiter1 "0"                                                        Cdelimiter2  // "Sequencia de Pagamento"                                     
                Cdelimiter1 "1"                                                        Cdelimiter2  // "C¢digo"
                Cdelimiter1 btab.cod_digito_cta_corren                                 Cdelimiter1  // "Digito da Conta"                            
                SKIP.

    END.
OUTPUT CLOSE.

RUN pi-finalizar IN h-acomp.    

