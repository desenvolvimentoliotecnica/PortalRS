(function () {
  if (window.PortalVagasStrings) return;

  window.PortalVagasStrings = {
    common: {
      loading: "Carregando...",
      notAvailable: "Nao disponivel",
      saveSuccess: "Salvo com sucesso.",
      saveError: "Nao foi possivel salvar.",
      ok: "Ok",
      cancel: "Cancelar",
      remove: "Remover",
      clear: "Limpar",
      confirm: "Confirmar",
      save: "Salvar",
      removeConfirmTitle: "Tem certeza?",
      removeConfirmText: "Esta acao nao pode ser desfeita.",
      removeConfirmYes: "Sim, remover",
      removeConfirmNo: "Cancelar",
      unauthorized: "Acesso nao autorizado."
    },
    apply: {
      send: "Enviar candidatura",
      sending: "Enviando...",
      loadUf: "Carregando UFs...",
      loadCity: "Carregando municipios...",
      selectUfFirst: "Selecione a UF primeiro",
      selectOption: "Selecione",
      ufLoadFail: "Nao foi possivel carregar UFs",
      cityLoadFail: "Nao foi possivel carregar cidades",
      attachmentTooLarge: "O arquivo excede 5MB. Selecione um arquivo menor.",
      attachmentInvalid: "Formato nao aceito. Use PDF, DOC ou DOCX.",
      reviewFields: "Revise os campos destacados antes de enviar.",
      tenantMissing: "Tenant nao informado. Recarregue a pagina e tente novamente.",
      submitError: "Ocorreu um erro ao enviar sua candidatura. Tente novamente.",
      submitSuccessTitle: "Candidatura enviada",
      submitSuccessText: "Em breve voce recebera um email com uma chave unica para acessar o portal futuramente.",
      submitSuccessFallback: "Candidatura enviada com sucesso. Voce recebera um email com uma chave unica para acessar o portal futuramente.",
      validateFileError: "Nao foi possivel validar o arquivo selecionado.",
      invalidFile: "Arquivo invalido."
    },
    newJob: {
      saving: "Salvando...",
      save: "Salvar",
      createSuccess: "Vaga criada com sucesso.",
      createError: "Nao foi possivel salvar a vaga.",
      missingRequired: "Preencha os campos obrigatorios.",
      loadUfFail: "Nao foi possivel carregar UFs.",
      loadCityFail: "Nao foi possivel carregar cidades.",
      loadJobFail: "Nao foi possivel carregar os dados da vaga.",
      loadJobFailShort: "Nao foi possivel carregar dados da vaga.",
      selectOption: "Selecione",
      selectArea: "Selecione a area",
      selectDepartment: "Selecione o departamento",
      selectStatus: "Selecione o status",
      loadUf: "Carregando UFs...",
      loadCity: "Carregando municipios...",
      selectUfFirst: "Selecione a UF primeiro",
      unexpectedErrorTitle: "Erro inesperado",
      createFail: "Nao foi possivel criar a vaga.",
      createFailAlert: "Falha ao criar a vaga.",
      saveFailTitle: "Falha ao salvar",
      saveSuccessTitle: "Vaga salva",
      saveSuccessText: "A vaga foi criada com sucesso.",
      unauthorized: "Acesso nao autorizado.",
      selectModalidade: "Modalidade",
      selectSenioridade: "Senioridade",
      selectTipo: "Tipo",
      selectVisibilidade: "Visibilidade"
    },
    jobs: {
      loadFail: "Nao foi possivel carregar as vagas. URL da API nao configurada.",
      loadFailGeneric: "Nao foi possivel carregar as vagas.",
      notInformed: "Nao informado",
      sectionFallbackTitle: "Outras oportunidades",
      companyFallback: "Portal RH",
      titleFallback: "Vaga",
      areaFallback: "Geral",
      tagFallback: "Geral",
      salaryLabel: "Faixa",
      salaryToBeArranged: "a combinar",
      vacanciesLabel: "vagas",
      noResults: "0 vagas encontradas",
      countSingular: "vaga encontrada",
      countPlural: "vagas encontradas"
    },
    index: {
      applyInitFail: "Nao foi possivel iniciar a candidatura. Abra os detalhes de uma vaga e tente novamente."
    },
    filters: {
      clear: "Limpar",
      searchPlaceholder: "Buscar por cargo, empresa, tecnologia..."
    },
    jobModal: {
      apply: "Candidatar-se",
      notAvailable: "Nao disponivel"
    },
    profile: {
      alertLoadFail: "Nao foi possivel carregar os dados."
    },
    experience: {
      saveErrorTitle: "Erro ao salvar",
      saveErrorText: "Nao foi possivel salvar a experiencia.",
      removeTitle: "Remover experiÃªncia?",
      removeErrorTitle: "Erro ao remover",
      removeErrorText: "Nao foi possivel remover a experiencia.",
      projectSaveErrorText: "Nao foi possivel salvar o projeto.",
      projectRemoveTitle: "Remover projeto?",
      projectRemoveErrorText: "Nao foi possivel remover o projeto.",
      tagRemoveTitle: "Remover tag?",
      tagRemoveLabel: "Remover tag"
    },
    education: {
      saveErrorTitle: "Erro ao salvar",
      saveErrorText: "Nao foi possivel salvar a formacao.",
      removeTitle: "Remover formaÃ§Ã£o?",
      removeErrorTitle: "Erro ao remover",
      removeErrorText: "Nao foi possivel remover a formacao.",
      clearTitle: "Limpar FormaÃ§Ã£o & EducaÃ§Ã£o?"
    },
    skills: {
      saveErrorTitle: "Erro ao salvar",
      saveErrorText: "Nao foi possivel salvar a competencia.",
      removeTitle: "Remover competÃªncia?",
      removeErrorTitle: "Erro ao remover",
      removeErrorText: "Nao foi possivel remover a competencia.",
      removeLegacyTitle: "Remover esta compet??ncia?",
      certSaveErrorText: "Nao foi possivel salvar o curso/certificacao.",
      certRemoveTitle: "Remover item?",
      certRemoveErrorText: "Nao foi possivel remover o curso/certificacao.",
      clearTitle: "Limpar CompetÃªncias & PortfÃ³lio?"
    },
    documents: {
      saveFail: "Falha ao salvar documento.",
      saveFailTitle: "Falha ao salvar",
      removeTitle: "Remover documento?",
      removeFail: "Falha ao remover documento.",
      removeFailTitle: "Falha ao remover",
      insertExamplesFailTitle: "Falha ao inserir exemplos",
      clearTitle: "Limpar Documentos & Anexos?",
      unexpectedError: "Erro inesperado"
    },
    references: {
      confirmContactTitle: "Confirmar contato imediato?",
      saveFail: "Falha ao salvar referencia.",
      saveFailTitle: "Falha ao salvar",
      removeTitle: "Remover referÃªncia?",
      removeFail: "Falha ao remover referÃƒÂªncia.",
      removeFailTitle: "Falha ao remover",
      insertExamplesFailTitle: "Falha ao inserir exemplos",
      clearTitle: "Limpar ReferÃªncias?"
    },
    a11y: {
      saveFail: "Falha ao salvar acessibilidade.",
      saveFailTitle: "Falha ao salvar",
      insertExampleFail: "Falha ao inserir exemplo.",
      insertExamplesFailTitle: "Falha ao inserir exemplo",
      clearTitle: "Limpar Acessibilidade & InclusÃ£o?",
      clearFail: "Falha ao limpar.",
      clearFailTitle: "Falha ao limpar",
      unexpectedError: "Erro inesperado"
    },
    agenda: {
      saveErrorTitle: "Erro ao salvar",
      saveErrorText: "Nao foi possivel salvar o bloqueio.",
      removeTitle: "Remover bloqueio?",
      removeErrorTitle: "Erro ao remover",
      removeErrorText: "Nao foi possivel remover o bloqueio.",
      clearTitle: "Limpar Disponibilidade & Agenda?",
      noticeFallback: "â€”"
    },
    apps: {
      removeTitle: "Remover candidatura?",
      clearTitle: "Limpar histÃ³rico?"
    },
    notifications: {
      ok: "Ok",
      clearTitle: "Limpar Notificacoes?",
      typeNewJobs: "Novas vagas",
      typeAppsUpdates: "Atualizacao de status",
      typeInterviews: "Entrevistas",
      typeMessages: "Mensagens",
      typeDocs: "Documentos",
      typeReminders: "Lembretes",
      allowContactYes: "Sim",
      allowContactNo: "Nao",
      quietActiveFallback: "Nao"
    },
    preferences: {
      clearTitle: "Limpar PreferÃªncias?",
      commuteExample: "Acesso facil a onibus/metro."
    },
    lgpd: {
      cancel: "Cancelar"
    }
  };
})();
