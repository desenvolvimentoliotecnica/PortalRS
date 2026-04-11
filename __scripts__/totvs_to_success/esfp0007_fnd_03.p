Def buffer empresa for mgcad.empresa.

/* Compatibilização TOTVS Camil 12.1.2209*/

/* Projeto: D41 - Extra‡Æo das informa‡äes HCM, para SuccessFactor              */
/* Autor..: Luiz Figueiroa - QualiIt                                            */
/* Data...: 05/10/2020                                                          */
/* Estabelecimento                                                              */
/********************************************************************************/

DEF BUFFER btab FOR rh_estab.
DEF BUFFER best FOR estabelecimento.
DEF BUFFER bpj  FOR rh_pessoa_jurid.
DEF BUFFER bspj FOR sped_rh_pessoa_jurid.

DEF VAR WTipoLogradouro AS CHAR FORMAT 'x(120)' NO-UNDO.
DEF VAR WRua            AS CHAR FORMAT 'x(120)' NO-UNDO.
DEF VAR WNumero         AS CHAR FORMAT 'x(120)' NO-UNDO.

DEF VAR Cdelimiter1 AS CHAR INIT '"'  NO-UNDO.
DEF VAR Cdelimiter2 AS CHAR INIT '",' NO-UNDO.

/*ASSIGN Cdelimiter1 = Cdelimiter1 + "'"
       Cdelimiter2 = Cdelimiter2 + "',".*/

DEFINE INPUT PARAMETER p-diretorio AS CHAR NO-UNDO.

DEFINE VARIABLE h-acomp   AS HANDLE                   NO-UNDO.
DEFINE VARIABLE i-cont    AS INT                      NO-UNDO.
DEFINE VARIABLE dDtIniVig AS CHAR                     NO-UNDO.

RUN utp/ut-acomp.p PERSISTENT SET h-acomp. 
RUN pi-inicializar IN h-acomp (INPUT "EXPORTANDO - CADASTRO ESTABELECIMENTO").

ASSIGN i-cont = 0.

OUTPUT TO VALUE(STRING(p-diretorio) + '3 - Estabelecimento.csv') NO-MAP CONVERT TARGET "UTF-8".

    PUT UNFORMATTED
       Cdelimiter1 'custom-string1'             Cdelimiter2
       Cdelimiter1 'end-date'                   Cdelimiter2
       Cdelimiter1 'custom-string2'             Cdelimiter2
       Cdelimiter1 'externalCode'               Cdelimiter2
       Cdelimiter1 'name'                       Cdelimiter2
       Cdelimiter1 'start-date'                 Cdelimiter2
       Cdelimiter1 'description'                Cdelimiter2
       Cdelimiter1 'status'                     Cdelimiter2
       Cdelimiter1 'timezone'                   Cdelimiter2
       Cdelimiter1 'LegalEntity.externalCode'   Cdelimiter2
       Cdelimiter1 'PayScaleType.externalCode'  Cdelimiter2
       Cdelimiter1 'address.city'               Cdelimiter2
       Cdelimiter1 'address.country'            Cdelimiter2
       Cdelimiter1 'address.custom-string2'     Cdelimiter2
       Cdelimiter1 'address.address1'           Cdelimiter2
       Cdelimiter1 'address.address2'           Cdelimiter2
       Cdelimiter1 'address.address3'           Cdelimiter2
       Cdelimiter1 'address.address4'           Cdelimiter2
       Cdelimiter1 'address.state'              Cdelimiter2
       Cdelimiter1 'address.zip-code'           Cdelimiter1
       SKIP.

     PUT UNFORMATTED
       Cdelimiter1 "CNPJ"                     Cdelimiter2
       Cdelimiter1 "Data Final"               Cdelimiter2
       Cdelimiter1 "ID Totvs"                 Cdelimiter2
       Cdelimiter1 "C¢digo*"                  Cdelimiter2
       Cdelimiter1 "Nome"                     Cdelimiter2
       Cdelimiter1 "Data Inicial"             Cdelimiter2
       Cdelimiter1 "Descri‡Æo"                Cdelimiter2
       Cdelimiter1 "Status*"                  Cdelimiter2
       Cdelimiter1 "Fuso Hor rio"             Cdelimiter2
       Cdelimiter1 "Empresa*"                 Cdelimiter2
       Cdelimiter1 "Sindicato*"               Cdelimiter2
       Cdelimiter1 "Cidade | BRA: Cidade"     Cdelimiter2
       Cdelimiter1 "Pa¡s"                     Cdelimiter2
       Cdelimiter1 "BRA: Tipo de Logradouro"  Cdelimiter2
       Cdelimiter1 "BRA: Rua"                 Cdelimiter2
       Cdelimiter1 "BRA: N£mero"              Cdelimiter2
       Cdelimiter1 "BRA: Complemento"         Cdelimiter2
       Cdelimiter1 "BRA: Bairro"              Cdelimiter2
       Cdelimiter1 "BRA: Estado"              Cdelimiter2
       Cdelimiter1 "BRA: CEP"                 Cdelimiter1
       SKIP.

    FOR EACH btab NO-LOCK,
        FIRST bpj OF btab NO-LOCK,
        FIRST bspj OF bpj NO-LOCK.
        
        ASSIGN i-cont = i-cont + 1.
        RUN pi-acompanhar IN h-acomp (INPUT "TOTAL REGISTROS: " + STRING(i-cont)).
        
        ASSIGN WTipoLogradouro = ''
               WRua            = ''
               WNumero         = ''.         
        ASSIGN WTipoLogradouro = ENTRY(1, bpj.nom_ender_rh, ' ')
               WRua            = SUBSTRING(ENTRY(1, bpj.nom_ender_rh, ','), LENGTH(WTipoLogradouro) + 2, 200).
        
        /***** Verifica Data Inicio Vigencia Estabelecimento *****/
        FIND FIRST best
             WHERE best.cod_estab = btab.cdn_estab NO-LOCK NO-ERROR.
        IF AVAIL best THEN DO:
           //ASSIGN dDtIniVig = best.dat_livre_1.
           ASSIGN dDtIniVig = STRING(MONTH(best.dat_livre_1),'99') + "/" + STRING(DAY(best.dat_livre_1),'99') + "/" + STRING(YEAR(best.dat_livre_1),'9999').
        END.
        ELSE DO:
            FIND FIRST histor_fgts_inss OF btab NO-LOCK NO-ERROR.
            IF AVAIL histor_fgts_inss THEN DO:
               //ASSIGN dDtIniVig = histor_fgts_inss.dat_inic_vigenc.
                ASSIGN dDtIniVig = STRING(MONTH(histor_fgts_inss.dat_inic_vigenc),'99') + "/" + STRING(DAY(histor_fgts_inss.dat_inic_vigenc),'99') + "/" + STRING(YEAR(histor_fgts_inss.dat_inic_vigenc),'9999').

            END.
        END.
         
        PUT UNFORMATTED
             Cdelimiter1 btab.cod_id_feder                                                Cdelimiter2 //custom-string1               //- CNPJ      
             Cdelimiter1 "12/31/9999"                                                     Cdelimiter2 //end-date                     //- Data final
             Cdelimiter1 btab.cdn_estab                                                   Cdelimiter2 //custom-string2               //- ID Totvs                                
             Cdelimiter1 btab.num_pessoa_jurid                                            Cdelimiter2 //externalCode                 //- C¢digo                                  
             Cdelimiter1 bpj.nom_pessoa_jurid                                             Cdelimiter2 //NAME                         //- Nome                                    
             Cdelimiter1 dDtIniVig                                                        Cdelimiter2 //start-date                   //- Data inicial                            
             Cdelimiter1 btab.nom_pessoa_jurid                                            Cdelimiter2 //description                  //- Descri‡Æo                               
             Cdelimiter1 "Ativa"                                                          Cdelimiter2 //status                       //- Status                                  
             Cdelimiter1 "America/Sao_Paulo"                                              Cdelimiter2 //ctimezone                    //- Fuso Hor rio                            
             Cdelimiter1 btab.cdn_empresa                                                 Cdelimiter2 //LegalEntity.externalCode     //- Empresa                                 
             Cdelimiter1 ""                                                               Cdelimiter2 //PayScaleType.externalCode    //- Sindicato                               
             Cdelimiter1 STRING(bspj.cdn_munpio_ender) + ' - ' + STRING(bpj.nom_cidad_rh) Cdelimiter2 //address.city                 //- Cidade | BRA: Cidade                    
             Cdelimiter1 bpj.cod_pais                                                     Cdelimiter2 //address.country              //- Pa¡s                                    
             Cdelimiter1 WTipoLogradouro                                                  Cdelimiter2 //address.custom-string2       //- BRA: Tipo de Logradouro                 
             Cdelimiter1 WRua                                                             Cdelimiter2 //address.address1             //- BRA: Rua                                
             Cdelimiter1 bpj.num_livre_1                                                  Cdelimiter2 //address.address2             //- BRA: N£mero                             
             Cdelimiter1 SUBSTRING(bpj.cod_livre_1,001,020)                               Cdelimiter2 //address.address3             //- BRA: Complemento                        
             Cdelimiter1 bpj.nom_bairro_rh                                                Cdelimiter2 //address.address4             //- BRA: Bairro                             
             Cdelimiter1 bpj.cod_unid_federac_rh                                          Cdelimiter2 //address.state                //- BRA: Estado                             
             Cdelimiter1 IF bpj.cod_cep_rh <> '' THEN SUBSTRING(bpj.cod_cep_rh,1,5) + '-' + SUBSTRING(bpj.cod_cep_rh,6,3) ELSE '' Cdelimiter1 //address.zip-code             //- BRA: CEP                                
             SKIP.
    END.
OUTPUT CLOSE.
RUN pi-finalizar IN h-acomp. 


