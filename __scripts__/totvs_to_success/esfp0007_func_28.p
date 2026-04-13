Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* RegistroBenef¡cio-DetalhesDeducao                                            */
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
DEFINE VARIABLE DtIniBen AS CHAR   NO-UNDO.

DEF TEMP-TABLE tt-ben
    FIELD cdn_beneficio LIKE bbf.cdn_beneficio.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - BENEFÖCIOS DEDU€ÇO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '28 - RegistroBenef¡cio-DetalhesDeducao.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"                                                                          Cdelimiter2 //"Operadores permitidos: Delimit Clear e Delete"
        Cdelimiter1 "id"                                                                                  Cdelimiter2 //"Registro de benef­cio.ID"                     
        Cdelimiter1 "effectiveStartDate"                                                                  Cdelimiter2 //"Registro de benef­cio.Efetivo a partir de"    
        Cdelimiter1 "benefitDeductibleAllowanceEnrollment.id"                                             Cdelimiter2 //"id"                                           
        Cdelimiter1 "benefitDeductibleAllowanceEnrollment.employeeContribution"                           Cdelimiter2 //"Contribui»’o do colaborador"                  
        Cdelimiter1 "benefitDeductibleAllowanceEnrollment.employerContribution"                           Cdelimiter2 //"Contribui»’o do empregador"                   
        Cdelimiter1 "benefitDeductibleAllowanceEnrollment.employeeContributionPayComponent.externalCode"  Cdelimiter2 //"payComponent.externalCode"                    
        Cdelimiter1 "benefitDeductibleAllowanceEnrollment.employerContributionPayComponent.externalCode"  Cdelimiter1 //"payComponent.externalCode"                    
        SKIP.  

    PUT UNFORMATTED
        Cdelimiter1 "Operadores permitidos: Delimit, Clear e Delete" Cdelimiter2 //"Operadores permitidos: Delimit Clear e Delete"
        Cdelimiter1 "Registro de Benef¡cio.ID*"                      Cdelimiter2 //"Registro de benef­cio.ID"                     
        Cdelimiter1 "Efetivo a Partir de*"                           Cdelimiter2 //"Registro de benef­cio.Efetivo a partir de"    
        Cdelimiter1 "ID*"                                            Cdelimiter2 //"id"                                           
        Cdelimiter1 "Contribui‡Æo do Colaborador"                    Cdelimiter2 //"Contribui»’o do colaborador"                  
        Cdelimiter1 "Contribui‡Æo do Empregador"                     Cdelimiter2 //"Contribui»’o do empregador"                   
        Cdelimiter1 "payComponent.externalCode"                      Cdelimiter2 //"payComponent.externalCode"                    
        Cdelimiter1 "payComponent.externalCodee"                     Cdelimiter1 //"payComponent.externalCode"                    
        SKIP.

    FOR EACH tt-ben. DELETE tt-ben. END.
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 1.   //Vale Transporte
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 8.   //Refei‡Æo SÆo Paulo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 12.  //Cesta B sica
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 13.  //Cesta B sica Itaqui
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 18.  //Vale Alimentacao
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 19.  //Vale Alimen - Rio Gr - Inativo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 20.  //Vale Aliment.Camaqua - Inativo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 24.  //Refei‡Æo Rio Grande
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 27.  //Cesta B sica -Itap - Inativo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 29.  //Refei‡Æo SÆo Gonzalo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 31.  //Vale Alimentacao-Recife
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 33.  //Ticket Refeicao - Brasilia
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 40.  //Refeitorio
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 42.  //Lanche CamaquÆ
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 44.  //Lanche Rio Grande
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 45.  //Refei‡Æo Navegantes
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 49.  //Vale Refeicao Ciclo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 50.  //Vale Alimentacao Ciclo
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 52.  //Vale Refeicao - 20,23
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 53.  //Vale Refeicao - 22,18
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 54.  //Vale Refeicao - 22,50
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 55.  //Vale Refeicao - 23,21
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 56.  //Vale Refeicao - 31,25
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 58.  //Vale Alimentacao
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 122. //Refei‡Æo Tocantins
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 123. //Vale Alimentacao CamaquÆ
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 124. //Refeitorio -29-32-38
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 360. //Refeitorio - A‡ucar
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 361. //Onibus Fretado
    CREATE tt-ben. ASSIGN tt-ben.cdn_beneficio = 365. //Vale Alimentacao

    FOR EACH bbf NO-LOCK, /* Lista Funcionarios com Beneficios */
        EACH btab OF bbf NO-LOCK 
        WHERE btab.dat_desligto_func = ? /* Lista Funcionarios para desconsiderar desligados */
          AND btab.cdn_empresa       >= p-emp-ini
          AND btab.cdn_empresa       <= p-emp-fim 
          AND btab.cdn_estab         >= p-estab-ini
          AND btab.cdn_estab         <= p-estab-fim
          AND btab.cdn_funcionario   >= p-matricula-ini
          AND btab.cdn_funcionario   <= p-matricula-fim
          AND btab.dat_admis_func    >= p-dt-admissao,
        FIRST tt-ben WHERE tt-ben.cdn_beneficio = bbf.cdn_beneficio /* tt para informar VA, VT, VR e Cesta Basica */
        BREAK BY bbf.cdn_funcionario BY bbf.cdn_benefic.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /* Coluna E = VT, VA e VR = 1 | Cesta Basica = 0 */
        ASSIGN iColunaE = 1.
        IF (bbf.cdn_beneficio = 12 OR 
            bbf.cdn_beneficio = 13 OR
            bbf.cdn_beneficio = 27 ) THEN DO:
            ASSIGN iColunaE = 0.
        END.

        /***** Data Inicio Benef¡cio *****/
        ASSIGN DtIniBen = STRING(MONTH(bbf.dat_inic_benefic),'99') + "/" + STRING(DAY(bbf.dat_inic_benefic),'99') + "/" + STRING(YEAR(bbf.dat_inic_benefic),'9999').
        
        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"                                       Cdelimiter2 //"Operadores permitidos: Delimit Clear e Delete"
            Cdelimiter1 STRING(bbf.cdn_funcion) + STRING(bbf.cdn_benefic)  Cdelimiter2 //"Registro de benef­cio.ID"                     
            Cdelimiter1 DtIniBen /*bbf.dat_inic_benefic*/                  Cdelimiter2 //"Registro de benef­cio.Efetivo a partir de"    
            Cdelimiter1 bbf.cdn_beneficio                                  Cdelimiter2 //"id"                                           
            Cdelimiter1 iColunaE                                           Cdelimiter2 //"Contribui»’o do colaborador"                  
            Cdelimiter1 "0"                                                Cdelimiter2 //"Contribui»’o do empregador"                   
            Cdelimiter1 "BN_001"                                           Cdelimiter2 //"payComponent.externalCode"                    
            Cdelimiter1 "BN_001"                                           Cdelimiter1 //"payComponent.externalCode" 
            SKIP.

    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.

