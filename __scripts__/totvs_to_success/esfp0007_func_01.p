Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Importacao Basica                                                            */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bpa  FOR rh_pais.
DEF BUFFER bup  FOR unid_lotac_plano.
DEF BUFFER bul  FOR unid_lotac.
DEF BUFFER bext FOR ext_funcionario.
DEF BUFFER bfnc FOR funcionario.
DEF BUFFER bcpf FOR compl_pessoa_fisic.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEF VAR WprimeiroNome    AS CHAR                           NO-UNDO.
DEF VAR WnomedoMeio      AS CHAR                           NO-UNDO.
DEF VAR WsobreNome       AS CHAR                           NO-UNDO.
DEF VAR Wgerente         AS CHAR                           NO-UNDO.
DEF VAR Wnome            LIKE funcionario.nom_pessoa_fisic NO-UNDO.
DEF VAR cEndereco        LIKE rh_pessoa_fisic.nom_ender_rh NO-UNDO.
DEF VAR v_des_unid_lotac LIKE unid_lotac.des_unid_lotac    NO-UNDO.
DEF VAR WContratacao     AS CHAR                           NO-UNDO.
DEF VAR DtUltAval        AS CHAR                           NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-ini       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-emp-fim       AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-ini     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-estab-fim     AS CHAR NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-ini AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-matricula-fim AS INT  NO-UNDO.
DEFINE INPUT PARAMETER p-dt-admissao   AS DATE NO-UNDO.

DEFINE VARIABLE h-acomp AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont  AS INT    NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES BASICAS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '1 - Importacao Basica.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "STATUS"                  Cdelimiter2 
        Cdelimiter1 "USERID"                  Cdelimiter2 
        Cdelimiter1 "USERNAME"                Cdelimiter2 
        Cdelimiter1 "FIRSTNAME"               Cdelimiter2 
        Cdelimiter1 "NICKNAME"                Cdelimiter2 
        Cdelimiter1 "MI"                      Cdelimiter2 
        Cdelimiter1 "LASTNAME"                Cdelimiter2 
        Cdelimiter1 "SUFFIX"                  Cdelimiter2 
        Cdelimiter1 "TITLE"                   Cdelimiter2 
        Cdelimiter1 "GENDER"                  Cdelimiter2 
        Cdelimiter1 "EMAIL"                   Cdelimiter2 
        Cdelimiter1 "MANAGER"                 Cdelimiter2 
        Cdelimiter1 "HR"                      Cdelimiter2 
        Cdelimiter1 "DEPARTMENT"              Cdelimiter2 
        Cdelimiter1 "JOBCODE"                 Cdelimiter2 
        Cdelimiter1 "DIVISION"                Cdelimiter2 
        Cdelimiter1 "LOCATION"                Cdelimiter2 
        Cdelimiter1 "TIMEZONE"                Cdelimiter2 
        Cdelimiter1 "HIREDATE"                Cdelimiter2 
        Cdelimiter1 "EMPID"                   Cdelimiter2 
        Cdelimiter1 "BIZ_PHONE"               Cdelimiter2 
        Cdelimiter1 "FAX"                     Cdelimiter2 
        Cdelimiter1 "ADDR1"                   Cdelimiter2 
        Cdelimiter1 "ADDR2"                   Cdelimiter2 
        Cdelimiter1 "CITY"                    Cdelimiter2 
        Cdelimiter1 "STATE"                   Cdelimiter2 
        Cdelimiter1 "ZIP"                     Cdelimiter2 
        Cdelimiter1 "COUNTRY"                 Cdelimiter2 
        Cdelimiter1 "REVIEW_FREQ"             Cdelimiter2 
        Cdelimiter1 "LAST_REVIEW_DATE"        Cdelimiter2 
        Cdelimiter1 "MATRIX_MANAGER"          Cdelimiter2 
        Cdelimiter1 "DEFAULT_LOCALE"          Cdelimiter2 
        Cdelimiter1 "PROXY"                   Cdelimiter2 
        Cdelimiter1 "seatingChart"            Cdelimiter2 
        Cdelimiter1 "CUSTOM01"                Cdelimiter2 
        Cdelimiter1 "CUSTOM02"                Cdelimiter2 
        Cdelimiter1 "CUSTOM03"                Cdelimiter2 
        Cdelimiter1 "CUSTOM04"                Cdelimiter2 
        Cdelimiter1 "CUSTOM05"                Cdelimiter2 
        Cdelimiter1 "CUSTOM06"                Cdelimiter2 
        Cdelimiter1 "CUSTOM07"                Cdelimiter2 
        Cdelimiter1 "CUSTOM08"                Cdelimiter2 
        Cdelimiter1 "CUSTOM09"                Cdelimiter2 
        Cdelimiter1 "CUSTOM10"                Cdelimiter2 
        Cdelimiter1 "CUSTOM11"                Cdelimiter2 
        Cdelimiter1 "CUSTOM12"                Cdelimiter2 
        Cdelimiter1 "CUSTOM13"                Cdelimiter2 
        Cdelimiter1 "CUSTOM14"                Cdelimiter2 
        Cdelimiter1 "CUSTOM15"                Cdelimiter2 
        Cdelimiter1 "PERSON_ID_EXTERNAL"      Cdelimiter2 
        Cdelimiter1 "ASSIGNMENT_ID_EXTERNAL"  Cdelimiter1
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "STATUS*"                   Cdelimiter2 
        Cdelimiter1 "USERID*"                   Cdelimiter2 
        Cdelimiter1 "Nome Usuario Rede*"        Cdelimiter2 
        Cdelimiter1 "Nome*"                     Cdelimiter2 
        Cdelimiter1 "Apelido"                   Cdelimiter2 
        Cdelimiter1 "Nome do Meio"              Cdelimiter2 
        Cdelimiter1 "Sobrenome*"                Cdelimiter2 
        Cdelimiter1 "Sufixo"                    Cdelimiter2 
        Cdelimiter1 "Titulo"                    Cdelimiter2 
        Cdelimiter1 "Sexo*"                     Cdelimiter2 
        Cdelimiter1 "E-mail*"                   Cdelimiter2 
        Cdelimiter1 "Gerente*"                  Cdelimiter2 
        Cdelimiter1 "Recursos Humanos*"         Cdelimiter2 
        Cdelimiter1 "Departamento"              Cdelimiter2 
        Cdelimiter1 "Codigo do Cargo"           Cdelimiter2 
        Cdelimiter1 "Divisao"                   Cdelimiter2 
        Cdelimiter1 "Localizacao*"              Cdelimiter2 
        Cdelimiter1 "Fuso Horario*"             Cdelimiter2 
        Cdelimiter1 "Data de Contratacao"       Cdelimiter2 
        Cdelimiter1 "ID do Colaborador"         Cdelimiter2 
        Cdelimiter1 "Telefone Comercial"        Cdelimiter2 
        Cdelimiter1 "Fax Comercial"             Cdelimiter2 
        Cdelimiter1 "Linha de Endereco 1"       Cdelimiter2 
        Cdelimiter1 "Linha de Endereco 2"       Cdelimiter2 
        Cdelimiter1 "Cidade"                    Cdelimiter2 
        Cdelimiter1 "Estado"                    Cdelimiter2 
        Cdelimiter1 "CEP"                       Cdelimiter2 
        Cdelimiter1 "Pais"                      Cdelimiter2 
        Cdelimiter1 "Frequencia da Avaliacao"   Cdelimiter2 
        Cdelimiter1 "Ultima Data de Avaliacao"  Cdelimiter2 
        Cdelimiter1 "Gerente da Hierarquia"     Cdelimiter2 
        Cdelimiter1 "Localidade Padrao"         Cdelimiter2 
        Cdelimiter1 "Proxy"                     Cdelimiter2 
        Cdelimiter1 "Null"                      Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 1*"   Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 2"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 3"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 4"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 5"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 6"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 7"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 8"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 9"    Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 10"   Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 11"   Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 12"   Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 13"   Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 14"   Cdelimiter2 
        Cdelimiter1 "Campo Personalizavel 15"   Cdelimiter2 
        Cdelimiter1 "PERSON_ID_EXTERNAL*"       Cdelimiter2 
        Cdelimiter1 "Assignment ID"             Cdelimiter1
        SKIP.

    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bpf  OF btab NO-LOCK,
        FIRST bcpf OF bpf  NO-LOCK,
        first bpa  OF bpf  NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        ASSIGN v_des_unid_lotac = "".
        FIND bup NO-LOCK WHERE
             bup.cdn_plano_lotac = btab.cdn_plano_lotac AND 
             bup.cod_unid_lotac  = btab.cod_unid_lotac NO-ERROR.
        IF AVAIL bul THEN DO:
           FIND bul NO-LOCK WHERE
                bul.cod_unid_lotac  = bup.cod_unid_lotac NO-ERROR.
           IF AVAIL bul THEN
              ASSIGN v_des_unid_lotac = bul.des_unid_lotac.
        END.

        ASSIGN Wnome = REPLACE(btab.nom_pessoa_fisic, ENTRY(NUM-ENTRIES(TRIM(btab.nom_pessoa_fisic)," "), btab.nom_pessoa_fisic," "), "")
               //WprimeiroNome = replace(btab.nom_pessoa_fisic, entry(num-entries(trim(btab.nom_pessoa_fisic)," "), btab.nom_pessoa_fisic," "), "")
               WprimeiroNome = ENTRY(1, btab.nom_pessoa_fisic," ")
               WsobreNome    = ENTRY(NUM-ENTRIES(TRIM(btab.nom_pessoa_fisic)," "), btab.nom_pessoa_fisic," ")
               WnomedoMeio   = TRIM(REPLACE(REPLACE(btab.nom_pessoa_fisic, WprimeiroNome, ''), WsobreNome, '')).
        IF WnomedoMeio = '' THEN ASSIGN WnomedoMeio = WprimeiroNome.

        /***** Data Admiss∆o | Data Ultima Avaliaá∆o *****/
        //ASSIGN WContratacao = btab.dat_admis_func.
        ASSIGN WContratacao = STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999')
               DtUltAval    = STRING(MONTH(btab.dat_ult_exam_medic),'99') + "/" + STRING(DAY(btab.dat_ult_exam_medic),'99') + "/" + STRING(YEAR(btab.dat_ult_exam_medic),'9999').

        /***** Trata Endereáo *****/
        RUN pi-endereco.

        ASSIGN Wgerente = ''.
        FOR FIRST bext WHERE
                  bext.cdn_empresa       = btab.cdn_empresa      AND  
                  bext.cdn_estab         = btab.cdn_estab        AND
                  bext.cdn_funcionario   = btab.cdn_funcionario  no-lock:

            find FIRST bfnc WHERE 
                       bfnc.cdn_empresa     = bext.cdn_empresa       AND
                       bfnc.cdn_funcionario = bext.cdn_func_gestor   and
                       bfnc.dat_desligto_func = ? no-lock no-error.
            if not avail bfnc then
                find last bfnc use-index fncnr_idfdemp
                    where bfnc.cdn_empresa     = bext.cdn_empresa
                      AND bfnc.cdn_funcionario = bext.cdn_func_gestor no-error.

            if avail bfnc then
                ASSIGN Wgerente = bfnc.nom_pessoa_fisic.
        END.

        PUT UNFORMATTED
            Cdelimiter1 "active"                                                             Cdelimiter2 /* "STATUS"                  */
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                            Cdelimiter2 /* "USERID"                  */
            Cdelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + STRING(btab.cdn_funcionario) Cdelimiter2 /* "Nome de usu†rio rede"    */
            Cdelimiter1 WprimeiroNome /*TRIM(bpf.nom_abrev_pessoa_fisic)*/              Cdelimiter2 /* "Nome Abreviado"          */
            Cdelimiter1 WprimeiroNome                                                   Cdelimiter2 /* "Apelido"                 */
            Cdelimiter1 STRING(WnomedoMeio) /*TRIM(btab.nom_pessoa_fisic)*/             Cdelimiter2 /* "Nome Completo"           */
            Cdelimiter1 /*STRING(WnomedoMeio) + ' ' +*/ STRING(WsobreNome)              Cdelimiter2 /* "Sobrenome Completo"      */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Sufixo"                  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "T°tulo"                  */
            Cdelimiter1 IF bpf.idi_sexo = 1 THEN "M" ELSE "F"                           Cdelimiter2 /* "Sexo"                    */
            Cdelimiter1 bpf.nom_e_mail                                                  Cdelimiter2 /* "E-mail"                  */
            Cdelimiter1 IF AVAIL bext THEN STRING(bext.cdn_empresa) + '-' + STRING(bext.cdn_estab) + '-' + FILL("0", 8 -  LENGTH(bext.cdn_func_gestor)) + STRING(bext.cdn_func_gestor) ELSE '0'                  Cdelimiter2 /* "Gerente"                 */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Recursos humanos"        */
            Cdelimiter1 v_des_unid_lotac                                                Cdelimiter2 /* "Departamento"            */
            Cdelimiter1 btab.cdn_cargo_basic                                            Cdelimiter2 /* "C¢digo do cargo"         */
            Cdelimiter1 btab.cdn_niv_cargo                                              Cdelimiter2 /* "Divis∆o"                 */
            Cdelimiter1 btab.cdn_local_marcac_cartao_pto                                Cdelimiter2 /* "Localizaá∆o"             */
            Cdelimiter1 "America/Sao_Paulo"                                             Cdelimiter2 /* "Fuso hor†rio"            */
            Cdelimiter1 WContratacao                                                    Cdelimiter2 /* "Data de contrataá∆o"     */
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                            Cdelimiter2 /* "ID do colaborador"       */
            Cdelimiter1 bpf.num_ddd + bpf.num_telefone                                  Cdelimiter2 /* "Telefone comercial"      */
            Cdelimiter1 bpf.num_livre_1 + bpf.num_fax                                   Cdelimiter2 /* "Fax comercial"           */
            Cdelimiter1 cEndereco                                                       Cdelimiter2 /* "Linha de endereáo 1"     */
            Cdelimiter1 SUBSTRING(bpf.cod_livre_1,66,08)                                Cdelimiter2 /* "Linha de endereáo 2"     */
            Cdelimiter1 bpf.nom_cidad_rh                                                Cdelimiter2 /* "Cidade"                  */
            Cdelimiter1 bpf.cod_unid_federac_rh                                         Cdelimiter2 /* "Estado"                  */
            Cdelimiter1 IF bpf.cod_cep_rh <> '' THEN SUBSTRING(bpf.cod_cep_rh,1,5) + '-' + SUBSTRING(bpf.cod_cep_rh,6,3) ELSE ''                                                  Cdelimiter2 /* "CEP"                     */
            Cdelimiter1 bpf.cod_pais_ender                                              Cdelimiter2 /* "Pa°s"                    */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Frequància da avaliaá∆o" */
            Cdelimiter1 DtUltAval /*btab.dat_ult_exam_medic*/                           Cdelimiter2 /* "Èltima data de avaliaá∆o */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Gerente da hierarquia"   */
            Cdelimiter1 "pt_BR"                                                         Cdelimiter2 /* "Localidade padr∆o"       */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Proxy"                   */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "null"                    */
            Cdelimiter1 btab.nom_pessoa_fisic                                           Cdelimiter2 /* "Campo personaliz†vel 1"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 2"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 3"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 4"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 5"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 6"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 7"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 8"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 9"  */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 10" */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 11" */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 12" */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 13" */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 14" */
            Cdelimiter1 ""                                                              Cdelimiter2 /* "Campo personaliz†vel 15" */
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                            Cdelimiter2 /* "PERSON_ID_EXTERNAL"      */
            Cdelimiter1 ""                                                              Cdelimiter1 /* "Assignment ID"           */
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    

/* Trata Endereáo */
PROCEDURE pi-endereco:

  ASSIGN cEndereco = bpf.nom_ender_rh.

  /***** Tratar AL *****/
  IF SUBSTRING(cEndereco, 1, 2) = "AL" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'AL ','').
     END.
  END.
  
  /***** Tratar AV e AVENIDA *****/
  IF (SUBSTRING(cEndereco, 1, 2) = "AV" OR
      SUBSTRING(cEndereco, 1, 7) = "AVENIDA") THEN DO:
      IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'AV ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 7)) = 7 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'AVENIDA ','').
      END.
  END.

  /***** Tratar BC e BECO *****/
  IF (SUBSTRING(cEndereco, 1, 2) = "BC" OR
      SUBSTRING(cEndereco, 1, 4) = "BECO") THEN DO:
      IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'BC ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 4)) = 4 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'BECO ','').
      END.
  END.

  /***** Tratar CAM *****/
  IF SUBSTRING(cEndereco, 1, 3) = "CAM" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'CAM ','').
     END.
  END.

  /***** Tratar COR *****/
  IF SUBSTRING(cEndereco, 1, 3) = "COR" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'COR ','').
     END.
  END.

  /***** Tratar EST *****/
  IF SUBSTRING(cEndereco, 1, 3) = "EST" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'EST ','').
     END.
  END.

  /***** Tratar PC *****/
  IF SUBSTRING(cEndereco, 1, 2) = "PC" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'PC ','').
     END.
  END.

  /***** Tratar ROD *****/
  IF SUBSTRING(cEndereco, 1, 3) = "ROD" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'ROD ','').
     END.
  END.

  /***** Tratar R e RUA *****/
  IF (SUBSTRING(cEndereco, 1, 1) = "R" OR
      SUBSTRING(cEndereco, 1, 3) = "RUA") THEN DO:
      IF LENGTH (SUBSTRING(cEndereco, 1, 1)) = 1 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'R ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'RUA ','').
      END.
  END.

  /***** Tratar SR e SRV *****/
  IF (SUBSTRING(cEndereco, 1, 2) = "SR" OR
      SUBSTRING(cEndereco, 1, 3) = "SRV") THEN DO:
      IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'SR ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'SRV ','').
      END.
  END.

  /***** Tratar TR, TV, TRV E TRAVESSA *****/
  IF (SUBSTRING(cEndereco, 1, 2) = "TR" OR
      SUBSTRING(cEndereco, 1, 2) = "TV" OR
      SUBSTRING(cEndereco, 1, 3) = "TRV" OR
      SUBSTRING(cEndereco, 1, 8) = "TRAVESSA") THEN DO:
      IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'TR ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'TV ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 3)) = 3 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'TRV ','').
      END.
      IF LENGTH (SUBSTRING(cEndereco, 1, 8)) = 8 THEN DO:
         ASSIGN cEndereco = REPLACE(cEndereco,'TRAVESSA ','').
      END.
  END.

  /***** Tratar VL *****/
  IF SUBSTRING(cEndereco, 1, 2) = "VL" THEN DO:
     IF LENGTH (SUBSTRING(cEndereco, 1, 2)) = 2 THEN DO:
        ASSIGN cEndereco = REPLACE(cEndereco,'VL ','').
     END.
  END.

END PROCEDURE.
