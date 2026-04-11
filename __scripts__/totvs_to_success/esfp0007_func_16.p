Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Relacionamento Pessoal                                                       */
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

DEFINE VARIABLE h-acomp      AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont       AS INT    NO-UNDO.
DEFINE VARIABLE WContratacao AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - RELACIONAMENTO PESSOAL").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '16 - Relacionamento Pessoal.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "start-date"                    Cdelimiter2  //"start-date"                    "Data do evento"              
            Cdelimiter1 "custom-string1"                Cdelimiter2  //"custom-string1"                "Grau do Dependente"              
            Cdelimiter1 "related-person-id-external"    Cdelimiter2  //"related-person-id-external"    "ID externa do dependente"    
            Cdelimiter1 "USERID"                        Cdelimiter2  // "USERID"                       "Matr°cula"
            Cdelimiter1 "country"                       Cdelimiter2  //"country"                       "Pa°s/Regi∆o"                 
            Cdelimiter1 "relationship-type"             Cdelimiter2  //"relationship-type"             "Relaá∆o"                     
            Cdelimiter1 "zip-code"                      Cdelimiter2  //"zip-code"                      "CEP"                         
            Cdelimiter1 "city"                          Cdelimiter2  //"city"                          "Cidade"                      
            Cdelimiter1 "is-address-same-as-person"     Cdelimiter2  //"is-address-same-as-person"     "Copiar endereáo do empregado"
            Cdelimiter1 "address1"                      Cdelimiter2  //"address1"                      "Endereáo 1"                  
            Cdelimiter1 "address2"                      Cdelimiter2  //"address2"                      "Endereáo 2"                  
            Cdelimiter1 "address3"                      Cdelimiter2  //"address3"                      "Endereáo 3"                  
            Cdelimiter1 "state"                         Cdelimiter2  //"state"                         "Estado"                      
            Cdelimiter1 "county"                        Cdelimiter2  //"county"                        "Munic°pio"                   
            Cdelimiter1 "province"                      Cdelimiter2  //"province"                      "Prov°ncia"                   
            Cdelimiter1 "is-beneficiary"                Cdelimiter2  //"is-beneficiary"                "ê o benefici†rio"            
            Cdelimiter1 "operation"                     Cdelimiter1  //"operation"                     "Operaá∆o"                    //"effectiveStartDate" "Data inicial efetiva"                            
            SKIP.

        PUT UNFORMATTED
            Cdelimiter1 "Data do Evento*"               Cdelimiter2  
            Cdelimiter1 "Grau do Dependente*"           Cdelimiter2  
            Cdelimiter1 "ID Externa do Dependente*"     Cdelimiter2  
            Cdelimiter1 "Matr°cula*"                    Cdelimiter2  
            Cdelimiter1 "Pa°s/Regi∆o*"                  Cdelimiter2  
            Cdelimiter1 "Relaá∆o*"                      Cdelimiter2  
            Cdelimiter1 "CEP*"                          Cdelimiter2  
            Cdelimiter1 "Cidade*"                       Cdelimiter2  
            Cdelimiter1 "Copiar Endereáo do Empregado*" Cdelimiter2  
            Cdelimiter1 "Endereáo 1*"                   Cdelimiter2  
            Cdelimiter1 "Endereáo 2*"                   Cdelimiter2  
            Cdelimiter1 "Endereáo 3*"                   Cdelimiter2  
            Cdelimiter1 "Estado*"                       Cdelimiter2  
            Cdelimiter1 "Munic°pio"                     Cdelimiter2  
            Cdelimiter1 "Prov°ncia"                     Cdelimiter2  
            Cdelimiter1 "ê o Benefici†rio*"             Cdelimiter2  
            Cdelimiter1 "Operaá∆o"                      Cdelimiter1                           
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
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        PUT UNFORMATTED
            Cdelimiter1 WContratacao                                                                                             Cdelimiter2  //"start-date"                    "Data do evento"              
            Cdelimiter1 bdf.idi_grau_depen_func /*{DATABASE/inpy/i02py047.i 04 bdf.idi_grau_depen_func}*/                        Cdelimiter2  //"custom-string1"                "Grau do Dependente"               
            Cdelimiter1 bdf.cdn_depend_func                                                                                      Cdelimiter2  //"related-person-id-external"    "ID externa do dependente"    
            Cdelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario) Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"          
            Cdelimiter1 bpf.cod_pais                                                                                             Cdelimiter2  //"country"                       "Pa°s/Regi∆o"                 
            Cdelimiter1 TRIM({database/inpy/i02py047.i 04 bdf.idi_grau_depen_func})                                              Cdelimiter2  //"relationship-type"             "Relaá∆o"                     
            Cdelimiter1 SUBSTRING(bpf.cod_cep_rh,1,5) + '-' + SUBSTRING(bpf.cod_cep_rh,6,3)                                      Cdelimiter2  //"zip-code"                      "CEP"                         
            Cdelimiter1 TRIM(bpf.nom_cidad_rh)                                                                                   Cdelimiter2  //"city"                          "Cidade"                      
            Cdelimiter1 "Y"                                                                                                      Cdelimiter2  //"is-address-same-as-person"     "Copiar endereáo do empregado"
            Cdelimiter1 TRIM(bpf.nom_ender_rh)                                                                                   Cdelimiter2  //"address1"                      "Endereáo 1"                  
            Cdelimiter1 INT(SUBSTR(bpf.cod_livre_1,66,8))                                                                        Cdelimiter2  //"address2"                      "Endereáo 2"                                                                                         
            Cdelimiter1 TRIM(bpf.nom_pto_refer)                                                                                  Cdelimiter2  //"address3"                      "Endereáo 3"                  
            Cdelimiter1 TRIM(bpf.cod_unid_federac_rh)                                                                            Cdelimiter2  //"state"                         "Estado"                      
            Cdelimiter1 TRIM(bpf.nom_cidad_rh)                                                                                   Cdelimiter2  //"county"                        "Munic°pio"                   
            Cdelimiter1 TRIM(bpf.nom_bairro_rh)                                                                                  Cdelimiter2  //"province"                      "Prov°ncia"                   
            Cdelimiter1 IF bdf.idi_grau_depen_func = 4 THEN "Yes" ELSE "No"                                                      Cdelimiter2  //"is-beneficiary"                "ê o benefici†rio"            
            Cdelimiter1 ""                                                                                                       Cdelimiter1  //"operation"                     "Operaá∆o"                    //"effectiveStartDate" "Data inicial efetiva"                            
             SKIP.  
        
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    










