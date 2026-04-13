Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Banco                                                                        */
/********************************************************************************/

DEF BUFFER btab FOR rh_bco_cta_corren_empres.
DEF BUFFER bage FOR rh_agenc_bcia.
DEF BUFFER bbco FOR rh_bco.
DEF BUFFER bpj  FOR rh_pessoa_jurid.
DEF BUFFER bmun FOR rh_munpio.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEFINE INPUT PARAMETER p-diretorio AS CHAR NO-UNDO.

DEFINE VARIABLE h-acomp AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont  AS INT    NO-UNDO.
DEFINE VARIABLE cCep    AS CHAR   NO-UNDO.
DEFINE VARIABLE cCidade AS CHAR   NO-UNDO.
DEFINE VARIABLE cRua    AS CHAR   NO-UNDO.
DEFINE VARIABLE cIbge   AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - CADASTRO BANCO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '11 - Banco.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "[OPERATOR]"             Cdelimiter2 
        Cdelimiter1 "externalCode"           Cdelimiter2 
        Cdelimiter1 "bankCountry.code"       Cdelimiter2 
        Cdelimiter1 "bankName"               Cdelimiter2 
        Cdelimiter1 "routingNumber"          Cdelimiter2 
        Cdelimiter1 "bankBranch"             Cdelimiter2 
        Cdelimiter1 "businessIdentifierCode" Cdelimiter2 
        Cdelimiter1 "postalCode"             Cdelimiter2 
        Cdelimiter1 "city"                   Cdelimiter2 
        Cdelimiter1 "street"                 Cdelimiter2 
        Cdelimiter1 "effectiveStatus"        Cdelimiter1 
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Operadores Permitidos: Delimit, Clear e Delete"     Cdelimiter2 
        Cdelimiter1 "ID do Banco"                                        Cdelimiter2 
        Cdelimiter1 "Pa°s/Regi∆o - C¢digo do Pa°s/Regi∆o(3 caracteres)*" Cdelimiter2 
        Cdelimiter1 "Nome do Banco*"                                     Cdelimiter2 
        Cdelimiter1 "N£mero do Banco"                                    Cdelimiter2 
        Cdelimiter1 "Nome da Agància"                                    Cdelimiter2 
        Cdelimiter1 "C¢digo da Agància"                                  Cdelimiter2 
        Cdelimiter1 "CEP"                                                Cdelimiter2 
        Cdelimiter1 "Cidade"                                             Cdelimiter2 
        Cdelimiter1 "Rua"                                                Cdelimiter2 
        Cdelimiter1 "Status(Valid Values: A/I A=Ativo  I=Inativo)*"      Cdelimiter1 
        SKIP.

    FOR EACH bbco NO-LOCK,
        EACH bage OF bbco.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        ASSIGN cCep    = ''
               cCidade = ''
               cRua    = ''
               cIbge   = ''.
        IF bage.num_pessoa_jurid <> 0 THEN DO:
           FIND FIRST bpj
                WHERE bpj.num_pessoa_jurid = bage.num_pessoa_jurid NO-LOCK NO-ERROR.
           IF AVAIL bpj THEN DO:           
              ASSIGN cCep    = bpj.cod_cep_rh
                     cCidade = bpj.nom_cidad_rh  
                     cRua    = STRING(bpj.nom_ender_rh) + ', ' + STRING(bpj.num_livre_1).

              /***** C¢digo Municipio IBGE *****/
              FIND FIRST bmun 
                   WHERE bmun.cod_unid_federac_rh = bpj.cod_unid_federac_rh
                     AND bmun.cod_pais            = bpj.cod_pais            
                     AND bmun.des_munpio_sped     = bpj.nom_cidad_rh NO-LOCK NO-ERROR.
              IF AVAIL bmun THEN DO: 
                 ASSIGN cIbge = STRING(bmun.cdn_munpio_sped).
              END.
           END.
        END.
        
        PUT UNFORMATTED
             Cdelimiter1 'Delimit'                                                                  Cdelimiter2 //"[OPERATOR]"             Operadores permitidos: Delimit, Clear e Delete
             Cdelimiter1 bbco.cdn_banco                                                             Cdelimiter2 //"externalCode"           ID do banco
             Cdelimiter1 IF AVAIL bage THEN bage.cod_pais ELSE ''                                   Cdelimiter2 //"bankCountry.code"       Pa°s/Regi∆o.C¢digo do pa°s/regi∆o (3 caracteres)
             Cdelimiter1 bbco.nom_razao_social_bco                                                  Cdelimiter2 //"bankName"               Nome do banco
             Cdelimiter1 bbco.cdn_banco                                                             Cdelimiter2 //"routingNumber"          N£mero do banco
             Cdelimiter1 IF AVAIL bage THEN bage.nom_pessoa_jurid ELSE ''                           Cdelimiter2 //"bankBranch"             Nome da agància
             Cdelimiter1 IF AVAIL bage THEN bage.cdn_agenc_bcia ELSE 0                              Cdelimiter2 //"businessIdentifierCode" C¢digo da agància
             Cdelimiter1 IF cCep <> '' THEN SUBSTRING(cCep,1,5) + '-' + SUBSTRING(cCep,6,3) ELSE '' Cdelimiter2 //"postalCode"             CEP
             Cdelimiter1 bpj.nom_cidad_rh                                                           Cdelimiter2 //"city"                   Cidade
             Cdelimiter1 cRua                                                                       Cdelimiter2 //"street"                 Rua
             Cdelimiter1 "A"                                                                        Cdelimiter1 //"effectiveStatus"        Status(Valid Values : A/I   A for Ativo  I for Inativo  )
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.
