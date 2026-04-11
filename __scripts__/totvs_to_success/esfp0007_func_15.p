Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Dependentes Consolidados                                                     */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bcf  FOR contrat_func.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bdf  FOR depend_func.
DEF BUFFER bmun FOR rh_munpio.
DEF BUFFER bcpf FOR compl_pessoa_fisic.

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

DEFINE VARIABLE h-acomp      AS HANDLE  NO-UNDO.
DEFINE VARIABLE i-cont       AS INT     NO-UNDO.
DEFINE VARIABLE WContratacao AS CHAR    NO-UNDO.
DEFINE VARIABLE cIbge        AS CHAR    NO-UNDO.
DEFINE VARIABLE cEstadoCivil AS CHAR    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - DEPENDENTES CONSOLIDADOS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '15 - Dependentes Consolidados.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "personInfo.person-id-external"      Cdelimiter2  //"personInfo.person-id-external"      "Matricula"                                                                           
            Cdelimiter1 "related-person-id-external"         Cdelimiter2  //"related-person-id-external"         "C¢digo do Dependente"                                                                           
            Cdelimiter1 "is-beneficiary"                     Cdelimiter2  //"is-beneficiary"                     "ê o Benefici†rio"                                                                                   
            Cdelimiter1 "custom-string1"                     Cdelimiter2  //"custom-string1"                     "Grau do Dependente"                                                                                   
            Cdelimiter1 "start-date"                         Cdelimiter2  //"start-date"                         "Data do Evento"                                                                                     
            Cdelimiter1 "relationship-type"                  Cdelimiter2  //"relationship-type"                  "Relaá∆o"                                                                                            
            Cdelimiter1 "is-address-same-as-person"          Cdelimiter2  //"is-address-same-as-person"          "Copiar Endereáo do Empregado"                                                                       
            Cdelimiter1 "attachment-id"                      Cdelimiter2  //"attachment-id"                      "Anexos"                                                                                             
            Cdelimiter1 "operation"                          Cdelimiter2  //"operation"                          "Operaá∆o"                                                                                           
            Cdelimiter1 "person.custom-string1"              Cdelimiter2  //"person.custom-string1"              "Idade"                                                                                              
            Cdelimiter1 "person.date-of-birth"               Cdelimiter2  //"person.date-of-birth"               "Data de Nascimento"                                                                                 
            Cdelimiter1 "person.country-of-birth"            Cdelimiter2  //"person.country-of-birth"            "Pa°s de Nascimento"                                                                                 
            Cdelimiter1 "person.place-of-birth"              Cdelimiter2  //"person.place-of-birth"              "Cidade de Nascimento"                                                                                             
            Cdelimiter1 "person.region-of-birth"             Cdelimiter2  //"person.region-of-birth"             "Estado de Nascimento"                                                                                             
            Cdelimiter1 "personalInfo.custom-string2"        Cdelimiter2  //"personalInfo.custom-string2"        "Autorizaá∆o LGPD (Essa autorizaá∆o vale para todos os dados armazenados do colaborador no sistema)" 
            Cdelimiter1 "personalInfo.custom-string3"        Cdelimiter2  //"personalInfo.custom-string3"        "PCD?"                                                                                               
            Cdelimiter1 "personalInfo.first-name"            Cdelimiter2  //"personalInfo.first-name"            "Nome"                                                                                               
            Cdelimiter1 "personalInfo.last-name"             Cdelimiter2  //"personalInfo.last-name"             "Sobrenome"                                                                                          
            Cdelimiter1 "personalInfo.gender"                Cdelimiter2  //"personalInfo.gender"                "Sexo"                                                                                               
            Cdelimiter1 "personalInfo.marital-status"        Cdelimiter2  //"personalInfo.marital-status"        "Estado Civil"                                                                                       
            Cdelimiter1 "personalInfo.native-preferred-lang" Cdelimiter2  //"personalInfo.native-preferred-lang" "Idioma"                                                                                             
            Cdelimiter1 "personalInfo.nationality"           Cdelimiter2  //"personalInfo.nationality"           "Nacionalidade"                                                                                      
            Cdelimiter1 "personalInfo.preferred-name"        Cdelimiter2  //"personalInfo.preferred-name"        "Nome Social"                                                                                        
            Cdelimiter1 "personalInfo.display-name"          Cdelimiter2  //"personalInfo.display-name"          "Nome Completo"                                                                                      
            Cdelimiter1 "personalInfo.attachment-id"         Cdelimiter2  //"personalInfo.attachment-id"         "Anexo"                                                                                              
            Cdelimiter1 "nationalIdCard.custom-date1"        Cdelimiter2  //"nationalIdCard.custom-date1"        "Data de Emiss∆o"                                                                                    
            Cdelimiter1 "nationalIdCard.custom-date2"        Cdelimiter2  //"nationalIdCard.custom-date2"        "Data Validade"                                                                                      
            Cdelimiter1 "nationalIdCard.country"             Cdelimiter2  //"nationalIdCard.country"             "Pa°s"                                                                                               
            Cdelimiter1 "nationalIdCard.card-type"           Cdelimiter2  //"nationalIdCard.card-type"           "Tipo de Cart∆o de ID Nacional"                                                                      
            Cdelimiter1 "nationalIdCard.national-id"         Cdelimiter2  //"nationalIdCard.national-id"         "Documento"                                                                                        
            Cdelimiter1 "nationalIdCard.isPrimary"           Cdelimiter2  //"nationalIdCard.isPrimary"           "ê Principal"                                                                                         
            Cdelimiter1 "nationalIdCard.notes"               Cdelimiter2  //"nationalIdCard.notes"               "Anotaá‰es"                                                                                          
            Cdelimiter1 "address.address1"                   Cdelimiter2  //"address.address1"                   "Endereáo"                                                                                         
            Cdelimiter1 "address.address2"                   Cdelimiter2  //"address.address2"                   "N£mero"                                                                                         
            Cdelimiter1 "address.address3"                   Cdelimiter2  //"address.address3"                   "Complemento"                                                                                         
            Cdelimiter1 "address.city"                       Cdelimiter2  //"address.city"                       "Cidade"                                                                                             
            Cdelimiter1 "address.county"                     Cdelimiter2  //"address.county"                     "Munic°pio"                                                                                          
            Cdelimiter1 "address.state"                      Cdelimiter2  //"address.state"                      "Estado"                                                                                             
            Cdelimiter1 "address.province"                   Cdelimiter2  //"address.province"                   "Prov°ncia"                                                                                          
            Cdelimiter1 "address.zip-code"                   Cdelimiter2  //"address.zip-code"                   "CEP"                                                                                                
            Cdelimiter1 "address.country"                    Cdelimiter2  //"address.country"                    "Pa°s/Regi∆o"                                                                                        
            Cdelimiter1 "address.notes"                      Cdelimiter2  //"address.notes"                      "Anotaá‰es"                                                                                          
            Cdelimiter1 "address.custom-string1"             Cdelimiter2  //"address.custom-string1"             "Campo personalizado da string 1"                                                                                          
            Cdelimiter1 "address.address4"                   Cdelimiter2  //"address.address4"                   "Endereáo 4"                                                                    
            Cdelimiter1 "address.attachment-id"              Cdelimiter1  //"address.attachment-id"              "Anexos"                                                                                             
            SKIP.                                                                                                                    

        PUT UNFORMATTED
            Cdelimiter1 "Matr°cula*"                       Cdelimiter2 //"personInfo.person-id-external"      "Matricula"                                                                                                                                                    
            Cdelimiter1 "C¢digo do Dependente*"            Cdelimiter2 //"related-person-id-external"         "C¢digo do Dependente"                                                                                                                                          
            Cdelimiter1 "ê o Benefici†rio*"                Cdelimiter2 //"is-beneficiary"                     "ê o Benefici†rio"                                                                                                                                              
            Cdelimiter1 "Grau Dependente*"                 Cdelimiter2 //"custom-string1"                     "Grau do Dependente"                                                                                   
            Cdelimiter1 "Data do Evento*"                  Cdelimiter2 //"start-date"                         "Data do Evento"                                                                                                                                                
            Cdelimiter1 "Relaá∆o*"                         Cdelimiter2 //"relationship-type"                  "Relaá∆o"                                                                                                                                                       
            Cdelimiter1 "Copiar Endereáo do Empregado*"    Cdelimiter2 //"is-address-same-as-person"          "Copiar Endereáo do Empregado"                                                                                                                                  
            Cdelimiter1 "Anexos"                           Cdelimiter2 //"attachment-id"                      "Anexos"                                                                                                                                                        
            Cdelimiter1 "Operaá∆o"                         Cdelimiter2 //"operation"                          "Operaá∆o"                                                                                                                                                      
            Cdelimiter1 "Idade"                            Cdelimiter2 //"person.custom-string1"              "Idade"                                                                                                                                                         
            Cdelimiter1 "Data de Nascimento*"              Cdelimiter2 //"person.date-of-birth"               "Data de Nascimento"                                                                                                                                            
            Cdelimiter1 "Pa°s de Nascimento*"              Cdelimiter2 //"person.country-of-birth"            "Pa°s de Nascimento"                                                                                                                                            
            Cdelimiter1 "Cidade de Nascimento*"            Cdelimiter2 //"person.place-of-birth"              "Cidade de Nascimento"                                                                                                                                          
            Cdelimiter1 "Estado de Nascimento*"            Cdelimiter2 //"person.region-of-birth"             "Estado de Nascimento"                                                                                                                                          
            Cdelimiter1 "Autorizaá∆o LGPD"                 Cdelimiter2 //"personalInfo.custom-string2"        "Autorizaá∆o LGPD (Essa autorizaá∆o vale para todos os dados armazenados do colaborador no sistema)"   
            Cdelimiter1 "PCD?"                             Cdelimiter2 //"personalInfo.custom-string3"        "PCD?"                                                                                                                                                          
            Cdelimiter1 "Nome*"                            Cdelimiter2 //"personalInfo.first-name"            "Nome"                                                                                                                                                          
            Cdelimiter1 "Sobrenome*"                       Cdelimiter2 //"personalInfo.last-name"             "Sobrenome"                                                                                                                                                     
            Cdelimiter1 "Sexo*"                            Cdelimiter2 //"personalInfo.gender"                "Sexo"                                                                                                                                                          
            Cdelimiter1 "Estado Civil*"                    Cdelimiter2 //"personalInfo.marital-status"        "Estado Civil"                                                                                                                                                  
            Cdelimiter1 "Idioma"                           Cdelimiter2 //"personalInfo.native-preferred-lang" "Idioma"                                                                                                                                                        
            Cdelimiter1 "Nacionalidade*"                   Cdelimiter2 //"personalInfo.nationality"           "Nacionalidade"                                                                                                                                                 
            Cdelimiter1 "Nome Social"                      Cdelimiter2 //"personalInfo.preferred-name"        "Nome Social"                                                                                                                                                   
            Cdelimiter1 "Nome Completo"                    Cdelimiter2 //"personalInfo.display-name"          "Nome Completo"                                                                                                                                                 
            Cdelimiter1 "Anexo"                            Cdelimiter2 //"personalInfo.attachment-id"         "Anexo"                                                                                                                                                         
            Cdelimiter1 "Data de Emiss∆o"                  Cdelimiter2 //"nationalIdCard.custom-date1"        "Data de Emiss∆o"                                                                                                                                               
            Cdelimiter1 "Data Validade"                    Cdelimiter2 //"nationalIdCard.custom-date2"        "Data Validade"                                                                                                                                                 
            Cdelimiter1 "Pa°s*"                            Cdelimiter2 //"nationalIdCard.country"             "Pa°s"                                                                                                                                                          
            Cdelimiter1 "Tipo de Cart∆o de ID Nacional*"   Cdelimiter2 //"nationalIdCard.card-type"           "Tipo de Cart∆o de ID Nacional"                                                                                                                                 
            Cdelimiter1 "Documento*"                       Cdelimiter2 //"nationalIdCard.national-id"         "Documento"                                                                                                                                                     
            Cdelimiter1 "ê Principal*"                     Cdelimiter2 //"nationalIdCard.isPrimary"           "ê Principal"                                                                                                                                                   
            Cdelimiter1 "Anotaá‰es"                        Cdelimiter2 //"nationalIdCard.notes"               "Anotaá‰es"                                                                                                                                                     
            Cdelimiter1 "Endereáo*"                        Cdelimiter2 //"address.address1"                   "Endereáo"                                                                                                                                                      
            Cdelimiter1 "N£mero*"                          Cdelimiter2 //"address.address2"                   "N£mero"                                                                                                                                                        
            Cdelimiter1 "Complemento*"                     Cdelimiter2 //"address.address3"                   "Complemento"                                                                                                                                                   
            Cdelimiter1 "Cidade*"                          Cdelimiter2 //"address.city"                       "Cidade"                                                                                                                                                        
            Cdelimiter1 "Munic°pio"                        Cdelimiter2 //"address.county"                     "Munic°pio"                                                                                                                                                     
            Cdelimiter1 "Estado*"                          Cdelimiter2 //"address.state"                      "Estado"                                                                                                                                                        
            Cdelimiter1 "Prov°ncia"                        Cdelimiter2 //"address.province"                   "Prov°ncia"                                                                                                                                                     
            Cdelimiter1 "CEP*"                             Cdelimiter2 //"address.zip-code"                   "CEP"                                                                                                                                                           
            Cdelimiter1 "Pa°s/Regi∆o*"                     Cdelimiter2 //"address.country"                    "Pa°s/Regi∆o"                                                                                                                                                   
            Cdelimiter1 "Anotaá‰es"                        Cdelimiter2 //"address.notes"                      "Anotaá‰es"                                                                                                                                                     
            Cdelimiter1 "Tipo de Logradouro*"              Cdelimiter2 //"address.custom-string1"             "Campo personalizado da string 1"                                                                                                                               
            Cdelimiter1 "Endereáo4*"                       Cdelimiter2 //"address.address4"                   "Endereáo 4"                                                                                                                                                    
            Cdelimiter1 "Anexos"                           Cdelimiter1 //"address.attachment-id"              "Anexos"                                                                                                                                                        
            SKIP.

    ASSIGN cEstadoCivil = ''.
    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bpf OF btab NO-LOCK,
        FIRST bcpf OF bpf NO-LOCK,
        EACH  bdf OF btab NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).
                                                       
        /***** Data Admiss∆o *****/
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        /***** C¢digo Municipio IBGE Dependentes *****/
        FIND FIRST bmun 
             WHERE bmun.cod_unid_federac_rh = bdf.cod_unid_federac_nasc
               AND bmun.cod_pais            = bdf.cod_pais_nasc            
               AND bmun.des_munpio_sped     = bdf.nom_cidad_nasc_depend NO-LOCK NO-ERROR.
        IF AVAIL bmun THEN DO: 
           ASSIGN cIbge = STRING(bmun.cdn_munpio_sped).
        END.

        IF bdf.num_livre_2 = 0 THEN ASSIGN cEstadoCivil = "Solteiro".
        IF bdf.num_livre_2 = 1 THEN ASSIGN cEstadoCivil = "Casado".
        IF bdf.num_livre_2 = 3 THEN ASSIGN cEstadoCivil = "Divorciado".
        IF bdf.num_livre_2 = 4 THEN ASSIGN cEstadoCivil = "Vi£vo".
        
        PUT UNFORMATTED
            Cdelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)   Cdelimiter2 //"personInfo.person-id-external"      "Matricula"                                                                                                                                                    
            Cdelimiter1 bdf.cdn_depend                                                                                                                      Cdelimiter2 //"related-person-id-external"         "C¢digo do Dependente"                                                                                                                                          
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"is-beneficiary"                     "ê o Benefici†rio"                                                                                                                                              
            Cdelimiter1 STRING(bdf.idi_grau_depen_func) + '-' + {DATABASE/inpy/i02py047.i 04 bdf.idi_grau_depen_func}                                       Cdelimiter2 //"custom-string1"                     "Grau do Dependente"                                                                                   
            Cdelimiter1 WContratacao                                                                                                                        Cdelimiter2 //"start-date"                         "Data do Evento"                                                                                                                                                
            Cdelimiter1 {DATABASE/inpy/i02py047.i 04 bdf.idi_grau_depen_func}                                                                               Cdelimiter2 //"relationship-type"                  "Relaá∆o"                                                                                                                                                       
            Cdelimiter1 TRIM(bpf.nom_ender_rh)                                                                                                              Cdelimiter2 //"is-address-same-as-person"          "Copiar Endereáo do Empregado"                                                                                                                                  
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"attachment-id"                      "Anexos"                                                                                                                                                        
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"operation"                          "Operaá∆o"                                                                                                                                                      
            Cdelimiter1 TRUNCATE((TODAY - bdf.dat_nascimento) / 365, 0)                                                                                     Cdelimiter2 //"person.custom-string1"              "Idade"                                                                                                                                                         
            Cdelimiter1 STRING(DAY(bdf.dat_nascimento),'99') + "/" + STRING(MONTH(bdf.dat_nascimento),'99') + "/" + STRING(YEAR(bdf.dat_nascimento),'9999') Cdelimiter2 //"person.date-of-birth"               "Data de Nascimento"                                                                                                                                            
            Cdelimiter1 bdf.cod_pais_nasc                                                                                                                   Cdelimiter2 //"person.country-of-birth"            "Pa°s de Nascimento"                                                                                                                                            
            Cdelimiter1 bdf.nom_cidad_nasc_depend                                                                                                           Cdelimiter2 //"person.place-of-birth"              "Cidade de Nascimento"                                                                                                                                          
            Cdelimiter1 bdf.cod_unid_federac_nasc                                                                                                           Cdelimiter2 //"person.region-of-birth"             "Estado de Nascimento"                                                                                                                                          
            Cdelimiter1 "No"                                                                                                                                Cdelimiter2 //"personalInfo.custom-string2"        "Autorizaá∆o LGPD (Essa autorizaá∆o vale para todos os dados armazenados do colaborador no sistema)"   
            Cdelimiter1 IF bpf.log_livre_1 = YES THEN "Sim" ELSE "N∆o"                                                                                      Cdelimiter2 //"personalInfo.custom-string3"        "PCD?"                                                                                                                                                          
            Cdelimiter1 IF bdf.nom_depend_func <> '' THEN TRIM(ENTRY(1, bdf.nom_depend_func, ' ')) ELSE ''                                                  Cdelimiter2 //"personalInfo.first-name"            "Nome"                                                                                                                                                          
            Cdelimiter1 IF bdf.nom_depend_func <> '' THEN TRIM(SUBSTR(bdf.nom_depend_func, LENGTH(ENTRY(1, bdf.nom_depend_func, ' ')) + 1, 1000)) ELSE ''   Cdelimiter2 //"personalInfo.last-name"             "Sobrenome"                                                                                                                                                     
            Cdelimiter1 (IF bdf.idi_sexo = 1 THEN "M" ELSE "F")                                                                                             Cdelimiter2 //"personalInfo.gender"                "Sexo"                                                                                                                                                          
            Cdelimiter1 cEstadoCivil                                                                                                                        Cdelimiter2 //"personalInfo.marital-status"        "Estado Civil"                                                                                                                                                  
            Cdelimiter1 "Portuguàs"                                                                                                                         Cdelimiter2 //"personalInfo.native-preferred-lang" "Idioma"                                                                                                                                                        
            Cdelimiter1 bcpf.cod_pais_nacion                                                                                                                Cdelimiter2 //"personalInfo.nationality"           "Nacionalidade"                                                                                                                                                 
            Cdelimiter1 IF bdf.nom_depend_func <> '' THEN TRIM(ENTRY(1, bdf.nom_depend_func, ' ')) ELSE ''                                                  Cdelimiter2 //"personalInfo.preferred-name"        "Nome Social"                                                                                                                                                   
            Cdelimiter1 bdf.nom_depend_func                                                                                                                 Cdelimiter2 //"personalInfo.display-name"          "Nome Completo"                                                                                                                                                 
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"personalInfo.attachment-id"         "Anexo"                                                                                                                                                         
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"nationalIdCard.custom-date1"        "Data de Emiss∆o"                                                                                                                                               
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"nationalIdCard.custom-date2"        "Data Validade"                                                                                                                                                 
            Cdelimiter1 "BRA"                                                                                                                               Cdelimiter2 //"nationalIdCard.country"             "Pa°s"                                                                                                                                                          
            Cdelimiter1 IF SUBSTR(bdf.cod_livre_1,1,11) <> bpf.cod_id_feder THEN "CPF" ELSE ""                                                              Cdelimiter2 //"nationalIdCard.card-type"           "Tipo de Cart∆o de ID Nacional"                                                                                                                                 
            Cdelimiter1 /*bpf.cod_id_feder*/ SUBSTRING(bdf.cod_livre_1,01,20)                                                                               Cdelimiter2 //"nationalIdCard.national-id"         "Documento"                                                                                                                                                     
            Cdelimiter1 IF TRIM(SUBSTR(bdf.cod_livre_1,1,11)) <> bpf.cod_id_feder THEN "Yes" ELSE "No"                                                      Cdelimiter2 //"nationalIdCard.isPrimary"           "ê Principal"                                                                                                                                                   
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"nationalIdCard.notes"               "Anotaá‰es"                                                                                                                                                     
            Cdelimiter1 TRIM(bpf.nom_ender_rh)                                                                                                              Cdelimiter2 //"address.address1"                   "Endereáo"                                                                                                                                                      
            Cdelimiter1 INT(SUBSTR(bpf.cod_livre_1,66,8))                                                                                                   Cdelimiter2 //"address.address2"                   "N£mero"                                                                                                                                                        
            Cdelimiter1 TRIM(bpf.nom_pto_refer)                                                                                                             Cdelimiter2 //"address.address3"                   "Complemento"                                                                                                                                                   
            Cdelimiter1 bpf.nom_cidad_rh                                                                                                                    Cdelimiter2 //"address.city"                       "Cidade"                                                                                                                                                        
            Cdelimiter1 TRIM(bpf.nom_cidad_rh)                                                                                                              Cdelimiter2 //"address.county"                     "Munic°pio"                                                                                                                                                     
            Cdelimiter1 TRIM(bpf.cod_unid_federac_rh)                                                                                                       Cdelimiter2 //"address.state"                      "Estado"                                                                                                                                                        
            Cdelimiter1 TRIM(bpf.nom_bairro_rh)                                                                                                             Cdelimiter2 //"address.province"                   "Prov°ncia"                                                                                                                                                     
            Cdelimiter1 SUBSTRING(bpf.cod_cep_rh,1,5) + '-' + SUBSTRING(bpf.cod_cep_rh,6,3)                                                                 Cdelimiter2 //"address.zip-code"                   "CEP"                                                                                                                                                           
            Cdelimiter1 bpf.cod_pais                                                                                                                        Cdelimiter2 //"address.country"                    "Pa°s/Regi∆o"                                                                                                                                                   
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"address.notes"                      "Anotaá‰es"                                                                                                                                                     
            Cdelimiter1 bcpf.cod_tip_lograd                                                                                                                 Cdelimiter2 //"address.custom-string1"             "Campo personalizado da string 1"                                                                                                                               
            Cdelimiter1 ""                                                                                                                                  Cdelimiter2 //"address.address4"                   "Endereáo 4"                                                                                                                                                    
            Cdelimiter1 ""                                                                                                                                  Cdelimiter1 //"address.attachment-id"              "Anexos"                                                                                                                                                        
            SKIP.
                       
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.   




