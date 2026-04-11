Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Hist¢rico de Trabalhos                                                       */
/********************************************************************************/

DEF BUFFER btab       FOR funcionario.
DEF BUFFER bcf        FOR contrat_func.
DEF BUFFER bpf        FOR rh_pessoa_fisic.
DEF BUFFER bdf        FOR depend_func.
DEF BUFFER bsp        FOR sped_participan.
DEF BUFFER bhs        FOR histor_sal_func.
DEF BUFFER bsaf       FOR sit_afast_func.
DEF BUFFER bexf       FOR ext_funcionario.
DEF BUFFER bsp_gestor FOR sped_participan.
DEF BUFFER bcb        FOR cargo_basic.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE VARIABLE agent_nociv     AS CHAR FORMAT 'x(256)'     NO-UNDO.
DEFINE VARIABLE fgts-percent    AS DEC FORMAT '->>>>>>9.99' NO-UNDO.
DEFINE VARIABLE Wdtatadmis      AS CHAR                     NO-UNDO.
DEFINE VARIABLE emit_cart_ponto AS CHAR FORMAT 'x(15)'      NO-UNDO.
DEFINE VARIABLE c-vinculo       AS CHAR                     NO-UNDO.
DEFINE VARIABLE NaturAtivid     AS CHAR FORMAT "x(25)"      NO-UNDO.
DEFINE VARIABLE iAgentNociv     AS INT                      NO-UNDO.

//DEFINE VARIABLE d-go-live       AS DATE FORMAT "99/99/9999" NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.
DEFINE INPUT PARAMETER p-dt-golive     AS DATE NO-UNDO.

DEFINE VARIABLE h-acomp AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont  AS INT    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - HISTàRICO TRABALHO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '6 - Hist¢rico de Trabalhos.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "worker-category"            Cdelimiter2  //worker-category           "BRA: Categoria eSocial"  
            Cdelimiter1 "emp-relationship"           Cdelimiter2  //emp-relationship          "BRA: Categoria Salarial"                       
            Cdelimiter1 "custom-string14"            Cdelimiter2  //custom-string14           "BRA: Categoria Trabalhador-Sefip"              
            Cdelimiter1 "custom-string29"            Cdelimiter2  //custom-string29           "BRA: C¢digo da Classe de Funcion rios para Ponto Eletr“nico"              
            Cdelimiter1 "harmful-agent-exposure"     Cdelimiter2  //harmful-agent-exposure    "BRA: C¢digo de exposi‡Æo do agente prejudicial"
            Cdelimiter1 "custom-string28"            Cdelimiter2  //custom-string28           "BRA: C¢digo do Local de Marca‡Æo"
            Cdelimiter1 "custom-date2"               Cdelimiter2  //custom-date2              "BRA: Data do éltimo Exame M‚dico"
            Cdelimiter1 "custom-string26"            Cdelimiter2  //custom-string26           "BRA: Emite CartÆo Ponto"
            Cdelimiter1 "event-reason"               Cdelimiter2  //event-reason              "BRA: event-reason"                             
            Cdelimiter1 "custom-string24"            Cdelimiter2  //custom-string24           "BRA: Indicador se Calcula 13. Sal rio"                             
            Cdelimiter1 "custom-string23"            Cdelimiter2  //custom-string23           "BRA: Indicador se Desconta Contrib. Sindical"                             
            Cdelimiter1 "custom-string21"            Cdelimiter2  //custom-string21           "BRA: Indicador se Funcion rio Estudante"                             
            Cdelimiter1 "custom-string22"            Cdelimiter2  //custom-string22           "BRA: Indicador se Funcion rio Sindicalizado"                             
            Cdelimiter1 "custom-string25"            Cdelimiter2  //custom-string25           "BRA: Indicador se Recebe F‚rias"                             
            Cdelimiter1 "custom-string35"            Cdelimiter2  //custom-string35           "BRA: Localidade"                             
            Cdelimiter1 "custom-string16"            Cdelimiter2  //custom-string16           "BRA: Natureza da Atividade eSocial" 
            Cdelimiter1 "seq-number"                 Cdelimiter2  //seq-number                "BRA: seq-number"                               
            Cdelimiter1 "contract-type"              Cdelimiter2  //contract-type             "BRA: Tipo de contrato"                         
            Cdelimiter1 "custom-string6"             Cdelimiter2  //custom-string6            "BRA: Tipo de Regime da Jornada"                
            Cdelimiter1 "custom-string10"            Cdelimiter2  //custom-string10           "BRA: Tipo de Regime Previdenci rio"            
            Cdelimiter1 "custom-string20"            Cdelimiter2  //custom-string20           "BRA: Turma"                            
            Cdelimiter1 "custom-string5"             Cdelimiter2  //custom-string5            "BRA: Unidade de lota‡Æo/Local F¡sico"          
            Cdelimiter1 "commitment-indicator"       Cdelimiter2  //commitment-indicator      "BRA: V¡nculo RAIS"
            Cdelimiter1 "job-code"                   Cdelimiter2  //job-code                  "Cargo"                                         
            Cdelimiter1 "start-date"                 Cdelimiter2  //start-date                "Data do evento"                                
            Cdelimiter1 "company"                    Cdelimiter2  //company                   "Empresa"                                       
            Cdelimiter1 "user-id"                    Cdelimiter2  //user-id                   "ID do Usu rio"                                 
            Cdelimiter1 "position"                   Cdelimiter2  //position                  "Posi‡Æo"                                       
            Cdelimiter1 "manager-id"                 Cdelimiter2  //manager-id                "Supervisor"                                    
            Cdelimiter1 "employee-class"             Cdelimiter2  //employee-class            "Tipo de colaborador"                           
            Cdelimiter1 "attachment-id"              Cdelimiter2  //attachment-id             "Anexo"                                     
            Cdelimiter1 "notes"                      Cdelimiter2  //notes                     "Anota‡äes"                                                                 
            Cdelimiter1 "retired"                    Cdelimiter2  //retired                   "BRA: Aposentado"                               
            Cdelimiter1 "custom-string4"             Cdelimiter2  //custom-string4            "BRA: CBO"                                      
            Cdelimiter1 "fgts-date"                  Cdelimiter2  //fgts-date                 "BRA: Data do FGTS"                             
            Cdelimiter1 "expected-return-date"       Cdelimiter2  //expected-return-date      "BRA: expected-return-date"                     
            Cdelimiter1 "custom-date6"               Cdelimiter2  //custom-date6              "BRA: Fim do 2§ per¡odo de Experiˆncia"         
            Cdelimiter1 "custom-string27"            Cdelimiter2  //custom-string27           "BRA: Indicador se Considera Carga Autom Turno"                             
            Cdelimiter1 "health-risk"                Cdelimiter2  //health-risk               "BRA: Insalubridade"                            
            Cdelimiter1 "custom-string19"            Cdelimiter2  //custom-string19           "BRA: Matr¡cula da Folha"                   
            Cdelimiter1 "custom-string1"             Cdelimiter2  //custom-string1            "BRA: N¡vel da insalubridade"                   
            Cdelimiter1 "fgts-optant"                Cdelimiter2  //fgts-optant               "BRA: Optante FGTS"                             
            Cdelimiter1 "custom-string7"             Cdelimiter2  //custom-string7            "BRA: Pagamento em Ju¡zo (S/N)"                 
            Cdelimiter1 "hazard"                     Cdelimiter2  //hazard                    "BRA: Periculosidade"                           
            Cdelimiter1 "fgts-percent"               Cdelimiter2  //fgts-percent              "BRA: Porcentagem do FGTS"                      
            Cdelimiter1 "custom-date1"               Cdelimiter2  //custom-date1              "BRA: Prazo Determinado - Cl usula Assecurat¢ria
            Cdelimiter1 "custom-string12"            Cdelimiter2  //custom-string12           "BRA: Situa‡Æo RAIS"                            
            Cdelimiter1 "custom-string18"            Cdelimiter2  //custom-string18           "BRA: Tipo de MÆo de Obra"                            
            Cdelimiter1 "holiday-calendar-code"      Cdelimiter2  //holiday-calendar-code     "Calend rio de feriados"
            Cdelimiter1 "cost-center"                Cdelimiter2  //cost-center               "Centro de custos"                              
            Cdelimiter1 "hireDate"                   Cdelimiter2  //hireDate                  "Data de admissÆo"                              
            Cdelimiter1 "positionEntryDate"          Cdelimiter2  //positionEntryDate         "Data de entrada de posi‡Æo"                    
            Cdelimiter1 "end-date"                   Cdelimiter2  //end-date                  "Data final" 
            Cdelimiter1 "custom-long3"               Cdelimiter2  //custom-long3              "Dias afastados (dentro do ano fiscal)" 
            Cdelimiter1 "custom-long2"               Cdelimiter2  //custom-long2              "Dias trabalhados (dentro do ano fiscal)" 
            Cdelimiter1 "custom-long1"               Cdelimiter2  //custom-long1              "Dias trabalhados (desde a admissÆo)" 
            Cdelimiter1 "custom-string2"             Cdelimiter2  //custom-string2            "Empresa Anterior"                               
            Cdelimiter1 "location"                   Cdelimiter2  //location                  "Estabelecimento"                                     
            Cdelimiter1 "custom-string17"            Cdelimiter2  //custom-string17           "Estabelecimento Anterior"                               
            Cdelimiter1 "department"                 Cdelimiter2  //department                "Estrutura"                                           
            Cdelimiter1 "fte"                        Cdelimiter2  //fte                       "ETI"
            Cdelimiter1 "custom-string9"             Cdelimiter2  //custom-string9            "Faixa salarial"                                
            Cdelimiter1 "probation-period-end-date"  Cdelimiter2  //probation-period-end-date "Fim do 1§ per¡odo de Experiˆncia"              
            Cdelimiter1 "timezone"                   Cdelimiter2  //timezone                  "Fuso hor rio"                                  
            Cdelimiter1 "pay-grade"                  Cdelimiter2  //pay-grade                 "Grade salarial"                                
            Cdelimiter1 "custom-double10"            Cdelimiter2  //custom-double10           "Horas mensais trabalhadas"                                
            Cdelimiter1 "custom-string13"            Cdelimiter2  //custom-string13           "Inativar posi‡Æo?"                             
            Cdelimiter1 "time-type-profile-code"     Cdelimiter2  //time-type-profile-code    "Perfil de tempos"                              
            Cdelimiter1 "workschedule-code"          Cdelimiter2  //workschedule-code         "Plano de hor rio de trabalho"                  
            Cdelimiter1 "contract-end-date"          Cdelimiter2  //contract-end-date         "Prazo de Contrato"                             
            Cdelimiter1 "custom-string8"             Cdelimiter2  //custom-string8            "Promo‡Æo por Substitui‡Æo?"                    
            Cdelimiter1 "payScaleType"               Cdelimiter2  //payScaleType              "Sindicato"  
            Cdelimiter1 "companyEntryDate"           Cdelimiter2  //companyEntryDate          "Tempo na empresa"                              
            Cdelimiter1 "business-unit"              Cdelimiter2  //business-unit             "Unidade de neg¢cios"                           
            Cdelimiter1 "time-recording-variant"     Cdelimiter2  //time-recording-variant    "Variante de registro de horas" 
            Cdelimiter1 "custom-string3"             Cdelimiter2  //custom-string3            "BRA: Indicador se Funcion rio com V¡nnculo" 
            Cdelimiter1 "operation"                  Cdelimiter1  //operation                 "Opera‡Æo" 
            SKIP.   

        PUT UNFORMATTED
            Cdelimiter1 "BRA: Categoria eSocial*"                                        Cdelimiter2  //worker-category           "BRA: Categoria eSocial"  
            Cdelimiter1 "BRA: Categoria Salarial*"                                       Cdelimiter2  //emp-relationship          "BRA: Categoria Salarial"                       
            Cdelimiter1 "BRA: Categoria Trabalhador-Sefip*"                              Cdelimiter2  //custom-string14           "BRA: Categoria Trabalhador-Sefip"              
            Cdelimiter1 "BRA: C¢digo da Classe de Funcion rios para Ponto Eletr“nico*"   Cdelimiter2  //custom-string29           "BRA: C¢digo da Classe de Funcion rios para Ponto Eletr“nico"              
            Cdelimiter1 "BRA: C¢digo de exposi‡Æo do agente prejudicial*"                Cdelimiter2  //harmful-agent-exposure    "BRA: C¢digo de exposi‡Æo do agente prejudicial"
            Cdelimiter1 "BRA: C¢digo do Local de Marca‡Æo*"                              Cdelimiter2  //custom-string28           "BRA: C¢digo do Local de Marca‡Æo"
            Cdelimiter1 "BRA: Data do éltimo Exame M‚dico*"                              Cdelimiter2  //custom-date2              "BRA: Data do éltimo Exame M‚dico"
            Cdelimiter1 "BRA: Emite CartÆo Ponto*"                                       Cdelimiter2  //custom-string26           "BRA: Emite CartÆo Ponto"
            Cdelimiter1 "BRA: event-reason*"                                             Cdelimiter2  //event-reason              "BRA: event-reason"                             
            Cdelimiter1 "BRA: Indicador se Calcula 13. Sal rio*"                         Cdelimiter2  //custom-string24           "BRA: Indicador se Calcula 13. Sal rio"                             
            Cdelimiter1 "BRA: Indicador se Desconta Contrib. Sindical*"                  Cdelimiter2  //custom-string23           "BRA: Indicador se Desconta Contrib. Sindical"                             
            Cdelimiter1 "BRA: Indicador se Funcion rio Estudante*"                       Cdelimiter2  //custom-string21           "BRA: Indicador se Funcion rio Estudante"                             
            Cdelimiter1 "BRA: Indicador se Funcion rio Sindicalizado*"                   Cdelimiter2  //custom-string22           "BRA: Indicador se Funcion rio Sindicalizado"                             
            Cdelimiter1 "BRA: Indicador se Recebe F‚rias*"                               Cdelimiter2  //custom-string25           "BRA: Indicador se Recebe F‚rias"                             
            Cdelimiter1 "BRA: Localidade*"                                               Cdelimiter2  //custom-string35           "BRA: Localidade"                             
            Cdelimiter1 "BRA: Natureza da Atividade eSocial*"                            Cdelimiter2  //custom-string16           "BRA: Natureza da Atividade eSocial"            
            Cdelimiter1 "BRA: seq-number*"                                               Cdelimiter2  //seq-number                "BRA: seq-number"                               
            Cdelimiter1 "BRA: Tipo de contrato*"                                         Cdelimiter2  //contract-type             "BRA: Tipo de contrato"                         
            Cdelimiter1 "BRA: Tipo de Regime da Jornada*"                                Cdelimiter2  //custom-string6            "BRA: Tipo de Regime da Jornada"                
            Cdelimiter1 "BRA: Tipo de Regime Previdenci rio*"                            Cdelimiter2  //custom-string10           "BRA: Tipo de Regime Previdenci rio"            
            Cdelimiter1 "BRA: Turma*"                                                    Cdelimiter2  //custom-string20           "BRA: Turma"
            Cdelimiter1 "BRA: Unidade de lota‡Æo/Local F¡sico*"                          Cdelimiter2  //custom-string5            "BRA: Unidade de lota‡Æo/Local F¡sico"          
            Cdelimiter1 "BRA: V¡nculo RAIS*"                                             Cdelimiter2  //commitment-indicator      "BRA: V¡nculo RAIS"
            Cdelimiter1 "Cargo*"                                                         Cdelimiter2  //job-code                  "Cargo"                                         
            Cdelimiter1 "Data do evento*"                                                Cdelimiter2  //start-date                "Data do evento"                                
            Cdelimiter1 "Empresa*"                                                       Cdelimiter2  //company                   "Empresa"                                       
            Cdelimiter1 "ID do Usu rio*"                                                 Cdelimiter2  //user-id                   "ID do Usu rio"                                 
            Cdelimiter1 "Posi‡Æo*"                                                       Cdelimiter2  //position                  "Posi‡Æo"                                       
            Cdelimiter1 "Supervisor*"                                                    Cdelimiter2  //manager-id                "Supervisor"                                    
            Cdelimiter1 "Tipo de colaborador*"                                           Cdelimiter2  //employee-class            "Tipo de colaborador"                                   
            Cdelimiter1 "Anexo"                                                          Cdelimiter2  //attachment-id             "Anexo"                                     
            Cdelimiter1 "Anota‡äes"                                                      Cdelimiter2  //notes                     "Anota‡äes"                                                                 
            Cdelimiter1 "BRA: Aposentado"                                                Cdelimiter2  //retired                   "BRA: Aposentado"                               
            Cdelimiter1 "BRA: CBO"                                                       Cdelimiter2  //custom-string4            "BRA: CBO"                                      
            Cdelimiter1 "BRA: Data do FGTS"                                              Cdelimiter2  //fgts-date                 "BRA: Data do FGTS"                             
            Cdelimiter1 "BRA: expected-return-date"                                      Cdelimiter2  //expected-return-date      "BRA: expected-return-date"                     
            Cdelimiter1 "BRA: Fim do 2§ per¡odo de Experiˆncia"                          Cdelimiter2  //custom-date6              "BRA: Fim do 2§ per¡odo de Experiˆncia"         
            Cdelimiter1 "BRA: Indicador se Considera Carga Autom Turno"                  Cdelimiter2  //custom-string27           "BRA: Indicador se Considera Carga Autom Turno"                             
            Cdelimiter1 "BRA: Insalubridade*"                                            Cdelimiter2  //health-risk               "BRA: Insalubridade"                            
            Cdelimiter1 "BRA: Matr¡cula da Folha*"                                       Cdelimiter2  //custom-string19           "BRA: Matr¡cula da Folha"                   
            Cdelimiter1 "BRA: N¡vel da insalubridade"                                    Cdelimiter2  //custom-string1            "BRA: N¡vel da insalubridade"                   
            Cdelimiter1 "BRA: Optante FGTS"                                              Cdelimiter2  //fgts-optant               "BRA: Optante FGTS"                             
            Cdelimiter1 "BRA: Pagamento em Ju¡zo (S/N)"                                  Cdelimiter2  //custom-string7            "BRA: Pagamento em Ju¡zo (S/N)"                 
            Cdelimiter1 "BRA: Periculosidade"                                            Cdelimiter2  //hazard                    "BRA: Periculosidade"                           
            Cdelimiter1 "BRA: Porcentagem do FGTS"                                       Cdelimiter2  //fgts-percent              "BRA: Porcentagem do FGTS"                      
            Cdelimiter1 "BRA: Prazo Determinado - Cl usula Assecurat¢ria"                Cdelimiter2  //custom-date1              "BRA: Prazo Determinado - Cl usula Assecurat¢ria"
            Cdelimiter1 "BRA: Situa‡Æo RAIS"                                             Cdelimiter2  //custom-string12           "BRA: Situa‡Æo RAIS"                            
            Cdelimiter1 "BRA: Tipo de MÆo de Obra"                                       Cdelimiter2  //custom-string18           "BRA: Tipo de MÆo de Obra"                            
            Cdelimiter1 "Calend rio de feriados*"                                        Cdelimiter2  //holiday-calendar-code     "Calend rio de feriados"                        
            Cdelimiter1 "Centro de custos"                                               Cdelimiter2  //cost-center               "Centro de custos"                              
            Cdelimiter1 "Data de admissÆo*"                                              Cdelimiter2  //hireDate                  "Data de admissÆo"                              
            Cdelimiter1 "Data de entrada de posi‡Æo"                                     Cdelimiter2  //positionEntryDate         "Data de entrada de posi‡Æo"                    
            Cdelimiter1 "Data final"                                                     Cdelimiter2  //end-date                  "Data final" 
            Cdelimiter1 "Dias afastados (dentro do ano fiscal)"                          Cdelimiter2  //custom-long3              "Dias afastados (dentro do ano fiscal)" 
            Cdelimiter1 "Dias trabalhados (dentro do ano fiscal)"                        Cdelimiter2  //custom-long2              "Dias trabalhados (dentro do ano fiscal)" 
            Cdelimiter1 "Dias trabalhados (desde a admissÆo)"                            Cdelimiter2  //custom-long1              "Dias trabalhados (desde a admissÆo)" 
            Cdelimiter1 "Empresa Anterior"                                               Cdelimiter2  //custom-string2            "Empresa Anterior"                               
            Cdelimiter1 "Estabelecimento"                                                Cdelimiter2  //location                  "Estabelecimento"                                     
            Cdelimiter1 "Estabelecimento Anterior"                                       Cdelimiter2  //custom-string17           "Estabelecimento Anterior"                               
            Cdelimiter1 "Estrutura"                                                      Cdelimiter2  //department                "Estrutura"                                           
            Cdelimiter1 "ETI*"                                                           Cdelimiter2  //fte                       "ETI"
            Cdelimiter1 "Faixa salarial"                                                 Cdelimiter2  //custom-string9            "Faixa salarial"                                
            Cdelimiter1 "Fim do 1§ per¡odo de Experiˆncia"                               Cdelimiter2  //probation-period-end-date "Fim do 1§ per¡odo de Experiˆncia"              
            Cdelimiter1 "Fuso hor rio*"                                                  Cdelimiter2  //timezone                  "Fuso hor rio"                                  
            Cdelimiter1 "Grade salarial"                                                 Cdelimiter2  //pay-grade                 "Grade salarial"                                
            Cdelimiter1 "Horas mensais trabalhadas"                                      Cdelimiter2  //custom-double10           "Horas mensais trabalhadas"                                
            Cdelimiter1 "Inativar posi‡Æo?"                                              Cdelimiter2  //custom-string13           "Inativar posi‡Æo?"                             
            Cdelimiter1 "Perfil de tempos*"                                              Cdelimiter2  //time-type-profile-code    "Perfil de tempos"                              
            Cdelimiter1 "Plano de hor rio de trabalho*"                                  Cdelimiter2  //workschedule-code         "Plano de hor rio de trabalho"                  
            Cdelimiter1 "Prazo de Contrato"                                              Cdelimiter2  //contract-end-date         "Prazo de Contrato"                             
            Cdelimiter1 "Promo‡Æo por Substitui‡Æo?"                                     Cdelimiter2  //custom-string8            "Promo‡Æo por Substitui‡Æo?"                    
            Cdelimiter1 "Sindicato"                                                      Cdelimiter2  //payScaleType              "Sindicato"                                     
            Cdelimiter1 "Tempo na empresa"                                               Cdelimiter2  //companyEntryDate          "Tempo na empresa"                              
            Cdelimiter1 "Unidade de neg¢cios"                                            Cdelimiter2  //business-unit             "Unidade de neg¢cios"                           
            Cdelimiter1 "Variante de registro de horas*"                                 Cdelimiter2  //time-recording-variant    "Variante de registro de horas" 
            Cdelimiter1 "Indicador se Funcion rio com V¡nculo*"                          Cdelimiter2  //custom-string3            "BRA: Indicador se Funcion rio com V¡nnculo" 
            Cdelimiter1 "Opera‡Æo"                                                       Cdelimiter1  //operation                 "Opera‡Æo" 
            SKIP.   
    
    //ASSIGN d-go-live = 04/01/2021.

    FOR EACH btab NO-LOCK
        WHERE btab.dat_desligto_func = ?
          AND btab.cdn_empresa     >= p-emp-ini
          AND btab.cdn_empresa     <= p-emp-fim 
          AND btab.cdn_estab       >= p-estab-ini
          AND btab.cdn_estab       <= p-estab-fim
          AND btab.cdn_funcionario >= p-matricula-ini
          AND btab.cdn_funcionario <= p-matricula-fim
          AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bpf OF btab NO-LOCK
        BREAK BY btab.cdn_empresa
              BY btab.cdn_estab
              BY btab.cdn_funcionario.

        IF (btab.cdn_funcionario >= 28000001 AND 
            btab.cdn_funcionario <= 28000567) OR 
           (btab.cdn_funcionario = 1255100    OR    
            btab.cdn_funcionario = 1262100    OR    
            btab.cdn_funcionario = 1281100    OR    
            btab.cdn_funcionario = 1443400    OR    
            btab.cdn_funcionario = 10327896   OR   
            btab.cdn_funcionario = 10339411   OR   
            btab.cdn_funcionario = 10348562   OR   
            btab.cdn_funcionario = 39968091   OR   
            btab.cdn_funcionario = 40062417   OR   
            btab.cdn_funcionario = 40074351   OR   
            btab.cdn_funcionario = 67380902   OR   
            btab.cdn_funcionario = 36500000   OR   
            btab.cdn_funcionario = 36500041   OR   
            btab.cdn_funcionario = 36500047   OR   
            btab.cdn_funcionario = 36500057   OR   
            btab.cdn_funcionario = 36500058   OR   
            btab.cdn_funcionario = 36500059)  THEN NEXT.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

       /* FOR LAST func_expos_agent_nociv OF btab BREAK BY func_expos_agent_nociv.dat_inic_lotac_func. END.
        ASSIGN agent_nociv = 'Non-Exposure to Harmful Agent'.
        IF AVAIL func_expos_agent_nociv THEN DO:
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '2' THEN
               ASSIGN agent_nociv = 'Exposure to Harmful Agent (Special Retirement: 15 Years Service)'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '6' THEN
               ASSIGN agent_nociv = 'Exposure to Harmful Agent (Special Retirement: 15 Years Service) ? Multiple Labor Ties'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '3' THEN
               ASSIGN agent_nociv = 'Exposure to Harmful Agent (Special Retirement: 20 Years Service)'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '7' THEN
               ASSIGN agent_nociv = 'Exposure to Harmful Agent (Special Retirement: 20 Years Service) ? Multiple Labor Ties'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '4' THEN
               ASSIGN agent_nociv = 'Exposure to Harmful Agent (Special Retirement: 25 Years Service) ? Multiple Labor Ties'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '8' THEN
               ASSIGN agent_nociv = 'Exposure to Harmful Agent (Special Retirement: 25 Years Service) ? Multiple Labor Ties'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '0' THEN  
               ASSIGN agent_nociv = 'Non-Exposure to Harmful Agent'.
            ELSE
            IF func_expos_agent_nociv.cod_expos_agent_nociv = '5' THEN
               ASSIGN agent_nociv = 'Non-Exposure to Harmful Agent ? Multiple Labor Ties'.
        END.
        IF agent_nociv = '' THEN "Unknow".*/

        /* Localiza %FGTS */
        ASSIGN fgts-percent = 0.            
        IF btab.log_recolhe_fgts = TRUE THEN
           IF btab.cdn_vinc_empregat = 55 THEN ASSIGN fgts-percent = 2.
           ELSE ASSIGN fgts-percent = 8.

        /* Grava Data de AdmissÆo */
        ASSIGN Wdtatadmis = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        /* Grava V¡nculo Empregat¡cio */
        //IF btab.idi_tip_vinc_empregat = 1 THEN ASSIGN c-vinculo = "Sim". ELSE "NÆo".

        /* Grava Informa‡äes de Ponto */
        IF btab.idi_emite_cartao_pto = 1 THEN ASSIGN emit_cart_ponto = "Turno".
        IF btab.idi_emite_cartao_pto = 2 THEN ASSIGN emit_cart_ponto = "yes".
        IF btab.idi_emite_cartao_pto = 3 THEN ASSIGN emit_cart_ponto = "no".

        /* Localiza Sped Participante PF */
        FIND FIRST bsp
             WHERE bsp.cdn_empresa         = btab.cdn_empresa
               AND bsp.cdn_estab           = btab.cdn_estab
               AND bsp.cdn_participan_sped = btab.cdn_funcionario NO-LOCK NO-ERROR.
        IF AVAIL bsp THEN DO:

           IF bsp.idi_natur_ativid_trab = 1 THEN ASSIGN NaturAtivid = "TRABALHADOR URBANO".
           IF bsp.idi_natur_ativid_trab = 2 THEN ASSIGN NaturAtivid = "TRABALHADOR RURAL".
           
        END.

        FIND LAST bhs OF btab NO-LOCK NO-ERROR.

        /* Localiza Situa‡Æo Afastamento */
        FIND LAST bsaf OF btab
            WHERE bsaf.cdn_sit_afast_func = 40 NO-LOCK NO-ERROR.
        
        /* Localiza C¢digo Gestor */
        FIND FIRST bexf
             WHERE bexf.cdn_empresa     = btab.cdn_empresa 
               AND bexf.cdn_estab       = btab.cdn_estab
               AND bexf.cdn_funcionario = btab.cdn_funcionario NO-LOCK NO-ERROR.
        /*IF AVAIL bexf THEN DO:
           FIND FIRST bsp_gestor
                WHERE bsp_gestor.cdn_empresa         = bexf.cdn_empresa
                  AND bsp_gestor.cdn_estab           = bexf.cdn_estab
                  AND bsp_gestor.cdn_participan_sped = bexf.cdn_func_gestor NO-LOCK NO-ERROR.

        END.*/
        
        FIND FIRST bcb
             WHERE bcb.cdn_cargo_basic = btab.cdn_cargo_basic NO-LOCK NO-ERROR.
        
        ASSIGN iAgentNociv = INT(SUBSTRING(btab.cod_livre_1,6,1)).

        IF iAgentNociv = 0 THEN
           ASSIGN iAgentNociv = 1.

        PUT UNFORMATTED
            Cdelimiter1 IF AVAIL bsp THEN bsp.cdn_categ_trab_sped ELSE 0   Cdelimiter2  //worker-category           "BRA: Categoria eSocial"  
            Cdelimiter1 btab.cdn_categ_sal                                 Cdelimiter2  //emp-relationship          "BRA: Categoria Salarial"                       
            Cdelimiter1 SUBSTRING(btab.cod_livre_2,37,2)                   Cdelimiter2  //custom-string14           "BRA: Categoria Trabalhador-Sefip"              
            Cdelimiter1 btab.cdn_clas_func                                 Cdelimiter2  //custom-string29           "BRA: C¢digo da Classe de Funcion rios para Ponto Eletr“nico"              
            Cdelimiter1 STRING(iAgentNociv)  + " - " + {varinc/var10126.i 04 iAgentNociv} /*btab.idi_tip_ocor_agent_nociv*/                      Cdelimiter2  //harmful-agent-exposure    "BRA: C¢digo de exposi‡Æo do agente prejudicial"
            Cdelimiter1 btab.cdn_local_marcac_cartao_pto                   Cdelimiter2  //custom-string28           "BRA: C¢digo do Local de Marca‡Æo"
            Cdelimiter1 IF btab.dat_ult_exam_medic = ? THEN Wdtatadmis ELSE STRING(DAY(btab.dat_ult_exam_medic),'99') + "/" + STRING(MONTH(btab.dat_ult_exam_medic),'99') + "/" + STRING(YEAR(btab.dat_ult_exam_medic),'9999') Cdelimiter2  //custom-date2              "BRA: Data do éltimo Exame M‚dico"
            Cdelimiter1 btab.idi_emite_cartao_pto                          Cdelimiter2  //custom-string26           "BRA: Emite CartÆo Ponto"
            Cdelimiter1 "Z"                                                Cdelimiter2  //event-reason              "BRA: event-reason"                             
            Cdelimiter1 IF btab.log_recebe_13o_salario = YES THEN "Sim" ELSE "NÆo" Cdelimiter2  //custom-string24           "BRA: Indicador se Calcula 13. Sal rio"                             
            Cdelimiter1 IF btab.log_descta_contrib_sindic = YES THEN "S" ELSE "N"  Cdelimiter2  //custom-string23           "BRA: Indicador se Desconta Contrib. Sindical"                             
            Cdelimiter1 IF btab.log_estudan = YES THEN "S" ELSE "N"                Cdelimiter2  //custom-string21           "BRA: Indicador se Funcion rio Estudante"                             
            Cdelimiter1 IF btab.log_func_sindlz = YES THEN "S" ELSE "N"            Cdelimiter2  //custom-string22           "BRA: Indicador se Funcion rio Sindicalizado"                             
            Cdelimiter1 IF btab.log_recebe_ferias = YES THEN "S" ELSE "N"          Cdelimiter2  //custom-string25           "BRA: Indicador se Recebe F‚rias"                             
            Cdelimiter1 btab.cdn_localidade                                Cdelimiter2  //custom-string35           "BRA: Localidade"                             
            Cdelimiter1 IF AVAIL bsp THEN STRING(bsp.idi_natur_ativid_trab) + " - " + STRING(NaturAtivid) ELSE "0" Cdelimiter2  //custom-string16           "BRA: Natureza da Atividade eSocial"            
            Cdelimiter1 "1"                                                Cdelimiter2  //seq-number                "BRA: seq-number"                               
            Cdelimiter1 btab.idi_tip_func /*{DATABASE/inpy/i21py085.i 04 btab.idi_tip_func}*/    Cdelimiter2  //contract-type             "BRA: Tipo de contrato"                         
            Cdelimiter1 IF AVAIL bsp THEN bsp.idi_regim_jorn ELSE 0        Cdelimiter2  //custom-string6            "BRA: Tipo de Regime da Jornada"                
            Cdelimiter1 IF AVAIL bsp THEN STRING(bsp.idi_regim_previd) + " - " + STRING({database/ingt/i04gt181.i 04 bsp.idi_regim_previd}) ELSE "0" Cdelimiter2  //custom-string10           "BRA: Tipo de Regime Previdenci rio"            
            Cdelimiter1 btab.cdn_turma_trab                                Cdelimiter2  //custom-string20           "BRA: Turma"                            
            Cdelimiter1 btab.cod_unid_lotac                                Cdelimiter2  //custom-string5            "BRA: Unidade de lota‡Æo/Local F¡sico"          
            Cdelimiter1 btab.log_consid_rais                               Cdelimiter2  //commitment-indicator      "BRA: V¡nculo RAIS"
            Cdelimiter1 btab.cdn_cargo_basic                               Cdelimiter2  //job-code                  "Cargo"                                         
            Cdelimiter1 Wdtatadmis                                         Cdelimiter2  //start-date                "Data do evento"                                
            Cdelimiter1 btab.cdn_empresa                                   Cdelimiter2  //company                   "Empresa"                                       
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                               Cdelimiter2  //user-id                   "ID do Usu rio"                                 
            Cdelimiter1 ""                                                 Cdelimiter2  //position                  "Posi‡Æo"                                       
            Cdelimiter1 IF AVAIL bexf THEN STRING(bexf.cdn_empresa) + '-' + STRING(bexf.cdn_estab) + '-' + FILL("0", 8 -  LENGTH(bexf.cdn_func_gestor)) + STRING(bexf.cdn_func_gestor) ELSE '0'  Cdelimiter2  //manager-id                "Supervisor"                                    
            Cdelimiter1 btab.cdn_clas_func                                 Cdelimiter2  //employee-class            "Tipo de colaborador"                           
            Cdelimiter1 ""                                                 Cdelimiter2  //attachment-id             "Anexo"                                     
            Cdelimiter1 ""                                                 Cdelimiter2  //notes                     "Anota‡äes"                                                                 
            Cdelimiter1 IF btab.idi_tip_func = 3 THEN "Yes" ELSE "No"      Cdelimiter2  //retired                   "BRA: Aposentado"                               
            Cdelimiter1 bcb.cod_classif_ocupac                             Cdelimiter2  //custom-string4            "BRA: CBO"                                      
            Cdelimiter1 STRING(DAY(btab.dat_opc_fgts),'99') + "/" + STRING(MONTH(btab.dat_opc_fgts),'99') + "/" + STRING(YEAR(btab.dat_opc_fgts),'9999') Cdelimiter2  //fgts-date                 "BRA: Data do FGTS"                             
            Cdelimiter1 ""                                                 Cdelimiter2  //expected-return-date      "BRA: expected-return-date"                     
            Cdelimiter1 IF btab.dat_term_prorrog_contrat_trab = ? THEN "" ELSE STRING(DAY(btab.dat_term_prorrog_contrat_trab),'99') + "/" + STRING(MONTH(btab.dat_term_prorrog_contrat_trab),'99') + "/" + STRING(YEAR(btab.dat_term_prorrog_contrat_trab),'9999')  Cdelimiter2  //custom-date6              "BRA: Fim do 2§ per¡odo de Experiˆncia"         
            Cdelimiter1 IF btab.log_consid_carg_turno_trab = YES THEN "S" ELSE "N"                   Cdelimiter2  //custom-string27           "BRA: Indicador se Considera Carga Autom Turno"                             
            Cdelimiter1 btab.log_recebe_insal                              Cdelimiter2  //health-risk               "BRA: Insalubridade"                            
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                               Cdelimiter2  //custom-string19           "BRA: Matr¡cula da Folha"                   
            Cdelimiter1 btab.num_niv_insal                                 Cdelimiter2  //custom-string1            "BRA: N¡vel da insalubridade"                   
            Cdelimiter1 btab.log_optan_fgts                                Cdelimiter2  //fgts-optant               "BRA: Optante FGTS"                             
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string7            "BRA: Pagamento em Ju¡zo (S/N)"                 
            Cdelimiter1 btab.log_recebe_pericul                            Cdelimiter2  //hazard                    "BRA: Periculosidade"                           
            Cdelimiter1 fgts-percent                                       Cdelimiter2  //fgts-percent              "BRA: Porcentagem do FGTS"                      
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-date1              "BRA: Prazo Determinado - Cl usula Assecurat¢ria"
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string12           "BRA: Situa‡Æo RAIS"                            
            Cdelimiter1 btab.cod_tip_mdo                                   Cdelimiter2  //custom-string18           "BRA: Tipo de MÆo de Obra"                            
            Cdelimiter1 ""                                                 Cdelimiter2  //holiday-calendar-code     "Calend rio de feriados"                        
            Cdelimiter1 btab.cod_rh_ccusto                                 Cdelimiter2  //cost-center               "Centro de custos"                              
            Cdelimiter1 Wdtatadmis                                         Cdelimiter2  //hireDate                  "Data de admissÆo"                              
            Cdelimiter1 ""                                                 Cdelimiter2  //positionEntryDate         "Data de entrada de posi‡Æo"                    
            Cdelimiter1 ""                                                 Cdelimiter2  //end-date                  "Data final" 
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-long3              "Dias afastados (dentro do ano fiscal)" 
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-long2              "Dias trabalhados (dentro do ano fiscal)" 
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-long1              "Dias trabalhados (desde a admissÆo)" 
            Cdelimiter1 IF AVAIL bsaf THEN bsaf.cdn_empres_orig ELSE ""    Cdelimiter2  //custom-string2            "Empresa Anterior"                               
            Cdelimiter1 btab.cdn_estab                                     Cdelimiter2  //location                  "Estabelecimento"                                     
            Cdelimiter1 IF AVAIL bsaf THEN bsaf.cdn_estab_orig ELSE ""     Cdelimiter2  //custom-string17           "Estabelecimento Anterior"                               
            Cdelimiter1 ""                                                 Cdelimiter2  //department                "Estrutura"                                           
            Cdelimiter1 "1"                                                Cdelimiter2  //fte                       "ETI"
            Cdelimiter1 "" /*btab.num_faixa_sal*/                          Cdelimiter2  //custom-string9            "Faixa salarial"                                
            Cdelimiter1 STRING(DAY(btab.dat_term_contrat_trab),'99') + "/" + STRING(MONTH(btab.dat_term_contrat_trab),'99') + "/" + STRING(YEAR(btab.dat_term_contrat_trab),'9999') Cdelimiter2  //probation-period-end-date "Fim do 1§ per¡odo de Experiˆncia"              
            Cdelimiter1 "America/Sao_Paulo"                                Cdelimiter2  //timezone                  "Fuso hor rio"                                  
            Cdelimiter1 "" /*btab.cdn_categ_sal*/                          Cdelimiter2  //pay-grade                 "Grade salarial"                                
            Cdelimiter1 bhs.qtd_hrs_categ_sal                              Cdelimiter2  //custom-double10           "Horas mensais trabalhadas"                                
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string13           "Inativar posi‡Æo?"                             
            Cdelimiter1 "HORARIO"                                          Cdelimiter2  //time-type-profile-code    "Perfil de tempos"                              
            Cdelimiter1 btab.cdn_turno_trab                                Cdelimiter2  //workschedule-code         "Plano de hor rio de trabalho"                  
            Cdelimiter1 ""                                                 Cdelimiter2  //contract-end-date         "Prazo de Contrato"                             
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string8            "Promo‡Æo por Substitui‡Æo?"                    
            Cdelimiter1 btab.cdn_sindicato                                 Cdelimiter2  //payScaleType              "Sindicato"                                     
            Cdelimiter1 TRUNCATE((TODAY - btab.dat_admis_func) / 365 ,0)   Cdelimiter2  //companyEntryDate          "Tempo na empresa"                              
            Cdelimiter1 btab.cod_unid_negoc                                Cdelimiter2  //business-unit             "Unidade de neg¢cios"                           
            Cdelimiter1 "DURATION"                                         Cdelimiter2  //time-recording-variant    "Variante de registro de horas" 
            Cdelimiter1 btab.cdn_vinc_empregat                             Cdelimiter2  //custom-string3            "BRA: Indicador se Funcion rio com V¡nculo"
            Cdelimiter1 ""                                                 Cdelimiter1  //operation                 "Opera‡Æo" */
            SKIP.   

        PUT UNFORMATTED
            Cdelimiter1 IF AVAIL bsp THEN bsp.cdn_categ_trab_sped ELSE 0   Cdelimiter2  //worker-category           "BRA: Categoria eSocial"  
            Cdelimiter1 btab.cdn_categ_sal                                 Cdelimiter2  //emp-relationship          "BRA: Categoria Salarial"                       
            Cdelimiter1 SUBSTRING(btab.cod_livre_2,37,2)                   Cdelimiter2  //custom-string14           "BRA: Categoria Trabalhador-Sefip"              
            Cdelimiter1 btab.cdn_clas_func                                 Cdelimiter2  //custom-string29           "BRA: C¢digo da Classe de Funcion rios para Ponto Eletr“nico"              
            Cdelimiter1 STRING(iAgentNociv)  + " - " + {varinc/var10126.i 04 iAgentNociv} /*btab.idi_tip_ocor_agent_nociv*/                      Cdelimiter2  //harmful-agent-exposure    "BRA: C¢digo de exposi‡Æo do agente prejudicial"
            Cdelimiter1 btab.cdn_local_marcac_cartao_pto                   Cdelimiter2  //custom-string28           "BRA: C¢digo do Local de Marca‡Æo"
            Cdelimiter1 IF btab.dat_ult_exam_medic = ? THEN Wdtatadmis ELSE STRING(DAY(btab.dat_ult_exam_medic),'99') + "/" + STRING(MONTH(btab.dat_ult_exam_medic),'99') + "/" + STRING(YEAR(btab.dat_ult_exam_medic),'9999') Cdelimiter2  //custom-date2              "BRA: Data do éltimo Exame M‚dico"
            Cdelimiter1 btab.idi_emite_cartao_pto                          Cdelimiter2  //custom-string26           "BRA: Emite CartÆo Ponto"
            Cdelimiter1 "AZ"                                               Cdelimiter2  //event-reason              "BRA: event-reason"                             
            Cdelimiter1 IF btab.log_recebe_13o_salario = YES THEN "Sim" ELSE "NÆo" Cdelimiter2  //custom-string24           "BRA: Indicador se Calcula 13. Sal rio"                             
            Cdelimiter1 IF btab.log_descta_contrib_sindic = YES THEN "S" ELSE "N"  Cdelimiter2  //custom-string23           "BRA: Indicador se Desconta Contrib. Sindical"                             
            Cdelimiter1 IF btab.log_estudan = YES THEN "S" ELSE "N"                Cdelimiter2  //custom-string21           "BRA: Indicador se Funcion rio Estudante"                             
            Cdelimiter1 IF btab.log_func_sindlz = YES THEN "S" ELSE "N"            Cdelimiter2  //custom-string22           "BRA: Indicador se Funcion rio Sindicalizado"                             
            Cdelimiter1 IF btab.log_recebe_ferias = YES THEN "S" ELSE "N"          Cdelimiter2  //custom-string25           "BRA: Indicador se Recebe F‚rias"                             
            Cdelimiter1 btab.cdn_localidade                                Cdelimiter2  //custom-string35           "BRA: Localidade"                             
            Cdelimiter1 IF AVAIL bsp THEN STRING(bsp.idi_natur_ativid_trab) + " - " + STRING(NaturAtivid) ELSE "0" Cdelimiter2  //custom-string16           "BRA: Natureza da Atividade eSocial"            
            Cdelimiter1 "1"                                                Cdelimiter2  //seq-number                "BRA: seq-number"                               
            Cdelimiter1 btab.idi_tip_func /*{DATABASE/inpy/i21py085.i 04 btab.idi_tip_func}*/    Cdelimiter2  //contract-type             "BRA: Tipo de contrato"                         
            Cdelimiter1 IF AVAIL bsp THEN bsp.idi_regim_jorn ELSE 0        Cdelimiter2  //custom-string6            "BRA: Tipo de Regime da Jornada"                
            Cdelimiter1 IF AVAIL bsp THEN STRING(bsp.idi_regim_previd) + " - " + STRING({database/ingt/i04gt181.i 04 bsp.idi_regim_previd}) ELSE "0" Cdelimiter2  //custom-string10           "BRA: Tipo de Regime Previdenci rio"            
            Cdelimiter1 btab.cdn_turma_trab                                Cdelimiter2  //custom-string20           "BRA: Turma"                            
            Cdelimiter1 btab.cod_unid_lotac                                Cdelimiter2  //custom-string5            "BRA: Unidade de lota‡Æo/Local F¡sico"          
            Cdelimiter1 btab.log_consid_rais                               Cdelimiter2  //commitment-indicator      "BRA: V¡nculo RAIS"
            Cdelimiter1 btab.cdn_cargo_basic                               Cdelimiter2  //job-code                  "Cargo"                                         
            Cdelimiter1 p-dt-golive                                        Cdelimiter2  //start-date                "Data do evento"                                
            Cdelimiter1 btab.cdn_empresa                                   Cdelimiter2  //company                   "Empresa"                                       
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                               Cdelimiter2  //user-id                   "ID do Usu rio"                                 
            Cdelimiter1 ""                                                 Cdelimiter2  //position                  "Posi‡Æo"                                       
            Cdelimiter1 IF AVAIL bexf THEN STRING(bexf.cdn_empresa) + '-' + STRING(bexf.cdn_estab) + '-' + FILL("0", 8 -  LENGTH(bexf.cdn_func_gestor)) + STRING(bexf.cdn_func_gestor) ELSE '0'  Cdelimiter2  //manager-id                "Supervisor"                                    
            Cdelimiter1 btab.cdn_clas_func                                 Cdelimiter2  //employee-class            "Tipo de colaborador"                           
            Cdelimiter1 ""                                                 Cdelimiter2  //attachment-id             "Anexo"                                     
            Cdelimiter1 ""                                                 Cdelimiter2  //notes                     "Anota‡äes"                                                                 
            Cdelimiter1 IF btab.idi_tip_func = 3 THEN "Yes" ELSE "No"      Cdelimiter2  //retired                   "BRA: Aposentado"                               
            Cdelimiter1 bcb.cod_classif_ocupac                             Cdelimiter2  //custom-string4            "BRA: CBO"                                      
            Cdelimiter1 STRING(DAY(btab.dat_opc_fgts),'99') + "/" + STRING(MONTH(btab.dat_opc_fgts),'99') + "/" + STRING(YEAR(btab.dat_opc_fgts),'9999') Cdelimiter2  //fgts-date                 "BRA: Data do FGTS"                             
            Cdelimiter1 ""                                                 Cdelimiter2  //expected-return-date      "BRA: expected-return-date"                     
            Cdelimiter1 IF btab.dat_term_prorrog_contrat_trab = ? THEN "" ELSE STRING(DAY(btab.dat_term_prorrog_contrat_trab),'99') + "/" + STRING(MONTH(btab.dat_term_prorrog_contrat_trab),'99') + "/" + STRING(YEAR(btab.dat_term_prorrog_contrat_trab),'9999')  Cdelimiter2  //custom-date6              "BRA: Fim do 2§ per¡odo de Experiˆncia"         
            Cdelimiter1 IF btab.log_consid_carg_turno_trab = YES THEN "S" ELSE "N"                   Cdelimiter2  //custom-string27           "BRA: Indicador se Considera Carga Autom Turno"                             
            Cdelimiter1 btab.log_recebe_insal                              Cdelimiter2  //health-risk               "BRA: Insalubridade"                            
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                               Cdelimiter2  //custom-string19           "BRA: Matr¡cula da Folha"                   
            Cdelimiter1 btab.num_niv_insal                                 Cdelimiter2  //custom-string1            "BRA: N¡vel da insalubridade"                   
            Cdelimiter1 btab.log_optan_fgts                                Cdelimiter2  //fgts-optant               "BRA: Optante FGTS"                             
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string7            "BRA: Pagamento em Ju¡zo (S/N)"                 
            Cdelimiter1 btab.log_recebe_pericul                            Cdelimiter2  //hazard                    "BRA: Periculosidade"                           
            Cdelimiter1 fgts-percent                                       Cdelimiter2  //fgts-percent              "BRA: Porcentagem do FGTS"                      
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-date1              "BRA: Prazo Determinado - Cl usula Assecurat¢ria"
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string12           "BRA: Situa‡Æo RAIS"                            
            Cdelimiter1 btab.cod_tip_mdo                                   Cdelimiter2  //custom-string18           "BRA: Tipo de MÆo de Obra"                            
            Cdelimiter1 ""                                                 Cdelimiter2  //holiday-calendar-code     "Calend rio de feriados"                        
            Cdelimiter1 btab.cod_rh_ccusto                                 Cdelimiter2  //cost-center               "Centro de custos"                              
            Cdelimiter1 Wdtatadmis                                         Cdelimiter2  //hireDate                  "Data de admissÆo"                              
            Cdelimiter1 ""                                                 Cdelimiter2  //positionEntryDate         "Data de entrada de posi‡Æo"                    
            Cdelimiter1 ""                                                 Cdelimiter2  //end-date                  "Data final" 
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-long3              "Dias afastados (dentro do ano fiscal)" 
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-long2              "Dias trabalhados (dentro do ano fiscal)" 
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-long1              "Dias trabalhados (desde a admissÆo)" 
            Cdelimiter1 IF AVAIL bsaf THEN bsaf.cdn_empres_orig ELSE ""    Cdelimiter2  //custom-string2            "Empresa Anterior"                               
            Cdelimiter1 btab.cdn_estab                                     Cdelimiter2  //location                  "Estabelecimento"                                     
            Cdelimiter1 IF AVAIL bsaf THEN bsaf.cdn_estab_orig ELSE ""     Cdelimiter2  //custom-string17           "Estabelecimento Anterior"                               
            Cdelimiter1 ""                                                 Cdelimiter2  //department                "Estrutura"                                           
            Cdelimiter1 "1"                                                Cdelimiter2  //fte                       "ETI"
            Cdelimiter1 "" /*btab.num_faixa_sal*/                          Cdelimiter2  //custom-string9            "Faixa salarial"                                
            Cdelimiter1 STRING(DAY(btab.dat_term_contrat_trab),'99') + "/" + STRING(MONTH(btab.dat_term_contrat_trab),'99') + "/" + STRING(YEAR(btab.dat_term_contrat_trab),'9999') Cdelimiter2  //probation-period-end-date "Fim do 1§ per¡odo de Experiˆncia"              
            Cdelimiter1 "America/Sao_Paulo"                                Cdelimiter2  //timezone                  "Fuso hor rio"                                  
            Cdelimiter1 "" /*btab.cdn_categ_sal*/                          Cdelimiter2  //pay-grade                 "Grade salarial"                                
            Cdelimiter1 bhs.qtd_hrs_categ_sal                              Cdelimiter2  //custom-double10           "Horas mensais trabalhadas"                                
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string13           "Inativar posi‡Æo?"                             
            Cdelimiter1 "HORARIO"                                          Cdelimiter2  //time-type-profile-code    "Perfil de tempos"                              
            Cdelimiter1 btab.cdn_turno_trab                                Cdelimiter2  //workschedule-code         "Plano de hor rio de trabalho"                  
            Cdelimiter1 ""                                                 Cdelimiter2  //contract-end-date         "Prazo de Contrato"                             
            Cdelimiter1 ""                                                 Cdelimiter2  //custom-string8            "Promo‡Æo por Substitui‡Æo?"                    
            Cdelimiter1 btab.cdn_sindicato                                 Cdelimiter2  //payScaleType              "Sindicato"                                     
            Cdelimiter1 TRUNCATE((TODAY - btab.dat_admis_func) / 365 ,0)   Cdelimiter2  //companyEntryDate          "Tempo na empresa"                              
            Cdelimiter1 btab.cod_unid_negoc                                Cdelimiter2  //business-unit             "Unidade de neg¢cios"                           
            Cdelimiter1 "DURATION"                                         Cdelimiter2  //time-recording-variant    "Variante de registro de horas" 
            Cdelimiter1 btab.cdn_vinc_empregat                             Cdelimiter2  //custom-string3            "BRA: Indicador se Funcion rio com V¡nnculo"
            Cdelimiter1 ""                                                 Cdelimiter1  //operation                 "Opera‡Æo" 
            SKIP.   


    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    




