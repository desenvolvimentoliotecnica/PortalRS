/* Recompilacao 12.1.2307.7 Camil*/

/*RecompilaÁ„o 1212307.7*/

Def buffer empresa for mgcad.empresa.

/* CompatibilizaÁ„o TOTVS Camil 12.1.2209*/

/*******************************************************************************
 * Empresa    : QualiIt
 * Cliente    : Camil
 * Programa   : apisfadmissao.p
 * Descricao  : Api para integraá∆oo de Funcion†rio(Criar|Alterar)
 * Autor      : Luiz Fernando Figueiroa Soares
 * Data       : 09/2020
 * Atualizaá∆o: 
******************************************************************************/
/***** Definiá∆o de Variaveis Locais *****/
DEFINE VARIABLE cNomeArq  AS CHAR NO-UNDO. 
DEFINE VARIABLE cArqLog   AS CHAR NO-UNDO.
DEFINE VARIABLE cMensagem AS CHAR NO-UNDO.

/***** Definiá∆o de Variaveis Readmissao *****/
DEFINE VARIABLE lReadmissao     AS LOG INITIAL NO NO-UNDO.
DEFINE VARIABLE iSexoRead       AS INT            NO-UNDO.
DEFINE VARIABLE cDtNascRead     AS CHAR           NO-UNDO.
DEFINE VARIABLE cNomeRead       AS CHAR           NO-UNDO.
DEFINE VARIABLE cNomeEnderecoRh AS CHAR           NO-UNDO.
DEFINE VARIABLE cNomeBairroRh   AS CHAR           NO-UNDO.
DEFINE VARIABLE cNomeCidadeRh   AS CHAR           NO-UNDO.
DEFINE VARIABLE cCodUfRh        AS CHAR           NO-UNDO.
DEFINE VARIABLE iNumPessoa      AS INT            NO-UNDO.
DEFINE VARIABLE iCodGestorOld   AS INTEGER        NO-UNDO.  //D201 - App MeuRH

DEFINE BUFFER b-ext_funcionario    FOR ext_funcionario.
DEFINE BUFFER b-funcionario        FOR funcionario.
DEFINE BUFFER b-sped_participan    FOR sped_participan.
DEFINE BUFFER b-rh_pessoa_fisic    FOR rh_pessoa_fisic.
DEFINE BUFFER b-compl_pessoa_fisic FOR compl_pessoa_fisic.
DEFINE BUFFER b-ficha_medic        FOR ficha_medic.
DEFINE BUFFER b_ficha_medic        FOR ficha_medic.
DEFINE BUFFER b-defcncia_pacien    FOR defcncia_pacien.
DEFINE BUFFER b-defcncia_fisic     FOR defcncia_fisic.


DEFINE STREAM s-imp.

/***** Definiá∆o de Variaveis e Temp-Tables  para chamada do rp.p *****/
DEF NEW GLOBAL SHARED TEMP-TABLE tt-param-aux NO-UNDO
    FIELD destino     AS INT
    FIELD arq-destino AS CHAR
    FIELD arq-entrada AS CHAR
    FIELD todos       AS INT
    FIELD usuario     AS CHAR
    FIELD data-exec   AS DATE
    FIELD hora-exec   AS INT.

/***** Definiá∆o de Includes *****/
{utp/ut-glob.i}
{prghur/fpp/fp6600tt.i}
{cfghur/cfghur.i}

/***** Include Formato CEP *****/
{include/i_dbvers.i}
{prghur/rsp/rsapi006.i}

DEFINE VARIABLE raw-param AS RAW NO-UNDO.

DEFINE TEMP-TABLE tt-raw-digita NO-UNDO
    FIELD raw-digita AS RAW.

{include/i-sysvar.i}

FIND FIRST tt-param-aux NO-LOCK NO-ERROR.
/***** Variaveis para chamado do rp.p *****/

/***** Temp-Tables recebidas no JASON *****/
DEFINE TEMP-TABLE ttFuncionarioR1 NO-UNDO
    FIELD cConstante         AS CHAR
    FIELD iTipoRegistro      AS INT
    FIELD cCodEmpresa        AS CHAR
    FIELD cCodEstab          AS CHAR
    FIELD iMatriculaFunc     AS INT
    FIELD iDigtoMatricula    AS INT
    FIELD iCodCategSalarial  AS INT
    FIELD cNome              AS CHAR
    FIELD iDtAdmissao        AS INT FORMAT 99999999
    FIELD iNumRegistroFunc   AS INT
    FIELD iSexo              AS INT
    FIELD iEstadoCivil       AS INT
    FIELD cEndereco          AS CHAR
    FIELD cPontoRefer        AS CHAR
    FIELD cBairro            AS CHAR
    FIELD cCep               AS CHAR
    FIELD cCidade            AS CHAR
    FIELD cEstado            AS CHAR
    FIELD cPais              AS CHAR
    FIELD iDddTelFunc        AS INT
    FIELD iTelFunc           AS INT
    FIELD cNumCertHabProfiss AS CHAR
    FIELD cUsoInterDatasul   AS CHAR
    FIELD cCodCrachaTsa      AS CHAR
    FIELD iSigOrgEmissIdent  AS INT
    FIELD iCodGestor         AS INT
    FIELD cCodDefcncia       AS CHAR
    FIELD cReabilitadoInss   AS CHAR
    FIELD cCodStatus         AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR2 NO-UNDO
    FIELD cConstante             AS CHAR
    FIELD iTipoRegistro          AS INT
    FIELD iCodEmpresa            AS INT
    FIELD iCodEstab              AS INT
    FIELD iMatriculaFunc         AS INT
    FIELD iDigtoMatricula        AS INT
    FIELD cCaixaPostalFunc       AS CHAR
    FIELD iDddTelContato         AS INT
    FIELD iTelContato            AS INT 
    FIELD iDtNascimento          AS INT FORMAT 99999999
    FIELD iOrigemFunc            AS INT
    FIELD cPaisNascimento        AS CHAR
    FIELD iAnoChegadaPaisEx      AS INT
    FIELD cCartIdentidadeEx      AS CHAR
    FIELD cCpf                   AS CHAR
    FIELD cPis                   AS CHAR
    FIELD iDocMilitarTipo        AS INT
    FIELD iDocMilitarRegiao      AS INT
    FIELD iDocMilitarCircuns     AS INT
    FIELD cDocMilitarNumero      AS CHAR
    FIELD cDocMilitarSerie       AS CHAR
    FIELD cCartIdentidadNumero   AS CHAR
    FIELD cCartIdentidadOrgEmiss AS CHAR
    FIELD cCartIdentidadEstEmiss AS CHAR
    FIELD cTitEleitorNumero      AS CHAR
    FIELD iTitEleitorSecao       AS INT
    FIELD iTitEleitorZona        AS INT
    FIELD cTitEleitorCidade      AS CHAR
    FIELD cTitEleitorEstEmiss    AS CHAR
    FIELD iCartTrabalhoNumero    AS INT
    FIELD iCartTrabalhoSerie     AS INT
    FIELD iCartTrabalhoModelo    AS INT
    FIELD cCartTrabalhoEstEmiss  AS CHAR
    FIELD cZipCode               AS CHAR
    FIELD iCutis                 AS INT
    FIELD iCabelo                AS INT
    FIELD iOlhos                 AS INT
    FIELD dAltura                AS DEC
    FIELD iPeso                  AS INT
    FIELD iManequim              AS INT
    FIELD iSapato                AS INT
    FIELD cPortDeficFisica       AS CHAR
    FIELD iDiasProrrog           AS INT
    FIELD iDtVenctoProrrog       AS INT FORMAT 99999999
    FIELD iNumSeqRegArq          AS INT
    FIELD cCartNacSaude          AS CHAR
    FIELD cCartTrabSerEsocial    AS CHAR
    FIELD cCartSaude             AS CHAR
    FIELD cCodStatus             AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR3 NO-UNDO                    
    FIELD cConstante                     AS CHAR
    FIELD iTipoRegistro                  AS INT
    FIELD iCodEmpresa                    AS INT
    FIELD iCodEstab                      AS INT
    FIELD iMatriculaFunc                 AS INT
    FIELD iDigtoMatricula                AS INT 
    FIELD iCodGrauInstruc                AS INT
    FIELD cIndicFuncEstudant             AS CHAR
    FIELD cUfEmprAnter                   AS CHAR 
    FIELD iNumMatricINSS                 AS INT 
    FIELD iDtUltExMedico                 AS INT FORMAT 99999999
    FIELD iGrpSanguineo                  AS INT
    FIELD iIndFatRhGrpSanguineo          AS INT
    FIELD cIndFuncDoador                 AS CHAR
    FIELD iNumDependSalFam               AS INT
    FIELD iDtVenctoCotSalFam             AS INT FORMAT 99999999
    FIELD iNumDependImpRenda             AS INT
    FIELD iCodPlanoLotac                 AS INT
    FIELD cCodUnidLotac                  AS CHAR
    FIELD cCodCCusto                     AS CHAR
    FIELD cUsoFuturo                     AS CHAR
    FIELD iCodTurno                      AS INT
    FIELD iCodTurma                      AS INT
    FIELD iNumRelPonto                   AS INT
    FIELD iNumChapeiro                   AS INT
    FIELD iNumCartPonto                  AS INT
    FIELD cUsoIntDatasul                 AS CHAR
    FIELD iTipoFunc                      AS INT
    FIELD cIndFuncQualificado            AS CHAR
    FIELD iCodVincEmpregat               AS INT
    FIELD iIndFuncVinc                   AS INT
    FIELD cIndTipoMo                     AS CHAR
    FIELD iCodCargoBasic                 AS INT
    FIELD iCodNivel                      AS INT
    FIELD dSalRealAdmiss                 AS DEC 
    FIELD cIndConsidTabSal               AS CHAR
    FIELD iCodTabSal                     AS INT
    FIELD iFaixaSalTab                   AS INT
    FIELD iNivelSalFaixa                 AS INT
    FIELD iDtUltAlterSal                 AS INT FORMAT 99999999
    FIELD iMotivoUltAlterSal             AS INT
    FIELD iCodCargBasAtual               AS INT
    FIELD iCodNivelAtual                 AS INT
    FIELD dSalAtual                      AS DEC 
    FIELD dSalSimulado                   AS DEC 
    FIELD cIndOptanteFGTS                AS CHAR
    FIELD iDtOpcaoFGTS                   AS INT FORMAT 99999999
    FIELD dCodSistemaFGTS                AS DEC
    FIELD iTipoAdmissFGTS                AS INT
    FIELD cIndRecolheFGTS                AS CHAR
    FIELD iNumMesNOptanteFGTS            AS INT
    FIELD cIndFuncRecolheINSS            AS CHAR
    FIELD iclassINSSFuncSemVinc          AS INT
    FIELD iDtMudClassINSS                AS INT FORMAT 99999999
    FIELD iFormaPagto                    AS INT
    FIELD iCodBancFormaPagto             AS INT
    FIELD iCodAgencFormaPagto            AS INT
    FIELD iFormaPagtoBanc                AS INT
    FIELD iCodBancComplFGTSTempor        AS INT
    FIELD iCodAgencComplFGTSTempor       AS INT
    FIELD iCodContaCorrComplFGTSTempor   AS INT
    FIELD cDigContaCorrComplFGTSTempor   AS CHAR
    FIELD iFormaPagtoBancComplFGTSTempor AS INT
    FIELD iRegSalarial                   AS INT
    FIELD cCodUnidNeg                    AS CHAR
    FIELD iIndCooperado                  AS INT
    FIELD iCodCategSEFIP                 AS INT
    FIELD cCodStatus                     AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR4 NO-UNDO                    
    FIELD cConstante                 AS CHAR
    FIELD iTipoRegistro              AS INT
    FIELD iCodEmpresa                AS INT
    FIELD iCodEstab                  AS INT
    FIELD iMatriculaFunc             AS INT
    FIELD iDigtoMatricula            AS INT 
    FIELD iNumContaCorrBanc          AS INT
    FIELD cDigitoContaCorr           AS CHAR
    FIELD cIndFuncSindicalizado      AS CHAR 
    FIELD cIndDescContribSindical    AS CHAR 
    FIELD cIndCargaAutomTurno        AS CHAR
    FIELD cIndRecebAdicPericul       AS CHAR
    FIELD iNivPericul                AS INT
    FIELD cIndRecebAdicInsalub       AS CHAR
    FIELD iNivInsalub                AS INT
    FIELD cIndRecebAdiantamento      AS CHAR
    FIELD cIndConsidEmissRAIS        AS CHAR
    FIELD cIndCalc13Sal              AS CHAR
    FIELD cIndRecebFerias            AS CHAR
    FIELD iNumAvos13SalCalcAnter     AS INT
    FIELD iNumAvos13SalCalc          AS INT
    FIELD dVlProvAcum13Sal           AS DEC 
    FIELD dVlProvAcumINSS13Sal       AS DEC 
    FIELD dVlProvAcumFGTS13Sal       AS DEC 
    FIELD dDiasProvFeriasMesAnter    AS DEC 
    FIELD dDiasProvFeriasMesAtual    AS DEC 
    FIELD dVlProvAcumFerias          AS DEC 
    FIELD dVlProvAcumINSSFerias      AS DEC 
    FIELD dVlProvAcumFGTSFerias      AS DEC 
    FIELD dVlProvAcumFerias13        AS DEC 
    FIELD cEmitCartPonto             AS CHAR
    FIELD dSaldHrsCompensMesAnter    AS DEC
    FIELD cSinSaldHrsCompensMesAnter AS CHAR
    FIELD cSinSaldHrsCompens         AS CHAR
    FIELD cNomePai                   AS CHAR
    FIELD cNomeMae                   AS CHAR
    FIELD cCodRegSistemaExter        AS CHAR
    FIELD cNumCartHabilit            AS CHAR
    FIELD iNumEnderResid             AS INT
    FIELD cUsoFuturo                 AS CHAR
    FIELD cCodStatus                 AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR5 NO-UNDO                    
    FIELD cConstante             AS CHAR
    FIELD iTipoRegistro          AS INT
    FIELD iCodEmpresa            AS INT
    FIELD iCodEstab              AS INT
    FIELD iMatriculaFunc         AS INT
    FIELD iDigtoMatricula        AS INT 
    FIELD cNomAbrevFunc          AS CHAR
    FIELD iDtAdmissTransf        AS INT FORMAT 99999999
    FIELD iDtUltAvaliaFunc       AS INT FORMAT 99999999
    FIELD dPercentAdiantConced   AS DEC 
    FIELD iDtTermContrato        AS INT FORMAT 99999999
    FIELD iDtUltAlterEnderFunc   AS INT FORMAT 99999999
    FIELD iNumMesesTrabAnter     AS INT
    FIELD iDtExperFunc           AS INT FORMAT 99999999
    FIELD iDtVenctoHabilit       AS INT FORMAT 99999999
    FIELD iLocalPagto            AS INT
    FIELD cContribSindicDia      AS CHAR
    FIELD iCgcCAGED              AS INT
    FIELD iFuncAdmitidoCAGED     AS INT
    FIELD iCodAdmissCAGED        AS INT
    FIELD iFuncDemitidoCAGED     AS INT
    FIELD iCodDemissCAGED        AS INT
    FIELD iDtCartTrab            AS INT FORMAT 99999999
    FIELD iDtValidCartTrab       AS INT FORMAT 99999999
    FIELD iDtPISPASEP            AS INT FORMAT 99999999
    FIELD cCodImagem             AS CHAR
    FIELD dCompensacao           AS DEC
    FIELD dCompensacaoMes        AS DEC
    FIELD iQtdeDiasContratExper  AS INT
    FIELD iCodLocalMarcacao      AS INT
    FIELD iCodFornecedor         AS INT
    FIELD iCodClassFuncPontEletr AS INT
    FIELD iUsoFuturo0            AS INT
    FIELD iUsoFuturo1            AS INT
    FIELD iUsoFuturo2            AS INT
    FIELD iUsoFuturo3            AS INT
    FIELD dUsoFuturo4            AS DEC
    FIELD dUsoFuturo5            AS DEC
    FIELD cUsoFuturo6            AS CHAR
    FIELD iUsoFuturo7            AS INT
    FIELD iUsoFuturo8            AS INT
    FIELD iUsoFuturo9            AS INT
    FIELD cCodStatus             AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR6 NO-UNDO                    
    FIELD cConstante                 AS CHAR
    FIELD iTipoRegistro              AS INT
    FIELD iCodEmpresa                AS INT
    FIELD iCodEstab                  AS INT
    FIELD iMatriculaFunc             AS INT
    FIELD iDigtoMatricula            AS INT 
    FIELD cNumCartTrabAnter          AS CHAR
    FIELD cSerieCartTrabAnter        AS CHAR
    FIELD cPisAnter                  AS CHAR 
    FIELD iNumFax                    AS INT 
    FIELD iTelex                     AS INT
    FIELD cEnderEletrInternet        AS CHAR
    FIELD cCodUFNascimento           AS CHAR
    FIELD cCidadNascimentoFunc       AS CHAR
    FIELD iIndTpVistoEstrang         AS INT
    FIELD iDtValidCartIdentidEstrang AS INT FORMAT 99999999
    FIELD iEmissIdentidad            AS INT
    FIELD iValidIDEstadual           AS INT
    FIELD iCodJornadTraba1           AS INT
    FIELD iCodIntervRefeicao1        AS INT
    FIELD iCodJornadTraba2           AS INT
    FIELD iCodIntervRefeicao2        AS INT
    FIELD iCodJornadTraba3           AS INT
    FIELD iCodIntervRefeicao3        AS INT
    FIELD iCodJornadTraba4           AS INT
    FIELD iCodIntervRefeicao4        AS INT
    FIELD iCodJornadTraba5           AS INT
    FIELD iCodIntervRefeicao5        AS INT
    FIELD iCodExposAgentNocivos      AS INT
    FIELD cDescReverSindical         AS CHAR
    FIELD cPaisLocalidade            AS CHAR
    FIELD iLocalidade                AS INT
    FIELD iCodFPAS                   AS INT
    FIELD cCodTomadorServ            AS CHAR
    FIELD iCodSindicato              AS INT
    FIELD iOcorrCAGED                AS INT
    FIELD cGerarCAGED                AS CHAR
    FIELD cCodStatus                 AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR7 NO-UNDO                    
    FIELD cConstante               AS CHAR
    FIELD iTipoRegistro            AS INT
    FIELD cCodEmpresa              AS CHAR
    FIELD cCodEstab                AS CHAR
    FIELD iMatriculaFunc           AS INT
    FIELD iDigtoMatricula          AS INT 
    FIELD iCategTrabaESocial       AS INT
    FIELD iIndAdmiss               AS INT
    FIELD iNaturAtividad           AS INT 
    FIELD cPaisNacionalidad        AS CHAR 
    FIELD iMunNascIBGE             AS INT
    FIELD cRegIdentidCivil         AS CHAR
    FIELD cUfRegIdentidCivil       AS CHAR
    FIELD cCidadRegIdentidCivil    AS CHAR
    FIELD cOrgEmissRegIdentidCivil AS CHAR
    FIELD iExpedRegIdentidCivil    AS INT 
    FIELD cUsoInternoDatasul1      AS CHAR
    FIELD cUsoInternoDatasul2      AS CHAR
    FIELD cCategCartNacHabilit     AS CHAR
    FIELD cUfCartNacHabilit        AS CHAR
    FIELD cOrgEmissCartNacHabilit  AS CHAR
    FIELD iExpedCartNacHabilit     AS INT
    FIELD iExpedRegNacEstrang      AS INT
    FIELD cOrgEmissRegNacEstrang   AS CHAR
    FIELD cTpLogradESocial         AS CHAR
    FIELD iMunicEnderIBGE          AS INT
    FIELD cEmailPrincipal          AS CHAR
    FIELD cEmailAlternativo        AS CHAR
    FIELD cUsoInternoDatasul3      AS CHAR
    FIELD cUsoInternoDatasul4      AS CHAR
    FIELD cResidExterior           AS CHAR
    FIELD cCodEnderPostResidExt    AS CHAR
    FIELD iDtChegBrasEstrang       AS INT FORMAT 99999999
    FIELD iDtNaturalizacao         AS INT FORMAT 99999999
    FIELD cCasadBrasileiroEstrang  AS CHAR
    FIELD cTemFilhoBrasileiro      AS CHAR
    FIELD cUsoInternoDatasul5      AS CHAR
    FIELD cUsoInternoDatasul6      AS CHAR
    FIELD cProcessAlvarJudicial    AS CHAR
    FIELD cProcessIRRF             AS CHAR
    FIELD cProcessContribPrevid    AS CHAR
    FIELD iDtPrimeirCartNacHabilit AS INT FORMAT 99999999
    FIELD cEnderESocial            AS CHAR
    FIELD cCodStatus               AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR8 NO-UNDO                    
    FIELD cConstante               AS CHAR
    FIELD iTipoRegistro            AS INT
    FIELD cCodEmpresa              AS CHAR
    FIELD cCodEstab                AS CHAR
    FIELD iMatriculaFunc           AS INT
    FIELD iDigtoMatricula          AS INT 
    FIELD cNaturEstagio            AS CHAR
    FIELD iNivEstagio              AS INT
    FIELD cCodPFSuperEstagio       AS CHAR 
    FIELD cAreaAtuacaoEstagio      AS CHAR 
    FIELD cNumApolSegurEstagio     AS CHAR
    FIELD cCodPJInstitEnsinEstagio AS CHAR
    FIELD cCodPJAgentIntegrEstagio AS CHAR
    FIELD cCodStatus               AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR9 NO-UNDO                    
    FIELD cConstante                AS CHAR
    FIELD iTipoRegistro             AS INT
    FIELD cCodEmpresa               AS CHAR
    FIELD cCodEstab                 AS CHAR
    FIELD iMatriculaFunc            AS INT
    FIELD iDigtoMatricula           AS INT 
    FIELD iTpAdmissESocial          AS INT
    FIELD iRegTrabalhista           AS INT
    FIELD iRegPrevidenciario        AS INT 
    FIELD iRegJornada               AS INT 
    FIELD cDescSalVariavel          AS CHAR
    FIELD cCnpjEmpregadorAnter      AS CHAR
    FIELD cMatricESocialAnter       AS CHAR
    FIELD iDtIniVinculo             AS INT FORMAT 99999999
    FIELD cCnpjEmpCedente           AS CHAR
    FIELD cMatricESocialEmpCedente  AS CHAR 
    FIELD iDtAdmissEmpCedente       AS INT FORMAT 99999999
    FIELD iOnusCessao               AS INT
    FIELD cContratTrabTempor        AS CHAR
    FIELD iMotcontratacao           AS INT
    FIELD cMatricESocialFuncSubstit AS CHAR
    FIELD cCpfFuncSubstit           AS CHAR
    FIELD cMatricESocial            AS CHAR
    FIELD cJornFlexibilidad         AS CHAR
    FIELD cInterVariavel            AS CHAR
    FIELD iProvimento               AS INT
    FIELD iTpProvimento             AS INT
    FIELD iDtNomeacao               AS INT FORMAT 99999999
    FIELD iDtPosse                  AS INT FORMAT 99999999
    FIELD iDtExercicio              AS INT FORMAT 99999999
    FIELD cCodStatus                AS CHAR /*A = Active I = Inactive*/.

DEFINE TEMP-TABLE ttFuncionarioR10 NO-UNDO                    
    FIELD cConstante                  AS CHAR
    FIELD iTipoRegistro               AS INT
    FIELD cCodEmpresa                 AS CHAR
    FIELD cCodEstab                   AS CHAR
    FIELD iMatriculaFunc              AS INT
    FIELD iDigtoMatricula             AS INT 
    FIELD cNomESocial                 AS CHAR
    FIELD cNomRelLegais               AS CHAR
    FIELD iDtLaudDoencaGrave          AS INT FORMAT 99999999
    FIELD cNumInscrSegurado           AS CHAR 
    FIELD cCondEstrang                AS CHAR
    FIELD cCidadExterior              AS CHAR
    FIELD iCategCedentOrig            AS INT
    FIELD iCategOrigDirigSindical     AS INT 
    FIELD cCnpjOrigDirigSindical      AS CHAR
    FIELD cMatricOrigDirigSindical    AS CHAR 
    FIELD iDtAdmissOrigDirigSindical  AS INT FORMAT 99999999
    FIELD cTpLogradLocTrabDomestic    AS CHAR
    FIELD cEnderLogradLocTrabDomestic AS CHAR
    FIELD cComplLocTrabaDomestic      AS CHAR
    FIELD cBairrLocTrabDomestic       AS CHAR
    FIELD cNumLogradLocTrabDomestic   AS CHAR
    FIELD iMunLocTrabDomestic         AS INT
    FIELD cUfLocTrabDomestic          AS CHAR
    FIELD iCepLocTrabDomestic         AS INT
    FIELD cSalExclusivVariavel        AS CHAR
    FIELD cCodStatus                  AS CHAR /*A = Active I = Inactive*/.

/***** Temp-Table para gerar o log de retorno *****/
DEFINE TEMP-TABLE ttRetornoAux NO-UNDO
    FIELD cEmpresa   AS CHAR LABEL "Empresa"
    FIELD cEstabel   AS CHAR LABEL "Estab"
    FIELD cMatricula AS CHAR LABEL "Matr°cula".

/***** Temp-Table para gerar o log de retorno no JASON *****/
DEFINE TEMP-TABLE ttRetorno NO-UNDO
    FIELD cEmpresa   AS CHAR LABEL "Empresa"
    FIELD cEstabel   AS CHAR LABEL "Estab"
    FIELD cMatricula AS CHAR LABEL "Matr°cula"
    FIELD cConteudo  AS CHAR LABEL "Conteudo"
    FIELD cMensagem  AS CHAR LABEL "Mensagem".

/***** Temp-Table para importar o log FP6600.LST *****/
DEFINE TEMP-TABLE ttLog NO-UNDO
    FIELD cLinha AS CHAR FORMAT "X(30)".

/***** Temp-Table Readmissao *****/
DEFINE TEMP-TABLE ttReadmissao NO-UNDO
    FIELD R1-cCep                         AS CHAR
    FIELD R1-cNome                        AS CHAR                   
    FIELD R1-iEstadoCivil                 AS INT                   
    FIELD R1-iSexo                        AS INT                   
    FIELD R1-cEndereco                    AS CHAR                   
    FIELD R1-cPontoRefer                  AS CHAR                   
    FIELD R1-cBairro                      AS CHAR                   
    FIELD R1-cCidade                      AS CHAR                   
    FIELD R1-cPais                        AS CHAR                   
    FIELD R1-cEstado                      AS CHAR                   
    FIELD R1-iDddtelFunc                  AS INT                   
    FIELD R1-iTelFunc                     AS INT
    FIELD R2-cCaixaPostalFunc             AS CHAR                   
    FIELD R2-iDddtelContato               AS INT                   
    FIELD R2-iTelContato                  AS INT                   
    FIELD R2-iOrigemFunc                  AS INT                   
    FIELD R2-cPaisNascimento              AS CHAR                   
    FIELD R2-iAnoChegadaPaisEx            AS INT                   
    FIELD R2-cCartIdentidadeEx            AS CHAR                   
    FIELD R2-cCartIdentidadNumero         AS CHAR                   
    FIELD R2-cCartIdentidadOrgEmiss       AS CHAR                   
    FIELD R2-cCartIdentidadEstEmiss       AS CHAR                   
    FIELD R2-iCutis                       AS INT                   
    FIELD R2-iCabelo                      AS INT                   
    FIELD R2-iOlhos                       AS INT                   
    FIELD R2-dAltura                      AS DEC            
    FIELD R2-iPeso                        AS INT                   
    FIELD R2-iManequim                    AS INT                   
    FIELD R2-iSapato                      AS INT                   
    FIELD R2-cCartNacSaude                AS CHAR                   
    FIELD R2-cPortDeficFisica             AS CHAR
    FIELD R2-iDtNascimento                AS CHAR
    FIELD R2-cZipCode                     AS CHAR
    FIELD R3-iCodGrauInstruc              AS INT                   
    FIELD R3-iGrpSanguineo                AS INT                   
    FIELD R3-iIndFatRhGrpSanguineo        AS INT                   
    FIELD R3-cIndFuncDoador               AS CHAR
    FIELD R4-iNumEnderResid               AS INT                   
    FIELD R4-cNomePai                     AS CHAR                   
    FIELD R4-cNomeMae                     AS CHAR                   
    FIELD R5-cNomAbrevFunc                AS CHAR                   
    FIELD R5-cCodImagem                   AS CHAR
    FIELD R6-iNumFax                      AS INT
    FIELD R6-iTelex                       AS INT          
    FIELD R6-cEnderEletrInternet          AS CHAR                   
    FIELD R6-cCodUFNascimento             AS CHAR
    FIELD R6-cCidadNascimentoFunc         AS CHAR                   
    FIELD R6-iIndTpVistoEstrang           AS INT
    FIELD R6-iDtValidCartIdentidEstrang   AS CHAR
    FIELD R6-iEmissIdentidad              AS CHAR
    FIELD R6-iValidIDEstadual             AS CHAR                                    
    FIELD R7-cPaisNacionalidad            AS CHAR                                         
    FIELD R7-cTpLogradESocial             AS CHAR                                            
    FIELD R7-cEmailPrincipal              AS CHAR                                                   
    FIELD R7-cEmailAlternativo            AS CHAR                                                         
    FIELD R7-cResidExterior               AS CHAR                                                          
    FIELD R7-cCodEnderPostResidExt        AS CHAR                                                                    
    FIELD R7-cCasadBrasileiroEstrang      AS CHAR                                                                           
    FIELD R7-cTemFilhoBrasileiro          AS CHAR                                                                           
    FIELD R7-cEnderESocial                AS CHAR                                                                             
    FIELD R7-iMunNascIBGE                 AS INT
    FIELD R7-iMunicEnderIBGE              AS INT
    FIELD R7-iDtChegBrasEstrang           AS CHAR
    FIELD R7-iDtNaturalizacao             AS CHAR
    FIELD R7-cRegIdentidCivil             AS CHAR
    FIELD R7-cUfRegIdentidCivil           AS CHAR
    FIELD R7-cCidadRegIdentidCivil        AS CHAR
    FIELD R7-cOrgEmissRegIdentidCivil     AS CHAR
    FIELD R7-iExpedRegIdentidCivil        AS CHAR
    FIELD R7-iExpedRegNacEstrang          AS CHAR
    FIELD R7-cOrgEmissRegNacEstrang       AS CHAR
    FIELD R10-cCondEstrang                AS CHAR                                                                         
    FIELD R10-cCidadExterior              AS CHAR
    FIELD R10-cNumInscrSegurado           AS CHAR
    FIELD R10-iDtLaudDoencaGrave          AS CHAR
    FIELD R10-cNomRelLegais               AS CHAR
    FIELD R10-cNomeSocial                 AS CHAR.


PROCEDURE SetAdmissao:

    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR1.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR2.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR3.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR4.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR5.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR6.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR7.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR8.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR9.
    DEFINE INPUT  PARAMETER TABLE FOR ttFuncionarioR10.
    DEFINE OUTPUT PARAMETER TABLE FOR ttRetorno.       
    DEFINE OUTPUT PARAMETER pRetorno AS CHAR NO-UNDO.

    ASSIGN cNomeArq = (STRING(SESSION:TEMP-DIRECTORY) +  "funcionario.txt").

    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Inicio Execucao' )) NO-ERROR.
    
    OUTPUT TO VALUE (cNomeArq) CONVERT TARGET 'ISO8859-1'.

    /* Tratar Readmiss∆o */
    FIND FIRST ttFuncionarioR2 NO-LOCK NO-ERROR.
    IF AVAIL ttFuncionarioR2 THEN DO:
       /* Localiza Cadastro Pessoa Fisica e grava CPF, Sexo, Data Nascimento e Nome - Regra do Produto */
       FIND FIRST b-rh_pessoa_fisic 
            WHERE b-rh_pessoa_fisic.cod_id_feder = ttFuncionarioR2.cCpf EXCLUSIVE-LOCK NO-ERROR.
       IF AVAIL b-rh_pessoa_fisic THEN DO:
          CREATE ttReadmissao.
          ASSIGN lReadmissao = YES
                 iSexoRead   = b-rh_pessoa_fisic.idi_sexo   
                 cDtNascRead = STRING(b-rh_pessoa_fisic.dat_nascimento, '99999999')
                 cNomeRead   = b-rh_pessoa_fisic.nom_pessoa_fisic.

          /* Na readmiss∆o j† grava o novo endereáo para as validaá‰es */
          FIND FIRST ttFuncionarioR1 NO-LOCK NO-ERROR.

          /* Grava variaveis para desfazer as alteraá‰es de endereáo se ocorrer erro na inclus∆o */
          ASSIGN cNomeEnderecoRh = b-rh_pessoa_fisic.nom_ender_rh       
                 cNomeBairroRh   = b-rh_pessoa_fisic.nom_bairro_rh      
                 cNomeCidadeRh   = b-rh_pessoa_fisic.nom_cidad_rh       
                 cCodUfRh        = b-rh_pessoa_fisic.cod_unid_federac_rh
                 iNumPessoa      = b-rh_pessoa_fisic.num_pessoa_fisic.

          /* Atualiza endereáo com as novas informaá‰es */
          ASSIGN b-rh_pessoa_fisic.nom_ender_rh        = ttFuncionarioR1.cEndereco
			  	 b-rh_pessoa_fisic.nom_bairro_rh       = ttFuncionarioR1.cBairro            
				 b-rh_pessoa_fisic.nom_cidad_rh        = ttFuncionarioR1.cCidade 
				 b-rh_pessoa_fisic.cod_unid_federac_rh = ttFuncionarioR1.cEstado.

       END.

       /***** Validaá∆o Portador de Deficiància F°sica *****/
       FIND FIRST ttFuncionarioR1 NO-LOCK NO-ERROR.

       IF (ttFuncionarioR2.cPortDeficFisica = "S" OR
           ttFuncionarioR2.cPortDeficFisica = "N") THEN DO:

           RUN pi-valida-deficiencia (OUTPUT cMensagem). /*Valida Deficiencia*/

           IF RETURN-VALUE = 'NOK' THEN DO:
           ASSIGN pRetorno = cMensagem.
           {integracao/api/sucess/apisfrelease.i}. 
           RETURN ERROR pRetorno.
           END.
       END.
    END.

    IF RETURN-VALUE <> 'NOK' THEN DO:

        FOR EACH ttFuncionarioR1 EXCLUSIVE-LOCK:
          
            ASSIGN ttFuncionarioR1.cCep = REPLACE(ttFuncionarioR1.cCep,'-','').
        
            EXPORT DELIMITER ";"
                   ttFuncionarioR1.cConstante          
                   ttFuncionarioR1.iTipoRegistro       
                   ttFuncionarioR1.cCodEmpresa         
                   ttFuncionarioR1.cCodEstab           
                   ttFuncionarioR1.iMatriculaFunc      
                   ttFuncionarioR1.iDigtoMatricula     
                   ttFuncionarioR1.iCodCategSalarial   
                   IF lReadmissao = YES THEN cNomeRead ELSE ttFuncionarioR1.cNome               
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR1.iDtAdmissao))) + STRING(ttFuncionarioR1.iDtAdmissao))
                   ttFuncionarioR1.iNumRegistroFunc   
                   IF lReadmissao = YES THEN iSexoRead ELSE ttFuncionarioR1.iSexo              
                   ttFuncionarioR1.iEstadoCivil       
                   ttFuncionarioR1.cEndereco          
                   ttFuncionarioR1.cPontoRefer        
                   ttFuncionarioR1.cBairro            
                   ttFuncionarioR1.cCep               
                   ttFuncionarioR1.cCidade            
                   ttFuncionarioR1.cEstado            
                   ttFuncionarioR1.cPais              
                   ttFuncionarioR1.iDddTelFunc        
                   ttFuncionarioR1.iTelFunc           
                   ttFuncionarioR1.cNumCertHabProfiss 
                   ttFuncionarioR1.cUsoInterDatasul.
        
            LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - SetAdmissao ' + STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR1.iDtAdmissao))) + STRING(ttFuncionarioR1.iDtAdmissao)) )) NO-ERROR.
        
            /***** Tabela para criar o registro de retorno do processamento *****/
            FIND FIRST ttRetornoAux
                 WHERE ttRetornoAux.cEmpresa   = ttFuncionarioR1.cCodEmpresa
                   AND ttretornoAux.cEstabel   = ttFuncionarioR1.cCodEstab
                   AND ttRetornoAux.cMatricula = STRING(ttFuncionarioR1.iMatriculaFunc) NO-LOCK NO-ERROR.
            IF NOT AVAIL ttRetornoAux THEN DO:
               CREATE ttRetornoAux.
               ASSIGN ttRetornoAux.cEmpresa   = ttFuncionarioR1.cCodEmpresa   
                      ttretornoAux.cEstabel   = ttFuncionarioR1.cCodEstab     
                      ttRetornoAux.cMatricula = STRING(ttFuncionarioR1.iMatriculaFunc).
            END.
           
            /***** Validaá∆o para identificar se o Funcion†rio j† existe *****/
            FIND FIRST b-funcionario
                 WHERE b-funcionario.cdn_empresa       = ttFuncionarioR1.cCodEmpresa
                   AND b-funcionario.cdn_estab         = ttFuncionarioR1.cCodEstab
                   AND b-funcionario.cdn_funcionario   = ttFuncionarioR1.iMatriculaFunc NO-LOCK NO-ERROR.
            IF AVAIL b-funcionario THEN DO:
               ASSIGN pRetorno = 'J† existe ocorrància Funcion†rio' + ' Emp: ' + 
                                 STRING(b-funcionario.cdn_empresa) + ' - Estab: ' +
                                 STRING(b-funcionario.cdn_estab) + ' - Matr: ' +
                                 STRING(b-funcionario.cdn_funcionario) + ' cadastrado.'.
               {integracao/api/sucess/apisfrelease.i}.                                 
               RETURN ERROR STRING(pRetorno).
            END.
        
            /* Grava informaá‰es R1 para Readmiss∆o - 12 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R1-cCep         = ttFuncionarioR1.cCep
                      ttReadmissao.R1-cNome        = ttFuncionarioR1.cNome       
                      ttReadmissao.R1-iEstadoCivil = ttFuncionarioR1.iEstadoCivil
                      ttReadmissao.R1-iSexo        = ttFuncionarioR1.iSexo       
                      ttReadmissao.R1-cEndereco    = ttFuncionarioR1.cEndereco   
                      ttReadmissao.R1-cPontoRefer  = ttFuncionarioR1.cPontoRefer 
                      ttReadmissao.R1-cBairro      = ttFuncionarioR1.cBairro     
                      ttReadmissao.R1-cCidade      = ttFuncionarioR1.cCidade     
                      ttReadmissao.R1-cPais        = ttFuncionarioR1.cPais       
                      ttReadmissao.R1-cEstado      = ttFuncionarioR1.cEstado     
                      ttReadmissao.R1-iDddtelFunc  = ttFuncionarioR1.iDddtelFunc 
                      ttReadmissao.R1-iTelFunc     = ttFuncionarioR1.iTelFunc.  
            END.
        END.
        
        FOR EACH ttFuncionarioR2 NO-LOCK:
            EXPORT DELIMITER ";"
                   ttFuncionarioR2.cConstante         
                   ttFuncionarioR2.iTipoRegistro      
                   ttFuncionarioR2.iCodEmpresa        
                   ttFuncionarioR2.iCodEstab          
                   ttFuncionarioR2.iMatriculaFunc     
                   ttFuncionarioR2.iDigtoMatricula    
                   ttFuncionarioR2.cCaixaPostalFunc   
                   ttFuncionarioR2.iDddTelContato     
                   ttFuncionarioR2.iTelContato        
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR2.iDtNascimento))) + STRING(ttFuncionarioR2.iDtNascimento))
                   ttFuncionarioR2.iOrigemFunc        
                   ttFuncionarioR2.cPaisNascimento    
                   ttFuncionarioR2.iAnoChegadaPaisEx  
                   ttFuncionarioR2.cCartIdentidadeEx  
                   ttFuncionarioR2.cCpf               
                   ttFuncionarioR2.cPis               
                   ttFuncionarioR2.iDocMilitarTipo    
                   ttFuncionarioR2.iDocMilitarRegiao  
                   ttFuncionarioR2.iDocMilitarCircuns 
                   ttFuncionarioR2.cDocMilitarNumero  
                   ttFuncionarioR2.cDocMilitarSerie   
                   ttFuncionarioR2.cCartIdentidadNumer
                   ttFuncionarioR2.cCartIdentidadOrgEm
                   ttFuncionarioR2.cCartIdentidadEstEm
                   ttFuncionarioR2.cTitEleitorNumero  
                   ttFuncionarioR2.iTitEleitorSecao   
                   ttFuncionarioR2.iTitEleitorZona    
                   ttFuncionarioR2.cTitEleitorCidade  
                   ttFuncionarioR2.cTitEleitorEstEmiss
                   ttFuncionarioR2.iCartTrabalhoNumero
                   ttFuncionarioR2.iCartTrabalhoSerie 
                   ttFuncionarioR2.iCartTrabalhoModelo
                   ttFuncionarioR2.cCartTrabalhoEstEmi
                   ttFuncionarioR2.cZipCode           
                   ttFuncionarioR2.iCutis             
                   ttFuncionarioR2.iCabelo            
                   ttFuncionarioR2.iOlhos             
                   STRING(ttFuncionarioR2.dAltura * 100, '99999')
                   ttFuncionarioR2.iPeso              
                   ttFuncionarioR2.iManequim          
                   ttFuncionarioR2.iSapato            
                   ttFuncionarioR2.cPortDeficFisica   
                   ttFuncionarioR2.iDiasProrrog       
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR2.iDtVenctoProrrog))) + STRING(ttFuncionarioR2.iDtVenctoProrrog))
                   ttFuncionarioR2.iNumSeqRegArq      
                   ttFuncionarioR2.cCartNacSaude      
                   ttFuncionarioR2.cCartTrabSerEsocial.
        
            /* Grava informaá‰es R2 para Readmiss∆o - 21 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R2-cCaixaPostalFunc       = ttFuncionarioR2.cCaixaPostalFunc      
                      ttReadmissao.R2-iDddtelContato         = ttFuncionarioR2.iDddtelContato        
                      ttReadmissao.R2-iTelContato            = ttFuncionarioR2.iTelContato           
                      ttReadmissao.R2-iOrigemFunc            = ttFuncionarioR2.iOrigemFunc           
                      ttReadmissao.R2-cPaisNascimento        = ttFuncionarioR2.cPaisNascimento       
                      ttReadmissao.R2-iAnoChegadaPaisEx      = ttFuncionarioR2.iAnoChegadaPaisEx     
                      ttReadmissao.R2-cCartIdentidadeEx      = ttFuncionarioR2.cCartIdentidadeEx     
                      ttReadmissao.R2-cCartIdentidadNumero   = ttFuncionarioR2.cCartIdentidadNumero  
                      ttReadmissao.R2-cCartIdentidadOrgEmiss = ttFuncionarioR2.cCartIdentidadOrgEmiss
                      ttReadmissao.R2-cCartIdentidadEstEmiss = ttFuncionarioR2.cCartIdentidadEstEmiss
                      ttReadmissao.R2-iCutis                 = ttFuncionarioR2.iCutis                
                      ttReadmissao.R2-iCabelo                = ttFuncionarioR2.iCabelo               
                      ttReadmissao.R2-iOlhos                 = ttFuncionarioR2.iOlhos                
                      ttReadmissao.R2-dAltura                = DEC(STRING(ttFuncionarioR2.dAltura * 100, '99999'))
                      ttReadmissao.R2-iPeso                  = ttFuncionarioR2.iPeso                 
                      ttReadmissao.R2-iManequim              = ttFuncionarioR2.iManequim             
                      ttReadmissao.R2-iSapato                = ttFuncionarioR2.iSapato               
                      ttReadmissao.R2-cCartNacSaude          = ttFuncionarioR2.cCartNacSaude         
                      ttReadmissao.R2-cPortDeficFisica       = ttFuncionarioR2.cPortDeficFisica      
                      ttReadmissao.R2-iDtNascimento          = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR2.iDtNascimento))) + STRING(ttFuncionarioR2.iDtNascimento))
                      ttReadmissao.R2-cZipCode               = ttFuncionarioR2.cZipCode.
            END.
        END.
        
        FOR EACH ttFuncionarioR3 NO-LOCK:

            /* Validaá∆o Unidade de Neg¢cio FP0500 */
            FIND FIRST param_empres_rh NO-LOCK
                 WHERE param_empres_rh.cdn_empresa = STRING(ttFuncionarioR3.iCodEmpresa) NO-ERROR.
            IF AVAIL param_empres_rh THEN DO:
               IF SUBSTRING(param_empres_rh.cod_livre_1,99,1) = 'N' AND
                            ttFuncionarioR3.cCodUnidNeg       <> '' THEN DO:
                  ASSIGN ttFuncionarioR3.cCodUnidNeg = "".
               END.
            END.

            EXPORT DELIMITER ";" 
                   ttFuncionarioR3.cConstante                    
                   ttFuncionarioR3.iTipoRegistro                 
                   ttFuncionarioR3.iCodEmpresa                   
                   ttFuncionarioR3.iCodEstab                     
                   ttFuncionarioR3.iMatriculaFunc                
                   ttFuncionarioR3.iDigtoMatricula               
                   ttFuncionarioR3.iCodGrauInstruc               
                   ttFuncionarioR3.cIndicFuncEstudant            
                   ttFuncionarioR3.cUfEmprAnter                  
                   ttFuncionarioR3.iNumMatricINSS                
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR3.iDtUltExMedico))) + STRING(ttFuncionarioR3.iDtUltExMedico))
                   ttFuncionarioR3.iGrpSanguineo                 
                   ttFuncionarioR3.iIndFatRhGrpSanguineo         
                   ttFuncionarioR3.cIndFuncDoador                
                   ttFuncionarioR3.iNumDependSalFam              
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR3.iDtVenctoCotSalFam))) + STRING(ttFuncionarioR3.iDtVenctoCotSalFam))
                   ttFuncionarioR3.iNumDependImpRenda            
                   ttFuncionarioR3.iCodPlanoLotac                
                   ttFuncionarioR3.cCodUnidLotac                 
                   ttFuncionarioR3.cCodCCusto                    
                   ttFuncionarioR3.cUsoFuturo                    
                   ttFuncionarioR3.iCodTurno                     
                   ttFuncionarioR3.iCodTurma                     
                   ttFuncionarioR3.iNumRelPonto                  
                   ttFuncionarioR3.iNumChapeiro                  
                   ttFuncionarioR3.iNumCartPonto                 
                   ttFuncionarioR3.cUsoIntDatasul                
                   ttFuncionarioR3.iTipoFunc                     
                   ttFuncionarioR3.cIndFuncQualificado           
                   ttFuncionarioR3.iCodVincEmpregat              
                   ttFuncionarioR3.iIndFuncVinc                  
                   ttFuncionarioR3.cIndTipoMo                    
                   ttFuncionarioR3.iCodCargoBasic                
                   ttFuncionarioR3.iCodNivel                     
                   STRING(ttFuncionarioR3.dSalRealAdmiss * 10000, '99999999999')
                   ttFuncionarioR3.cIndConsidTabSal              
                   ttFuncionarioR3.iCodTabSal                    
                   ttFuncionarioR3.iFaixaSalTab                  
                   ttFuncionarioR3.iNivelSalFaixa                
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR3.iDtUltAlterSal))) + STRING(ttFuncionarioR3.iDtUltAlterSal))
                   ttFuncionarioR3.iMotivoUltAlterSal            
                   ttFuncionarioR3.iCodCargBasAtual              
                   ttFuncionarioR3.iCodNivelAtual                
                   STRING(ttFuncionarioR3.dSalAtual * 10000, '99999999999')
                   STRING(ttFuncionarioR3.dSalSimulado * 10000, '99999999999') 
                   ttFuncionarioR3.cIndOptanteFGTS               
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR3.iDtOpcaoFGTS))) + STRING(ttFuncionarioR3.iDtOpcaoFGTS))
                   ttFuncionarioR3.dCodSistemaFGTS               
                   ttFuncionarioR3.iTipoAdmissFGTS               
                   ttFuncionarioR3.cIndRecolheFGTS               
                   ttFuncionarioR3.iNumMesNOptanteFGTS           
                   ttFuncionarioR3.cIndFuncRecolheINSS           
                   ttFuncionarioR3.iclassINSSFuncSemVinc         
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR3.iDtMudClassINSS))) + STRING(ttFuncionarioR3.iDtMudClassINSS))
                   ttFuncionarioR3.iFormaPagto                   
                   ttFuncionarioR3.iCodBancFormaPagto
                   ttFuncionarioR3.iCodAgencFormaPagto           
                   ttFuncionarioR3.iFormaPagtoBanc               
                   ttFuncionarioR3.iCodBancComplFGTSTempor       
                   ttFuncionarioR3.iCodAgencComplFGTSTempor      
                   ttFuncionarioR3.iCodContaCorrComplFGTSTempor  
                   ttFuncionarioR3.cDigContaCorrComplFGTSTempor  
                   ttFuncionarioR3.iFormaPagtoBancComplFGTSTempor
                   ttFuncionarioR3.iRegSalarial                  
                   ttFuncionarioR3.cCodUnidNeg                   
                   ttFuncionarioR3.iIndCooperado                 
                   ttFuncionarioR3.iCodCategSEFIP
                   "".
        
            /* Grava informaá‰es R3 para Readmiss∆o - 4 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R3-iCodGrauInstruc       = ttFuncionarioR3.iCodGrauInstruc      
                      ttReadmissao.R3-iGrpSanguineo         = ttFuncionarioR3.iGrpSanguineo        
                      ttReadmissao.R3-iIndFatRhGrpSanguineo = ttFuncionarioR3.iIndFatRhGrpSanguineo
                      ttReadmissao.R3-cIndFuncDoador        = ttFuncionarioR3.cIndFuncDoador.
            END.
        END.
        
        FOR EACH ttFuncionarioR4 NO-LOCK:
            EXPORT DELIMITER ";" 
                   ttFuncionarioR4.cConstante                
                   ttFuncionarioR4.iTipoRegistro             
                   ttFuncionarioR4.iCodEmpresa               
                   ttFuncionarioR4.iCodEstab                 
                   ttFuncionarioR4.iMatriculaFunc            
                   ttFuncionarioR4.iDigtoMatricula           
                   ttFuncionarioR4.iNumContaCorrBanc         
                   ttFuncionarioR4.cDigitoContaCorr          
                   ttFuncionarioR4.cIndFuncSindicalizado     
                   ttFuncionarioR4.cIndDescContribSindical   
                   ttFuncionarioR4.cIndCargaAutomTurno       
                   ttFuncionarioR4.cIndRecebAdicPericul      
                   ttFuncionarioR4.iNivPericul               
                   ttFuncionarioR4.cIndRecebAdicInsalub      
                   ttFuncionarioR4.iNivInsalub               
                   ttFuncionarioR4.cIndRecebAdiantamento     
                   ttFuncionarioR4.cIndConsidEmissRAIS       
                   ttFuncionarioR4.cIndCalc13Sal             
                   ttFuncionarioR4.cIndRecebFerias           
                   ttFuncionarioR4.iNumAvos13SalCalcAnter    
                   ttFuncionarioR4.iNumAvos13SalCalc         
                   STRING(ttFuncionarioR4.dVlProvAcum13Sal * 100, '99999999999')
                   STRING(ttFuncionarioR4.dVlProvAcumINSS13Sal * 100, '9999999999')
                   STRING(ttFuncionarioR4.dVlProvAcumFGTS13Sal * 100, '9999999999')
                   STRING(ttFuncionarioR4.dDiasProvFeriasMesAnter * 10, '999999')
                   STRING(ttFuncionarioR4.dDiasProvFeriasMesAtual * 10, '999999')
                   STRING(ttFuncionarioR4.dVlProvAcumFerias * 100, '99999999999')
                   STRING(ttFuncionarioR4.dVlProvAcumINSSFerias * 100, '99999999999')
                   STRING(ttFuncionarioR4.dVlProvAcumFGTSFerias * 100, '99999999999')
                   STRING(ttFuncionarioR4.dVlProvAcumFerias13 * 100, '99999999999') 
                   ttFuncionarioR4.cEmitCartPonto            
                   STRING(ttFuncionarioR4.dSaldHrsCompensMesAnter * 1000, '999999999')
                   ttFuncionarioR4.cSinSaldHrsCompensMesAnter
                   ttFuncionarioR4.cSinSaldHrsCompens        
                   ttFuncionarioR4.cNomePai                  
                   ttFuncionarioR4.cNomeMae                  
                   ttFuncionarioR4.cCodRegSistemaExter       
                   ttFuncionarioR4.cNumCartHabilit           
                   ttFuncionarioR4.iNumEnderResid            
                   ttFuncionarioR4.cUsoFuturo.
        
            /* Grava informaá‰es R4 para Readmiss∆o - 3 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R4-iNumEnderResid = ttFuncionarioR4.iNumEnderResid
                      ttReadmissao.R4-cNomePai       = ttFuncionarioR4.cNomePai
                      ttReadmissao.R4-cNomeMae       = ttFuncionarioR4.cNomeMae.
            END.
        END.
        
        FOR EACH ttFuncionarioR5 NO-LOCK:
            EXPORT DELIMITER ";" 
                   ttFuncionarioR5.cConstante            
                   ttFuncionarioR5.iTipoRegistro         
                   ttFuncionarioR5.iCodEmpresa           
                   ttFuncionarioR5.iCodEstab             
                   ttFuncionarioR5.iMatriculaFunc        
                   ttFuncionarioR5.iDigtoMatricula       
                   ttFuncionarioR5.cNomAbrevFunc         
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtAdmissTransf))) + STRING(ttFuncionarioR5.iDtAdmissTransf))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtUltAvaliaFunc))) + STRING(ttFuncionarioR5.iDtUltAvaliaFunc))
                   STRING(ttFuncionarioR5.dPercentAdiantConced * 100, '999999')
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtTermContrato))) + STRING(ttFuncionarioR5.iDtTermContrato))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtUltAlterEnderFunc))) + STRING(ttFuncionarioR5.iDtUltAlterEnderFunc))
                   ttFuncionarioR5.iNumMesesTrabAnter    
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtExperFunc))) + STRING(ttFuncionarioR5.iDtExperFunc))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtVenctoHabilit))) + STRING(ttFuncionarioR5.iDtVenctoHabilit))
                   ttFuncionarioR5.iLocalPagto           
                   ttFuncionarioR5.cContribSindicDia     
                   ttFuncionarioR5.iCgcCAGED             
                   ttFuncionarioR5.iFuncAdmitidoCAGED    
                   ttFuncionarioR5.iCodAdmissCAGED       
                   ttFuncionarioR5.iFuncDemitidoCAGED    
                   ttFuncionarioR5.iCodDemissCAGED       
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtCartTrab))) + STRING(ttFuncionarioR5.iDtCartTrab))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtValidCartTrab))) + STRING(ttFuncionarioR5.iDtValidCartTrab))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR5.iDtPISPASEP))) + STRING(ttFuncionarioR5.iDtPISPASEP))
                   ttFuncionarioR5.cCodImagem            
                   STRING(ttFuncionarioR5.dCompensacao * 100000, '9999999999999')
                   STRING(ttFuncionarioR5.dCompensacaoMes * 100000, '9999999999999')
                   ttFuncionarioR5.iQtdeDiasContratExper 
                   ttFuncionarioR5.iCodLocalMarcacao     
                   ttFuncionarioR5.iCodFornecedor        
                   ttFuncionarioR5.iCodClassFuncPontEletr
                   ttFuncionarioR5.iUsoFuturo0           
                   ttFuncionarioR5.iUsoFuturo1           
                   ttFuncionarioR5.iUsoFuturo2           
                   ttFuncionarioR5.iUsoFuturo3           
                   ttFuncionarioR5.dUsoFuturo4           
                   ttFuncionarioR5.dUsoFuturo5           
                   ttFuncionarioR5.cUsoFuturo6           
                   ttFuncionarioR5.iUsoFuturo7           
                   ttFuncionarioR5.iUsoFuturo8           
                   ttFuncionarioR5.iUsoFuturo9.
        
            /* Grava informaá‰es R5 para Readmiss∆o - 2 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R5-cNomAbrevFunc = ttFuncionarioR5.cNomAbrevFunc
                      ttReadmissao.R5-cCodImagem    = ttFuncionarioR5.cCodImagem.
            END.
        END.
        
        FOR EACH ttFuncionarioR6 NO-LOCK:
            EXPORT DELIMITER ";" 
                   ttFuncionarioR6.cConstante                
                   ttFuncionarioR6.iTipoRegistro             
                   ttFuncionarioR6.iCodEmpresa               
                   ttFuncionarioR6.iCodEstab                 
                   ttFuncionarioR6.iMatriculaFunc            
                   ttFuncionarioR6.iDigtoMatricula           
                   ttFuncionarioR6.cNumCartTrabAnter         
                   ttFuncionarioR6.cSerieCartTrabAnter       
                   ttFuncionarioR6.cPisAnter                 
                   ttFuncionarioR6.iNumFax                   
                   ttFuncionarioR6.iTelex                    
                   ttFuncionarioR6.cEnderEletrInternet       
                   ttFuncionarioR6.cCodUFNascimento          
                   ttFuncionarioR6.cCidadNascimentoFunc      
                   ttFuncionarioR6.iIndTpVistoEstrang        
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR6.iDtValidCartIdentidEstrang))) + STRING(ttFuncionarioR6.iDtValidCartIdentidEstrang))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR6.iEmissIdentidad))) + STRING(ttFuncionarioR6.iEmissIdentidad))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR6.iValidIDEstadual))) + STRING(ttFuncionarioR6.iValidIDEstadual))
                   ttFuncionarioR6.iCodJornadTraba1          
                   ttFuncionarioR6.iCodIntervRefeicao1       
                   ttFuncionarioR6.iCodJornadTraba2          
                   ttFuncionarioR6.iCodIntervRefeicao2       
                   ttFuncionarioR6.iCodJornadTraba3          
                   ttFuncionarioR6.iCodIntervRefeicao3       
                   ttFuncionarioR6.iCodJornadTraba4          
                   ttFuncionarioR6.iCodIntervRefeicao4       
                   ttFuncionarioR6.iCodJornadTraba5          
                   ttFuncionarioR6.iCodIntervRefeicao5       
                   ttFuncionarioR6.iCodExposAgentNocivos     
                   ttFuncionarioR6.cDescReverSindical        
                   ttFuncionarioR6.cPaisLocalidade           
                   ttFuncionarioR6.iLocalidade               
                   ttFuncionarioR6.iCodFPAS                  
                   ttFuncionarioR6.cCodTomadorServ           
                   ttFuncionarioR6.iCodSindicato             
                   ttFuncionarioR6.iOcorrCAGED               
                   ttFuncionarioR6.cGerarCAGED.
        
            /* Grava informaá‰es R6 para Readmiss∆o - 9 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R6-iNumFax                    = ttFuncionarioR6.iNumFax                   
                      ttReadmissao.R6-iTelex                     = ttFuncionarioR6.iTelex                    
                      ttReadmissao.R6-cEnderEletrInternet        = ttFuncionarioR6.cEnderEletrInternet       
                      ttReadmissao.R6-cCodUFNascimento           = ttFuncionarioR6.cCodUFNascimento          
                      ttReadmissao.R6-cCidadNascimentoFunc       = ttFuncionarioR6.cCidadNascimentoFunc      
                      ttReadmissao.R6-iIndTpVistoEstrang         = ttFuncionarioR6.iIndTpVistoEstrang
                      ttReadmissao.R6-iDtValidCartIdentidEstrang = STRING(FILL("0",8 - LENGTH(STRING(ttReadmissao.R6-iDtValidCartIdentidEstrang))) + STRING(ttReadmissao.R6-iDtValidCartIdentidEstrang))   
                      ttReadmissao.R6-iEmissIdentidad            = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR6.iEmissIdentidad))) + STRING(ttFuncionarioR6.iEmissIdentidad))
                      ttReadmissao.R6-iValidIDEstadual           = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR6.iValidIDEstadual))) + STRING(ttFuncionarioR6.iValidIDEstadual)).
            END.
        END.
        
        FOR EACH ttFuncionarioR7 NO-LOCK:
            EXPORT DELIMITER ";" 
                   ttFuncionarioR7.cConstante              
                   ttFuncionarioR7.iTipoRegistro           
                   ttFuncionarioR7.cCodEmpresa             
                   ttFuncionarioR7.cCodEstab               
                   ttFuncionarioR7.iMatriculaFunc          
                   ttFuncionarioR7.iDigtoMatricula         
                   ttFuncionarioR7.iCategTrabaESocial      
                   ttFuncionarioR7.iIndAdmiss              
                   ttFuncionarioR7.iNaturAtividad          
                   ttFuncionarioR7.cPaisNacionalidad       
                   ttFuncionarioR7.iMunNascIBGE            
                   ttFuncionarioR7.cRegIdentidCivil        
                   ttFuncionarioR7.cUfRegIdentidCivil      
                   ttFuncionarioR7.cCidadRegIdentidCivil   
                   ttFuncionarioR7.cOrgEmissRegIdentidCivil
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iExpedRegIdentidCivil))) + STRING(ttFuncionarioR7.iExpedRegIdentidCivil))
                   ttFuncionarioR7.cUsoInternoDatasul1     
                   ttFuncionarioR7.cUsoInternoDatasul2     
                   ttFuncionarioR7.cCategCartNacHabilit    
                   ttFuncionarioR7.cUfCartNacHabilit       
                   ttFuncionarioR7.cOrgEmissCartNacHabilit 
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iExpedCartNacHabilit))) + STRING(ttFuncionarioR7.iExpedCartNacHabilit))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iExpedRegNacEstrang))) + STRING(ttFuncionarioR7.iExpedRegNacEstrang))
                   ttFuncionarioR7.cOrgEmissRegNacEstrang  
                   ttFuncionarioR7.cTpLogradESocial        
                   ttFuncionarioR7.iMunicEnderIBGE         
                   ttFuncionarioR7.cEmailPrincipal         
                   ttFuncionarioR7.cEmailAlternativo       
                   ttFuncionarioR7.cUsoInternoDatasul3     
                   ttFuncionarioR7.cUsoInternoDatasul4     
                   ttFuncionarioR7.cResidExterior          
                   ttFuncionarioR7.cCodEnderPostResidExt   
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iDtChegBrasEstrang))) + STRING(ttFuncionarioR7.iDtChegBrasEstrang))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iDtNaturalizacao))) + STRING(ttFuncionarioR7.iDtNaturalizacao))
                   ttFuncionarioR7.cCasadBrasileiroEstrang 
                   ttFuncionarioR7.cTemFilhoBrasileiro     
                   ttFuncionarioR7.cUsoInternoDatasul5     
                   ttFuncionarioR7.cUsoInternoDatasul6     
                   ttFuncionarioR7.cProcessAlvarJudicial   
                   ttFuncionarioR7.cProcessIRRF            
                   ttFuncionarioR7.cProcessContribPrevid   
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iDtPrimeirCartNacHabilit))) + STRING(ttFuncionarioR7.iDtPrimeirCartNacHabilit))
                   ttFuncionarioR7.cEnderESocial.
        
            /* Grava informaá‰es R7 para Readmiss∆o - 20 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R7-cPaisNacionalidad        = ttFuncionarioR7.cPaisNacionalidad       
                      ttReadmissao.R7-cTpLogradESocial         = ttFuncionarioR7.cTpLogradESocial        
                      ttReadmissao.R7-cEmailPrincipal          = ttFuncionarioR7.cEmailPrincipal         
                      ttReadmissao.R7-cEmailAlternativo        = ttFuncionarioR7.cEmailAlternativo       
                      ttReadmissao.R7-cResidExterior           = ttFuncionarioR7.cResidExterior          
                      ttReadmissao.R7-cCodEnderPostResidExt    = ttFuncionarioR7.cCodEnderPostResidExt   
                      ttReadmissao.R7-cCasadBrasileiroEstrang  = ttFuncionarioR7.cCasadBrasileiroEstrang 
                      ttReadmissao.R7-cTemFilhoBrasileiro      = ttFuncionarioR7.cTemFilhoBrasileiro     
                      ttReadmissao.R7-cEnderESocial            = ttFuncionarioR7.cEnderESocial           
                      ttReadmissao.R7-iMunNascIBGE             = ttFuncionarioR7.iMunNascIBGE            
                      ttReadmissao.R7-iMunicEnderIBGE          = ttFuncionarioR7.iMunicEnderIBGE         
                      ttReadmissao.R7-iDtChegBrasEstrang       = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iDtChegBrasEstrang))) + STRING(ttFuncionarioR7.iDtChegBrasEstrang))   
                      ttReadmissao.R7-iDtNaturalizacao         = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iDtNaturalizacao))) + STRING(ttFuncionarioR7.iDtNaturalizacao))   
                      ttReadmissao.R7-cRegIdentidCivil         = ttFuncionarioR7.cRegIdentidCivil        
                      ttReadmissao.R7-cUfRegIdentidCivil       = ttFuncionarioR7.cUfRegIdentidCivil      
                      ttReadmissao.R7-cCidadRegIdentidCivil    = ttFuncionarioR7.cCidadRegIdentidCivil   
                      ttReadmissao.R7-cOrgEmissRegIdentidCivil = ttFuncionarioR7.cOrgEmissRegIdentidCivil
                      ttReadmissao.R7-iExpedRegIdentidCivil    = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iExpedRegIdentidCivil))) + STRING(ttFuncionarioR7.iExpedRegIdentidCivil))   
                      ttReadmissao.R7-iExpedRegNacEstrang      = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR7.iExpedRegNacEstrang))) + STRING(ttFuncionarioR7.iExpedRegNacEstrang))    
                      ttReadmissao.R7-cOrgEmissRegNacEstrang   = ttFuncionarioR7.cOrgEmissRegNacEstrang.
            END.
        END.
        
        FOR EACH ttFuncionarioR8 NO-LOCK:
            EXPORT DELIMITER ";" ttFuncionarioR8 EXCEPT ttFuncionarioR8.cCodStatus.
        END.
        
        FOR EACH ttFuncionarioR9 NO-LOCK:
            EXPORT DELIMITER ";" 
                   ttFuncionarioR9.cConstante               
                   ttFuncionarioR9.iTipoRegistro            
                   ttFuncionarioR9.cCodEmpresa              
                   ttFuncionarioR9.cCodEstab                
                   ttFuncionarioR9.iMatriculaFunc           
                   ttFuncionarioR9.iDigtoMatricula          
                   ttFuncionarioR9.iTpAdmissESocial         
                   ttFuncionarioR9.iRegTrabalhista          
                   ttFuncionarioR9.iRegPrevidenciario       
                   ttFuncionarioR9.iRegJornada              
                   ttFuncionarioR9.cDescSalVariavel         
                   ttFuncionarioR9.cCnpjEmpregadorAnter     
                   ttFuncionarioR9.cMatricESocialAnter      
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR9.iDtIniVinculo))) + STRING(ttFuncionarioR9.iDtIniVinculo))
                   ttFuncionarioR9.cCnpjEmpCedente          
                   ttFuncionarioR9.cMatricESocialEmpCedente 
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR9.iDtAdmissEmpCedente))) + STRING(ttFuncionarioR9.iDtAdmissEmpCedente))
                   ttFuncionarioR9.iOnusCessao              
                   ttFuncionarioR9.cContratTrabTempor       
                   ttFuncionarioR9.iMotcontratacao          
                   ttFuncionarioR9.cMatricESocialFuncSubstit
                   ttFuncionarioR9.cCpfFuncSubstit          
                   ttFuncionarioR9.cMatricESocial           
                   ttFuncionarioR9.cJornFlexibilidad        
                   ttFuncionarioR9.cInterVariavel           
                   ttFuncionarioR9.iProvimento              
                   ttFuncionarioR9.iTpProvimento            
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR9.iDtNomeacao))) + STRING(ttFuncionarioR9.iDtNomeacao))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR9.iDtPosse))) + STRING(ttFuncionarioR9.iDtPosse))
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR9.iDtExercicio))) + STRING(ttFuncionarioR9.iDtExercicio)).
        END.
        
        FOR EACH ttFuncionarioR10 NO-LOCK:
            EXPORT DELIMITER ";" 
                   ttFuncionarioR10.cConstante                 
                   ttFuncionarioR10.iTipoRegistro              
                   ttFuncionarioR10.cCodEmpresa                
                   ttFuncionarioR10.cCodEstab                  
                   ttFuncionarioR10.iMatriculaFunc             
                   ttFuncionarioR10.iDigtoMatricula            
                   ttFuncionarioR10.cNomESocial                
                   ttFuncionarioR10.cNomRelLegais              
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR10.iDtLaudDoencaGrave))) + STRING(ttFuncionarioR10.iDtLaudDoencaGrave))
                   ttFuncionarioR10.cNumInscrSegurado          
                   ttFuncionarioR10.cCondEstrang               
                   ttFuncionarioR10.cCidadExterior             
                   ttFuncionarioR10.iCategCedentOrig           
                   ttFuncionarioR10.iCategOrigDirigSindical    
                   ttFuncionarioR10.cCnpjOrigDirigSindical     
                   ttFuncionarioR10.cMatricOrigDirigSindical   
                   STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR10.iDtAdmissOrigDirigSindical))) + STRING(ttFuncionarioR10.iDtAdmissOrigDirigSindical))
                   ttFuncionarioR10.cTpLogradLocTrabDomestic   
                   ttFuncionarioR10.cEnderLogradLocTrabDomestic
                   ttFuncionarioR10.cComplLocTrabaDomestic     
                   ttFuncionarioR10.cBairrLocTrabDomestic      
                   ttFuncionarioR10.cNumLogradLocTrabDomestic  
                   ttFuncionarioR10.iMunLocTrabDomestic        
                   ttFuncionarioR10.cUfLocTrabDomestic         
                   ttFuncionarioR10.iCepLocTrabDomestic        
                   ttFuncionarioR10.cSalExclusivVariavel. 
        
            /* Grava informaá‰es R10 para Readmiss∆o - 6 campos */
            IF lReadmissao = YES THEN DO:
               ASSIGN ttReadmissao.R10-cCondEstrang       = ttFuncionarioR10.cCondEstrang               
                      ttReadmissao.R10-cCidadExterior     = ttFuncionarioR10.cCidadExterior             
                      ttReadmissao.R10-cNumInscrSegurado  = ttFuncionarioR10.cNumInscrSegurado          
                      ttReadmissao.R10-iDtLaudDoencaGrave = STRING(FILL("0",8 - LENGTH(STRING(ttFuncionarioR10.iDtLaudDoencaGrave))) + STRING(ttFuncionarioR10.iDtLaudDoencaGrave))   
                      ttReadmissao.R10-cNomRelLegais      = ttFuncionarioR10.cNomRelLegais              
                      ttReadmissao.R10-cNomeSocial        = ttFuncionarioR10.cNomeSocial.
            END.
        END.
    END.

    OUTPUT CLOSE.

    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Exporta Layout' )) NO-ERROR.
    /***** Procedure para Importar e Exportar Layout Corrigido *****/

    RUN piArquivo.

    LOG-MANAGER:WRITE-MESSAGE (">>> " + string("Execuá∆o FP6600 API Admiss∆o - Inicio Importa Arquivo-Processa fp6600rp" )) NO-ERROR.

    /***** Procedure para importar funcion†rio no FP6600 *****/
    RUN piImportaFunc(INPUT cNomeArq,
                      OUTPUT cArqLog).

    /***** Procedure para importar o log gerado ap¢s execuá∆o FP6600 *****/
    RUN piLog(INPUT cArqLog,
              OUTPUT TABLE ttLog).
    
    IF AVAIL funcionario THEN
        RELEASE funcionario NO-ERROR.

    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Admiss∆o Conclu°da' )) NO-ERROR.

    FOR EACH ttRetornoAux NO-LOCK:
        
        FIND FIRST b-funcionario
             WHERE b-funcionario.cdn_empresa     = ttretornoAux.cEmpresa
               AND b-funcionario.cdn_estab       = ttretornoAux.cEstabel
               AND b-funcionario.cdn_funcionario = INT(ttRetornoAux.cMatricula) NO-LOCK NO-ERROR.
        IF AVAIL b-funcionario THEN DO:

           LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Complemento Funcion†rio ' + ttretornoAux.cEmpresa + "-" + ttretornoAux.cEstabel + "-" + ttRetornoAux.cMatricula )) NO-ERROR.


           FIND CURRENT b-funcionario EXCLUSIVE-LOCK NO-ERROR.
           /***** Considera C†lculo Ponto Eletrìnico *****/
           ASSIGN b-funcionario.log_consid_calc_ptoelet = YES.

           /***** Rotina para gravar o codigo do cracha TSA no FP1500 *****/
           IF CAN-FIND(FIRST param_empres_rh
                       WHERE param_empres_rh.cdn_empresa = ttFuncionarioR1.cCodEmpresa
                         AND param_empres_rh.log_integr_control_aces) THEN DO:

              ASSIGN SUBSTRING(b-funcionario.cod_livre_4,177,20) = STRING(ttFuncionarioR1.cCodCrachaTsa,"x(20)")
                     SUBSTRING(b-funcionario.cod_livre_4,197,01) = "N".
           END.

           FIND CURRENT b-funcionario NO-LOCK NO-ERROR.

           /***** Rotina para gravar o tipo de Admissao no FP1500 *****/
           FIND FIRST ttFuncionarioR7
                WHERE ttFuncionarioR7.cCodEmpresa    = b-funcionario.cdn_empresa
                  AND ttFuncionarioR7.cCodEstab      = b-funcionario.cdn_estab
                  AND ttFuncionarioR7.iMatriculaFunc = b-funcionario.cdn_funcionario NO-LOCK NO-ERROR.
           IF AVAIL ttFuncionarioR7 THEN DO:
              FIND FIRST b-sped_participan
                   WHERE b-sped_participan.cdn_empresa         = ttFuncionarioR7.cCodEmpresa
                     AND b-sped_participan.cdn_estab           = ttFuncionarioR7.cCodEstab
                     AND b-sped_participan.cdn_participan_sped = ttFuncionarioR7.iMatriculaFunc EXCLUSIVE-LOCK NO-ERROR.
              IF AVAIL b-sped_participan THEN DO:
                 ASSIGN b-sped_participan.idi_admis_func = ttFuncionarioR7.iIndAdmiss.
              END.
              FIND CURRENT b-sped_participan NO-LOCK NO-ERROR.
           END.

           /***** Rotina para gravar o codigo do gestor no FP1500 *****/
           FIND FIRST ttFuncionarioR1                  
                WHERE ttFuncionarioR1.cCodEmpresa    = b-funcionario.cdn_empresa
                  AND ttFuncionarioR1.cCodEstab      = b-funcionario.cdn_estab
                  AND ttFuncionarioR1.iMatriculaFunc = b-funcionario.cdn_funcionario NO-LOCK NO-ERROR.
           IF AVAIL ttFuncionarioR1 THEN DO:
              FIND FIRST b-ext_funcionario
                   WHERE b-ext_funcionario.cdn_empresa     = ttFuncionarioR1.cCodEmpresa
                     AND b-ext_funcionario.cdn_estab       = ttFuncionarioR1.cCodEstab
                     AND b-ext_funcionario.cdn_funcionario = ttFuncionarioR1.iMatriculaFunc EXCLUSIVE-LOCK NO-ERROR.
              IF NOT AVAIL b-ext_funcionario THEN DO:
                 CREATE b-ext_funcionario.
                 ASSIGN b-ext_funcionario.cdn_empresa     = ttFuncionarioR1.cCodEmpresa   
                        b-ext_funcionario.cdn_estab       = ttFuncionarioR1.cCodEstab     
                        b-ext_funcionario.cdn_funcionario = ttFuncionarioR1.iMatriculaFunc
                        iCodGestorOld                     = 0
                        b-ext_funcionario.cdn_func_gestor = ttFuncionarioR1.iCodGestor.
              END.
              ELSE
                ASSIGN iCodGestorOld                     = 0
                       b-ext_funcionario.cdn_func_gestor = ttFuncionarioR1.iCodGestor.

              FIND CURRENT b-ext_funcionario NO-LOCK NO-ERROR.

              //D201 - App MeuRH
              IF iCodGestorOld <> b-ext_funcionario.cdn_func_gestor THEN DO:
                  RUN prghur/upc/upcfp1500-u08a.p (INPUT b-funcionario.cdn_empresa,
                                                   INPUT ROWID(b-funcionario),
                                                   INPUT iCodGestorOld,
                                                   INPUT b-ext_funcionario.cdn_func_gestor ).
              
              END.

              /***** Rotina para gravar a sigla do org∆o emissor do RG no FP1440 *****/
              FIND FIRST b-rh_pessoa_fisic
                   WHERE b-rh_pessoa_fisic.num_pessoa_fisic = b-funcionario.num_pessoa_fisic EXCLUSIVE-LOCK NO-ERROR.
              IF AVAIL b-rh_pessoa_fisic THEN DO:
                 FIND FIRST b-compl_pessoa_fisic
                      WHERE b-compl_pessoa_fisic.num_pessoa_fisic = b-rh_pessoa_fisic.num_pessoa_fisic EXCLUSIVE-LOC NO-ERROR.
                 IF AVAIL b-compl_pessoa_fisic THEN DO:
                    ASSIGN b-compl_pessoa_fisic.num_livre_1 = ttFuncionarioR1.iSigOrgEmissIdent.
                 END.
                 

                 /***** Inlcuir Deficiància *****/
                 FIND FIRST b-ficha_medic 
                      WHERE b-ficha_medic.num_pessoa_fisic = b-rh_pessoa_fisic.num_pessoa_fisic EXCLUSIVE-LOCK NO-ERROR.
                 IF NOT AVAIL b-ficha_medic THEN DO:
                                        
                    FIND LAST b_ficha_medic NO-LOCK NO-ERROR.

                    /***** Cria Ficha MÇdica *****/
                    CREATE b-ficha_medic.
                    ASSIGN b-ficha_medic.num_ficha_medic        = b_ficha_medic.num_ficha_medic + 1
                           b-ficha_medic.dat_criac_ficha_medic  = TODAY
                           b-ficha_medic.cdn_candempr           = 0
                           b-ficha_medic.cdn_depend_func        = 0
                           b-ficha_medic.cdn_empresa            = b-funcionario.cdn_empresa
                           b-ficha_medic.cdn_estab              = b-funcionario.cdn_estab                          
                           b-ficha_medic.num_pessoa_fisic       = b-funcionario.num_pessoa_fisic
                           /*b-ficha_medic.num_pessoa_fisic      = b-rh_pessoa_fisic.num_pessoa_fisic*/
                           b-ficha_medic.dat_nascimento         = b-rh_pessoa_fisic.dat_nascimento
                           b-ficha_medic.dat_ult_doacao_sangue  = ?
                           b-ficha_medic.idi_fator_rh           = b-rh_pessoa_fisic.idi_fatorrh
                           b-ficha_medic.idi_sexo               = b-rh_pessoa_fisic.idi_sexo
                           b-ficha_medic.idi_sit_ficha_medic    = 1
                           b-ficha_medic.idi_tip_defcncia_fisic = 1
                           b-ficha_medic.idi_tip_pacien         = 1
                           b-ficha_medic.idi_tip_sangue         = b-rh_pessoa_fisic.idi_tip_sangue
                           b-ficha_medic.log_doador_sangue      = b-rh_pessoa_fisic.log_pessoa_fisic_doador
                           b-ficha_medic.nom_pacien_medic       = b-rh_pessoa_fisic.nom_pessoa_fisic
                           b-ficha_medic.num_ficha_medic_ant    = 0
                           b-ficha_medic.val_alt_func           = b-rh_pessoa_fisic.val_estatur_pessoa
                           b-ficha_medic.vli_peso_pessoa        = b-rh_pessoa_fisic.vli_peso_pessoa
                           b-ficha_medic.num_livre_1            = 0.



                    /***** Rotina para gravar o codigo do gestor no FP1500 *****/
                    FIND FIRST ttFuncionarioR2                  
                         WHERE ttFuncionarioR2.iCodEmpresa    = INT(b-funcionario.cdn_empresa)
                           AND ttFuncionarioR2.iCodEstab      = INT(b-funcionario.cdn_estab)
                           AND ttFuncionarioR2.iMatriculaFunc = b-funcionario.cdn_funcionario NO-LOCK NO-ERROR.
                    IF AVAIL ttFuncionarioR2 AND ttFuncionarioR2.cPortDeficFisica = "S" THEN DO:
                                                  
                       /***** Cria a Deficiància *****/
                       FIND FIRST b-defcncia_pacien
                            WHERE b-defcncia_pacien.num_ficha_medic = b-ficha_medic.num_ficha_medic EXCLUSIVE-LOCK NO-ERROR.
                       IF NOT AVAIL b-defcncia_pacien THEN DO:
                          
                          FIND FIRST b-defcncia_fisic
                               WHERE b-defcncia_fisic.cod_defcncia_fisic =  ttFuncionarioR1.cCodDefcncia NO-LOCK NO-ERROR. 
                   
                          CREATE b-defcncia_pacien.
                          ASSIGN b-defcncia_pacien.num_ficha_medic        = b-ficha_medic.num_ficha_medic
                                 b-defcncia_pacien.cod_defcncia_fisic     = ttFuncionarioR1.cCodDefcncia
                                 b-defcncia_pacien.dat_inic_defcncia      = TODAY
                                 b-defcncia_pacien.dat_term_defcncia      = 12/31/9999
                                 b-defcncia_pacien.idi_tip_defcncia       = b-defcncia_fisic.idi_tip_defcncia WHEN AVAIL b-defcncia_fisic
                                 b-defcncia_pacien.log_reaval             = IF ttFuncionarioR1.cReabilitadoInss = "S" THEN YES ELSE NO
                                 b-defcncia_pacien.dsl_obs_defcncia       = '' NO-ERROR.                              
                   
                       END.
                   
                    END.
                   
                    FIND CURRENT b-ficha_medic     NO-LOCK NO-ERROR.
                    FIND CURRENT b-defcncia_pacien NO-LOCK NO-ERROR.
                    FIND CURRENT b-defcncia_fisic  NO-LOCK NO-ERROR.
                    FIND CURRENT b_ficha_medic     NO-LOCK NO-ERROR.

                 END.

                 IF lReadmissao = YES THEN DO:
                    RUN piReadmissao.
                 END.
              END.
           END.
            
           LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Integraá∆o Realizada com Sucesso. Funcion†rio ' + ttretornoAux.cEmpresa + "-" + ttretornoAux.cEstabel + "-" + ttRetornoAux.cMatricula )) NO-ERROR.

           ASSIGN pRetorno = 'Integraá∆o Realizada com Sucesso.'.
           /*RETURN pRetorno.*/

           FIND CURRENT b-funcionario NO-LOCK NO-ERROR.

        END.
        ELSE DO:

            /* Localiza pessoa para desfazer as alteraá‰es do novo endereáo */
            FIND FIRST b-rh_pessoa_fisic
                 WHERE b-rh_pessoa_fisic.num_pessoa_fisic = iNumPessoa EXCLUSIVE-LOCK NO-ERROR.
            IF AVAIL b-rh_pessoa_fisic THEN DO:

               /* Grava na pessoa as informaá‰es originais de endereáo */ 
               ASSIGN b-rh_pessoa_fisic.nom_ender_rh        = cNomeEnderecoRh
                      b-rh_pessoa_fisic.nom_bairro_rh       = cNomeBairroRh
                      b-rh_pessoa_fisic.nom_cidad_rh        = cNomeCidadeRh
                      b-rh_pessoa_fisic.cod_unid_federac_rh = cCodUfRh.

            END.

            LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Funcion†rio Com Erro ' + ttretornoAux.cEmpresa + "-" + ttretornoAux.cEstabel + "-" + ttRetornoAux.cMatricula )) NO-ERROR.

            ASSIGN pRetorno = 'Integraá∆o N∆o Realizada. '.
            
            FOR EACH ttLog
               WHERE ttLog.cLinha <> '' NO-LOCK:

               IF (ttLog.cLinha BEGINS '---' OR
                   ttLog.cLinha BEGINS 'CAM' OR
                   ttLog.cLinha BEGINS 'Emp' OR
                   ttlog.cLinha BEGINS '**'  OR
                   TRIM(ttLog.cLinha) BEGINS 'Erro' OR
                   TRIM(ttLog.cLinha) BEGINS 'Ajuda') THEN NEXT.

               IF SUBSTRING(ttLog.cLinha,61,70) = '' THEN DO:
                  CREATE ttRetorno.
                  ASSIGN ttRetorno.cMensagem  = TRIM(ttLog.cLinha).
               END.
               ELSE DO:
                  CREATE ttRetorno.
                  ASSIGN ttRetorno.cEmpresa   = SUBSTRING(ttLog.cLinha,1,3)
                         ttRetorno.cEstabel   = SUBSTRING(ttLog.cLinha,5,3)
                         ttRetorno.cMatricula = SUBSTRING(ttLog.cLinha,9,9) 
                         ttRetorno.cConteudo  = SUBSTRING(ttLog.cLinha,44,16)
                         ttRetorno.cMensagem  = SUBSTRING(ttLog.cLinha,61,70).
                  
                  ASSIGN ttRetorno.cEmpresa   = REPLACE(ttRetorno.cEmpresa,  ' ','')
                         ttRetorno.cEstabel   = REPLACE(ttRetorno.cEstabel,  ' ','')
                         ttRetorno.cMatricula = REPLACE(ttRetorno.cMatricula,' ','')
                         ttRetorno.cConteudo  = REPLACE(ttRetorno.cConteudo, ' ','').
                 
                  ASSIGN ttRetorno.cMensagem  = REPLACE(ttRetorno.cMensagem, ENTRY(1, ttRetorno.cMensagem, ' '),'').
               END.

               ASSIGN pRetorno = STRING(pRetorno)  + 
                                 STRING(ttRetorno.cConteudo) + ' - ' +
                                 STRING(ttRetorno.cMensagem) + ' | '.

            END.
            {integracao/api/sucess/apisfrelease.i}.
            RETURN ERROR pRetorno.
        END.
    END.

    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('Execuá∆o FP6600 API Admiss∆o - Fim Execucao' )) NO-ERROR.

    RELEASE b-funcionario        NO-ERROR.
    RELEASE b-ext_funcionario    NO-ERROR.
    RELEASE b-sped_participan    NO-ERROR.
    RELEASE b-rh_pessoa_fisic    NO-ERROR.
    RELEASE b-compl_pessoa_fisic NO-ERROR.

    RELEASE b-ficha_medic     NO-ERROR.
    RELEASE b-defcncia_pacien NO-ERROR.
    RELEASE b-defcncia_fisic  NO-ERROR.
    RELEASE b_ficha_medic     NO-ERROR.
    
END PROCEDURE.

/***** Procedure para importar e exportar o layout gerado corrigindo as aspas *****/
PROCEDURE piArquivo: 

    DEFINE VAR c-dados-1  AS CHAR FORMAT "X(265)" NO-UNDO.
    DEFINE VAR c-dados-2  AS CHAR FORMAT "X(265)" NO-UNDO.
    DEFINE VAR c-dados-3  AS CHAR FORMAT "X(272)" NO-UNDO.
    DEFINE VAR c-dados-4  AS CHAR FORMAT "X(265)" NO-UNDO.
    DEFINE VAR c-dados-5  AS CHAR FORMAT "X(265)" NO-UNDO.
    DEFINE VAR c-dados-6  AS CHAR FORMAT "X(265)" NO-UNDO.
    DEFINE VAR c-dados-7  AS CHAR FORMAT "X(320)" NO-UNDO.
    DEFINE VAR c-dados-8  AS CHAR FORMAT "X(269)" NO-UNDO.
    DEFINE VAR c-dados-9  AS CHAR FORMAT "X(291)" NO-UNDO.
    DEFINE VAR c-dados-10 AS CHAR FORMAT "X(205)" NO-UNDO.
    
    INPUT STREAM s-imp FROM VALUE(cNomeArq) NO-CONVERT.
    REPEAT:
        IMPORT STREAM s-imp UNFORMATTED c-dados-1.
        IMPORT STREAM s-imp UNFORMATTED c-dados-2.
        IMPORT STREAM s-imp UNFORMATTED c-dados-3.
        IMPORT STREAM s-imp UNFORMATTED c-dados-4.
        IMPORT STREAM s-imp UNFORMATTED c-dados-5.
        IMPORT STREAM s-imp UNFORMATTED c-dados-6.
        IMPORT STREAM s-imp UNFORMATTED c-dados-7.
        IMPORT STREAM s-imp UNFORMATTED c-dados-8.
        IMPORT STREAM s-imp UNFORMATTED c-dados-9.
        IMPORT STREAM s-imp UNFORMATTED c-dados-10.
    END.
    INPUT STREAM s-imp CLOSE.

    ASSIGN c-dados-1  = REPLACE(c-dados-1,'"','')
           c-dados-2  = REPLACE(c-dados-2,'"','')
           c-dados-3  = REPLACE(c-dados-3,'"','')
           c-dados-4  = REPLACE(c-dados-4,'"','')
           c-dados-5  = REPLACE(c-dados-5,'"','')
           c-dados-6  = REPLACE(c-dados-6,'"','')
           c-dados-7  = REPLACE(c-dados-7,'"','')
           c-dados-8  = REPLACE(c-dados-8,'"','')
           c-dados-9  = REPLACE(c-dados-9,'"','')
           c-dados-10 = REPLACE(c-dados-10,'"','').
    
    OUTPUT TO VALUE(cNomeArq) CONVERT TARGET 'ISO8859-1'.
        PUT UNFORMATTED
            c-dados-1 SKIP
            c-dados-2 SKIP
            c-dados-3 SKIP
            c-dados-4 SKIP
            c-dados-5 SKIP
            c-dados-6 SKIP
            c-dados-7 SKIP
            c-dados-8 SKIP
            c-dados-9 SKIP
            c-dados-10 SKIP. 
    OUTPUT CLOSE.
   
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-1  ' + c-dados-1  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-2  ' + c-dados-2  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-3  ' + c-dados-3  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-4  ' + c-dados-4  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-5  ' + c-dados-5  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-6  ' + c-dados-6  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-7  ' + c-dados-7  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-8  ' + c-dados-8  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-9  ' + c-dados-9  )) NO-ERROR.
    LOG-MANAGER:WRITE-MESSAGE (">>> " + string('SMS - piArquivo - c-dados-10 ' + c-dados-10 )) NO-ERROR.   
   
    RETURN "OK". 
END PROCEDURE.

/***** Procedure para importar funcion†rio no FP6600 *****/
PROCEDURE piImportaFunc:
    DEFINE INPUT PARAMETER pNomeArq   AS CHAR NO-UNDO.
    DEFINE OUTPUT PARAMETER pArqLog   AS CHAR NO-UNDO.

    DEFINE VARIABLE cDestino AS CHAR NO-UNDO.

    ASSIGN cDestino = STRING(SESSION:TEMP-DIRECTORY) + "FP6600.LST".
    
    CREATE tt-param.
    ASSIGN tt-param.parametro            = NO          
           tt-param.v_cdn_empres_usuar   = v_cdn_empres_usuar
           tt-param.v_cod_unid_lotac_ini = ""            
           tt-param.v_cod_unid_lotac_fim = ""            
           tt-param.i-es-ini             = ""            
           tt-param.i-es-fim             = ""            
           tt-param.i-fc-ini             = 0    
           tt-param.i-fc-fim             = 0    
           tt-param.v_num_tip_aces_usuar = 0           
           tt-param.v_cod_grp_usuar      = ""            
           tt-param.v_num_opcao          = 0           
           tt-param.v_des_opcao          = ""             
           tt-param.v_dat_valid          = 12/31/9999           
           tt-param.v_log_expande_estrut = NO         
           tt-param.v_num_salta_pg       = 0           
           tt-param.v_num_quebra         = 0           
           tt-param.v_num_faixa          = 0           
           tt-param.destino              = 2           
           tt-param.arquivo              = pNomeArq 
           tt-param.usuario              = c-seg-usuario
           tt-param.data-exec            = TODAY  
           tt-param.hora-exec            = TIME      
           tt-param.classifica           = 0           
           tt-param.desc-classifica      = ""            
           tt-param.arq-destino          = cDestino 
           tt-param.arq-entrada          = pNomeArq 
           tt-param.todos                = 1           
           tt-param.log_somente_teste    = NO         
           tt-param.des_tip_msg          = "msg"         
           tt-param.des_separador        = ";"           
           tt-param.idi_integracao       = 0.  

    IF SESSION:SET-WAIT-STATE("general") THEN.
    RAW-TRANSFER tt-param TO raw-param.

    RUN prghur/fpp/fp6600rp.p(INPUT raw-param,
                              INPUT TABLE tt-raw-digita).
                              
    {integracao/api/sucess/apisfrelease.i}.

    IF SESSION:SET-WAIT-STATE("") THEN.
    ASSIGN pArqLog = cDestino.

    RETURN "OK".
END PROCEDURE.


PROCEDURE piReadmissao:
  
  /* L¢gica utilizada para verificar o formato do campo referente ao CEP */
  DEFINE VARIABLE v_cod_format_cep  AS CHAR FORMAT "x(12)" NO-UNDO.

  CREATE tt-input-rsapi006.
  ASSIGN tt-input-rsapi006.cod-versao-integracao = 1.
  RUN prghur/rsp/rsapi006.p (INPUT TABLE tt-input-rsapi006, 
                             OUTPUT TABLE tt-output-rsapi006).
  IF RETURN-VALUE = "OK" THEN DO:
     FIND FIRST tt-output-rsapi006 NO-LOCK NO-ERROR.
     IF AVAIL tt-output-rsapi006 then         
        ASSIGN v_cod_format_cep = tt-output-rsapi006.cod_format_cep.
     ELSE
        ASSIGN v_cod_format_cep = "99999999":U.
  END.
  ELSE
     ASSIGN v_cod_format_cep = "99999999":U.

  ASSIGN v_cod_format_cep = REPLACE(v_cod_format_cep, "9":U, "0":U)
         v_cod_format_cep = REPLACE(v_cod_format_cep, "x":U, "0":U)
         v_cod_format_cep = REPLACE(v_cod_format_cep, ".":U, "":U)
         v_cod_format_cep = REPLACE(v_cod_format_cep, ",":U, "":U)
         v_cod_format_cep = REPLACE(v_cod_format_cep, "-":U, "":U)
         v_cod_format_cep = REPLACE(v_cod_format_cep, "/":U, "":U)
         v_cod_format_cep = REPLACE(v_cod_format_cep, "~/":U, "":U).

  FOR EACH ttReadmissao NO-LOCK:

      FIND FIRST b-compl_pessoa_fisic
           WHERE b-compl_pessoa_fisic.num_pessoa_fisic = b-rh_pessoa_fisic.num_pessoa_fisic EXCLUSIVE-LOCK NO-ERROR.

      IF b-rh_pessoa_fisic.cod_cep_rh <> ttReadmissao.R1-cCep THEN DO:
         IF LENGTH(TRIM(STRING(v_cod_format_cep))) <= 8 THEN ASSIGN b-rh_pessoa_fisic.cod_cep_rh = ttReadmissao.R1-cCep.
         ELSE ASSIGN b-rh_pessoa_fisic.cod_cep_rh = ttReadmissao.R2-cZipCode.
      END.

      ASSIGN b-rh_pessoa_fisic.nom_pessoa_fisic                  = IF b-rh_pessoa_fisic.nom_pessoa_fisic                  <> ttReadmissao.R1-cNome                               THEN ttReadmissao.R1-cNome                                 ELSE b-rh_pessoa_fisic.nom_pessoa_fisic
             b-rh_pessoa_fisic.idi_estado_civil                  = IF b-rh_pessoa_fisic.idi_estado_civil                  <> ttReadmissao.R1-iEstadoCivil                        THEN ttReadmissao.R1-iEstadoCivil                          ELSE b-rh_pessoa_fisic.idi_estado_civil
             b-rh_pessoa_fisic.idi_sexo                          = IF b-rh_pessoa_fisic.idi_sexo                          <> ttReadmissao.R1-iSexo                               THEN ttReadmissao.R1-iSexo                                 ELSE b-rh_pessoa_fisic.idi_sexo        
             b-rh_pessoa_fisic.nom_ender_rh                      = IF b-rh_pessoa_fisic.nom_ender_rh                      <> ttReadmissao.R1-cEndereco                           THEN ttReadmissao.R1-cEndereco                             ELSE b-rh_pessoa_fisic.nom_ender_rh    
             b-rh_pessoa_fisic.nom_pto_refer                     = IF b-rh_pessoa_fisic.nom_pto_refer                     <> ttReadmissao.R1-cPontoRefer                         THEN ttReadmissao.R1-cPontoRefer                           ELSE b-rh_pessoa_fisic.nom_pto_refer   
             b-rh_pessoa_fisic.nom_bairro_rh                     = IF b-rh_pessoa_fisic.nom_bairro_rh                     <> ttReadmissao.R1-cBairro                             THEN ttReadmissao.R1-cBairro                               ELSE b-rh_pessoa_fisic.nom_bairro_rh
             b-rh_pessoa_fisic.nom_cidad_rh                      = IF b-rh_pessoa_fisic.nom_cidad_rh                      <> ttReadmissao.R1-cCidade                             THEN ttReadmissao.R1-cCidade                               ELSE b-rh_pessoa_fisic.nom_cidad_rh       
             b-rh_pessoa_fisic.cod_pais                          = IF b-rh_pessoa_fisic.cod_pais                          <> ttReadmissao.R1-cPais                               THEN ttReadmissao.R1-cPais                                 ELSE b-rh_pessoa_fisic.cod_pais           
             b-rh_pessoa_fisic.cod_pais_ender                    = IF b-rh_pessoa_fisic.cod_pais_ender                    <> ttReadmissao.R1-cPais                               THEN ttReadmissao.R1-cPais                                 ELSE b-rh_pessoa_fisic.cod_pais_ender     
             b-rh_pessoa_fisic.cod_unid_federac_rh               = IF b-rh_pessoa_fisic.cod_unid_federac_rh               <> ttReadmissao.R1-cEstado                             THEN ttReadmissao.R1-cEstado                               ELSE b-rh_pessoa_fisic.cod_unid_federac_rh
             b-rh_pessoa_fisic.num_ddd                           = IF b-rh_pessoa_fisic.num_ddd                           <> ttReadmissao.R1-iDddtelFunc                         THEN ttReadmissao.R1-iDddtelFunc                           ELSE b-rh_pessoa_fisic.num_ddd            
             b-rh_pessoa_fisic.num_telefone                      = IF b-rh_pessoa_fisic.num_telefone                      <> ttReadmissao.R1-iTelFunc                            THEN ttReadmissao.R1-iTelFunc                              ELSE b-rh_pessoa_fisic.num_telefone       
             b-rh_pessoa_fisic.num_livre_1                       = IF b-rh_pessoa_fisic.num_livre_1                       <> INT(ttReadmissao.R1-iDddtelFunc)                    THEN INT(ttReadmissao.R1-iDddtelFunc)                      ELSE b-rh_pessoa_fisic.num_livre_1          
             b-rh_pessoa_fisic.cod_cx_post_rh                    = IF b-rh_pessoa_fisic.cod_cx_post_rh                    <> ttReadmissao.R2-cCaixaPostalFunc                    THEN ttReadmissao.R2-cCaixaPostalFunc                      ELSE b-rh_pessoa_fisic.cod_cx_post_rh             
             b-rh_pessoa_fisic.num_ddd_contat                    = IF b-rh_pessoa_fisic.num_ddd_contat                    <> ttReadmissao.R2-iDddtelContato                      THEN ttReadmissao.R2-iDddtelContato                        ELSE b-rh_pessoa_fisic.num_ddd_contat             
             b-rh_pessoa_fisic.num_telef_contat                  = IF b-rh_pessoa_fisic.num_telef_contat                  <> ttReadmissao.R2-iTelContato                         THEN ttReadmissao.R2-iTelContato                           ELSE b-rh_pessoa_fisic.num_telef_contat           
             b-rh_pessoa_fisic.idi_orig_pessoa_fisic             = IF b-rh_pessoa_fisic.idi_orig_pessoa_fisic             <> ttReadmissao.R2-iOrigemFunc                         THEN ttReadmissao.R2-iOrigemFunc                           ELSE b-rh_pessoa_fisic.idi_orig_pessoa_fisic      
             b-rh_pessoa_fisic.cod_pais_nasc                     = IF b-rh_pessoa_fisic.cod_pais_nasc                     <> ttReadmissao.R2-cPaisNascimento                     THEN ttReadmissao.R2-cPaisNascimento                       ELSE b-rh_pessoa_fisic.cod_pais_nasc              
             b-rh_pessoa_fisic.num_ano_chegad_pais               = IF b-rh_pessoa_fisic.num_ano_chegad_pais               <> ttReadmissao.R2-iAnoChegadaPaisEx                   THEN ttReadmissao.R2-iAnoChegadaPaisEx                     ELSE b-rh_pessoa_fisic.num_ano_chegad_pais        
             b-rh_pessoa_fisic.cod_identde_estrang               = IF b-rh_pessoa_fisic.cod_identde_estrang               <> ttReadmissao.R2-cCartIdentidadeEx                   THEN ttReadmissao.R2-cCartIdentidadeEx                     ELSE b-rh_pessoa_fisic.cod_identde_estrang        
             b-rh_pessoa_fisic.cod_id_estad_fisic                = IF b-rh_pessoa_fisic.cod_id_estad_fisic                <> ttReadmissao.R2-cCartIdentidadNumero                THEN ttReadmissao.R2-cCartIdentidadNumero                  ELSE b-rh_pessoa_fisic.cod_id_estad_fisic         
             b-rh_pessoa_fisic.cod_orgao_emis_id_esta            = IF b-rh_pessoa_fisic.cod_orgao_emis_id_esta            <> ttReadmissao.R2-cCartIdentidadOrgEmiss              THEN ttReadmissao.R2-cCartIdentidadOrgEmiss                ELSE b-rh_pessoa_fisic.cod_orgao_emis_id_esta     
             b-rh_pessoa_fisic.cod_unid_federac_emis_estad       = IF b-rh_pessoa_fisic.cod_unid_federac_emis_estad       <> ttReadmissao.R2-cCartIdentidadEstEmiss              THEN ttReadmissao.R2-cCartIdentidadEstEmiss                ELSE b-rh_pessoa_fisic.cod_unid_federac_emis_estad
             b-rh_pessoa_fisic.idi_cor_cutis                     = IF b-rh_pessoa_fisic.idi_cor_cutis                     <> ttReadmissao.R2-iCutis                              THEN ttReadmissao.R2-iCutis                                ELSE b-rh_pessoa_fisic.idi_cor_cutis              
             b-rh_pessoa_fisic.idi_cor_cabelo                    = IF b-rh_pessoa_fisic.idi_cor_cabelo                    <> ttReadmissao.R2-iCabelo                             THEN ttReadmissao.R2-iCabelo                               ELSE b-rh_pessoa_fisic.idi_cor_cabelo             
             b-rh_pessoa_fisic.idi_cor_olhos                     = IF b-rh_pessoa_fisic.idi_cor_olhos                     <> ttReadmissao.R2-iOlhos                              THEN ttReadmissao.R2-iOlhos                                ELSE b-rh_pessoa_fisic.idi_cor_olhos              
             b-rh_pessoa_fisic.val_estatur_pessoa                = IF b-rh_pessoa_fisic.val_estatur_pessoa                <> (ttReadmissao.R2-dAltura) / 100                     THEN (ttReadmissao.R2-dAltura) / 100                       ELSE b-rh_pessoa_fisic.val_estatur_pessoa         
             b-rh_pessoa_fisic.vli_peso_pessoa                   = IF b-rh_pessoa_fisic.vli_peso_pessoa                   <> ttReadmissao.R2-iPeso                               THEN ttReadmissao.R2-iPeso                                 ELSE b-rh_pessoa_fisic.vli_peso_pessoa            
             b-rh_pessoa_fisic.num_manequim                      = IF b-rh_pessoa_fisic.num_manequim                      <> ttReadmissao.R2-iManequim                           THEN ttReadmissao.R2-iManequim                             ELSE b-rh_pessoa_fisic.num_manequim               
             b-rh_pessoa_fisic.num_calcad_func                   = IF b-rh_pessoa_fisic.num_calcad_func                   <> ttReadmissao.R2-iSapato                             THEN ttReadmissao.R2-iSapato                               ELSE b-rh_pessoa_fisic.num_calcad_func            
             b-compl_pessoa_fisic.cod_cartao_nac_saude           = IF b-compl_pessoa_fisic.cod_cartao_nac_saude           <> ttReadmissao.R2-cCartNacSaude                       THEN ttReadmissao.R2-cCartNacSaude                         ELSE b-compl_pessoa_fisic.cod_cartao_nac_saude    
             b-rh_pessoa_fisic.cdn_grau_instruc                  = IF b-rh_pessoa_fisic.cdn_grau_instruc                  <> ttReadmissao.R3-iCodGrauInstruc                     THEN ttReadmissao.R3-iCodGrauInstruc                       ELSE b-rh_pessoa_fisic.cdn_grau_instruc
             b-rh_pessoa_fisic.idi_tip_sangue                    = IF b-rh_pessoa_fisic.idi_tip_sangue                    <> ttReadmissao.R3-iGrpSanguineo                       THEN ttReadmissao.R3-iGrpSanguineo                         ELSE b-rh_pessoa_fisic.idi_tip_sangue  
             b-rh_pessoa_fisic.idi_fatorrh                       = IF b-rh_pessoa_fisic.idi_fatorrh                       <> ttReadmissao.R3-iIndFatRhGrpSanguineo               THEN ttReadmissao.R3-iIndFatRhGrpSanguineo                 ELSE b-rh_pessoa_fisic.idi_fatorrh     
             b-rh_pessoa_fisic.log_pessoa_fisic_doador           = IF ttReadmissao.R3-cIndFuncDoador   = "S" THEN YES ELSE NO
             b-rh_pessoa_fisic.log_livre_1                       = IF ttReadmissao.R2-cPortDeficFisica = "S" THEN YES ELSE NO 
             b-rh_pessoa_fisic.nom_pai_pessoa_fisic              = IF b-rh_pessoa_fisic.nom_pai_pessoa_fisic              <> ttReadmissao.R4-cNomePai                              THEN ttReadmissao.R4-cNomePai                              ELSE b-rh_pessoa_fisic.nom_pai_pessoa_fisic
             b-rh_pessoa_fisic.nom_mae_pessoa_fisic              = IF b-rh_pessoa_fisic.nom_mae_pessoa_fisic              <> ttReadmissao.R4-cNomeMae                              THEN ttReadmissao.R4-cNomeMae                              ELSE b-rh_pessoa_fisic.nom_mae_pessoa_fisic
             SUBSTRING(b-rh_pessoa_fisic.cod_livre_1,66,8)       = IF SUBSTRING(b-rh_pessoa_fisic.cod_livre_1,66,8)       <> TRIM(STRING(ttReadmissao.R4-iNumEnderResid))          THEN TRIM(STRING(ttReadmissao.R4-iNumEnderResid))          ELSE SUBSTRING(b-rh_pessoa_fisic.cod_livre_1,66,8)
             b-rh_pessoa_fisic.nom_abrev_pessoa_fisic            = IF b-rh_pessoa_fisic.nom_abrev_pessoa_fisic            <> ttReadmissao.R5-cNomAbrevFunc                         THEN ttReadmissao.R5-cNomAbrevFunc                         ELSE b-rh_pessoa_fisic.nom_abrev_pessoa_fisic
             b-rh_pessoa_fisic.cod_imagem                        = IF b-rh_pessoa_fisic.cod_imagem                        <> ttReadmissao.R5-cCodImagem                            THEN ttReadmissao.R5-cCodImagem                            ELSE b-rh_pessoa_fisic.cod_imagem
             b-rh_pessoa_fisic.num_fax                           = IF b-rh_pessoa_fisic.num_fax                           <> INT(ttReadmissao.R6-iNumFax)                          THEN INT(ttReadmissao.R6-iNumFax)                          ELSE b-rh_pessoa_fisic.num_fax              
             b-rh_pessoa_fisic.num_telex                         = IF b-rh_pessoa_fisic.num_telex                         <> INT(ttReadmissao.R6-iTelex)                           THEN INT(ttReadmissao.R6-iTelex)                           ELSE b-rh_pessoa_fisic.num_telex            
             b-rh_pessoa_fisic.nom_e_mail                        = IF b-rh_pessoa_fisic.nom_e_mail                        <> ttReadmissao.R6-cEnderEletrInternet                   THEN ttReadmissao.R6-cEnderEletrInternet                   ELSE b-rh_pessoa_fisic.nom_e_mail           
             b-rh_pessoa_fisic.cod_unid_federac_nasc             = IF b-rh_pessoa_fisic.cod_unid_federac_nasc             <> TRIM(ttReadmissao.R6-cCodUFNascimento)                THEN TRIM(ttReadmissao.R6-cCodUFNascimento)                ELSE b-rh_pessoa_fisic.cod_unid_federac_nasc
             b-rh_pessoa_fisic.nom_naturalidade                  = IF b-rh_pessoa_fisic.nom_naturalidade                  <> ttReadmissao.R6-cCidadNascimentoFunc                  THEN ttReadmissao.R6-cCidadNascimentoFunc                  ELSE b-rh_pessoa_fisic.nom_naturalidade     
             b-rh_pessoa_fisic.idi_tip_visto_estrang             = IF b-rh_pessoa_fisic.idi_tip_visto_estrang             <> INT(ttReadmissao.R6-iIndTpVistoEstrang)               THEN INT(ttReadmissao.R6-iIndTpVistoEstrang)               ELSE b-rh_pessoa_fisic.idi_tip_visto_estrang
             b-compl_pessoa_fisic.nom_relat_legal                = IF b-compl_pessoa_fisic.nom_relat_legal                <> rh_pessoa_fisic.nom_pessoa_fisic                      THEN rh_pessoa_fisic.nom_pessoa_fisic                      ELSE b-compl_pessoa_fisic.nom_relat_legal
             b-compl_pessoa_fisic.cod_pais_nacion                = IF b-compl_pessoa_fisic.cod_pais_nacion                <> STRING(ttReadmissao.R7-cPaisNacionalidad,'x(3)')      THEN STRING(ttReadmissao.R7-cPaisNacionalidad,'x(3)')      ELSE b-compl_pessoa_fisic.cod_pais_nacion 
             b-compl_pessoa_fisic.cod_tip_lograd                 = IF b-compl_pessoa_fisic.cod_tip_lograd                 <> STRING(ttReadmissao.R7-cTpLogradESocial,'x(4)')       THEN STRING(ttReadmissao.R7-cTpLogradESocial,'x(4)')       ELSE b-compl_pessoa_fisic.cod_tip_lograd  
             SUBSTRING(b-compl_pessoa_fisic.cod_livre_1,070,003) = IF SUBSTRING(b-compl_pessoa_fisic.cod_livre_1,070,003) <> STRING(ttReadmissao.R7-cTpLogradESocial,'x(3)')       THEN STRING(ttReadmissao.R7-cTpLogradESocial,'x(3)')       ELSE SUBSTRING(b-compl_pessoa_fisic.cod_livre_1,070,003)
             b-rh_pessoa_fisic.nom_e_mail                        = IF b-rh_pessoa_fisic.nom_e_mail                        <> ttReadmissao.R7-cEmailPrincipal                       THEN ttReadmissao.R7-cEmailPrincipal                       ELSE b-rh_pessoa_fisic.nom_e_mail               
             b-rh_pessoa_fisic.nom_mail_contat                   = IF b-rh_pessoa_fisic.nom_mail_contat                   <> STRING(ttReadmissao.R7-cEmailAlternativo,'x(60)')     THEN STRING(ttReadmissao.R7-cEmailAlternativo,'x(60)')     ELSE b-rh_pessoa_fisic.nom_mail_contat
             b-compl_pessoa_fisic.log_resdte_exter               = IF ttReadmissao.R7-cResidExterior = 'S' THEN YES ELSE NO
             b-compl_pessoa_fisic.cod_cep_resdte_exter           = IF b-compl_pessoa_fisic.cod_cep_resdte_exter           <> STRING(ttReadmissao.R7-cCodEnderPostResidExt,'x(10)') THEN STRING(ttReadmissao.R7-cCodEnderPostResidExt,'x(10)') ELSE b-compl_pessoa_fisic.cod_cep_resdte_exter
             b-compl_pessoa_fisic.log_estrang_casad_bras         = IF ttReadmissao.R7-cCasadBrasileiroEstrang = 'S' THEN YES ELSE NO
             b-compl_pessoa_fisic.log_possui_filho_bras          = IF ttReadmissao.R7-cTemFilhoBrasileiro     = 'S' THEN YES ELSE NO
             b-compl_pessoa_fisic.idi_cond_trabdor_estrang       = IF b-compl_pessoa_fisic.idi_cond_trabdor_estrang       <> INT(ttReadmissao.R10-cCondEstrang)                    THEN INT(ttReadmissao.R10-cCondEstrang)                    ELSE b-compl_pessoa_fisic.idi_cond_trabdor_estrang.
             
             IF ttReadmissao.R6-iDtValidCartIdentidEstrang <> '00000000' THEN DO:
                ASSIGN b-rh_pessoa_fisic.dat_valid_ident_estrang = IF b-rh_pessoa_fisic.dat_valid_ident_estrang <> DATE(ttReadmissao.R6-iDtValidCartIdentidEstrang) THEN DATE(ttReadmissao.R6-iDtValidCartIdentidEstrang) ELSE b-rh_pessoa_fisic.dat_valid_ident_estrang.
             END.
            
             IF ttReadmissao.R6-iEmissIdentidad <> '00000000' THEN DO:
                ASSIGN b-rh_pessoa_fisic.dat_emis_id_estad_fisic = IF b-rh_pessoa_fisic.dat_emis_id_estad_fisic <> DATE(ttReadmissao.R6-iEmissIdentidad) THEN DATE(ttReadmissao.R6-iEmissIdentidad) ELSE b-rh_pessoa_fisic.dat_emis_id_estad_fisic.
             END.
             
             IF ttReadmissao.R6-iValidIDEstadual <> '00000000' THEN DO:   
                ASSIGN b-rh_pessoa_fisic.dat_valid_id_estad_fisic = IF b-rh_pessoa_fisic.dat_valid_id_estad_fisic  <> DATE(ttReadmissao.R6-iValidIDEstadual) THEN DATE(ttReadmissao.R6-iValidIDEstadual) ELSE b-rh_pessoa_fisic.dat_valid_id_estad_fisic.
             END.

             IF b-rh_pessoa_fisic.nom_ender_rh <> "" AND
                ttReadmissao.R7-cEnderESocial = "" THEN 
                ASSIGN b-compl_pessoa_fisic.nom_ender_rh = b-rh_pessoa_fisic.nom_ender_rh.
                ELSE ASSIGN b-compl_pessoa_fisic.nom_ender_rh = STRING(ttReadmissao.R7-cEnderESocial,'x(80)').

             IF b-rh_pessoa_fisic.idi_orig_pessoa_fisic = 1 THEN
                ASSIGN b-compl_pessoa_fisic.cdn_munpio_nasc = INT(ttReadmissao.R7-iMunNascIBGE).

             IF ttReadmissao.R7-cResidExterior = "N" THEN
                ASSIGN b-compl_pessoa_fisic.cdn_munpio_ender = INT(ttReadmissao.R7-iMunicEnderIBGE).

             IF ttReadmissao.R7-cResidExterior = "S" THEN
                ASSIGN b-compl_pessoa_fisic.nom_cidad_exterior = STRING(ttReadmissao.R10-cCidadExterior,'x(50)').

             IF b-rh_pessoa_fisic.idi_orig_pessoa_fisic > 2 THEN
                ASSIGN b-compl_pessoa_fisic.dat_chegad_estrang_bra = DATE(ttReadmissao.R7-iDtChegBrasEstrang).

             IF b-rh_pessoa_fisic.idi_orig_pessoa_fisic = 2 THEN
                ASSIGN b-compl_pessoa_fisic.dat_naturaliz = DATE(ttReadmissao.R7-iDtNaturalizacao).

             IF ttReadmissao.R7-cRegIdentidCivil <> "" THEN
                ASSIGN b-compl_pessoa_fisic.cod_ric              = ttReadmissao.R7-cRegIdentidCivil
                       b-compl_pessoa_fisic.cod_unid_federac_ric = ttReadmissao.R7-cUfRegIdentidCivil
                       b-compl_pessoa_fisic.nom_cidad_ric        = ttReadmissao.R7-cCidadRegIdentidCivil
                       b-compl_pessoa_fisic.cod_orgao_emis_ric   = ttReadmissao.R7-cOrgEmissRegIdentidCivil
                       b-compl_pessoa_fisic.dat_expedic_ric      = DATE(ttReadmissao.R7-iExpedRegIdentidCivil).

             IF b-rh_pessoa_fisic.idi_orig_pessoa_fisic > 2 THEN
                ASSIGN b-compl_pessoa_fisic.dat_expedic_rne  = DATE(ttReadmissao.R7-iExpedRegNacEstrang)
                       b-compl_pessoa_fisic.cod_emissor_rne  = STRING(ttReadmissao.R7-cOrgEmissRegNacEstrang,'x(20)').

             IF ttReadmissao.R10-cNumInscrSegurado <> "" THEN
                ASSIGN b-compl_pessoa_fisic.cod_nume_ident_social = ttReadmissao.R10-cNumInscrSegurado.

             IF INT(ttReadmissao.R10-iDtLaudDoencaGrave) <> 0 THEN
                ASSIGN b-compl_pessoa_fisic.dat_laudo_doenc_grave = DATE(ttReadmissao.R10-iDtLaudDoencaGrave).
             ELSE
                ASSIGN b-compl_pessoa_fisic.dat_laudo_doenc_grave = ?.

             IF ttReadmissao.R10-cNomRelLegais <> "" THEN
                ASSIGN b-compl_pessoa_fisic.nom_relat_legal = ttReadmissao.R10-cNomRelLegais.

             IF ttReadmissao.R10-cNomeSocial <> "" THEN
                ASSIGN b-compl_pessoa_fisic.nom_pessoa_fisic_sped = ttReadmissao.R10-cNomeSocial.
             ELSE
                ASSIGN b-compl_pessoa_fisic.nom_pessoa_fisic_sped = SUBSTRING(compl_pessoa_fisic.nom_relat_legal,1,60).


             FIND CURRENT b-rh_pessoa_fisic    NO-LOCK NO-ERROR.
             FIND CURRENT b-compl_pessoa_fisic NO-LOCK NO-ERROR.
  END.

  RETURN "OK".

END PROCEDURE.



/***** Procedure Valida Deficiància Funcionario *****/
PROCEDURE pi-valida-deficiencia: 
    DEF OUTPUT PARAM cMensagem AS CHAR NO-UNDO.

    ASSIGN cMensagem  = ''.

    IF ttFuncionarioR2.cPortDeficFisica = "S" AND 
       ttFuncionarioR1.cCodDefcncia     = "" THEN DO:
       ASSIGN cMensagem = 'Funcion†rio Portador de Deficiància F°sica. C¢digo da Deficiància deve ser informado.'.
       {integracao/api/sucess/apisfrelease.i}.
       RETURN 'NOK'.
    END.
    IF ttFuncionarioR2.cPortDeficFisica = "N" AND 
       ttFuncionarioR1.cCodDefcncia      <> "" THEN DO:
       ASSIGN cMensagem = 'Funcion†rio n∆o Ç Portador de Deficiància F°sica.'.
       {integracao/api/sucess/apisfrelease.i}.
       RETURN 'NOK'.
    END.

    IF ttFuncionarioR2.cPortDeficFisica = "S" AND 
       ttFuncionarioR1.cCodDefcncia     <> "" AND 
       NOT CAN-FIND(FIRST b-defcncia_fisic
                     WHERE b-defcncia_fisic.cod_defcncia_fisic = ttFuncionarioR1.cCodDefcncia
                    )THEN DO:
          ASSIGN cMensagem = 'C¢digo de deficiància inexistente.'.
          RUN pi-ret-func(INPUT cMensagem, INPUT ttFuncionarioR1.cCodDefcncia). 

    END.


END PROCEDURE.

/***** Procedure para importar o log gerado ap¢s execuá∆o FP6600 *****/
PROCEDURE piLog:
    DEFINE INPUT  PARAMETER pDest  AS CHAR NO-UNDO.
    DEFINE OUTPUT PARAMETER TABLE FOR ttLog.
    
    INPUT FROM VALUE(pDest) NO-CONVERT.
    REPEAT:
        CREATE ttLog.
        IMPORT UNFORMATTED ttLog.
    END.

    RETURN "OK".
END PROCEDURE.
