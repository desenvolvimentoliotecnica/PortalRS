Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* RegistroBenef¡cio-DetalhesPlanoSeguro                                        */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bcf  FOR contrat_func.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bdf  FOR depend_func.
DEF BUFFER bbf  FOR benefic_func.
DEF BUFFER bben FOR beneficio.

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
DEFINE VARIABLE iColunaE AS INT    NO-UNDO.
DEFINE VARIABLE i-cont-p AS INT    NO-UNDO. /*conta plano              */
DEFINE VARIABLE i-cont-d AS INT    NO-UNDO. /*conta dependente         */
DEFINE VARIABLE i-cont-c AS INT    NO-UNDO. /*conta colaborador        */
DEFINE VARIABLE c-depend AS CHAR   NO-UNDO. /*grava contador dependente*/
DEFINE VARIABLE DtIniBen AS CHAR   NO-UNDO. /*data inicio benef¡cio    */

DEF TEMP-TABLE tt-func
    FIELD cdn_empresa      LIKE bbf.cdn_empresa
    FIELD cdn_estab        LIKE bbf.cdn_estab
    FIELD cdn_funcionario  LIKE bbf.cdn_funcionario
    FIELD cdn_beneficio    LIKE bbf.cdn_beneficio
    FIELD dat_inic_benefic AS CHAR
    FIELD cont-depend      AS INT
    FIELD c-status         AS CHAR.
                           
DEF TEMP-TABLE tt-ben
    FIELD cdn_beneficio LIKE bbf.cdn_beneficio.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - BENEFÖCIOS PLANO DE SEGURO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '29 - RegistroBenef¡cio-DetalhesPlanoSeguro.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"                                                               Cdelimiter2 //"[OPERATOR]"                                                              "Operadores permitidos: Delimit Clear e Delete"           
        Cdelimiter1 "id"                                                                       Cdelimiter2 //"id"                                                                      "Registro de benef­cio.ID"                                
        Cdelimiter1 "effectiveStartDate"                                                       Cdelimiter2 //"effectiveStartDate"                                                      "Registro de benef­cio.Efetivo a partir de"               
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.externalCode"                       Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.externalCode"                      "externalCode"                                            
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.plan.id"                            Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.plan.id"                           "Plano de seguro.ID do Plano"                             
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.provider.providerId"                Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.provider.providerId"               "Seguradora.ID do provedor"                               
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.enrolleeOptions.id"                 Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.enrolleeOptions.id"                "Op»„es para inscritos eleg­veis.ID de op»„es de inscrito"
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.coverage.coverageId"                Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.coverage.coverageId"               "Cobertura do seguro.ID da cobertura"                     
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.employeeContribution"               Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employeeContribution"              "Contribui»’o do colaborador"                             
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.employerContribution"               Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employerContribution"              "Contribui»’o do empregador"                              
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.smoking"                            Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.smoking"                           "Smoking"                              
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitSalaryAmount"                Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.benefitSalaryAmount"               "Benefit Salary"                              
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.roundedCoverageAmount"              Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.roundedCoverageAmount"             "Rounded Coverage"                              
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.employeePreTaxContributionAmount"   Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employeePreTaxContributionAmount"  "Contribui»’o do colaborador pr²-imposto"                 
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.employeePostTaxContributionAmount"  Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employeePostTaxContributionAmount" "Contribui»’o do colaborador p½s-imposto"                 
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.imputedIncomeAmount"                Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.imputedIncomeAmount"               "Valor fixo da renda imputada"                            
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.mdfSystemStatus"                    Cdelimiter1 //"benefitInsurancePlanEnrollmentDetails.mdfSystemStatus"                   "Status(Valid Values: A/I A=Ativo I=Inativo)"                            
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Operadores permitidos: Delimit Clear e Delete"             Cdelimiter2 //"[OPERATOR]"                                                              "Operadores permitidos: Delimit Clear e Delete"           
        Cdelimiter1 "ID*"                                                       Cdelimiter2 //"id"                                                                      "Registro de benef­cio.ID"                                
        Cdelimiter1 "Efetivo a Partir de*"                                      Cdelimiter2 //"effectiveStartDate"                                                      "Registro de benef­cio.Efetivo a partir de"               
        Cdelimiter1 "externalCode*"                                             Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.externalCode"                      "externalCode"                                            
        Cdelimiter1 "ID do Plano*"                                              Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.plan.id"                           "Plano de seguro.ID do Plano"                             
        Cdelimiter1 "Seguradora.ID do Provedor*"                                Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.provider.providerId"               "Seguradora.ID do provedor"                               
        Cdelimiter1 "Op‡äes para Inscritos Eleg¡veis.ID de op‡äes de inscrito*" Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.enrolleeOptions.id"                "Op»„es para inscritos eleg­veis.ID de op»„es de inscrito"
        Cdelimiter1 "Cobertura do Seguro.ID da cobertura*"                      Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.coverage.coverageId"               "Cobertura do seguro.ID da cobertura"                     
        Cdelimiter1 "Contribui‡Æo do Colaborador*"                              Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employeeContribution"              "Contribui»’o do colaborador"                             
        Cdelimiter1 "Contribui‡Æo do Empregador*"                               Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employerContribution"              "Contribui»’o do empregador"                              
        Cdelimiter1 "Smoking"                                                   Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.smoking"                           "Smoking"                              
        Cdelimiter1 "Benefit Salary"                                            Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.benefitSalaryAmount"               "Benefit Salary"                              
        Cdelimiter1 "Rounded Coverage"                                          Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.roundedCoverageAmount"             "Rounded Coverage"                     
        Cdelimiter1 "Contribui‡Æo do Colaborador Pr‚-imposto"                   Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employeePreTaxContributionAmount"  "Contribui»’o do colaborador pr²-imposto"                 
        Cdelimiter1 "Contribui‡Æo do Colaborador P¢s-imposto"                   Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.employeePostTaxContributionAmount" "Contribui»’o do colaborador p½s-imposto"                 
        Cdelimiter1 "Valor Fixo da Renda Imputada"                              Cdelimiter2 //"benefitInsurancePlanEnrollmentDetails.imputedIncomeAmount"               "Valor fixo da renda imputada"                            
        Cdelimiter1 "Status(Valid Values: A/I A=Ativo I=Inativo)*"              Cdelimiter1 //"benefitInsurancePlanEnrollmentDetails.mdfSystemStatus"                   "Status(Valid Values: A/I A=Ativo I=Inativo)"                            
        SKIP.
    
    FOR EACH bben NO-LOCK
        WHERE bben.cdn_grp_benefic = 2, /* Grupo 2 = Assintencia Medica */    
        EACH bbf OF bben
        WHERE bbf.cdn_depend_func > 0 
         AND bbf.cdn_depend_func < 999 NO-LOCK, /* Lista Benef¡cios do Funcion rio */
        EACH btab OF bbf NO-LOCK
         WHERE btab.dat_desligto_func = ? /* Lista Funcionarios para desconsiderar desligados */
           AND btab.cdn_empresa     >= p-emp-ini
           AND btab.cdn_empresa     <= p-emp-fim 
           AND btab.cdn_estab       >= p-estab-ini
           AND btab.cdn_estab       <= p-estab-fim
           AND btab.cdn_funcionario >= p-matricula-ini
           AND btab.cdn_funcionario <= p-matricula-fim
           AND btab.dat_admis_func  >= p-dt-admissao
        BREAK BY bbf.cdn_funcionario BY bbf.cdn_depend_func BY bbf.cdn_benefic.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        ASSIGN i-cont-p = 0.
               i-cont-d = 0.

        
                
        ASSIGN c-depend = ''.

        IF bbf.cdn_depend_func <> 999 THEN DO:

           FOR EACH bdf
              WHERE bdf.cdn_empresa     = bbf.cdn_empresa 
                AND bdf.cdn_estab       = bbf.cdn_estab
                AND bdf.cdn_funcionario = bbf.cdn_funcionario
                AND bdf.cdn_depend_func = bbf.cdn_depend_func  NO-LOCK BREAK BY bdf.cdn_funcionario:

                ASSIGN i-cont-c = i-cont-c + 1.

           END.
        END.

        FIND FIRST tt-func
             WHERE tt-func.cdn_empresa     = bbf.cdn_empresa
               AND tt-func.cdn_estab       = bbf.cdn_estab
               AND tt-func.cdn_funcionario = bbf.cdn_funcionario
               AND tt-func.cdn_beneficio   = bbf.cdn_beneficio EXCLUSIVE-LOCK NO-ERROR.
        IF NOT AVAIL tt-func THEN DO:

           CREATE tt-func.
           ASSIGN tt-func.cdn_empresa     = bbf.cdn_empresa    
                  tt-func.cdn_estab       = bbf.cdn_estab      
                  tt-func.cdn_funcionario = bbf.cdn_funcionario
                  tt-func.cdn_beneficio   = bbf.cdn_beneficio.

        END.

        ASSIGN tt-func.cont-depend = tt-func.cont-depend + 1
               tt-func.dat_inic_benefic = STRING(MONTH(bbf.dat_inic_benefic),'99') + "/" + STRING(DAY(bbf.dat_inic_benefic),'99') + "/" + STRING(YEAR(bbf.dat_inic_benefic),'9999').

        IF bbf.idi_sit_benefic = 1 THEN ASSIGN tt-func.c-status = "A". ELSE "I".
       
    END.

    FOR EACH tt-func NO-LOCK:
    
        IF tt-func.cont-depend = 1 THEN DO:
           ASSIGN c-depend = "EE_D".
        END.
        IF tt-func.cont-depend > 1 THEN DO:
           ASSIGN c-depend = "EE_D" + STRING(tt-func.cont-depend).
        END.

        PUT UNFORMATTED
            Cdelimiter1 "Delimit"                                                       Cdelimiter2 //"Operadores permitidos: Delimit Clear e Delete"           
            Cdelimiter1 STRING(tt-func.cdn_funcionario) + STRING(tt-func.cdn_beneficio) Cdelimiter2 //"Registro de benef¡cio.ID"                                
            Cdelimiter1 tt-func.dat_inic_benefic                                        Cdelimiter2 //"Registro de benef¡cio.Efetivo a partir de"               
            Cdelimiter1 "#1"                                                            Cdelimiter2 //"externalCode"                                            
            Cdelimiter1 tt-func.cdn_beneficio                                           Cdelimiter2 //"Plano de seguro.ID do Plano"                             
            Cdelimiter1 ""                                                              Cdelimiter2 //"Seguradora.ID do provedor"                               
            Cdelimiter1 IF tt-func.cont-depend = 0 THEN "EE" ELSE c-depend              Cdelimiter2 //"Op‡äes para inscritos eleg¡veis.ID de op‡äes de inscrito"
            Cdelimiter1 tt-func.cdn_beneficio                                           Cdelimiter2 //"Cobertura do seguro.ID da cobertura"                     
            Cdelimiter1 "0"                                                             Cdelimiter2 //"Contribui‡Æo do colaborador"                             
            Cdelimiter1 "100"                                                           Cdelimiter2 //"Contribui‡Æo do empregador" 
            Cdelimiter1 ""                                                              Cdelimiter2 //"Smoking"                              
            Cdelimiter1 ""                                                              Cdelimiter2 //"Benefit Salary"                              
            Cdelimiter1 ""                                                              Cdelimiter2 //"Rounded Coverage"                     
            Cdelimiter1 ""                                                              Cdelimiter2 //"Contribui‡Æo do colaborador pr‚-imposto"                 
            Cdelimiter1 ""                                                              Cdelimiter2 //"Contribui‡Æo do colaborador p¢s-imposto"                 
            Cdelimiter1 ""			                                                    Cdelimiter2 //"Valor fixo da renda imputada"                            
            Cdelimiter1 tt-func.c-status                                                Cdelimiter1 //"Status(Valid Values: A/I A=Ativo I=Inativo)"                            
            SKIP.
    END.
    
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.



