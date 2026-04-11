Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* LinhasValeTransporte                                                         */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bft  FOR func_lin_vale_transp.
DEF BUFFER blt  FOR lin_vale_transp.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.

DEFINE VARIABLE h-acomp  AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont   AS INT    NO-UNDO.
DEFINE VARIABLE i-cont-l AS INT    NO-UNDO.
DEFINE VARIABLE c-tipo-t AS CHAR   NO-UNDO.
DEFINE VARIABLE c-status AS CHAR   NO-UNDO.
DEFINE VARIABLE DtIniBen AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - BENEFÖCIOS VALE TRANSPORTE").

ASSIGN i-cont   = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '32 - LinhasValeTransporte.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"                                          Cdelimiter2 //"[OPERATOR]"                                          "Operadores permitidos: Delimit Clear e Delete"
            Cdelimiter1 "id"                                                  Cdelimiter2 //"id"                                                  "Registro de Benef¡cio.ID"                     
            Cdelimiter1 "effectiveStartDate"                                  Cdelimiter2 //"effectiveStartDate"                                  "Registro de Benef¡cio.Efetivo a partir de"    
            Cdelimiter1 "cust_valeTransporte.externalCode"                    Cdelimiter2 //"cust_valeTransporte.externalCode"                    "ID"                                           
            Cdelimiter1 "cust_valeTransporte.externalName"                    Cdelimiter2 //"cust_valeTransporte.externalName"                    "Nome"                                         
            Cdelimiter1 "cust_valeTransporte.cust_passagem.externalCode"      Cdelimiter2 //"cust_valeTransporte.cust_passagem.externalCode"      "Linha de Transporte.C¢digo do Transporte"                                     
            Cdelimiter1 "cust_valeTransporte.cust_valorTarifa"                Cdelimiter2 //"cust_valeTransporte.cust_valorTarifa"                "Valor da Tarifa"   
            Cdelimiter1 "cust_valeTransporte.cust_tipo.externalCode"          Cdelimiter2 //"cust_valeTransporte.cust_tipo.externalCode"          "Valor da lista de op‡äes.C¢digo externo"   
            Cdelimiter1 "cust_valeTransporte.cust_periodicidade.externalCode" Cdelimiter2 //"cust_valeTransporte.cust_periodicidade.externalCode" "Valor da lista de op‡äes.C¢digo externo"   
            Cdelimiter1 "cust_valeTransporte.cust_quantidade.externalCode"    Cdelimiter2 //"cust_valeTransporte.cust_quantidade.externalCode"    "Valor da lista de op‡äes.C¢digo externo"                                  
            Cdelimiter1 "cust_valeTransporte.mdfSystemStatus"                 Cdelimiter1 //"cust_valeTransporte.mdfSystemStatus"                 "Status(Valid Values: A/I A=Ativo I=Inativo)"                                  
            SKIP.  

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"                                   Cdelimiter2 //"[OPERATOR]"                                          "Operadores permitidos: Delimit Clear e Delete"
            Cdelimiter1 "id*"                                          Cdelimiter2 //"id"                                                  "Registro de Benef¡cio.ID"                     
            Cdelimiter1 "Efetivo a partir de*"                         Cdelimiter2 //"effectiveStartDate"                                  "Registro de Benef¡cio.Efetivo a partir de"    
            Cdelimiter1 "ID*"                                          Cdelimiter2 //"cust_valeTransporte.externalCode"                    "ID"                                           
            Cdelimiter1 "Nome"                                         Cdelimiter2 //"cust_valeTransporte.externalName"                    "Nome"                                         
            Cdelimiter1 "C¢digo do Transporte"                         Cdelimiter2 //"cust_valeTransporte.cust_passagem.externalCode"      "Linha de Transporte.C¢digo do Transporte"                                     
            Cdelimiter1 "Valor da Tarifa"                              Cdelimiter2 //"cust_valeTransporte.cust_valorTarifa"                "Valor da Tarifa"   
            Cdelimiter1 "Tipo Linha"                                   Cdelimiter2 //"cust_valeTransporte.cust_tipo.externalCode"          "Valor da lista de op‡äes.C¢digo externo"   
            Cdelimiter1 "Periodicidade"                                Cdelimiter2 //"cust_valeTransporte.cust_periodicidade.externalCode" "Valor da lista de op‡äes.C¢digo externo"   
            Cdelimiter1 "Quantidade Pessagem"                          Cdelimiter2 //"cust_valeTransporte.cust_quantidade.externalCode"    "Valor da lista de op‡äes.C¢digo externo"                                  
            Cdelimiter1 "Status(Valid Values: A/I A=Ativo I=Inativo)*" Cdelimiter1 //"cust_valeTransporte.mdfSystemStatus"                 "Status(Valid Values: A/I A=Ativo I=Inativo)"                                  
            SKIP.

    FOR EACH bft NO-LOCK,
        EACH btab OF bft NO-LOCK 
         WHERE btab.dat_desligto_func = ? /* Lista Funcionarios para desconsiderar desligados */
           AND btab.cdn_empresa     >= p-emp-ini
           AND btab.cdn_empresa     <= p-emp-fim 
           AND btab.cdn_estab       >= p-estab-ini
           AND btab.cdn_estab       <= p-estab-fim
           AND btab.cdn_funcionario >= p-matricula-ini
           AND btab.cdn_funcionario <= p-matricula-fim
           AND btab.dat_admis_func  >= p-dt-admissao
        BREAK BY bft.cdn_empresa
              BY bft.cdn_estab
              BY bft.cdn_funcion
              BY bft.cdn_lin_vale_trans.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        FIND FIRST blt
             WHERE blt.cdn_lin_vale_transp = bft.cdn_lin_vale_transp NO-LOCK NO-ERROR. 

        ASSIGN c-tipo-t = {DATABASE/inpy/i02py115.i 04 blt.idi_tip_lin}.

        ASSIGN i-cont-l = i-cont-l + 1.

        IF FIRST-OF(bft.cdn_funcionario) THEN DO:
           ASSIGN i-cont-l = 1.
        END.

        IF bft.idi_sit_lin_transp  = 1 THEN ASSIGN c-status = "A". ELSE "I".

        /***** Data Inicio Benef¡cio *****/
        ASSIGN DtIniBen = STRING(MONTH(bft.dat_lin_impl_func),'99') + "/" + STRING(DAY(bft.dat_lin_impl_func),'99') + "/" + STRING(YEAR(bft.dat_lin_impl_func),'9999').

        PUT UNFORMATTED
            Cdelimiter1 "Delimit"                                                                                                Cdelimiter2 //"[OPERATOR]"                                          "Operadores permitidos: Delimit Clear e Delete"
            Cdelimiter1 STRING(bft.cdn_funcion) + STRING(bft.cdn_benefic)                                                        Cdelimiter2 //"id"                                                  "Registro de Benef¡cio.ID"                     
            Cdelimiter1 DtIniBen /*bft.dat_lin_impl_func*/                                                                       Cdelimiter2 //"effectiveStartDate"                                  "Registro de Benef¡cio.Efetivo a partir de"    
            Cdelimiter1 "#" + STRING(i-cont-l)                                                                                   Cdelimiter2 //"cust_valeTransporte.externalCode"                    "ID"                                            
            Cdelimiter1 blt.des_lin_transp                                                                                       Cdelimiter2 //"cust_valeTransporte.externalName"                    "Nome"                                         
            Cdelimiter1 bft.cdn_lin_vale_trans                                                                                   Cdelimiter2 //"cust_valeTransporte.cust_passagem.externalCode"      "Linha de Transporte.C¢digo do Transporte"                                     
            Cdelimiter1 blt.val_tarifa_transp                                                                                    Cdelimiter2 //"cust_valeTransporte.cust_valorTarifa"                "Valor da Tarifa"    
            Cdelimiter1 c-tipo-t                                                                                                 Cdelimiter2 //"cust_valeTransporte.cust_tipo.externalCode"          "Valor da lista de op‡äes.C¢digo externo"   
            Cdelimiter1 "1"                                                                                                      Cdelimiter2 //"cust_valeTransporte.cust_periodicidade.externalCode" "Valor da lista de op‡äes.C¢digo externo"
            Cdelimiter1 bft.qti_padr_dia_vale_func_lin                                                                           Cdelimiter2 //"cust_valeTransporte.cust_quantidade.externalCode"    "Valor da lista de op‡äes.C¢digo externo"                                   
            Cdelimiter1 c-status                                                                                                 Cdelimiter1 //"cust_valeTransporte.mdfSystemStatus"                 "Status(Valid Values: A/I A=Ativo I=Inativo)"                                  
            SKIP.                                                                                                                    
                       
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.







