// ────────────────────────────────────────────────────────────────────────────
// Mock TOTVS Admissão — payload QA (Render → Datasul Progress)
//
// Regras aplicadas (confirmadas pela resposta de erro do TOTVS):
//   • cCpf / cPis  → apenas dígitos, máx 11 caracteres
//   • iPeso        → em GRAMAS (mínimo 1000 = 1 kg)
//   • datas        → string "yyyy-MM-dd" (ISO 8601)
//
// Dados são fictícios — gerados para uso em ambiente QA.
// ────────────────────────────────────────────────────────────────────────────

export const mockData = {
    // ── Empresa / Estabelecimento ────────────────────────────────────────
    cCodEmpresa:           "1",
    cCodEstab:             "099",
    iMatriculaFunc:        28201475,
    iDigtoMatricula:       0,
    iNumRegistroFunc:      28201475,

    // ── Identificação pessoal ────────────────────────────────────────────
    cNome:                 "MARIANA OLIVEIRA COSTA",
    cNomAbrevFunc:         "MARIANA",
    iSexo:                 2,
    iEstadoCivil:          1,
    iDtNascimento:         "1994-07-22",
    iOrigemFunc:           1,
    cPaisNascimento:       "BRA",
    cCodUFNascimento:      "SP",
    cCidadNascimentoFunc:  "CAMPINAS",
    iAnoChegadaPaisEx:     0,
    cCartIdentidadeEx:     "",

    // ── Documentos ───────────────────────────────────────────────────────
    cCpf:                  "52817463091",        // só dígitos
    cPis:                  "20754193628",        // só dígitos
    iDocMilitarTipo:       1,
    iDocMilitarRegiao:     2,
    iDocMilitarCircuns:    0,
    cDocMilitarNumero:     "412687",
    cDocMilitarSerie:      "B",
    cCartIdentidadNumero:  "478215036",
    cCartIdentidadOrgEmiss:"SSP",
    cCartIdentidadEstEmiss:"SP",
    cTitEleitorNumero:     "21459683022",
    iTitEleitorSecao:      215,
    iTitEleitorZona:       312,
    cTitEleitorCidade:     "CAMPINAS",
    cTitEleitorEstEmiss:   "SP",
    iCartTrabalhoNumero:   78921,
    iCartTrabalhoSerie:    354,
    iCartTrabalhoModelo:   3,
    cCartTrabalhoEstEmiss: "SP",
    cCartNacSaude:         "70004193825",
    cCartTrabSerEsocial:   "354",
    cNumCartHabilit:       "08745126930",

    // ── Endereço ─────────────────────────────────────────────────────────
    cEndereco:             "Avenida Brigadeiro Faria Lima",
    iNumEnderResid:        2845,
    cPontoRefer:           "Próximo ao Shopping Iguatemi",
    cBairro:               "Jardim Paulistano",
    cCep:                  "01452000",                // só dígitos
    cCidade:               "Sao Paulo",
    cEstado:               "SP",
    cPais:                 "BRA",
    cZipCode:              "",
    cCaixaPostalFunc:      "",

    // ── Contato ──────────────────────────────────────────────────────────
    iDddTelFunc:           11,
    iTelFunc:              33214567,
    iDddTelContato:        11,
    iTelContato:           987651234,
    cEmailPrincipal:       "mariana.costa.qa@qualiit-test.com.br",
    cEmailAlternativo:     "mariana.oliveira.qa@gmail.com.br",
    cEnderEletrInternet:   "",

    // ── Dados de admissão / contrato ─────────────────────────────────────
    iDtAdmissao:           "2025-11-03",
    iDtAdmissTransf:       "0001-01-01",
    iCodCategSalarial:     1,
    iCodPlanoLotac:        101,
    cCodUnidLotac:         "00001001",
    cCodCCusto:            "99999",
    iCodTurno:             1,
    iCodTurma:             1,
    iNumRelPonto:          0,
    iNumChapeiro:          0,
    iNumCartPonto:         28201475,
    iTipoFunc:             1,
    cIndFuncQualificado:   "S",
    iCodVincEmpregat:      10,
    iIndFuncVinc:          1,
    cIndTipoMo:            "ADM",
    iCodCargoBasic:        427,
    iCodNivel:             0,
    dSalRealAdmiss:        5240.00,
    cIndConsidTabSal:      "N",
    iCodTabSal:            0,
    iFaixaSalTab:          0,
    iNivelSalFaixa:        0,
    iDtUltAlterSal:        "0001-01-01",
    iMotivoUltAlterSal:    0,
    iCodCargBasAtual:      427,
    iCodNivelAtual:        0,
    dSalAtual:             5240.00,
    dSalSimulado:          5240.00,
    iDtTermContrato:       "0001-01-01",
    iDtUltAlterEnderFunc:  "0001-01-01",
    iNumMesesTrabAnter:    0,
    iDtExperFunc:          "0001-01-01",
    iDtVenctoHabilit:      "2029-08-15",
    iLocalPagto:           0,
    iQtdeDiasContratExper: 90,

    // ── Características físicas ──────────────────────────────────────────
    iCutis:                2,
    iCabelo:               2,
    iOlhos:                2,
    dAltura:               165,
    iPeso:                 62000,                  // 62 kg em GRAMAS
    iManequim:             38,
    iSapato:               36,
    cPortDeficFisica:      "N",

    // ── Saúde ────────────────────────────────────────────────────────────
    iGrpSanguineo:         2,
    iIndFatRhGrpSanguineo: 1,
    cIndFuncDoador:        "S",
    iDtUltExMedico:        "2025-10-15",
    iDtLaudDoencaGrave:    "0001-01-01",

    // ── Filiação ─────────────────────────────────────────────────────────
    cNomePai:              "Carlos Eduardo Costa",
    cNomeMae:              "Sandra Regina Oliveira",

    // ── Escolaridade / Profissional ──────────────────────────────────────
    iCodGrauInstruc:       7,
    cIndicFuncEstudant:    "N",
    cUfEmprAnter:          "",
    iNumMatricINSS:        0,

    // ── Dependentes ──────────────────────────────────────────────────────
    iNumDependSalFam:      0,
    iDtVenctoCotSalFam:    "0001-01-01",
    iNumDependImpRenda:    0,

    // ── FGTS / INSS ──────────────────────────────────────────────────────
    cIndOptanteFGTS:       "S",
    iDtOpcaoFGTS:          "2025-11-03",
    dCodSistemaFGTS:       0,
    iTipoAdmissFGTS:       1,
    cIndRecolheFGTS:       "S",
    iNumMesNOptanteFGTS:   0,
    cIndFuncRecolheINSS:   "S",
    iclassINSSFuncSemVinc: 0,
    iDtMudClassINSS:       "0001-01-01",

    // ── Forma de pagamento ───────────────────────────────────────────────
    iFormaPagto:           1,
    iCodBancFormaPagto:    341,
    iCodAgencFormaPagto:   3271,
    iFormaPagtoBanc:       0,
    iNumContaCorrBanc:     2598431,
    cDigitoContaCorr:      "8",

    // ── FGTS Temporário ──────────────────────────────────────────────────
    iCodBancComplFGTSTempor:        0,
    iCodAgencComplFGTSTempor:       0,
    iCodContaCorrComplFGTSTempor:   0,
    cDigContaCorrComplFGTSTempor:   "0",
    iFormaPagtoBancComplFGTSTempor: 0,

    // ── Sindicato ────────────────────────────────────────────────────────
    cIndFuncSindicalizado:   "N",
    cIndDescContribSindical: "N",
    cContribSindicDia:       "S",
    iCodSindicato:           1,
    cDescReverSindical:      "N",

    // ── Adicionais / Cálculos ────────────────────────────────────────────
    cIndCargaAutomTurno:   "S",
    cIndRecebAdicPericul:  "N",
    iNivPericul:           0,
    cIndRecebAdicInsalub:  "N",
    iNivInsalub:           0,
    cIndRecebAdiantamento: "S",
    cIndConsidEmissRAIS:   "S",
    cIndCalc13Sal:         "S",
    cIndRecebFerias:       "S",

    // ── Provisões 13º ────────────────────────────────────────────────────
    iNumAvos13SalCalcAnter: 0,
    iNumAvos13SalCalc:      0,
    dVlProvAcum13Sal:       0,
    dVlProvAcumINSS13Sal:   0,
    dVlProvAcumFGTS13Sal:   0,

    // ── Provisões Férias ─────────────────────────────────────────────────
    dDiasProvFeriasMesAnter: 0,
    dDiasProvFeriasMesAtual: 0,
    dVlProvAcumFerias:       0,
    dVlProvAcumINSSFerias:   0,
    dVlProvAcumFGTSFerias:   0,
    dVlProvAcumFerias13:     0,

    // ── Ponto eletrônico ─────────────────────────────────────────────────
    cEmitCartPonto:             "1",
    dSaldHrsCompensMesAnter:    0,
    cSinSaldHrsCompensMesAnter: "+",
    cSinSaldHrsCompens:         "+",
    iCodLocalMarcacao:          1,
    iCodFornecedor:             0,
    iCodClassFuncPontEletr:     1,

    // ── CAGED ────────────────────────────────────────────────────────────
    iCgcCAGED:           0,
    iFuncAdmitidoCAGED:  0,
    iCodAdmissCAGED:     0,
    iFuncDemitidoCAGED:  0,
    iCodDemissCAGED:     0,
    iOcorrCAGED:         1,
    cGerarCAGED:         "N",

    // ── CTPS / PIS adicionais ────────────────────────────────────────────
    iDtCartTrab:      "0001-01-01",
    iDtValidCartTrab: "0001-01-01",
    iDtPISPASEP:      "0001-01-01",

    // ── Histórico anterior ───────────────────────────────────────────────
    cNumCartTrabAnter:  "",
    cSerieCartTrabAnter:"",
    cPisAnter:          "",

    // ── Outros contatos ──────────────────────────────────────────────────
    iNumFax: 0,
    iTelex:  0,

    // ── Estrangeiro ──────────────────────────────────────────────────────
    iIndTpVistoEstrang:         0,
    iDtValidCartIdentidEstrang: "0001-01-01",
    iEmissIdentidad:            "2012-04-18",
    iValidIDEstadual:           "0001-01-01",

    // ── Jornadas ─────────────────────────────────────────────────────────
    iCodJornadTraba1:    0,
    iCodIntervRefeicao1: 0,
    iCodJornadTraba2:    0,
    iCodIntervRefeicao2: 0,
    iCodJornadTraba3:    0,
    iCodIntervRefeicao3: 0,
    iCodJornadTraba4:    0,
    iCodIntervRefeicao4: 0,
    iCodJornadTraba5:    0,
    iCodIntervRefeicao5: 0,
    iCodExposAgentNocivos: 0,

    // ── Localidade / FPAS ────────────────────────────────────────────────
    cPaisLocalidade:  "BRA",
    iLocalidade:      17,
    iCodFPAS:         0,
    cCodTomadorServ:  "0",

    // ── eSocial ──────────────────────────────────────────────────────────
    iCategTrabaESocial:   101,
    iIndAdmiss:           1,
    iNaturAtividad:       1,
    cPaisNacionalidad:    "BRA",
    iMunNascIBGE:         3509502,
    cTpLogradESocial:     "AV",
    iMunicEnderIBGE:      3550308,
    iTpAdmissESocial:     1,
    iRegTrabalhista:      1,
    iRegPrevidenciario:   1,
    iRegJornada:          1,

    // ── Identidade civil (RIC) ───────────────────────────────────────────
    cRegIdentidCivil:         "",
    cUfRegIdentidCivil:       "",
    cCidadRegIdentidCivil:    "",
    cOrgEmissRegIdentidCivil: "",
    iExpedRegIdentidCivil:    "0001-01-01",

    // ── CNH detalhado ────────────────────────────────────────────────────
    cCategCartNacHabilit:    "B",
    cUfCartNacHabilit:       "SP",
    cOrgEmissCartNacHabilit: "SSP",
    iExpedCartNacHabilit:    "2024-08-15",
    iDtPrimeirCartNacHabilit:"2014-09-22",

    // ── Estrangeiro adicionais ───────────────────────────────────────────
    iExpedRegNacEstrang:    "0001-01-01",
    cOrgEmissRegNacEstrang: "",
    cResidExterior:         "N",
    cCodEnderPostResidExt:  "",
    iDtChegBrasEstrang:     "0001-01-01",
    iDtNaturalizacao:       "0001-01-01",
    cCasadBrasileiroEstrang:"N",
    cTemFilhoBrasileiro:    "N",

    // ── Processos judiciais ──────────────────────────────────────────────
    cProcessAlvarJudicial:  "",
    cProcessIRRF:           "",
    cProcessContribPrevid:  "",

    // ── Estágio ──────────────────────────────────────────────────────────
    cNaturEstagio:           "N",
    iNivEstagio:             0,
    cCodPFSuperEstagio:      "",
    cAreaAtuacaoEstagio:     "",
    cNumApolSegurEstagio:    "",
    cCodPJInstitEnsinEstagio:"",
    cCodPJAgentIntegrEstagio:"",

    // ── Vínculo anterior eSocial ─────────────────────────────────────────
    cDescSalVariavel:          "",
    cCnpjEmpregadorAnter:      "",
    cMatricESocialAnter:       "",
    iDtIniVinculo:             "0001-01-01",
    cCnpjEmpCedente:           "",
    cMatricESocialEmpCedente:  "",
    iDtAdmissEmpCedente:       "0001-01-01",
    iOnusCessao:               0,
    cContratTrabTempor:        "N",
    iMotcontratacao:           0,
    cMatricESocialFuncSubstit: "",
    cCpfFuncSubstit:           "",
    cMatricESocial:            "",
    cJornFlexibilidad:         "N",
    cInterVariavel:            "N",

    // ── Cargo público ────────────────────────────────────────────────────
    iProvimento:   0,
    iTpProvimento: 0,
    iDtNomeacao:   "0001-01-01",
    iDtPosse:      "0001-01-01",
    iDtExercicio:  "0001-01-01",

    // ── Identificação alternativa ────────────────────────────────────────
    cNomESocial:       "",
    cNomRelLegais:     "",
    cNumInscrSegurado: "",
    cCondEstrang:      "",
    cCidadExterior:    "",

    // ── Cessão / Dirigente sindical ──────────────────────────────────────
    iCategCedentOrig:         0,
    iCategOrigDirigSindical:  0,
    cCnpjOrigDirigSindical:   "",
    cMatricOrigDirigSindical: "",
    iDtAdmissOrigDirigSindical:"0001-01-01",

    // ── Trabalho doméstico ───────────────────────────────────────────────
    cTpLogradLocTrabDomestic:    "",
    cEnderLogradLocTrabDomestic: "",
    cComplLocTrabaDomestic:      "",
    cBairrLocTrabDomestic:       "",
    cNumLogradLocTrabDomestic:   "",
    iMunLocTrabDomestic:         0,
    cUfLocTrabDomestic:          "",
    iCepLocTrabDomestic:         0,
    cSalExclusivVariavel:        "N",

    // ── Reservas e usos internos ─────────────────────────────────────────
    cNumCertHabProfiss:      "",
    cUsoInterDatasul:        "",
    cUsoIntDatasul:          "",
    cUsoInternoDatasul1:     "",
    cUsoInternoDatasul2:     "",
    cUsoInternoDatasul3:     "",
    cUsoInternoDatasul4:     "",
    cUsoInternoDatasul5:     "",
    cUsoInternoDatasul6:     "",
    cEnderESocial:           "",
    cCodRegSistemaExter:     "",
    cCodImagem:              "",
    cCodUnidNeg:             "",
    iIndCooperado:           0,
    iCodCategSEFIP:          0,
    iRegSalarial:            0,
    iSigOrgEmissIdent:       0,
    iCodGestor:              0,
    cCodDefcncia:            "",
    cReabilitadoInss:        "",
    cCodCrachaTsa:           "",
    iDtUltAvaliaFunc:        "0001-01-01",
    dPercentAdiantConced:    0,
    iDiasProrrog:            0,
    iDtVenctoProrrog:        "0001-01-01",
    iNumSeqRegArq:           0,
    dCompensacao:            0,
    dCompensacaoMes:         0,
    iUsoFuturo0:             0,
    iUsoFuturo1:             0,
    iUsoFuturo2:             0,
    iUsoFuturo3:             0,
    dUsoFuturo4:             0,
    dUsoFuturo5:             0,
    iUsoFuturo7:             0,
    iUsoFuturo8:             0,
    iUsoFuturo9:             0,
};
