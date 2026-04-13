Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Endereco Residencial                                                         */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
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

DEFINE VARIABLE h-acomp   AS HANDLE                         NO-UNDO.
DEFINE VARIABLE i-cont    AS INT                            NO-UNDO.
DEFINE VARIABLE dAdmiss   AS CHAR                           NO-UNDO.
DEFINE VARIABLE cEndereco LIKE rh_pessoa_fisic.nom_ender_rh NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - ENDEREÄO RESIDENCIAL").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '8 - Endereco Residencial.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "address4"                      Cdelimiter2  //"address4"                      "BRA: Bairro"            
            Cdelimiter1 "custom-string1"                Cdelimiter2  //"custom-string1"                "BRA: Tipo de logradouro"
            Cdelimiter1 "start-date"                    Cdelimiter2  //"start-date"                    "Data do evento"         
            Cdelimiter1 "personInfo.person-id-external" Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"     
            Cdelimiter1 "country"                       Cdelimiter2  //"country"                       "Pa°s/Regi∆o"            
            Cdelimiter1 "address-type"                  Cdelimiter2  //"address-type"                  "Tipo de endereáo "      
            Cdelimiter1 "zip-code"                      Cdelimiter2  //"zip-code"                      "BRA: CEP"               
            Cdelimiter1 "city"                          Cdelimiter2  //"city"                          "BRA: Cidade"            
            Cdelimiter1 "address3"                      Cdelimiter2  //"address3"                      "BRA: Complemento"       
            Cdelimiter1 "state"                         Cdelimiter2  //"state"                         "BRA: Estado"            
            Cdelimiter1 "address2"                      Cdelimiter2  //"address2"                      "BRA: N£mero"            
            Cdelimiter1 "address1"                      Cdelimiter2  //"address1"                      "BRA: Rua"               
            Cdelimiter1 "operation"                     Cdelimiter1  //"operation"                     "Operaá∆o"               
            SKIP.   

        PUT UNFORMATTED
            Cdelimiter1 "BRA: Bairro*"             Cdelimiter2  
            Cdelimiter1 "BRA: Tipo de Logradouro*" Cdelimiter2  
            Cdelimiter1 "Data do Evento*"          Cdelimiter2  
            Cdelimiter1 "ID Pessoal Externa*"      Cdelimiter2  
            Cdelimiter1 "Pa°s/Regi∆o*"             Cdelimiter2  
            Cdelimiter1 "Tipo de Endereáo*"        Cdelimiter2  
            Cdelimiter1 "BRA: CEP*"                Cdelimiter2  
            Cdelimiter1 "BRA: Cidade*"             Cdelimiter2  
            Cdelimiter1 "BRA: Complemento"         Cdelimiter2  
            Cdelimiter1 "BRA: Estado*"             Cdelimiter2  
            Cdelimiter1 "BRA: N£mero*"             Cdelimiter2  
            Cdelimiter1 "BRA: Rua*"                Cdelimiter2  
            Cdelimiter1 "Operaá∆o"                 Cdelimiter1  
            SKIP. 

    FOR EACH btab NO-LOCK
       WHERE btab.cdn_empresa     >= p-emp-ini
         AND btab.cdn_empresa     <= p-emp-fim 
         AND btab.cdn_estab       >= p-estab-ini
         AND btab.cdn_estab       <= p-estab-fim
         AND btab.cdn_funcionario >= p-matricula-ini
         AND btab.cdn_funcionario <= p-matricula-fim
         AND btab.dat_admis_func  >= p-dt-admissao,
        FIRST bpf OF btab NO-LOCK,
        FIRST bcpf OF bpf NO-LOCK.

        IF btab.dat_desligto_func <> ? THEN NEXT.
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /***** Data Admiss∆o *****/
        ASSIGN dAdmiss = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        /***** Trata Endereáo *****/
        RUN pi-endereco.

        FIND FIRST rh_unid_federac NO-LOCK
            WHERE rh_unid_federac.cod_unid_federac_rh = bpf.cod_unid_federac_rh NO-ERROR.

        PUT UNFORMATTED
            Cdelimiter1 TRIM(bpf.nom_bairro_rh)                                             Cdelimiter2  //"address4"                      "BRA: Bairro"            
            Cdelimiter1 bcpf.cod_tip_lograd                                                 Cdelimiter2  //"custom-string1"                "BRA: Tipo de logradouro"
            Cdelimiter1 dAdmiss                                                             Cdelimiter2  //"start-date"                    "Data do evento"         
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                                Cdelimiter2  //"personInfo.person-id-external" "ID pessoal externa"     
            Cdelimiter1 bpf.cod_pais_ender                                                  Cdelimiter2  //"country"                       "Pa°s/Regi∆o"            
            Cdelimiter1 "home"                                                              Cdelimiter2  //"address-type"                  "Tipo de endereáo "      
            Cdelimiter1 SUBSTRING(bpf.cod_cep_rh,1,5) + '-' + SUBSTRING(bpf.cod_cep_rh,6,3) Cdelimiter2  //"zip-code"                      "BRA: CEP"               
            Cdelimiter1 TRIM(bpf.nom_cidad_rh)                                              Cdelimiter2  //"city"                          "BRA: Cidade"            
            Cdelimiter1 TRIM(bpf.nom_pto_refer)                                             Cdelimiter2  //"address3"                      "BRA: Complemento"       
            Cdelimiter1 bpf.cod_unid_federac_rh + (IF AVAIL rh_unid_federac THEN rh_unid_federac.des_unid_federac_rh ELSE "")   Cdelimiter2  //"state"                         "BRA: Estado"            
            Cdelimiter1 INT(SUBSTR(bpf.cod_livre_1,66,8))                                   Cdelimiter2  //"address2"                      "BRA: N£mero"            
            Cdelimiter1 cEndereco                                                           Cdelimiter2  //"address1"                      "BRA: Rua"               
            Cdelimiter1 ""                                                                  Cdelimiter1  //"operation"                     "Operaá∆o"               
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

