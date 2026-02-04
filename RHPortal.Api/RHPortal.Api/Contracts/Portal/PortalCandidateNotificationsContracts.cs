namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateNotificationsResponse(
    bool CanalEmail,
    bool CanalWhatsapp,
    bool CanalSms,
    bool CanalPush,
    string? Frequencia,
    string? Idioma,
    string? Email,
    string? Telefone,
    bool PermiteContato,
    bool AlertaNovasVagas,
    bool AlertaAtualizacoes,
    bool AlertaEntrevistas,
    bool AlertaMensagens,
    bool AlertaDocumentos,
    bool AlertaLembretes,
    string? SilencioAtivo,
    string? SilencioInicio,
    string? SilencioFim,
    string? SilencioPrioridade,
    string? Assinatura,
    DateTimeOffset? UpdatedAtUtc
);

public sealed record PortalCandidateNotificationsRequest(
    bool CanalEmail,
    bool CanalWhatsapp,
    bool CanalSms,
    bool CanalPush,
    string? Frequencia,
    string? Idioma,
    string? Email,
    string? Telefone,
    bool PermiteContato,
    bool AlertaNovasVagas,
    bool AlertaAtualizacoes,
    bool AlertaEntrevistas,
    bool AlertaMensagens,
    bool AlertaDocumentos,
    bool AlertaLembretes,
    string? SilencioAtivo,
    string? SilencioInicio,
    string? SilencioFim,
    string? SilencioPrioridade,
    string? Assinatura
);
