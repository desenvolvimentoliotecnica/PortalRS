Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes Globais                                                          */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bdf  FOR depend_func.
DEF BUFFER bfm  FOR ficha_medic.
DEF BUFFER bdp  FOR defcncia_pacien.
DEF BUFFER bdfi FOR defcncia_fisic.
DEF BUFFER bgi  FOR grau_instruc.
DEF BUFFER bcpf FOR compl_pessoa_fisic.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEF VAR genericNumber1  AS CHAR NO-UNDO.
DEF VAR c-pai           AS CHAR NO-UNDO.
DEF VAR c-mae           AS CHAR NO-UNDO.
DEF VAR genericString9  AS CHAR NO-UNDO.
DEF VAR WContratacao    AS CHAR NO-UNDO.
DEF VAR cReabilitado    AS CHAR NO-UNDO.

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
DEFINE VARIABLE cFisica  AS CHAR   NO-UNDO.
DEFINE VARIABLE cVisual  AS CHAR   NO-UNDO.
DEFINE VARIABLE cMental  AS CHAR   NO-UNDO.
DEFINE VARIABLE cAuditvo AS CHAR   NO-UNDO.
DEFINE VARIABLE cCodDef  AS CHAR   NO-UNDO.
DEFINE VARIABLE iContDef AS INT    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES GLOBAIS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '5 - Informacoes Globais.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "genericString9"                 Cdelimiter2  //"genericString9"                "BRA: Grau de instruá∆o"                               
            Cdelimiter1 "custom-string4"                 Cdelimiter2  //"custom-string4"                "BRA: Nome da m∆e"                                     
            Cdelimiter1 "genericNumber1"                 Cdelimiter2  //"genericNumber1"                "BRA: Raáa"                                            
            Cdelimiter1 "start-date"                     Cdelimiter2  //"start-date"                    "Data do evento"                                       
            Cdelimiter1 "personInfo.person-id-external"  Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"                                   
            Cdelimiter1 "country"                        Cdelimiter2  //"country"                       "Pa°s/Regi∆o"                                          
            Cdelimiter1 "custom-string2"                 Cdelimiter2  //"custom-string2"                "BRA: Aposentadoria"                                   
            Cdelimiter1 "genericDate10"                  Cdelimiter2  //"genericDate10"                 "BRA: Aposentadoria do INSS"                           
            Cdelimiter1 "genericNumber3"                 Cdelimiter2  //"genericNumber3"                "BRA: Cidad∆o naturalizado"                            
            Cdelimiter1 "custom-date1"                   Cdelimiter2  //"custom-date1"                  "BRA: Data da Aposentadoria"                           
            Cdelimiter1 "genericDate5"                   Cdelimiter2  //"genericDate5"                  "BRA: Data de Chegada ao Pa°s"                         
            Cdelimiter1 "genericDate1"                   Cdelimiter2  //"genericDate1"                  "BRA: Data de conhecimento"                            
            Cdelimiter1 "genericDate7"                   Cdelimiter2  //"genericDate7"                  "BRA: Data de naturalizaá∆o"                           
            Cdelimiter1 "custom-string12"                Cdelimiter2  //"custom-string12"               "BRA: Deficiància Auditiva"                            
            Cdelimiter1 "custom-string10"                Cdelimiter2  //"custom-string10"               "BRA: Deficiància F°sica"                              
            Cdelimiter1 "custom-string13"                Cdelimiter2  //"custom-string13"               "BRA: Deficiància Mental"                              
            Cdelimiter1 "custom-string11"                Cdelimiter2  //"custom-string11"               "BRA: Deficiància Visual"                              
            Cdelimiter1 "custom-string1"                 Cdelimiter2  //"custom-string1"                "BRA: Entregou Cart∆o de Vacina?"                      
            Cdelimiter1 "genericString13"                Cdelimiter2  //"genericString13"               "BRA: Escola"                                         
            Cdelimiter1 "genericString2"                 Cdelimiter2  //"genericString2"                "BRA: Grupo de deficiància f°sica"                     
            Cdelimiter1 "custom-string5"                 Cdelimiter2  //"custom-string5"                "BRA: Nome do pai"                                     
            Cdelimiter1 "genericString15"                Cdelimiter2  //"genericString15"               "BRA: Reabilitado"                                     
            Cdelimiter1 "genericNumber16"                Cdelimiter2  //"genericNumber16"               "BRA: Recebimento de benef°cio de seguro desemprego"   
            Cdelimiter1 "custom-string3"                 Cdelimiter2  //"custom-string3"                "BRA: Tipo de Aposentadoria"                           
            Cdelimiter1 "genericString3"                 Cdelimiter2  //"genericString3"                "BRA: Tipo de deficiància"                             
            Cdelimiter1 "genericString5"                 Cdelimiter2  //"genericString5"                "BRA: Tipo de visto"                                   
            Cdelimiter1 "genericNumber14"                Cdelimiter2  //"genericNumber14"               "BRA: Trabalhador Estrangeiro com Cìnjuge Brasileiro/a"
            Cdelimiter1 "genericNumber15"                Cdelimiter2  //"genericNumber15"               "BRA: Trabalhador Estrangeiro com Filhos Brasileiros"  
            Cdelimiter1 "operation"                      Cdelimiter1  //"operation"                     "Operaá∆o"                                            
            SKIP.

        PUT UNFORMATTED
            Cdelimiter1 "BRA: Grau de Instruá∆o*"                                Cdelimiter2  
            Cdelimiter1 "BRA: Nome da M∆e*"                                      Cdelimiter2  
            Cdelimiter1 "BRA: Raáa*"                                             Cdelimiter2  
            Cdelimiter1 "Data do Evento*"                                        Cdelimiter2  
            Cdelimiter1 "ID Pessoal Externa*"                                    Cdelimiter2  
            Cdelimiter1 "Pa°s/Regi∆o*"                                           Cdelimiter2  
            Cdelimiter1 "BRA: Aposentadoria"                                     Cdelimiter2  
            Cdelimiter1 "BRA: Aposentadoria do INSS"                             Cdelimiter2
            Cdelimiter1 "BRA: Cidad∆o Naturalizado"                              Cdelimiter2  
            Cdelimiter1 "BRA: Data da Aposentadoria"                             Cdelimiter2  
            Cdelimiter1 "BRA: Data de Chegada ao Pa°s"                           Cdelimiter2  
            Cdelimiter1 "BRA: Data de Conhecimento"                              Cdelimiter2  
            Cdelimiter1 "BRA: Data de Naturalizaá∆o"                             Cdelimiter2  
            Cdelimiter1 "BRA: Deficiància Auditiva"                              Cdelimiter2  
            Cdelimiter1 "BRA: Deficiància F°sica"                                Cdelimiter2  
            Cdelimiter1 "BRA: Deficiància Mental"                                Cdelimiter2  
            Cdelimiter1 "BRA: Deficiància Visual"                                Cdelimiter2  
            Cdelimiter1 "BRA: Entregou Cart∆o de Vacina?"                        Cdelimiter2  
            Cdelimiter1 "BRA: Escola"                                            Cdelimiter2  
            Cdelimiter1 "BRA: Grupo de Deficiància F°sica"                       Cdelimiter2  
            Cdelimiter1 "BRA: Nome do pai"                                       Cdelimiter2  
            Cdelimiter1 "BRA: Reabilitado"                                       Cdelimiter2  
            Cdelimiter1 "BRA: Recebimento de Benef°cio de Seguro Desemprego"     Cdelimiter2  
            Cdelimiter1 "BRA: Tipo de Aposentadoria"                             Cdelimiter2  
            Cdelimiter1 "BRA: Tipo de Deficiància"                               Cdelimiter2  
            Cdelimiter1 "BRA: Tipo de Visto"                                     Cdelimiter2  
            Cdelimiter1 "BRA: Trabalhador Estrangeiro com Cìnjuge Brasileiro(a)" Cdelimiter2  
            Cdelimiter1 "BRA: Trabalhador Estrangeiro com Filhos Brasileiros"    Cdelimiter2  
            Cdelimiter1 "Operaá∆o"                                               Cdelimiter1  
            SKIP.
    
    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bpf OF btab NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /*assign genericNumber1 = ''.
        case bpf.idi_cor_cutis:
            when 1 then genericNumber1 = 'Caucasian'.
            when 2 then genericNumber1 = 'Black'.
            when 3 then genericNumber1 = 'Mulato' /* 'Brown' */ .
            when 4 then genericNumber1 = 'Yellow' /* 'Asian' */ .
            when 5 then genericNumber1 = 'Not Entered'.
            when 6 then genericNumber1 = 'Indigenous'.
            otherwise genericNumber1 = 'Not Entered'.
        end.*/

        ASSIGN c-pai = ''
               c-mae = ''.
        FOR EACH bdf OF btab NO-LOCK.
            if {database/inpy/i02py047.i 04 bdf.idi_grau_depen_func} = "Pais" then do:
                if bdf.idi_sexo = 1 then ASSIGN c-pai = trim(bdf.nom_depend_func).
                else assign c-mae = trim(bdf.nom_depend_func).
            end. /* if {database/inpy/i02py047.i 04 bdf.idi_grau_depen_func} = "Pais" then do: */
        END.
        IF c-mae = '' THEN
            assign c-mae = trim(bpf.nom_mae_pessoa_fis).
        
        /***** Grau de Instruá∆o *****/
        FIND bgi WHERE bgi.cdn_grau_instruc = bpf.cdn_grau_instruc NO-LOCK NO-ERROR.

        /***** Data Admiss∆o *****/
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        /***** Verifica Portador de Deficiencia *****/
        FIND FIRST bfm OF bpf NO-LOCK NO-ERROR.
        ASSIGN cMental  = ''
               cAuditvo = ''
               cFisica  = ''
               cVisual  = ''
               cCodDef  = ''
               iContDef = 0.
        FOR EACH bdp
           WHERE bdp.num_ficha_medic = bfm.num_ficha_medic NO-LOCK:

           ASSIGN iContDef = iContDef + 1.
           
           FIND FIRST bdfi
                WHERE bdfi.cod_defcncia_fisic = bdp.cod_defcncia NO-LOCK NO-ERROR.
           IF AVAIL bdfi THEN DO:
                      
              IF {database/inpm/i01pm527.i 4 bdfi.idi_tip_defcncia_fisic} = "Mental" THEN DO:
                 ASSIGN cMental = "Sim".
              END.
              IF {database/inpm/i01pm527.i 4 bdfi.idi_tip_defcncia_fisic} = "Auditiva" THEN DO:
                 ASSIGN cAuditvo = "Sim". 
              END.
              IF {database/inpm/i01pm527.i 4 bdfi.idi_tip_defcncia_fisic} = "F°sica" THEN DO:
                 ASSIGN cFisica = "Sim". 
              END.
              IF {database/inpm/i01pm527.i 4 bdfi.idi_tip_defcncia_fisic} = "Visual" THEN DO:
                 ASSIGN cVisual = "Sim".
              END.

              ASSIGN cCodDef = STRING(bdp.cod_defcncia) + ' - ' + STRING(Bdfi.des_defcncia_fisic).

           END.
        END.

        IF iContDef > 1 THEN ASSIGN cCodDef = '7 - Deficiància M£ltipla'.
        IF cAuditvo = '' THEN ASSIGN cAuditvo = 'N∆o'. 
        IF cFisica  = '' THEN ASSIGN cFisica  = 'N∆o'. 
        IF cMental  = '' THEN ASSIGN cMental  = 'N∆o'.
        IF cVisual  = '' THEN ASSIGN cVisual  = 'N∆o'.

        FIND bcpf WHERE bcpf.num_pessoa_fisic = bpf.num_pessoa_fisic EXCLUSIVE-LOCK NO-ERROR.

        FIND FIRST bfm OF bpf NO-LOCK NO-ERROR.

        /* Verifica Reabilitado */
        FIND FIRST bdp
             WHERE bdp.num_ficha_medic = bfm.num_ficha_medic NO-LOCK NO-ERROR.
        IF AVAIL bdp THEN DO:
           IF bdp.log_reaval = YES THEN
              ASSIGN cReabilitado = "Sim".
           ELSE 
              ASSIGN cReabilitado = "N∆o".
        END.
        ELSE DO:                          
           ASSIGN cReabilitado = "N∆o" .  
        END.

        PUT UNFORMATTED
            Cdelimiter1 IF AVAIL bgi THEN bgi.des_grau_instruc ELSE ''                                       Cdelimiter2  //"genericString9"                "BRA: Grau de instruá∆o"                               
            Cdelimiter1 c-mae                                                                                Cdelimiter2  //"custom-string4"                "BRA: Nome da m∆e"                                     
            Cdelimiter1 STRING(bpf.idi_cor_cutis) + ' - ' + {database/inpy/i03py257.i 04 bpf.idi_cor_cutis}  Cdelimiter2  //"genericNumber1"                "BRA: Raáa"                                            
            Cdelimiter1 WContratacao                                                                         Cdelimiter2  //"start-date"                    "Data do evento"                                       
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                                                 Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"                                   
            Cdelimiter1 TRIM(bpf.cod_pais_nasc)                                                              Cdelimiter2  //"country"                       "Pa°s/Regi∆o"                                          
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"custom-string2"                "BRA: Aposentadoria"                                   
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"genericDate10"                 "BRA: Aposentadoria do INSS"                           
            Cdelimiter1 {database/inpy/i08py257.i 4 bpf.idi_orig_pessoa_fisic}                               Cdelimiter2  //"genericNumber3"                "BRA: Cidad∆o naturalizado"                            
            Cdelimiter1 IF DATE(btab.dat_livre_1) <> ? THEN STRING(DAY(btab.dat_livre_1),'99') + "/" + STRING(MONTH(btab.dat_livre_1),'99') + "/" + STRING(YEAR(btab.dat_livre_1),'9999') ELSE ''  Cdelimiter2  //"custom-date1"                  "BRA: Data da Aposentadoria"                           
            Cdelimiter1 bpf.num_ano_chegad_pais                                                              Cdelimiter2  //"genericDate5"                  "BRA: Data de Chegada ao Pa°s"                         
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"genericDate1"                  "BRA: Data de conhecimento"                            
            Cdelimiter1 STRING(DAY(bcpf.dat_naturaliz),'99') + "/" + STRING(MONTH(bcpf.dat_naturaliz),'99') + "/" + STRING(YEAR(bcpf.dat_naturaliz),'9999') Cdelimiter2  //"genericDate7"                  "BRA: Data de naturalizaá∆o"                           
            Cdelimiter1 cAuditvo                                                                             Cdelimiter2  //"custom-string12"               "BRA: Deficiància Auditiva"                            
            Cdelimiter1 cFisica                                                                              Cdelimiter2  //"custom-string10"               "BRA: Deficiància F°sica"                              
            Cdelimiter1 cMental                                                                              Cdelimiter2  //"custom-string13"               "BRA: Deficiància Mental"                              
            Cdelimiter1 cVisual                                                                              Cdelimiter2  //"custom-string11"               "BRA: Deficiància Visual"                              
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"custom-string1"                "BRA: Entregou Cart∆o de Vacina?"                      
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"genericString13"               "BRA: Escola"                                          
            Cdelimiter1 cCodDef                                                                              Cdelimiter2  //"genericString2"                "BRA: Grupo de deficiància f°sica"                     
            Cdelimiter1 TRIM(bpf.nom_pai_pessoa_fis)                                                         Cdelimiter2  //"custom-string5"                "BRA: Nome do pai"                                     
            Cdelimiter1 cReabilitado                                                                         Cdelimiter2  //"genericString15"               "BRA: Reabilitado"                                     
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"genericNumber16"               "BRA: Recebimento de benef°cio de seguro desemprego"   
            Cdelimiter1 ""                                                                                   Cdelimiter2  //"custom-string3"                "BRA: Tipo de Aposentadoria"                           
            Cdelimiter1 IF AVAIL bdfi THEN {database/inpm/i01pm527.i 4 bdfi.idi_tip_defcncia_fisic} ELSE ''  Cdelimiter2  //"genericString3"                "BRA: Tipo de deficiància"                             
            Cdelimiter1 {database/inpy/i09py257.i 4 bpf.idi_tip_visto_estrang}                               Cdelimiter2  //"genericString5"                "BRA: Tipo de visto"                                   
            Cdelimiter1 IF bcpf.log_estrang_casad_bras = NO THEN "N∆o" ELSE "Sim"                            Cdelimiter2  //"genericNumber14"               "BRA: Trabalhador Estrangeiro com Cìnjuge Brasileiro/a"
            Cdelimiter1 IF bcpf.log_possui_filho_bras = NO THEN "N∆o" ELSE "Sim"                             Cdelimiter2  //"genericNumber15"               "BRA: Trabalhador Estrangeiro com Filhos Brasileiros"  
            Cdelimiter1 ""                                                                                   Cdelimiter1  //"operation"                     "Operaá∆o"                                            
            SKIP.                                                                                                                    
                       
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    














