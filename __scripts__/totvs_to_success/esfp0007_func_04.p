Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extraá∆o das informaá‰es HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Informacoes Pessoais                                                         */
/********************************************************************************/

DEF BUFFER btab FOR funcionario.
DEF BUFFER bpf  FOR rh_pessoa_fisic.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

DEF VAR WContratacao AS CHAR NO-UNDO.

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
DEFINE VARIABLE cSexo   AS CHAR   NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - INFORMAÄÂES PESSOAIS").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '4 - Informacoes Pessoais.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
        Cdelimiter1 "start-date"               Cdelimiter2  //"start-date"             "Data Admiss∆o"                                                                                    
        Cdelimiter1 "marital-status"           Cdelimiter2  //"marital-status"         "Estado Civil"                                                                                      
        Cdelimiter1 "person-id-external"       Cdelimiter2  //"person-id-external"     "ID Pessoa Fisica"                                                                                 
        Cdelimiter1 "native-preferred-lang"    Cdelimiter2  //"native-preferred-lang"  "Idioma"                                                                                            
        Cdelimiter1 "nationality"              Cdelimiter2  //"nationality"            "Nacionalidade"                                                                                     
        Cdelimiter1 "first-name"               Cdelimiter2  //"first-name"             "Nome"                                                                                              
        Cdelimiter1 "gender"                   Cdelimiter2  //"gender"                 "Sexo"                                                                                              
        Cdelimiter1 "last-name"                Cdelimiter2  //"last-name"              "Sobrenome"    
        Cdelimiter1 "custom-string2"           Cdelimiter2  //"custom-string2"         "Autorizaá∆o LGPD"
        Cdelimiter1 "display-name"             Cdelimiter2  //"display-name"           "Nome Completo"                                                                                     
        Cdelimiter1 "custom-string3"           Cdelimiter2  //"custom-string3"         "PCD?" 
        Cdelimiter1 "preferred-name"           Cdelimiter2  //"preferred-name"         "Nome Social"                                                                                       
        Cdelimiter1 "operation"                Cdelimiter1  //"operation"              "Operaá∆o"                                                                                          
        SKIP.

    PUT UNFORMATTED
        Cdelimiter1 "Data Admiss∆o*"    Cdelimiter2   //"start-date"             "Data Admiss∆o"                                                                                    
        Cdelimiter1 "Estado Civil*"     Cdelimiter2   //"marital-status"         "Estado Civil"                                                                                      
        Cdelimiter1 "ID Pessoa Fisica*" Cdelimiter2   //"person-id-external"     "ID Pessoa Fisica"                                                                                 
        Cdelimiter1 "Idioma*"           Cdelimiter2   //"native-preferred-lang"  "Idioma"                                                                                            
        Cdelimiter1 "Nacionalidade*"    Cdelimiter2   //"nationality"            "Nacionalidade"                                                                                     
        Cdelimiter1 "Nome*"             Cdelimiter2   //"first-name"             "Nome"                                                                                              
        Cdelimiter1 "Sexo*"             Cdelimiter2   //"gender"                 "Sexo"                                                                                              
        Cdelimiter1 "Sobrenome*"        Cdelimiter2   //"last-name"              "Sobrenome"       
        Cdelimiter1 "Autorizaá∆o LGPD"  Cdelimiter2   //"custom-string2"         "Autorizaá∆o LGPD"
        Cdelimiter1 "Nome Completo"     Cdelimiter2   //"display-name"           "Nome Completo"                                                                                     
        Cdelimiter1 "PCD ?"             Cdelimiter2   //"custom-string3"         "PCD?"            
        Cdelimiter1 "Nome Social"       Cdelimiter2   //"preferred-name"         "Nome Social"                                                                                      
        Cdelimiter1 "Operaá∆o"          Cdelimiter1   //"operation"              "Operaá∆o"                                                                                          
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
        FIRST bpf OF btab NO-LOCK
        BREAK BY btab.cdn_empresa
              BY btab.cdn_estab
              BY btab.cdn_funcionario.

        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).

        /* Data Admiss∆o */
        ASSIGN WContratacao = STRING(DAY(btab.dat_admis_func),'99') + "/" + STRING(MONTH(btab.dat_admis_func),'99') + "/" + STRING(YEAR(btab.dat_admis_func),'9999').

        /* Sexo */
        IF {database/inpy/i01py257.i 04 bpf.idi_sexo} = "Masculino" THEN
           ASSIGN cSexo = "M" /*1*/.
        ELSE 
           ASSIGN cSexo = "F" /*2*/.
       
        PUT UNFORMATTED
            Cdelimiter1 WContratacao                                                                               Cdelimiter2   //"start-date"             "Data Admiss∆o"                                                                                    
            Cdelimiter1 STRING(bpf.idi_estado_civil) + ' - ' + {DATABASE/inpy/i02py257.i 04 bpf.idi_estado_civil}  Cdelimiter2   //"marital-status"         "Estado Civil"                                                                                      
            cDelimiter1 STRING(btab.cdn_empresa) + '-' + STRING(btab.cdn_estab) + '-' + FILL("0", 8 -  length(btab.cdn_funcionario)) + STRING(btab.cdn_funcionario)                                                                       Cdelimiter2   //"person-id-external"     "ID Pessoa Fisica"                                                                                 
            Cdelimiter1 "Portuguàs"                                                                                Cdelimiter2   //"native-preferred-lang"  "Idioma"                                                                                            
            Cdelimiter1 bpf.idi_orig_pessoa_fisic " - " {DATABASE/inpy/i08py257.i 04 bpf.idi_orig_pessoa_fisic}    Cdelimiter2   //"nationality"            "Nacionalidade"                                                                                     
            Cdelimiter1 ENTRY(1, bpf.nom_pessoa_fisic, ' ')                                                        Cdelimiter2   //"first-name"             "Nome"                                                                                              
            Cdelimiter1 cSexo                                                                                      Cdelimiter2   //"gender"                 "Sexo"                                                                                              
            Cdelimiter1 ENTRY(NUM-ENTRIES(TRIM(btab.nom_pessoa_fisic)," "), btab.nom_pessoa_fisic," ")             Cdelimiter2   //"last-name"              "Sobrenome"       
            Cdelimiter1 "Y"                                                                                        Cdelimiter2   //"custom-string2"         "Autorizaá∆o LGPD"
            Cdelimiter1 TRIM(btab.nom_pessoa_fisic)                                                                Cdelimiter2   //"display-name"           "Nome Completo"                                                                                     
            Cdelimiter1 IF bpf.log_livre_1 = TRUE THEN "Y" ELSE "N"                                                Cdelimiter2   //"custom-string3"         "PCD?"            
            Cdelimiter1 TRIM(btab.nom_pessoa_fisic)                                                                Cdelimiter2   //"preferred-name"         "Nome Social"                                                                                      
            Cdelimiter1 ""                                                                                         Cdelimiter1   //"operation"              "Operaá∆o"                                                                                          
            SKIP.

    END.

OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp.    

