Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Estagiario-Aprendiz                                                          */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bcf  FOR contrat_func.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bsp  FOR sped_participan.
DEF BUFFER bpj  FOR rh_pessoa_jurid.
DEF BUFFER bcpf FOR compl_pessoa_fisic.
DEF BUFFER bspj FOR sped_rh_pessoa_jurid.
    
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

DEFINE VARIABLE h-acomp   AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont    AS INT    NO-UNDO.
DEFINE VARIABLE cTpFunc   AS CHAR   NO-UNDO.
DEFINE VARIABLE cNatEst   AS CHAR   NO-UNDO.
DEFINE VARIABLE cNivEst   AS CHAR   NO-UNDO.
DEFINE VARIABLE cNum      AS CHAR   NO-UNDO.
DEFINE VARIABLE cIbge     AS CHAR   NO-UNDO.
DEFINE VARIABLE DtInicial AS CHAR   NO-UNDO.
DEFINE VARIABLE DtFimEstg AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - ESTAGIµRIO APRENDIZ").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '22 - Estagiario-Aprendiz.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"                         Cdelimiter2  //"[OPERATOR]"                         "Operadores permitidos: Delimit Clear e Delete"
            Cdelimiter1 "externalCode"                       Cdelimiter2  //"externalCode"                       "externalCode"                                 
            Cdelimiter1 "externalName"                       Cdelimiter2  //"externalName"                       "externalName"                                 
            Cdelimiter1 "effectiveStartDate"                 Cdelimiter2  //"effectiveStartDate"                 "effectiveStartDate"                           
            Cdelimiter1 "cust_natureza_estagio.externalCode" Cdelimiter2  //"cust_natureza_estagio.externalCode" "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_nivel_estagio.externalCode"    Cdelimiter2  //"cust_nivel_estagio.externalCode"    "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_data_termino_estagio"          Cdelimiter2  //"cust_data_termino_estagio"          "Data TÇrmino do Est†gio"                      
            Cdelimiter1 "cust_razao_social.externalCode"     Cdelimiter2  //"cust_razao_social.externalCode"     "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_CNPJ"                          Cdelimiter2  //"cust_CNPJ"                          "CNPJ Insituiá∆o"                              
            Cdelimiter1 "cust_tipo_contrato.externalCode"    Cdelimiter2  //"cust_tipo_contrato.externalCode"    "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_logradouro"                    Cdelimiter2  //"cust_logradouro"                    "Logradouro Instituiá∆o"                       
            Cdelimiter1 "cust_numero"                        Cdelimiter2  //"cust_numero"                        "N£mero Instituiá∆o"                           
            Cdelimiter1 "cust_bairro"                        Cdelimiter2  //"cust_bairro"                        "Bairro Instituiá∆o"                           
            Cdelimiter1 "cust_cep"                           Cdelimiter2  //"cust_cep"                           "CEP Instituiá∆o"                              
            Cdelimiter1 "cust_codigo_municipio"              Cdelimiter2  //"cust_codigo_municipio"              "C¢digo do Munic°pio"                          
            Cdelimiter1 "cust_uf.externalCode"               Cdelimiter2  //"cust_uf.externalCode"               "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_cnpj_1"                        Cdelimiter2  //"cust_cnpj_1"                        "CNPJ"                                         
            Cdelimiter1 "cust_razao_social_1.externalCode"   Cdelimiter2  //"cust_razao_social_1.externalCode"   "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_endereco_1"                    Cdelimiter2  //"cust_endereco_1"                    "Endereáo"                                     
            Cdelimiter1 "cust_numero_1"                      Cdelimiter2  //"cust_numero_1"                      "N£mero"                                       
            Cdelimiter1 "cust_bairro_1"                      Cdelimiter2  //"cust_bairro_1"                      "Bairro"                                       
            Cdelimiter1 "cust_cep_1"                         Cdelimiter2  //"cust_cep_1"                         "CEP"                                          
            Cdelimiter1 "cust_codigo_municipio_1"            Cdelimiter2  //"cust_codigo_municipio_1"            "C¢digo do Munic°pio"                          
            Cdelimiter1 "cust_uf_1.externalCode"             Cdelimiter2  //"cust_uf_1.externalCode"             "Valor da lista de opá‰es.C¢digo externo"      
            Cdelimiter1 "cust_cpf"                           Cdelimiter2  //"cust_cpf"                           "CPF"                                          
            Cdelimiter1 "cust_nome_completo"                 Cdelimiter2  //"cust_nome_completo"                 "Nome Completo"                                
            Cdelimiter1 "cust_area_atuacao_estagio"          Cdelimiter1  //"cust_area_atuacao_estagio"          "µrea de Atuaá∆o do Est†gio"                   
            SKIP.    

        PUT UNFORMATTED
            Cdelimiter1 "Operadores permitidos: Delimit Clear e Delete" Cdelimiter2 
            Cdelimiter1 "ExternalCode*"                                 Cdelimiter2 
            Cdelimiter1 "ExternalName"                                  Cdelimiter2 
            Cdelimiter1 "Data Inicial Efetiva*"                         Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "Data TÇrmino do Est†gio"                       Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "CNPJ Insituiá∆o"                               Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "Logradouro Instituiá∆o"                        Cdelimiter2 
            Cdelimiter1 "N£mero Instituiá∆o"                            Cdelimiter2 
            Cdelimiter1 "Bairro Instituiá∆o"                            Cdelimiter2 
            Cdelimiter1 "CEP Instituiá∆o"                               Cdelimiter2 
            Cdelimiter1 "C¢digo do Munic°pio"                           Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "CNPJ"                                          Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "Endereáo"                                      Cdelimiter2 
            Cdelimiter1 "N£mero"                                        Cdelimiter2 
            Cdelimiter1 "Bairro"                                        Cdelimiter2 
            Cdelimiter1 "CEP"                                           Cdelimiter2 
            Cdelimiter1 "C¢digo do Munic°pio"                           Cdelimiter2 
            Cdelimiter1 "Valor da Lista de Opá‰es.C¢digo Externo"       Cdelimiter2 
            Cdelimiter1 "CPF"                                           Cdelimiter2 
            Cdelimiter1 "Nome Completo"                                 Cdelimiter2 
            Cdelimiter1 "µrea de Atuaá∆o do Est†gio"                    Cdelimiter1 
            SKIP.

        ASSIGN cTpFunc = ''.
        FOR EACH btab NO-LOCK
           WHERE btab.dat_desligto_func = ?
             AND btab.cdn_empresa       >= p-emp-ini
             AND btab.cdn_empresa       <= p-emp-fim 
             AND btab.cdn_estab         >= p-estab-ini
             AND btab.cdn_estab         <= p-estab-fim
             AND btab.cdn_funcionario   >= p-matricula-ini
             AND btab.cdn_funcionario   <= p-matricula-fim
             AND btab.dat_admis_func    >= p-dt-admissao
             AND (btab.idi_tip_func      = 2    //Estagiario
              OR  btab.idi_tip_func      = 7)   //Menor Aprendiz
              BY btab.idi_tip_func.
           FIND FIRST bpf OF btab NO-LOCK NO-ERROR.
           
           ASSIGN i-cont = i-cont + 1.
           RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

           /***** Separa Estagi†rio de Aprendiz *****/
           IF btab.idi_tip_func = 2 THEN ASSIGN cTpFunc = "Estagi†rio". ELSE "Aprendiz".
         
           /***** Natureza e N°vel do Est†gio *****/
           ASSIGN cNatEst = ''.
           FIND FIRST bsp
                WHERE bsp.cdn_empresa         = btab.cdn_empresa
                  AND bsp.cdn_estab           = btab.cdn_estab
                  AND bsp.cdn_participan_sped = btab.cdn_funcionario NO-LOCK NO-ERROR.
           
           /***** Localizar Pessoa Juridica - Instituiá∆o *****/
           ASSIGN cNum  = ''.
           FIND FIRST bpj 
                WHERE bpj.num_pessoa = bsp.num_instit_estag NO-LOCK NO-ERROR.
           IF AVAIL bpj THEN DO:           
              ASSIGN cNum = STRING(bpj.num_livre_1).
           END.

           /***** Localizar C¢digo Municipio IBGE Pessoa Fisica *****/
           FIND FIRST bcpf OF bpf NO-LOCK NO-ERROR.

           /***** Localizar C¢digo Municipio IBGE Pessoa Juridica *****/
           ASSIGN cIbge = ''.
           FIND FIRST bspj OF bpj NO-LOCK NO-ERROR.
           IF AVAIL bspj THEN DO:
              ASSIGN cIbge = STRING(bspj.cdn_munpio_ender).
           END.
           /***** Data Admiss∆o | Data TÇrmino Est†gio *****/
           ASSIGN DtInicial = STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999')
                  DtFimEstg = STRING(MONTH(btab.dat_term_contrat_trab),'99') + "/" + STRING(DAY(btab.dat_term_contrat_trab),'99') + "/" + STRING(YEAR(btab.dat_term_contrat_trab),'9999').

           PUT UNFORMATTED
               Cdelimiter1 "Delimit"                                                                                     Cdelimiter2  //"[OPERATOR]"                         "Operadores permitidos: Delimit Clear e Delete"
               cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                                                          Cdelimiter2  //"externalCode"                       "externalCode"                                 
               Cdelimiter1 bpf.nom_pessoa_fisic                                                                          Cdelimiter2  //"externalName"                       "externalName"                                 
               Cdelimiter1 DtInicial /*btab.dat_admis_func*/                                                             Cdelimiter2  //"effectiveStartDate"                 "effectiveStartDate"                           
               Cdelimiter1 IF btab.idi_tip_func = 2 THEN bsp.cod_natur_estag ELSE ''  /*btab.idi_natur_ativid*/          Cdelimiter2  //"cust_natureza_estagio.externalCode" "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 bsp.idi_niv_estag                                                                             Cdelimiter2  //"cust_nivel_estagio.externalCode"    "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 DtFimEstg /*btab.dat_term_contrat_trab*/                                                      Cdelimiter2  //"cust_data_termino_estagio"          "Data TÇrmino do Est†gio"                      
               Cdelimiter1 IF AVAIL bpj THEN bpj.nom_pessoa_jurid ELSE ''                                                Cdelimiter2  //"cust_razao_social.externalCode"     "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 IF AVAIL bpj THEN bpj.cod_id_feder ELSE ''                                                    Cdelimiter2  //"cust_CNPJ"                          "CNPJ Insituiá∆o"                              
               Cdelimiter1 ""/*bcf.idi_contrat_candempr*/                                                                Cdelimiter2  //"cust_tipo_contrato.externalCode"    "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 IF AVAIL bpj THEN bpj.nom_ender_rh ELSE ''                                                    Cdelimiter2  //"cust_logradouro"                    "Logradouro Instituiá∆o"                       
               Cdelimiter1 IF cNum <> '' THEN cNum ELSE '' /*IF AVAIL bpj THEN INT(bpj.num_livre_1) ELSE 0*/             Cdelimiter2  //"cust_numero"                        "N£mero Instituiá∆o"                           
               Cdelimiter1 IF AVAIL bpj THEN bpj.nom_bairro_rh ELSE ''                                                   Cdelimiter2  //"cust_bairro"                        "Bairro Instituiá∆o"                           
               Cdelimiter1 IF AVAIL bpj THEN SUBSTRING(bpj.cod_cep_rh,1,5) + '-' + SUBSTRING(bpj.cod_cep_rh,6,3) ELSE '' Cdelimiter2  //"cust_cep"                           "CEP Instituiá∆o"                              
               Cdelimiter1 IF cIbge <> '' THEN cIbge ELSE '' /*IF AVAIL bspj THEN bspj.cdn_munpio_ender ELSE 0*/         Cdelimiter2  //"cust_codigo_municipio"              "C¢digo do Munic°pio"                          
               Cdelimiter1 IF AVAIL bpj THEN bpj.cod_unid_federac_rh ELSE ''                                             Cdelimiter2  //"cust_uf.externalCode"               "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 ""                                                                                            Cdelimiter2  //"cust_cnpj_1"                        "CNPJ"                                         
               Cdelimiter1 ""                                                                                            Cdelimiter2  //"cust_razao_social_1.externalCode"   "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 bpf.nom_ender_rh                                                                              Cdelimiter2  //"cust_endereco_1"                    "Endereáo"                                     
               Cdelimiter1 INT(SUBSTR(bpf.cod_livre_1,66,8))                                                             Cdelimiter2  //"cust_numero_1"                      "N£mero"                                       
               Cdelimiter1 bpf.nom_bairro_rh                                                                             Cdelimiter2  //"cust_bairro_1"                      "Bairro"                                       
               Cdelimiter1 SUBSTRING(bpf.cod_cep_rh,1,5) + '-' + SUBSTRING(bpf.cod_cep_rh,6,3)                           Cdelimiter2  //"cust_cep_1"                         "CEP"                                          
               Cdelimiter1 STRING(bcpf.cdn_munpio_ender)+ ' - ' + STRING(bpf.nom_cidad_rh)                               Cdelimiter2  //"cust_codigo_municipio_1"            "C¢digo do Munic°pio"                          
               Cdelimiter1 bpf.cod_unid_federac_rh                                                                       Cdelimiter2  //"cust_uf_1.externalCode"             "Valor da lista de opá‰es.C¢digo externo"      
               Cdelimiter1 bpf.cod_id_feder                                                                              Cdelimiter2  //"cust_cpf"                           "CPF"                                          
               Cdelimiter1 bpf.nom_pessoa_fisic                                                                          Cdelimiter2  //"cust_nome_completo"                 "Nome Completo"                                
               Cdelimiter1 bsp.nom_area_atuac_estag                                                                      Cdelimiter1  //"cust_area_atuacao_estagio"          "µrea de Atuaá∆o do Est†gio"                   
               SKIP.                                                                                                                    
                          
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    


