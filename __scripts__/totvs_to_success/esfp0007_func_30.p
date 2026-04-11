Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* DetalhesPlanoSeguro-RegistroDependente                                       */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
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

DEFINE VARIABLE h-acomp    AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont     AS INT    NO-UNDO.
DEFINE VARIABLE c-grau-dep AS CHAR   NO-UNDO. 
DEFINE VARIABLE c-coluna-e AS CHAR   NO-UNDO.
DEFINE VARIABLE c-status   AS CHAR   NO-UNDO.
DEFINE VARIABLE DtIniBen   AS CHAR   NO-UNDO.
DEFINE VARIABLE DtNasc     AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - BENEFÖCIOS PLANO SEGURO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '30 - DetalhesPlanoSeguro-RegistroDependente.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"                                                                                           Cdelimiter2 //"Operadores permitidos: Delimit, Clear e Delete"                                                                           
        Cdelimiter1 "id"                                                                                                   Cdelimiter2 //"Registro de Benef¡cio.ID"                                                                                                 
        Cdelimiter1 "effectiveStartDate"                                                                                   Cdelimiter2 //"Registro de Benef¡cio.Efetivo a partir de"                                                                                
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.externalCode"                                                   Cdelimiter2 //"Detalhes do registro do plano de seguro.externalCode"                                                                     
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.dependentName"                 Cdelimiter2 //"Nome do Dependente"                                                                                                       
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.dateOfBirth"                   Cdelimiter2 //"Data de Nascimento"                                                                                                       
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.relationShipType.externalCode" Cdelimiter2 //"Valor da lista de op‡äes.C¢digo externo"                                                                                  
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.smoking"                       Cdelimiter2 //"Smoking"                                                                                  
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.gender"                        Cdelimiter2 //"Sexo(Valid Values : F/M/U/D/O F=Feminino  M=Masculino  U=Desconhecido  D=NÆo Declarado  O=Outros)"
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.cust_codDependente"            Cdelimiter2 //"C¢digo Dependente"                                                                                                                    
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.cust_idade"                    Cdelimiter2 //"Idade"                                                                                                                    
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.cust_percentual"               Cdelimiter2 //"Percentual do seguro"                                                                                                     
        Cdelimiter1 "benefitInsurancePlanEnrollmentDetails.benefitInsuranceDependentDetails.mdfSystemStatus"               Cdelimiter1 //"Status(Valid Values: A/I A=Ativo  I=Inativo)"                                                                                                     
        SKIP. 

    PUT UNFORMATTED
        Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete"                                                     Cdelimiter2 //"Operadores permitidos: Delimit, Clear e Delete"                                                                           
        Cdelimiter1 "Registro de Benef¡cio.ID"                                                                           Cdelimiter2 //"Registro de Benef¡cio.ID"                                                                                                 
        Cdelimiter1 "Registro de Benef¡cio.Efetivo a partir de*"                                                         Cdelimiter2 //"Registro de Benef¡cio.Efetivo a partir de"                                                                                
        Cdelimiter1 "Detalhes do registro do plano de seguro.externalCode*"                                              Cdelimiter2 //"Detalhes do registro do plano de seguro.externalCode"                                                                     
        Cdelimiter1 "Matricula + C¢d do Dependente*"                                                                     Cdelimiter2 //"Nome do Dependente"                                                                                                       
        Cdelimiter1 "Data de Nascimento*"                                                                                Cdelimiter2 //"Data de Nascimento"                                                                                                       
        Cdelimiter1 "Valor da lista de op‡äes.C¢digo externo*"                                                           Cdelimiter2 //"Valor da lista de op‡äes.C¢digo externo"                                                                                  
        Cdelimiter1 "Smoking"                                                                                            Cdelimiter2 //"Smoking"                                                                                  
        Cdelimiter1 "Sexo(Valid Values : F/M/U/D/O F=Feminino  M=Masculino  U=Desconhecido  D=NÆo Declarado  O=Outros)*" Cdelimiter2 //"Sexo(Valid Values : F/M/U/D/O F=Feminino  M=Masculino  U=Desconhecido  D=NÆo Declarado  O=Outros)"
        Cdelimiter1 "C¢digo Dependente*"                                                                                 Cdelimiter2 //"C¢digo Dependente"                                                                                                                    
        Cdelimiter1 "Idade*"                                                                                             Cdelimiter2 //"Idade"                                                                                                                    
        Cdelimiter1 "Percentual do Seguro"                                                                               Cdelimiter2 //"Percentual do Seguro"                                                                                                     
        Cdelimiter1 "Status(Valid Values: A/I A=Ativo  I=Inativo)*"                                                      Cdelimiter1 //"Status(Valid Values: A/I A=Ativo  I=Inativo)"                                                                                                     
        SKIP. 
  
   FOR EACH bben NO-LOCK
       WHERE bben.cdn_grp_benefic = 2, /* Grupo 2 = Assintencia Medica */    
       EACH bbf OF bben 
       WHERE bbf.cdn_depend_func > 0 
         AND bbf.cdn_depend_func < 999 NO-LOCK /* Lista Benef¡cios do Funcion rio */,
       EACH btab OF bbf NO-LOCK
        WHERE btab.dat_desligto_func = ? /* Lista Funcionarios para desconsiderar desligados */
          AND btab.cdn_empresa     >= p-emp-ini
          AND btab.cdn_empresa     <= p-emp-fim 
          AND btab.cdn_estab       >= p-estab-ini
          AND btab.cdn_estab       <= p-estab-fim
          AND btab.cdn_funcionario >= p-matricula-ini
          AND btab.cdn_funcionario <= p-matricula-fim
          AND btab.dat_admis_func  >= p-dt-admissao
       BREAK BY bbf.cdn_funcionario BY bbf.cdn_benefic.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).
          
        /* Grava Informa‡äes de Dependente <> 0 e 999 */
        
        ASSIGN c-grau-dep = ''.
        FIND FIRST bdf
             WHERE bdf.cdn_empresa     = bbf.cdn_empresa
               AND bdf.cdn_estab       = bbf.cdn_estab
               AND bdf.cdn_funcionario = bbf.cdn_funcionario
               AND bdf.cdn_depend_func = bbf.cdn_depend_func NO-LOCK NO-ERROR.

        ASSIGN c-grau-dep = {DATABASE/inpy/i02py047.i 04 bdf.idi_grau_depen_func}
               c-coluna-e = STRING(bbf.cdn_depend_func).

        IF bbf.idi_sit_benefic = 1 THEN ASSIGN c-status = "A". ELSE "I".

        /***** Data Inicio Benef¡cio | Data Nascimento *****/
        ASSIGN DtIniBen = STRING(MONTH(bbf.dat_inic_benefic),'99') + "/" + STRING(DAY(bbf.dat_inic_benefic),'99') + "/" + STRING(YEAR(bbf.dat_inic_benefic),'9999')
               DtNasc   = STRING(MONTH(bdf.dat_nascimento),'99') + "/" + STRING(DAY(bdf.dat_nascimento),'99') + "/" + STRING(YEAR(bdf.dat_nascimento),'9999').

        PUT UNFORMATTED
            Cdelimiter1 "Delimit"                                                 Cdelimiter2 //"Operadores permitidos: Delimit, Clear e Delete"                                                                           
            Cdelimiter1 STRING(bbf.cdn_funcionario) + STRING(bbf.cdn_beneficio)   Cdelimiter2 //"Registro de benef¡cio.ID"                                                                                                 
            Cdelimiter1 DtIniBen /*bbf.dat_inic_benefic */                        Cdelimiter2 //"Registro de benef¡cio.Efetivo a partir de"                                                                                
            Cdelimiter1 bbf.cdn_beneficio                                         Cdelimiter2 //"Detalhes do registro do plano de seguro.externalCode"                                                                     
            Cdelimiter1 STRING(bbf.cdn_funcionario) + STRING(bbf.cdn_depend_func) Cdelimiter2 //"Nome do dependente -> Matricula + Codigo Dependente"                                                                                                       
            Cdelimiter1 DtNasc /*STRING(bdf.dat_nascimento, '99/99/9999')*/       Cdelimiter2 //"Data de nascimento"                                                                                                       
            Cdelimiter1 c-grau-dep                                                Cdelimiter2 //"Valor da lista de op‡äes.C¢digo externo"                                                                                  
            Cdelimiter1 ""                                                        Cdelimiter2 //"Smoking"                                                                                  
            Cdelimiter1 IF bdf.idi_sexo = 1 THEN "M" ELSE "F"                     Cdelimiter2 //"Sexo(Valid Values : F/M/U/D/O F=Feminino  M=Masculino  U=Desconhecido  D=NÆo Declarado  O=Outros)"
            Cdelimiter1 SUBSTRING(c-coluna-e, 1,2)                                Cdelimiter2 //"C¢digo Dependente com duas posi‡äes"                                                                                  
            Cdelimiter1 STRING(TRUNCATE((TODAY - bdf.dat_nascimento) / 365, 0))   Cdelimiter2 //"Idade"                                                                                                                    
            Cdelimiter1 ""                                                        Cdelimiter2 //"Percentual do seguro"    
            Cdelimiter1 c-status                                                  Cdelimiter1 //"Status(Valid Values: A/I A=Ativo  I=Inativo)"     
            SKIP.
        
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.

/*
30 - DUVIDAS
Coluna B = informar o mesmo ID do Layout 27 
Coluna D - mesmo valor inserido no layout 28
Coluna E = informar o c¢digo do dependente
Coluna F = informar o data de nascimento do dependente
Coluna G = informar o grau do dependente
Coluna I = informar o c¢digo do dependente
Coluna K = fixo branco
*/


