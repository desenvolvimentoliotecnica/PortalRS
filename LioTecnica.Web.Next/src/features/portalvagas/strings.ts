/**
 * i18n para Portal de Vagas — pt-BR e en-US.
 * Locale via localStorage "renderrh.locale".
 */

export type PortalVagasLocale = "pt-BR" | "en-US";

export const strings = {
  "pt-BR": {
    common: {
      loading: "Carregando...",
      save: "Salvar",
      cancel: "Cancelar",
      remove: "Remover",
      clear: "Limpar",
      ok: "Ok",
      confirm: "Confirmar",
    },
    apps: {
      title: "Histórico de Candidaturas & Etapas",
      subtitle: "Acompanhe suas candidaturas (MVP: salvo neste navegador).",
      insertExample: "Inserir exemplo",
      importFromMyApps: "Importar do Minhas candidaturas",
      newApp: "Nova candidatura",
      downloadSummary: "Baixar resumo",
      clear: "Limpar",
      noApps: "Nenhuma candidatura cadastrada.",
      searchPlaceholder: "Buscar por vaga, empresa, local...",
      statusAll: "Status (todos)",
      sortNew: "Mais recentes",
      sortOld: "Mais antigas",
      sortStatus: "Por status",
      downloadSuccess: "Resumo baixado.",
      summaryHeader: "Resumo — Histórico de Candidaturas",
      summaryGenerated: "Gerado em:",
    },
    access: {
      login: "Entrar",
      register: "Cadastrar",
      helpSteps: [
        "Cadastro rápido e perfil único.",
        "Triagem e retorno em até 5 dias.",
        "Entrevista com gestor.",
        "Proposta e onboarding.",
      ],
    },
    jobs: {
      noResults: "0 vagas encontradas",
      countSingular: "vaga encontrada",
      countPlural: "vagas encontradas",
      apply: "Candidatar-se",
      notAvailable: "Não disponível",
    },
    profile: {
      perfil: "Perfil",
      vagas: "Vagas",
      agenda: "Agenda",
    },
  },
  "en-US": {
    common: {
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      remove: "Remove",
      clear: "Clear",
      ok: "Ok",
      confirm: "Confirm",
    },
    apps: {
      title: "Application History & Stages",
      subtitle: "Track your applications (MVP: saved in this browser).",
      insertExample: "Insert example",
      importFromMyApps: "Import from My applications",
      newApp: "New application",
      downloadSummary: "Download summary",
      clear: "Clear",
      noApps: "No applications registered.",
      searchPlaceholder: "Search by job, company, location...",
      statusAll: "Status (all)",
      sortNew: "Newest first",
      sortOld: "Oldest first",
      sortStatus: "By status",
      downloadSuccess: "Summary downloaded.",
      summaryHeader: "Summary — Application History",
      summaryGenerated: "Generated at:",
    },
    access: {
      login: "Log in",
      register: "Register",
      helpSteps: [
        "Quick registration and unique profile.",
        "Screening and feedback within 5 days.",
        "Interview with manager.",
        "Offer and onboarding.",
      ],
    },
    jobs: {
      noResults: "0 jobs found",
      countSingular: "job found",
      countPlural: "jobs found",
      apply: "Apply",
      notAvailable: "Not available",
    },
    profile: {
      perfil: "Profile",
      vagas: "Jobs",
      agenda: "Agenda",
    },
  },
} as const;

export function getPortalVagasLocale(): PortalVagasLocale {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const v = localStorage.getItem("renderrh.locale");
    if (v === "en-US") return "en-US";
    return "pt-BR";
  } catch {
    return "pt-BR";
  }
}

export function t(locale: PortalVagasLocale) {
  return strings[locale];
}
