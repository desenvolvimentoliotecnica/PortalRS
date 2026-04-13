Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Registro_Benef¡cio                                                           */
/********************************************************************************/

DEF BUFFER bben FOR beneficio.
DEF BUFFER btab FOR funcionario.
DEF BUFFER bcf  FOR contrat_func.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bdf  FOR depend_func.
DEF BUFFER bbf  FOR benefic_func.

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

DEFINE VARIABLE h-acomp    AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont     AS INT    NO-UNDO.
DEFINE VARIABLE cCesBasica AS CHAR   NO-UNDO.
DEFINE VARIABLE cMoeda     AS CHAR   NO-UNDO.
DEFINE VARIABLE c-status   AS CHAR   NO-UNDO.
DEFINE VARIABLE DtIniBen   AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - REGISTROS DE BENEFÖCIOS").

ASSIGN i-cont  = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '27 - Registro_Benef¡cio.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"                                                      Cdelimiter2 //"Operadores permitidos: Delimit, Clear e Delete"        "[OPERATOR]"                                                    
            Cdelimiter1 "id"                                                              Cdelimiter2 //"ID"                                                    "id"                                                            
            Cdelimiter1 "effectiveStartDate"                                              Cdelimiter2 //"Efetivo a partir de"                                   "effectiveStartDate"                                            
            Cdelimiter1 "benefit.benefitId"                                               Cdelimiter2 //"Benef¡cio.ID do benef¡cio"                             "benefit.benefitId"                                             
            Cdelimiter1 "benefitProgram.programId"                                        Cdelimiter2 //"Programa de benef¡cios.ID do programa"                 "benefitProgram.programId"                                      
            Cdelimiter1 "workerId"                                                        Cdelimiter2 //"ID do funcion rio"                                     "workerId"                                                      
            Cdelimiter1 "amount"                                                          Cdelimiter2 //"Valor do registro"                                     "amount"                                                        
            Cdelimiter1 "currency.code"                                                   Cdelimiter2 //"Moeda corrente.C¢digo da moeda"                        "currency.code"                                                 
            Cdelimiter1 "benefitPaymentOption.payComponent.externalCode"                  Cdelimiter2 //"payComponent.externalCode"                             "benefitPaymentOption.payComponent.externalCode"                
            Cdelimiter1 "benefitEntitlementAmount"                                        Cdelimiter2 //"Valor de direito ao benef¡cio"                         "benefitEntitlementAmount"                                      
            Cdelimiter1 "schedulePeriod.id"                                               Cdelimiter2 //"Per¡odo de programa‡Æo do benef¡cio.ID do per¡odo"     "schedulePeriod.id"                                             
            Cdelimiter1 "attachment"                                                      Cdelimiter2 //"Anexo"                                                 "attachment"                                                    
            Cdelimiter1 "previousEnrollmentId"                                            Cdelimiter2 //"ID do registro anterior"                               "previousEnrollmentId"                                          
            Cdelimiter1 "exception.exceptionId"                                           Cdelimiter2 //"Exce‡Æo de benef¡cios.ID da exce‡Æo"                   "exception.exceptionId"                                         
            Cdelimiter1 "compensationAdjustmentUntil"                                     Cdelimiter2 //"Ajuste de compensa‡Æo necess rio at‚"                  "compensationAdjustmentUntil"                                   
            Cdelimiter1 "eligibleWalletWithDataSource"                                    Cdelimiter2 //"Carteiras dispon¡veis"                                 "eligibleWalletWithDataSource"                                  
            Cdelimiter1 "eligibleWallet.benefitId"                                        Cdelimiter2 //"Benef¡cio.ID do benef¡cio"                             "eligibleWallet.benefitId"                                      
            Cdelimiter1 "eligibleWalletCredits"                                           Cdelimiter2 //"Cr‚ditos dispon¡veis na carteira"                      "eligibleWalletCredits"                                         
            Cdelimiter1 "eligibleWalletAmount"                                            Cdelimiter2 //"Valor dispon¡vel na carteira"                          "eligibleWalletAmount"                                          
            Cdelimiter1 "creditPointsFromWallet"                                          Cdelimiter2 //"Cr‚ditos consumidos da carteira"                       "creditPointsFromWallet"                                        
            Cdelimiter1 "amountFromWallet"                                                Cdelimiter2 //"Valor consumido da carteira"                           "amountFromWallet"                                              
            Cdelimiter1 "walletConsumedTill"                                              Cdelimiter2 //"Carteira consumida at‚"                                "walletConsumedTill"                                            
            Cdelimiter1 "enrollmentDate"                                                  Cdelimiter2 //"Data da solicita‡Æo"                                   "enrollmentDate"                                                
            Cdelimiter1 "externalName"                                                    Cdelimiter2 //"Nome"                                                  "enrollmentDate"                                                
            Cdelimiter1 "retirementDate"                                                  Cdelimiter2 //"Data da aposentadoria"                                 "retirementDate"                                                
            Cdelimiter1 "benefitDataSourceWithExternalCode"                               Cdelimiter2 //"Benef¡cio"                                             "benefitDataSourceWithExternalCode"                             
            Cdelimiter1 "isOptOutEvent"                                                   Cdelimiter2 //"isOptOutEvent(Valid Values : TRUE/FALSE)"              "isOptOutEvent"                                                 
            Cdelimiter1 "benefitSavingsPlanEmployerContribution.employerContributionId"   Cdelimiter2 //"Contribui‡Æo do empregador para o plano de poupan‡a"   "benefitSavingsPlanEmployerContribution.employerContributionId" 
            Cdelimiter1 "cust_Mobilidade.externalCode"                                    Cdelimiter2 //"Valor da lista de op‡äes.C¢digo externo"               "cust_Mobilidade.externalCode"                                  
            Cdelimiter1 "cust_tipoEndereco.externalCode"                                  Cdelimiter2 //"Valor da lista de op‡äes.C¢digo externo"               "cust_tipoEndereco.externalCode"                                
            Cdelimiter1 "cust_tipoCesta.externalCode"                                     Cdelimiter2 //"Valor da lista de op‡äes.C¢digo externo"               "cust_tipoCesta.externalCode"                                   
            Cdelimiter1 "cust_idTotvs"                                                    Cdelimiter2 //"Id Totvs"                                              "cust_idTotvs"                                  
            Cdelimiter1 "effectiveStatus"                                                 Cdelimiter1 //"Status(Valid Values : A/I A for Ativo I for Inativo)"  "effectiveStatus"                                  
            SKIP. 

        PUT UNFORMATTED
            Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete"         Cdelimiter2 //"Operadores permitidos: Delimit, Clear e Delete"         "[OPERATOR]"                                                    
            Cdelimiter1 "ID*"                                                    Cdelimiter2 //"ID"                                                     "id"                                                            
            Cdelimiter1 "Efetivo a partir de*"                                   Cdelimiter2 //"Efetivo a partir de"                                    "effectiveStartDate"                                            
            Cdelimiter1 "Benef¡cio.ID do benef¡cio*"                             Cdelimiter2 //"Benef¡cio.ID do benef¡cio"                              "benefit.benefitId"                                             
            Cdelimiter1 "Programa de Benef¡cios.ID do programa*"                 Cdelimiter2 //"Programa de benef¡cios.ID do programa"                  "benefitProgram.programId"                                      
            Cdelimiter1 "ID do Funcion rio*"                                     Cdelimiter2 //"ID do funcion rio"                                      "workerId"                                                      
            Cdelimiter1 "Valor do Registro"                                      Cdelimiter2 //"Valor do registro"                                      "amount"                                                        
            Cdelimiter1 "C¢digo da Moeda*"                                       Cdelimiter2 //"Moeda corrente.C¢digo da moeda"                         "currency.code"                                                 
            Cdelimiter1 "payComponent.externalCode"                              Cdelimiter2 //"payComponent.externalCode"                              "benefitPaymentOption.payComponent.externalCode"                
            Cdelimiter1 "Valor de direito ao benef¡cio"                          Cdelimiter2 //"Valor de direito ao benef¡cio"                          "benefitEntitlementAmount"                                      
            Cdelimiter1 "Per¡odo de programa‡Æo do benef¡cio.ID do per¡odo*"     Cdelimiter2 //"Per¡odo de programa‡Æo do benef¡cio.ID do per¡odo"      "schedulePeriod.id"                                             
            Cdelimiter1 "Anexo"                                                  Cdelimiter2 //"Anexo"                                                  "attachment"                                                    
            Cdelimiter1 "ID do registro anterior"                                Cdelimiter2 //"ID do registro anterior"                                "previousEnrollmentId"                                          
            Cdelimiter1 "Exce‡Æo de benef¡cios.ID da exce‡Æo"                    Cdelimiter2 //"Exce‡Æo de benef¡cios.ID da exce‡Æo"                    "exception.exceptionId"                                         
            Cdelimiter1 "Ajuste de compensa‡Æo necess rio at‚"                   Cdelimiter2 //"Ajuste de compensa‡Æo necess rio at‚"                   "compensationAdjustmentUntil"                                   
            Cdelimiter1 "Carteiras dispon¡veis"                                  Cdelimiter2 //"Carteiras dispon¡veis"                                  "eligibleWalletWithDataSource"                                  
            Cdelimiter1 "Benef¡cio.ID do benef¡cio"                              Cdelimiter2 //"Benef¡cio.ID do benef¡cio"                              "eligibleWallet.benefitId"                                      
            Cdelimiter1 "Cr‚ditos dispon¡veis na carteira"                       Cdelimiter2 //"Cr‚ditos dispon¡veis na carteira"                       "eligibleWalletCredits"                                         
            Cdelimiter1 "Valor dispon¡vel na carteira"                           Cdelimiter2 //"Valor dispon¡vel na carteira"                           "eligibleWalletAmount"                                          
            Cdelimiter1 "Cr‚ditos consumidos da carteira"                        Cdelimiter2 //"Cr‚ditos consumidos da carteira"                        "creditPointsFromWallet"                                        
            Cdelimiter1 "Valor consumido da carteira"                            Cdelimiter2 //"Valor consumido da carteira"                            "amountFromWallet"                                              
            Cdelimiter1 "Carteira consumida at‚"                                 Cdelimiter2 //"Carteira consumida at‚"                                 "walletConsumedTill"                                            
            Cdelimiter1 "Data da Solicita‡Æo*"                                   Cdelimiter2 //"Data da solicita‡Æo"                                    "enrollmentDate"                                                
            Cdelimiter1 "Nome"                                                   Cdelimiter2 //"Nome"                                                   "enrollmentDate"                                                
            Cdelimiter1 "Data da Aposentadoria"                                  Cdelimiter2 //"Data da aposentadoria"                                  "retirementDate"                                                
            Cdelimiter1 "Benef¡cio*"                                             Cdelimiter2 //"Benef¡cio"                                              "benefitDataSourceWithExternalCode"                             
            Cdelimiter1 "isOptOutEvent(Valid Values : TRUE/FALSE)"               Cdelimiter2 //"isOptOutEvent(Valid Values : TRUE/FALSE)"               "isOptOutEvent"                                                 
            Cdelimiter1 "Contribui‡Æo do empregador para o plano de poupan‡a"    Cdelimiter2 //"Contribui‡Æo do empregador para o plano de poupan‡a"    "benefitSavingsPlanEmployerContribution.employerContributionId" 
            Cdelimiter1 "Tipo de aplicativo mobilidade"                          Cdelimiter2 //"Tipo de aplicativo mobilidade"                          "cust_Mobilidade.externalCode"                                  
            Cdelimiter1 "Tipo de endere‡o cesta basica"                          Cdelimiter2 //"Tipo de endere‡o cesta basica"                          "cust_tipoEndereco.externalCode"                                
            Cdelimiter1 "Tipo de cesta basica"                                   Cdelimiter2 //"Tipo de cesta basica"                                   "cust_tipoCesta.externalCode"                                   
            Cdelimiter1 "Id Totvs"                                               Cdelimiter2 //"Id Totvs"                                               "cust_idTotvs"                                  
            Cdelimiter1 "Status(Valid Values: A/I A=Ativo I=Inativo)*"           Cdelimiter1 //"Status(Valid Values: A/I A=Ativo I=Inativo)"            "effectiveStatus"                                  
            SKIP. 
        
        FOR EACH bben NO-LOCK, /* Lista cadastro de Beneficios */
            EACH bbf OF bben WHERE bbf.cdn_depend_func <> 999 NO-LOCK, /* Lista Funcionarios com Beneficios - Desconsidera 999(Dependentes)*/
            EACH btab OF bbf NO-LOCK 
            WHERE btab.dat_desligto_func = ? /* Lista Funcionarios para desconsiderar desligados */
              AND btab.cdn_empresa       >= p-emp-ini
              AND btab.cdn_empresa       <= p-emp-fim 
              AND btab.cdn_estab         >= p-estab-ini
              AND btab.cdn_estab         <= p-estab-fim
              AND btab.cdn_funcionario   >= p-matricula-ini
              AND btab.cdn_funcionario   <= p-matricula-fim
              AND btab.dat_admis_func    >= p-dt-admissao
            BREAK BY bbf.cdn_funcionario BY bbf.cdn_benefic.
            
            ASSIGN i-cont = i-cont + 1.
            RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).
        
            /* Grava "home" para Cesta Basica */
            ASSIGN cCesBasica = ''.
            IF bben.cdn_benefic = 12 THEN DO:
               FIND FIRST bpf of btab NO-LOCK NO-ERROR.
               IF AVAIL bpf THEN
                  ASSIGN cCesBasica = "Home".
               ELSE
                  ASSIGN cCesBasica = "".
            END.

            /* Grava % para Assis. Medica e BRL para os demais*/
            ASSIGN cMoeda = ''.
            IF bben.cdn_grp_benefic = 2 THEN DO:

               IF (bben.cdn_benefic = 2  OR bben.cdn_benefic = 3  OR
                   bben.cdn_benefic = 4  OR bben.cdn_benefic = 5  OR
                   bben.cdn_benefic = 6  OR bben.cdn_benefic = 9  OR
                   bben.cdn_benefic = 10 OR bben.cdn_benefic = 14 OR
                   bben.cdn_benefic = 21 OR bben.cdn_benefic = 22 OR
                   bben.cdn_benefic = 23 OR bben.cdn_benefic = 25 OR
                   bben.cdn_benefic = 26 OR bben.cdn_benefic = 28 OR
                   bben.cdn_benefic = 34 OR bben.cdn_benefic = 35 OR
                   bben.cdn_benefic = 36 OR bben.cdn_benefic = 37 OR
                   bben.cdn_benefic = 38 OR bben.cdn_benefic = 39 OR
                   bben.cdn_benefic = 43 OR bben.cdn_benefic = 46 OR 
                   bben.cdn_benefic = 47 OR bben.cdn_benefic = 48) THEN DO:

                   ASSIGN cMoeda = "%".
               END.
               ELSE DO:
                   ASSIGN cMoeda = "BRL".
               END.
            END.
            ELSE DO:
               ASSIGN cMoeda = "BRL".
            END.

            /* Trata Status do Benef¡cio */
            IF bbf.idi_sit_benefic = 1 THEN ASSIGN c-status = "A". ELSE "I".

            /***** Data Inicio Benef¡cio | Data Solicita‡Æo *****/
            ASSIGN DtIniBen = STRING(MONTH(bbf.dat_inic_benefic),'99') + "/" + STRING(DAY(bbf.dat_inic_benefic),'99') + "/" + STRING(YEAR(bbf.dat_inic_benefic),'9999').
            
            PUT UNFORMATTED
    /*A  */     Cdelimiter1 "Delimit"                                                                                              Cdelimiter2 //"Operadores permitidos: Delimit, Clear e Delete"                                                   
    /*B  */     Cdelimiter1 STRING(bbf.cdn_funcionario) + STRING(bbf.cdn_benefic)                                                  Cdelimiter2 //"ID"                                                                                               
    /*C  */     Cdelimiter1 DtIniBen /*bbf.dat_inic_benefic*/                                                                      Cdelimiter2 //"Efetivo a partir de"                                                                              
    /*D  */     Cdelimiter1 bbf.cdn_benefic /*bben.des_abrev_benefic*/                                                             Cdelimiter2 //"Benef¡cio.ID do benef¡cio"                         
    /*E  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Programa de benef¡cios.ID do programa"                                                            
    /*F  */     Cdelimiter1 STRING(bbf.cdn_empresa) + '-' + STRING(bbf.cdn_estab) + '-' + STRING(bbf.cdn_funcionario, '99999999')  Cdelimiter2 //"ID do funcion rio"                                                                                
    /*G  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Valor do registro"                                                                                
    /*H  */     Cdelimiter1 cMoeda                                                                                                 Cdelimiter2 //"Moeda corrente.C¢digo da moeda"                                                                   
    /*I  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"payComponent.externalCode"                                                                        
    /*J  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Valor de direito ao benef¡cio"                                                                    
    /*K  */     Cdelimiter1 "1000"                                                                                                 Cdelimiter2 //"Per¡odo de programa‡Æo do benef¡cio.ID do per¡odo"                                                
    /*L  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Anexo"                                                                                            
    /*M  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"ID do registro anterior"                                                                          
    /*N  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Exce‡Æo de benef¡cios.ID da exce‡Æo"                                                              
    /*O  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Ajuste de compensa‡Æo necess rio at‚"                                                             
    /*P  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Carteiras dispon¡veis"                                                                            
    /*Q  */     Cdelimiter1 bbf.cdn_benefic                                                                                        Cdelimiter2 //"Benef¡cio.ID do benef¡cio"                                                                        
    /*R  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Cr‚ditos dispon¡veis na carteira"                                                                 
    /*S  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Valor dispon¡vel na carteira"                                                                     
    /*T  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Cr‚ditos consumidos da carteira"                                                                  
    /*U  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Valor consumido da carteira"                                                                      
    /*V  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Carteira consumida at‚"                                                                           
    /*W  */     Cdelimiter1 DtIniBen /*bbf.dat_inic_benefic*/                                                                      Cdelimiter2 //"Data da solicita‡Æo"                                                                              
    /*X  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Nome"                                                                                                             
    /*X  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Data da aposentadoria"                                                                           
    /*Y  */     Cdelimiter1 bbf.cdn_benefic /*bben.des_abrev_benefic*/                                                             Cdelimiter2 //"Benef¡cio"                                           
    /*Z  */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"isOptOutEvent(Valid Values : TRUE/FALSE)"            
    /*AA */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Contribui‡Æo do empregador para o plano de poupan‡a" 
    /*AB */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Tipo de aplicativo mobilidade"                                                        
    /*AC */     Cdelimiter1 "home"                                                                                                 Cdelimiter2 //"Tipo de endere‡o cesta basica"                                                        
    /*AD */     Cdelimiter1 ""                                                                                                     Cdelimiter2 //"Tipo de cesta basica"                                                                 
    /*AJ */     Cdelimiter1 bbf.cdn_benefic                                                                                        Cdelimiter2 //"Id Totvs"                                                                           
                Cdelimiter1 c-status                                                                                               Cdelimiter1 //"Status(Valid Values: A/I A=Ativo I=Inativo)"                                  
                SKIP.                                                                                                                    
                           
        END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.
