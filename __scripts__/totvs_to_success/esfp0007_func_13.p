Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes de Documentos Pessoais                                           */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bcf  FOR contrat_func.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bcpf FOR compl_pessoa_fisic.
DEF BUFFER bsp  FOR sped_participan.

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

DEFINE VARIABLE h-acomp      AS HANDLE                NO-UNDO.
DEFINE VARIABLE i-cont       AS INT                   NO-UNDO.
DEFINE VARIABLE WContratacao AS CHAR                  NO-UNDO.
DEFINE VARIABLE cTipoVisto   AS CHAR                  NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES DOCUMENTOS PESSOAIS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '13 - Informacoes de Documentos Pessoais.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "document-number" Cdelimiter2  //document-number "Controle do registro"                         
            Cdelimiter1 "issue-date"      Cdelimiter2  //issue-date      "Data de Registro"                         
            Cdelimiter1 "user-id"         Cdelimiter2  //user-id         "ID do Usu†rio"                            
            Cdelimiter1 "country"         Cdelimiter2  //country         "Pa°s"                                     
            Cdelimiter1 "document-type"   Cdelimiter2  //document-type   "Tipo de documento"                                     
            Cdelimiter1 "custom-string11" Cdelimiter2  //custom-string11 "Cert. Reservista - Categoria"             
            Cdelimiter1 "custom-long7"    Cdelimiter2  //custom-long7    "Cert. Reservista - Data de Expediá∆o"     
            Cdelimiter1 "custom-string10" Cdelimiter2  //custom-string10 "Cert. Reservista - EspÇcie"               
            Cdelimiter1 "custom-string9"  Cdelimiter2  //custom-string9  "Cert. Reservista - N£mero"                
            Cdelimiter1 "custom-string7"  Cdelimiter2  //custom-string7  "CNH - Categoria"                          
            Cdelimiter1 "custom-date7"    Cdelimiter2  //custom-date7    "CNH - Data da Primeira Habilitaá∆o"       
            Cdelimiter1 "custom-date5"    Cdelimiter2  //custom-date5    "CNH - Data de Emiss∆o"                    
            Cdelimiter1 "custom-date6"    Cdelimiter2  //custom-date6    "CNH - Data de Validade"                   
            Cdelimiter1 "custom-string6"  Cdelimiter2  //custom-string6  "CNH - N£mero"                             
            Cdelimiter1 "custom-long6"    Cdelimiter2  //custom-long6    "CNH - UF de Expediá∆o"                    
            Cdelimiter1 "custom-string8"  Cdelimiter2  //custom-string8  "CNH - ‡rg∆o Emissor"                      
            Cdelimiter1 "custom-date3"    Cdelimiter2  //custom-date3    "CTPS - Data de Expediá∆o"                 
            Cdelimiter1 "custom-long2"    Cdelimiter2  //custom-long2    "CTPS - N£mero"                            
            Cdelimiter1 "custom-string4"  Cdelimiter2  //custom-string4  "CTPS - SÇrie"                             
            Cdelimiter1 "custom-long3"    Cdelimiter2  //custom-long3    "CTPS - UF de Expediá∆o"                   
            Cdelimiter1 "custom-string3"  Cdelimiter2  //custom-string3  "PIS"                                      
            Cdelimiter1 "custom-date2"    Cdelimiter2  //custom-date2    "PIS - Data de Emiss∆o"                    
            Cdelimiter1 "custom-date1"    Cdelimiter2  //custom-date1    "RG - Data de Emiss∆o"                     
            Cdelimiter1 "custom-string1"  Cdelimiter2  //custom-string1  "RG - Doc. de Identidade"                  
            Cdelimiter1 "ustom-long1"     Cdelimiter2  //ustom-long1     "RG - UF de Expediá∆o"                     
            Cdelimiter1 "custom-string2"  Cdelimiter2  //custom-string2  "RG - ‡rg∆o Emissor"                       
            Cdelimiter1 "custom-string12" Cdelimiter2  //custom-string12 "RNE - N£mero ID Estrangeiro"              
            Cdelimiter1 "custom-string13" Cdelimiter2  //custom-string13 "RNE - ‡rg∆o Emissor"                      
            Cdelimiter1 "custom-date4"    Cdelimiter2  //custom-date4    "T°tulo de Eleitor - Data de Expediá∆o"    
            Cdelimiter1 "custom-long4"    Cdelimiter2  //custom-long4    "T°tulo de Eleitor - N£mero"               
            Cdelimiter1 "custom-string5"  Cdelimiter2  //custom-string5  "T°tulo de Eleitor - Seá∆o Eleitoral"      
            Cdelimiter1 "custom-long5"    Cdelimiter2  //custom-long5    "T°tulo de Eleitor - Zona Eleitoral"       
            Cdelimiter1 "custom-string14" Cdelimiter2  //custom-string14 "Visto de estrangeiro - N£mero sÇrie visto"
            Cdelimiter1 "custom-string15" Cdelimiter1  //custom-string15 "Visto de estrangeiro - Tipo"              
            SKIP.  

        PUT UNFORMATTED
            Cdelimiter1 "Controle do registro*"                     Cdelimiter2
            Cdelimiter1 "Data de Registro*"                         Cdelimiter2  
            Cdelimiter1 "ID do Usu†rio*"                            Cdelimiter2  
            Cdelimiter1 "Pa°s*"                                     Cdelimiter2  
            Cdelimiter1 "Tipo de documento*"                        Cdelimiter2
            Cdelimiter1 "Cert. Reservista - Categoria"              Cdelimiter2  
            Cdelimiter1 "Cert. Reservista - Data de Expediá∆o"      Cdelimiter2  
            Cdelimiter1 "Cert. Reservista - EspÇcie"                Cdelimiter2  
            Cdelimiter1 "Cert. Reservista - N£mero"                 Cdelimiter2  
            Cdelimiter1 "CNH - Categoria"                           Cdelimiter2  
            Cdelimiter1 "CNH - Data da Primeira Habilitaá∆o"        Cdelimiter2  
            Cdelimiter1 "CNH - Data de Emiss∆o"                     Cdelimiter2  
            Cdelimiter1 "CNH - Data de Validade"                    Cdelimiter2  
            Cdelimiter1 "CNH - N£mero"                              Cdelimiter2  
            Cdelimiter1 "CNH - UF de Expediá∆o"                     Cdelimiter2  
            Cdelimiter1 "CNH - ‡rg∆o Emissor"                       Cdelimiter2  
            Cdelimiter1 "CTPS - Data de Expediá∆o"                  Cdelimiter2  
            Cdelimiter1 "CTPS - N£mero"                             Cdelimiter2  
            Cdelimiter1 "CTPS - SÇrie"                              Cdelimiter2  
            Cdelimiter1 "CTPS - UF de Expediá∆o"                    Cdelimiter2  
            Cdelimiter1 "PIS"                                       Cdelimiter2  
            Cdelimiter1 "PIS - Data de Emiss∆o"                     Cdelimiter2  
            Cdelimiter1 "RG - Data de Emiss∆o"                      Cdelimiter2  
            Cdelimiter1 "RG - Doc. de Identidade"                   Cdelimiter2  
            Cdelimiter1 "RG - UF de Expediá∆o"                      Cdelimiter2  
            Cdelimiter1 "RG - ‡rg∆o Emissor"                        Cdelimiter2  
            Cdelimiter1 "RNE - N£mero ID Estrangeiro"               Cdelimiter2  
            Cdelimiter1 "RNE - ‡rg∆o Emissor"                       Cdelimiter2  
            Cdelimiter1 "T°tulo de Eleitor - Data de Expediá∆o"     Cdelimiter2  
            Cdelimiter1 "T°tulo de Eleitor - N£mero"                Cdelimiter2  
            Cdelimiter1 "T°tulo de Eleitor - Seá∆o Eleitoral"       Cdelimiter2  
            Cdelimiter1 "T°tulo de Eleitor - Zona Eleitoral"        Cdelimiter2  
            Cdelimiter1 "Visto de Estrangeiro - N£mero sÇrie visto" Cdelimiter2  
            Cdelimiter1 "Visto de Estrangeiro - Tipo"               Cdelimiter1  
            SKIP.

    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bcf   OF btab NO-LOCK,
        FIRST bpf   OF btab NO-LOCK,
        FIRST bcpf  OF bpf  NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /***** Data Admiss∆o *****/
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        /***** Tipo de Visto *****/
        ASSIGN cTipoVisto = {database/inpy/i09py257.i 04 bpf.idi_tip_visto_estrang}.

        /***** Org∆o Emissor CNH *****/
        FIND FIRST bsp
             WHERE bsp.cdn_empresa         = btab.cdn_empresa
               AND bsp.cdn_estab           = btab.cdn_estab
               AND bsp.cdn_participan_sped = btab.cdn_funcionario NO-LOCK NO-ERROR.


        FIND FIRST rh_unid_federac NO-LOCK
            WHERE rh_unid_federac.cod_unid_federac_rh = btab.cod_unid_federac_cart_trab NO-ERROR.


        PUT UNFORMATTED
            Cdelimiter1 "1"                                                     Cdelimiter2  //document-number "Controle do registro"                         
            Cdelimiter1 WContratacao                                            Cdelimiter2  //issue-date      "Data de Registro"                         
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                    Cdelimiter2  //user-id         "ID do Usu†rio"                            
            Cdelimiter1 bpf.cod_pais_ender                                      Cdelimiter2  //country         "Pa°s"                                     
            Cdelimiter1 "Documentos Legais"                                     Cdelimiter2  //document-type   "Tipo de documento"                            
            Cdelimiter1 btab.cdn_regiao_milit                                   Cdelimiter2  //custom-string11 "Cert. Reservista - Categoria"             
            Cdelimiter1 ""                                                      Cdelimiter2  //custom-long7    "Cert. Reservista - Data de Expediá∆o"     
            Cdelimiter1 btab.cdn_circuns_milit                                  Cdelimiter2  //custom-string10 "Cert. Reservista - EspÇcie"               
            Cdelimiter1 btab.cod_docto_milit                                    Cdelimiter2  //custom-string9  "Cert. Reservista - N£mero"                
            Cdelimiter1 CAPS(TRIM(SUBSTR(btab.cod_categ_habilit, 1, 01)))       Cdelimiter2  //custom-string7  "CNH - Categoria"                          
            Cdelimiter1 STRING(DAY(bsp.dat_primei_cnh),'99') + "/" + STRING(MONTH(bsp.dat_primei_cnh),'99') + "/" + STRING(YEAR(bsp.dat_primei_cnh),'9999')                Cdelimiter2  //custom-date7    "CNH - Data da Primeira Habilitaá∆o"       
            Cdelimiter1 STRING(DAY(bsp.dat_expedic_cnh),'99') + "/" + STRING(MONTH(bsp.dat_expedic_cnh),'99') + "/" + STRING(YEAR(bsp.dat_expedic_cnh),'9999')             Cdelimiter2  //custom-date5    "CNH - Data de Emiss∆o"                    
            Cdelimiter1 STRING(DAY(btab.dat_vencto_habilit),'99') + "/" + STRING(MONTH(btab.dat_vencto_habilit),'99') + "/" + STRING(YEAR(btab.dat_vencto_habilit),'9999') Cdelimiter2  //custom-date6    "CNH - Data de Validade"                   
            Cdelimiter1 btab.num_cart_habilit                                   Cdelimiter2  //custom-string6  "CNH - N£mero"                             
            Cdelimiter1 TRIM(SUBSTR(btab.cod_livre_1,10,2))                     Cdelimiter2  //custom-long6    "CNH - UF de Expediá∆o"                    
            Cdelimiter1 IF AVAIL bsp THEN bsp.nom_emissor_cnh ELSE ""           Cdelimiter2  //custom-string8  "CNH - ‡rg∆o Emissor"                      
            Cdelimiter1 IF DATE(btab.dat_cart_trab) <> ? THEN STRING(DAY(btab.dat_cart_trab),'99') + "/" + STRING(MONTH(btab.dat_cart_trab),'99') + "/" + STRING(YEAR(btab.dat_cart_trab),'9999')      
                        ELSE STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999')        Cdelimiter2  //custom-date3    "CTPS - Data de Expediá∆o"                 
            Cdelimiter1 btab.cod_cart_trab                                      Cdelimiter2  //custom-long2    "CTPS - N£mero"                            
            Cdelimiter1 btab.cod_ser_cart_trab                                  Cdelimiter2  //custom-string4  "CTPS - SÇrie"                             
            Cdelimiter1 btab.cod_unid_federac_cart_trab + (IF AVAIL rh_unid_federac THEN rh_unid_federac.des_unid_federac_rh ELSE "")                        Cdelimiter2  /* custom-long3    "CTPS - UF de Expediá∆o" */.

        FIND FIRST rh_unid_federac NO-LOCK
            WHERE rh_unid_federac.cod_unid_federac_rh = bpf.cod_unid_federac_emis_estad NO-ERROR.

        PUT UNFORMATTED
            Cdelimiter1 btab.cod_pis                                            Cdelimiter2  //custom-string3  "PIS"                                      
            Cdelimiter1 STRING(DAY(btab.dat_pis_pasep),'99') + "/" + STRING(MONTH(btab.dat_pis_pasep),'99') + "/" + STRING(YEAR(btab.dat_pis_pasep),'9999')                Cdelimiter2  //custom-date2    "PIS - Data de Emiss∆o"  
            Cdelimiter1 IF DATE(bpf.dat_emis_id_estad_fisic) <> ? THEN STRING(DAY(bpf.dat_emis_id_estad_fisic),'99') + "/" + STRING(MONTH(bpf.dat_emis_id_estad_fisic),'99') + "/" + STRING(YEAR(bpf.dat_emis_id_estad_fisic),'9999')
                        ELSE "01/01/1900"                                       Cdelimiter2  //custom-date1    "RG - Data de Emiss∆o"                     
            Cdelimiter1 bpf.cod_id_estad_fisic                                  Cdelimiter2  //custom-string1  "RG - Doc. de Identidade"                  
            Cdelimiter1 bpf.cod_unid_federac_emis_estad + (IF AVAIL rh_unid_federac THEN rh_unid_federac.des_unid_federac_rh ELSE "")                        Cdelimiter2  //ustom-long1     "RG - UF de Expediá∆o"                     
            Cdelimiter1 bpf.cod_orgao_emis_id_estad                             Cdelimiter2  //custom-string2  "RG - ‡rg∆o Emissor"                       
            Cdelimiter1 bpf.cod_identde_estrang                                 Cdelimiter2  //custom-string12 "RNE - N£mero ID Estrangeiro"              
            Cdelimiter1 bcpf.cod_unid_federac_rne                               Cdelimiter2  //custom-string13 "RNE - ‡rg∆o Emissor"                      
            Cdelimiter1 "01/01/1900"                                            Cdelimiter2  //custom-date4    "T°tulo de Eleitor - Data de Expediá∆o"    
            Cdelimiter1 btab.cod_tit_eletral                                    Cdelimiter2  //custom-long4    "T°tulo de Eleitor - N£mero"               
            Cdelimiter1 btab.num_secao_tit_eletral                              Cdelimiter2  //custom-string5  "T°tulo de Eleitor - Seá∆o Eleitoral"      
            Cdelimiter1 btab.num_zona_tit_eletral                               Cdelimiter2  //custom-long5    "T°tulo de Eleitor - Zona Eleitoral"       
            Cdelimiter1 bpf.cod_identde_estrang                                 Cdelimiter2  //custom-string14 "Visto de estrangeiro - N£mero sÇrie visto"
            Cdelimiter1 cTipoVisto                                              Cdelimiter1  //custom-string15 "Visto de estrangeiro - Tipo"              
            SKIP.                                                                                                                    
                       
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    


