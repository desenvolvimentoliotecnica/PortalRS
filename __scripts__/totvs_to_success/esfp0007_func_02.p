Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes Biograficas                                                      */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.
DEF BUFFER bsp  FOR sped_participan.

DEF VAR Cdelimiter1 AS CHAR INIT '"' NO-UNDO.
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
DEFINE VARIABLE DtNascim AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMA€åES BIOGRAFICAS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '2 - Informacoes Biograficas.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "place-of-birth"        Cdelimiter2  //"place-of-birth"     "Cidade"                 
        Cdelimiter1 "date-of-birth"         Cdelimiter2  //"date-of-birth"      "Data de nascimento"     
        Cdelimiter1 "region-of-birth"       Cdelimiter2  //"region-of-birth"    "Estado"                 
        Cdelimiter1 "user-id"               Cdelimiter2  //"user-id"            "ID do Usu rio"          
        Cdelimiter1 "country-of-birth"      Cdelimiter2  //"country-of-birth"   "Pa¡s de nascimento"     
        Cdelimiter1 "custom-string1"        Cdelimiter2  //"custom-string1"     "Idade"                  
        Cdelimiter1 "person-id-external"    Cdelimiter1  //"person-id-external" "Matr¡cula eSocial"
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Cidade*"                  Cdelimiter2 
        Cdelimiter1 "Data de Nascimento*"      Cdelimiter2 
        Cdelimiter1 "Estado*"                  Cdelimiter2 
        Cdelimiter1 "ID do Usuario*"           Cdelimiter2 
        Cdelimiter1 "Pais de Nascimento*"      Cdelimiter2 
        Cdelimiter1 "Idade"                    Cdelimiter2 
        Cdelimiter1 "Matr¡cula eSocial*"       Cdelimiter1 
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

        /* Localiza Sped Participante PF */
        FIND FIRST bsp
             WHERE bsp.cdn_empresa         = btab.cdn_empresa
               AND bsp.cdn_estab           = btab.cdn_estab
               AND bsp.cdn_participan_sped = btab.cdn_funcionario NO-LOCK NO-ERROR.

        /***** Data Nascimento *****/
        ASSIGN DtNascim = STRING(DAY(bpf.dat_nascimento),'99') + "/" + STRING(MONTH(bpf.dat_nascimento),'99') + "/" + STRING(YEAR(bpf.dat_nascimento),'9999').

        PUT UNFORMATTED
            Cdelimiter1 TRIM(bpf.nom_naturalidade)                      Cdelimiter2  //"place-of-birth"     "Cidade"                 
            Cdelimiter1 DtNascim /*bpf.dat_nascimento*/                 Cdelimiter2  //"date-of-birth"      "Data de nascimento"     
            Cdelimiter1 bpf.cod_unid_federac_nasc                       Cdelimiter2  //"region-of-birth"    "Estado"                 
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                            Cdelimiter2  //"user-id"            "ID do Usu rio"          
            Cdelimiter1 bpf.cod_pais_nasc                               Cdelimiter2  //"country-of-birth"   "Pa¡s de nascimento"     
            Cdelimiter1 TRUNCATE((TODAY - bpf.dat_nascimento ) / 365,0) Cdelimiter2  //"custom-string1"     "Idade"                  
            Cdelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)     Cdelimiter1  //person-id-external   "Matr¡cula eSocial"                   
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    



