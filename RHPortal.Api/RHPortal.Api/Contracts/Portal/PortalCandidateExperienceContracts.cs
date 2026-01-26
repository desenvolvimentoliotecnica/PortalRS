using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateExperienceDto(
    Guid Id,
    string Empresa,
    string Cargo,
    string? Inicio,
    string? Fim,
    string? Local,
    string? Atividades);

public sealed record PortalCandidateProjectDto(
    Guid Id,
    string Nome,
    string? Periodo,
    string? Descricao,
    string? Link,
    string? Stack,
    string? Destaques);

public sealed record PortalCandidateExperienceProjectResponse(
    IReadOnlyList<PortalCandidateExperienceDto> Experiences,
    IReadOnlyList<PortalCandidateProjectDto> Projects);

public sealed record PortalCandidateExperienceRequest(
    [Required] string Empresa,
    [Required] string Cargo,
    string? Inicio,
    string? Fim,
    string? Local,
    string? Atividades);

public sealed record PortalCandidateProjectRequest(
    [Required] string Nome,
    string? Periodo,
    string? Descricao,
    string? Link,
    string? Stack,
    string? Destaques);
