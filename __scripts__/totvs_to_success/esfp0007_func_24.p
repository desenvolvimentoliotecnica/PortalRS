Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes globais                                                          */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bdf  FOR depend_func.

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

DEFINE VARIABLE h-acomp      AS HANDLE                         NO-UNDO.
DEFINE VARIABLE i-cont       AS INT                            NO-UNDO.
DEFINE VARIABLE WContratacao AS CHAR                           NO-UNDO.
DEFINE VARIABLE DtEntregCert AS CHAR                           NO-UNDO.
DEFINE VARIABLE cSalFamilia  AS CHAR                           NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - DEPENDENTES INFORMAÄÂES GLOBAIS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '24 - Dependentes - Informacoes globais.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "genericNumber9"                Cdelimiter2  //"genericNumber9"                "BRA: Eleg°vel para desconto de IR"                   
            Cdelimiter1 "genericString9"                Cdelimiter2  //"genericString9"                "BRA: Grau de instruá∆o"                              
            Cdelimiter1 "genericString14"               Cdelimiter2  //"genericString14"               "BRA: Nome da M∆e do Dependente"                      
            Cdelimiter1 "genericNumber1"                Cdelimiter2  //"genericNumber1"                "BRA: Raáa"                                           
            Cdelimiter1 "start-date"                    Cdelimiter2  //"start-date"                    "Data do evento"                                      
            Cdelimiter1 "personInfo.person-id-external" Cdelimiter2  //"personInfo.person-id-external" "C¢digo Dependente"                                  
            Cdelimiter1 "country"                       Cdelimiter2  //"country"                       "Pa°s/Regi∆o"                                         
            Cdelimiter1 "genericNumber11"               Cdelimiter2  //"genericNumber11"               "BRA: Aux°lio-educaá∆o"                               
            Cdelimiter1 "genericDate4"                  Cdelimiter2  //"genericDate4"                  "BRA: Data de entrega da certid∆o"                    
            Cdelimiter1 "genericDate2"                  Cdelimiter2  //"genericDate2"                  "BRA: Data de vencimento do cart∆o de vacinaá∆o"      
            Cdelimiter1 "genericDate6"                  Cdelimiter2  //"genericDate6"                  "BRA: Data do Atestado Escolar"                       
            Cdelimiter1 "genericString17"               Cdelimiter2  //"genericString17"               "BRA: Dependente do plano de sa£de"                   
            Cdelimiter1 "custom-string1"                Cdelimiter2  //"custom-string1"                "BRA: Entregou Cart∆o de Vacina?"                     
            Cdelimiter1 "genericString13"               Cdelimiter2  //"genericString13"               "BRA: Escola"                                         
            Cdelimiter1 "genericNumber12"               Cdelimiter2  //"genericNumber12"               "BRA: Estudante"                                      
            Cdelimiter1 "custom-string7"                Cdelimiter2  //"custom-string7"                "BRA: Incluir no eSocial"                             
            Cdelimiter1 "genericString7"                Cdelimiter2  //"genericString7"                "BRA: Nome do tabeli∆o p£blico"                       
            Cdelimiter1 "genericString6"                Cdelimiter2  //"genericString6"                "BRA: N£mero da Declaraá∆o de Nascido Vivo"           
            Cdelimiter1 "genericNumber7"                Cdelimiter2  //"genericNumber7"                "BRA: N£mero da folha de registro"                    
            Cdelimiter1 "genericNumber8"                Cdelimiter2  //"genericNumber8"                "BRA: N£mero do cart∆o nacional do seguro-sa£de"      
            Cdelimiter1 "genericNumber5"                Cdelimiter2  //"genericNumber5"                "BRA: N£mero do escrit¢rio de registro de nascimento" 
            Cdelimiter1 "genericNumber6"                Cdelimiter2  //"genericNumber6"                "BRA: N£mero do Raz∆o de registro"                    
            Cdelimiter1 "genericString8"                Cdelimiter2  //"genericString8"                "BRA: Registro da certid∆o de nascimento"             
            Cdelimiter1 "genericNumber10"               Cdelimiter2  //"genericNumber10"               "BRA: Sal†rio-fam°lia"                                
            Cdelimiter1 "genericNumber13"               Cdelimiter2  //"genericNumber13"               "BRA: ê dependente com deficiància"                   
            Cdelimiter1 "operation"                     Cdelimiter1  //"operation"                     "Operaá∆o"                                            
            SKIP.  

        PUT UNFORMATTED
            Cdelimiter1 "BRA: Eleg°vel para Desconto de IR*"                  Cdelimiter2  
            Cdelimiter1 "BRA: Grau de Instruá∆o*"                             Cdelimiter2  
            Cdelimiter1 "BRA: Nome da M∆e do Dependente*"                     Cdelimiter2  
            Cdelimiter1 "BRA: Raáa*"                                          Cdelimiter2  
            Cdelimiter1 "Data do Evento*"                                     Cdelimiter2  
            Cdelimiter1 "C¢digo Dependente*"                                  Cdelimiter2  
            Cdelimiter1 "Pa°s/Regi∆o*"                                        Cdelimiter2  
            Cdelimiter1 "BRA: Aux°lio-Educaá∆o"                               Cdelimiter2  
            Cdelimiter1 "BRA: Data de Entrega da Certid∆o"                    Cdelimiter2  
            Cdelimiter1 "BRA: Data de Vencimento do Cart∆o de Vacinaá∆o"      Cdelimiter2  
            Cdelimiter1 "BRA: Data do Atestado Escolar"                       Cdelimiter2  
            Cdelimiter1 "BRA: Dependente do Plano de Sa£de"                   Cdelimiter2 
            Cdelimiter1 "BRA: Entregou Cart∆o de Vacina?"                     Cdelimiter2
            Cdelimiter1 "BRA: Escola"                                         Cdelimiter2  
            Cdelimiter1 "BRA: Estudante"                                      Cdelimiter2  
            Cdelimiter1 "BRA: Incluir no eSocial"                             Cdelimiter2  
            Cdelimiter1 "BRA: Nome do Tabeli∆o P£blico"                       Cdelimiter2
            Cdelimiter1 "BRA: N£mero da Declaraá∆o de Nascido Vivo"           Cdelimiter2  
            Cdelimiter1 "BRA: N£mero da Folha de Registro"                    Cdelimiter2  
            Cdelimiter1 "BRA: N£mero do Cart∆o Nacional do Seguro-Sa£de"      Cdelimiter2 
            Cdelimiter1 "BRA: N£mero do Escrit¢rio de Registro de Nascimento" Cdelimiter2  
            Cdelimiter1 "BRA: N£mero do Raz∆o de Registro"                    Cdelimiter2  
            Cdelimiter1 "BRA: Registro da Certid∆o de Nascimento"             Cdelimiter2  
            Cdelimiter1 "BRA: Sal†rio-Fam°lia"                                Cdelimiter2  
            Cdelimiter1 "BRA: ê Dependente com Deficiància"                   Cdelimiter2  
            Cdelimiter1 "Operaá∆o"                                            Cdelimiter1  
            SKIP.

    FOR EACH btab NO-LOCK
        WHERE btab.dat_desligto_func = ?
          AND btab.cdn_empresa       >= p-emp-ini
          AND btab.cdn_empresa       <= p-emp-fim 
          AND btab.cdn_estab         >= p-estab-ini
          AND btab.cdn_estab         <= p-estab-fim
          AND btab.cdn_funcionario   >= p-matricula-ini
          AND btab.cdn_funcionario   <= p-matricula-fim
          AND btab.dat_admis_func    >= p-dt-admissao,
        FIRST bpf OF btab NO-LOCK,
        EACH  bdf OF btab NO-LOCK.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /***** Data Admiss∆o *****/
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999')
               DtEntregCert = STRING(DAY(bdf.dat_livre_1),'99') + "/" + STRING(MONTH(bdf.dat_livre_1),'99') + "/" + STRING(YEAR(bdf.dat_livre_1),'9999').

        /***** Verifica Sal†rio Fam°lia *****/
        ASSIGN cSalFamilia = ''.
        IF bdf.idi_sit_salfam = 1 THEN ASSIGN cSalFamilia = "Suspenso".
        IF bdf.idi_sit_salfam = 2 THEN ASSIGN cSalFamilia = "Sim".
        IF bdf.idi_sit_salfam = 3 THEN ASSIGN cSalFamilia = "N∆o".
        
        PUT UNFORMATTED
            Cdelimiter1 IF bdf.idi_inciden_depend = 2 THEN "Sim" ELSE "N∆o"                                                      Cdelimiter2  //"genericNumber9"                "BRA: Eleg°vel para desconto de IR"                                                                                 
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"genericString9"                "BRA: Grau de instruá∆o"                                       
            Cdelimiter1 SUBSTRING(bdf.cod_livre_2,01,100)                                                                        Cdelimiter2  //"genericString14"               "BRA: Nome da M∆e do Dependente"
            Cdelimiter1 "N∆o Informada"                                                                                          Cdelimiter2  //"genericNumber1"                "BRA: Raáa"                                                                                                                                        
            Cdelimiter1 WContratacao                                                                                             Cdelimiter2  //"start-date"                    "Data do evento" 
            Cdelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario) + "-" + string(bdf.cdn_depend_func)                                                                                      Cdelimiter2  //"related-person-id-external"    "Codigo dependente"                                                                           
            Cdelimiter1 bdf.cod_pais_nasc                                                                                        Cdelimiter2  //"country"                       "Pa°s/Regi∆o"                                                                                   
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"genericNumber11"               "BRA: Aux°lio-educaá∆o"
            Cdelimiter1 DtEntregCert /*bdf.dat_livre_1*/                                                                         Cdelimiter2  //"genericDate4"                  "BRA: Data de entrega da certid∆o" 
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"genericDate2"                  "BRA: Data de vencimento do cart∆o de vacinaá∆o"               
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"genericDate6"                  "BRA: Data do Atestado Escolar"                                                                                              
            Cdelimiter1 IF bdf.log_plano_saude = YES THEN "Sim" ELSE "N∆o"                                                       Cdelimiter2  //"genericString17"               "BRA: Dependente do plano de sa£de"                                                                                 
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"custom-string1"                "BRA: Entregou Cart∆o de Vacina?"                                                                                     
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"genericString13"               "BRA: Escola"
            Cdelimiter1 IF bdf.log_estudan = YES THEN "Sim" ELSE "N∆o"                                                           Cdelimiter2  //"genericNumber12"               "BRA: Estudante"
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"custom-string7"                "BRA: Incluir no eSocial"                                                                                             
            Cdelimiter1 bdf.nom_cartor_reg_depend                                                                                Cdelimiter2  //"genericString7"                "BRA: Nome do tabeli∆o p£blico"                                                                                                
            Cdelimiter1 SUBSTRING(bdf.cod_livre_1,74,20)                                                                         Cdelimiter2  //"genericString6"                "BRA: N£mero da Declaraá∆o de Nascido Vivo" 
            Cdelimiter1 bdf.cod_folha_anot_depend                                                                                Cdelimiter2  //"genericNumber7"                "BRA: N£mero da folha de registro"
            Cdelimiter1 bdf.cod_cartao_nac_saude                                                                                 Cdelimiter2  //"genericNumber8"                "BRA: N£mero do cart∆o nacional do seguro-sa£de"               
            Cdelimiter1 bdf.nom_cartor_reg_depend                                                                                Cdelimiter2  //"genericNumber5"                "BRA: N£mero do escrit¢rio de registro de nascimento"                                                                                                 
            Cdelimiter1 bdf.cod_cgc_cartor                                                                                       Cdelimiter2  //"genericNumber6"                "BRA: N£mero do Raz∆o de registro"                                                                                                                          
            Cdelimiter1 bdf.num_reg_certid_depend                                                                                Cdelimiter2  //"genericString8"                "BRA: Registro da certid∆o de nascimento"                                                                                                            
            Cdelimiter1 cSalFamilia                                                                                              Cdelimiter2  //"genericNumber10"               "BRA: Sal†rio-fam°lia"                                         
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"genericNumber13"               "BRA: ê dependente com deficiància"                            
            Cdelimiter1 ""                                                                                                       Cdelimiter2  //"operation"                     "Operaá∆o"
            SKIP.                                                                                                                    
                       
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    











