using RhPortal.Api.Contracts.Portal;

namespace RhPortal.Api.Contracts.Candidatos;

/// <summary>
/// Agregado read-only do perfil do candidato como no portal (portal-candidates), para consumo autenticado do RH.
/// </summary>
public sealed record CandidatoPortalPerfilCompletoResponse(
    PortalCandidateProfileResponse PerfilBasico,
    PortalCandidateSkillsPortfolioResponse SkillsPortfolio,
    PortalCandidateEducationResponse Education,
    PortalCandidatePreferencesResponse Preferences,
    PortalCandidateAccessibilityDto Accessibility,
    PortalCandidateAgendaResponse Agenda,
    PortalCandidateNotificationsResponse Notifications,
    PortalCandidateDocumentsResponse PortalDocuments,
    PortalCandidateLgpdResponse Lgpd,
    PortalCandidateReferencesResponse References,
    PortalCandidateExperienceProjectResponse ExperienceProjects
);
