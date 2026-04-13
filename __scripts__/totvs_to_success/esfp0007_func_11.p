Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Tipo Fisico                                                                  */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.

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

DEFINE VARIABLE h-acomp   AS HANDLE NO-UNDO.
DEFINE VARIABLE i-cont    AS INT    NO-UNDO.
DEFINE VARIABLE DtInicial AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - TIPO FISICO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '11 - Tipo Fisico.csv') NO-MAP CONVERT TARGET "UTF-8".

        PUT UNFORMATTED
            Cdelimiter1 "[OPERATOR]"               Cdelimiter2  //"[OPERATOR]"               "Operadores permitidos: Delimit Clear e Delete"
            Cdelimiter1 "externalCode"             Cdelimiter2  //"externalCode"             "Funcion rio"                                  
            Cdelimiter1 "effectiveStartDate"       Cdelimiter2  //"effectiveStartDate"       "effectiveStartDate"                           
            Cdelimiter1 "cust_calcado"             Cdelimiter2  //"cust_calcado"             "Nr. cal‡ado"                                  
            Cdelimiter1 "cust_cutis.externalCode"  Cdelimiter2  //"cust_cutis.externalCode"  "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 "cust_cabelo.externalCode" Cdelimiter2  //"cust_cabelo.externalCode" "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 "cust_olho.externalCode"   Cdelimiter2  //"cust_olho.externalCode"   "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 "cust_estatura"            Cdelimiter2  //"cust_estatura"            "Estatura"                                     
            Cdelimiter1 "cust_peso"                Cdelimiter2  //"cust_peso"                "Peso"                                         
            Cdelimiter1 "cust_manequim"            Cdelimiter2  //"cust_manequim"            "Manequim"                                     
            Cdelimiter1 "cust_calca"               Cdelimiter2  //"cust_calca"               "Cal‡a"                                        
            Cdelimiter1 "cust_camisa"              Cdelimiter2  //"cust_camisa"              "Camisa"                                       
            Cdelimiter1 "cust_jaqueta"             Cdelimiter2  //"cust_jaqueta"             "Jaqueta"                                      
            Cdelimiter1 "cust_capa"                Cdelimiter2  //"cust_capa"                "Capa chuva"                                   
            Cdelimiter1 "cust_jaleco"              Cdelimiter2  //"cust_jaleco"              "Jaleco"                                       
            Cdelimiter1 "cust_sangue.externalCode" Cdelimiter2  //"cust_sangue.externalCode" "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 "cust_fator.externalCode"  Cdelimiter2  //"cust_fator.externalCode"  "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 "cust_doador.externalCode" Cdelimiter1  //"cust_doador.externalCode" "Valor da lista de op‡äes.C¢digo externo"      
            SKIP. 

         PUT UNFORMATTED
            Cdelimiter1 "Operadores permitidos: Delimit Clear e Delete" Cdelimiter2  
            Cdelimiter1 "Funcion rio*"                                  Cdelimiter2  
            Cdelimiter1 "EffectiveStartDate*"                           Cdelimiter2  
            Cdelimiter1 "Nr. Cal‡ado"                                   Cdelimiter2  
            Cdelimiter1 "Valor da Lista de Op‡äes.C¢digo Externo"       Cdelimiter2  
            Cdelimiter1 "Valor da Lista de Op‡äes.C¢digo Externo"       Cdelimiter2  
            Cdelimiter1 "Valor da Lista de Op‡äes.C¢digo Externo"       Cdelimiter2  
            Cdelimiter1 "Estatura"                                      Cdelimiter2  
            Cdelimiter1 "Peso"                                          Cdelimiter2  
            Cdelimiter1 "Manequim"                                      Cdelimiter2  
            Cdelimiter1 "Cal‡a"                                         Cdelimiter2  
            Cdelimiter1 "Camisa"                                        Cdelimiter2  
            Cdelimiter1 "Jaqueta"                                       Cdelimiter2  
            Cdelimiter1 "Capa chuva"                                    Cdelimiter2  
            Cdelimiter1 "Jaleco"                                        Cdelimiter2  
            Cdelimiter1 "Valor da Lista de Op‡äes.C¢digo Externo"       Cdelimiter2  
            Cdelimiter1 "Valor da Lista de Op‡äes.C¢digo Externo"       Cdelimiter2  
            Cdelimiter1 "Valor da Lista de Op‡äes.C¢digo Externo"       Cdelimiter1  
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

        ASSIGN DtInicial = STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        PUT UNFORMATTED
            Cdelimiter1 "Delimit"                                               Cdelimiter2  //"[OPERATOR]"               "Operadores permitidos: Delimit Clear e Delete"
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                    Cdelimiter2  //"externalCode"             "Funcion rio"                                  
            Cdelimiter1 DtInicial /*btab.dat_admis_func*/                       Cdelimiter2  //"effectiveStartDate"       "effectiveStartDate"                           
            Cdelimiter1 bpf.num_calcad_func                                     Cdelimiter2  //"cust_calcado"             "Nr. cal‡ado"                                  
            Cdelimiter1 STRING(bpf.idi_cor_cutis) + " - "  + TRIM({database/inpy/i03py257.i 04 bpf.idi_cor_cutis})   Cdelimiter2  //"cust_cutis.externalCode"  "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 STRING(bpf.idi_cor_cabelo) + " - " + TRIM({database/inpy/i04py257.i 04 bpf.idi_cor_cabelo})  Cdelimiter2  //"cust_cabelo.externalCode" "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 STRING(bpf.idi_cor_olhos) + " - "  + TRIM({database/inpy/i05py257.i 04 bpf.idi_cor_olhos})   Cdelimiter2  //"cust_olho.externalCode"   "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 bpf.val_estatur_pessoa                                  Cdelimiter2  //"cust_estatura"            "Estatura"                                     
            Cdelimiter1 bpf.vli_peso_pessoa                                     Cdelimiter2  //"cust_peso"                "Peso"                                         
            Cdelimiter1 bpf.num_manequim                                        Cdelimiter2  //"cust_manequim"            "Manequim"                                     
            Cdelimiter1 SUBSTRING(bpf.cod_livre_1,001,5)                        Cdelimiter2  //"cust_calca"               "Cal‡a"                                        
            Cdelimiter1 SUBSTRING(bpf.cod_livre_1,006,5)                        Cdelimiter2  //"cust_camisa"              "Camisa"                                       
            Cdelimiter1 SUBSTRING(bpf.cod_livre_1,011,5)                        Cdelimiter2  //"cust_jaqueta"             "Jaqueta"                                      
            Cdelimiter1 SUBSTRING(bpf.cod_livre_1,016,5)                        Cdelimiter2  //"cust_capa"                "Capa chuva"                                   
            Cdelimiter1 SUBSTRING(bpf.cod_livre_1,021,5)                        Cdelimiter2  //"cust_jaleco"              "Jaleco"                                       
            Cdelimiter1 TRIM({database/inpy/i06py257.i 04 bpf.idi_tip_sangue})  Cdelimiter2  //"cust_sangue.externalCode" "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 TRIM({database/inpy/i07py257.i 04 bpf.idi_fatorrh})     Cdelimiter2  //"cust_fator.externalCode"  "Valor da lista de op‡äes.C¢digo externo"      
            Cdelimiter1 bpf.log_pessoa_fisic_doador                             Cdelimiter1  //"cust_doador.externalCode" "Valor da lista de op‡äes.C¢digo externo"      
            SKIP.                                                                                                                    

    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    



