using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidaturaRequest(
    [Required] Guid VagaId,
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(180)] string Email,
    [MaxLength(40)] string? Fone,
    [MaxLength(120)] string? CidadeUf,
    [MaxLength(200)] string? Linkedin,
    [MaxLength(200)] string? Portfolio,
    [MaxLength(160)] string? CargoAtual,
    [Range(0, 80)] int? AnosExperiencia,
    [MaxLength(2000)] string? Observacoes,
    IFormFile? Arquivo,
    /// <summary>JSON array: [{"campoId":"guid","valor":"text"}, ...]</summary>
    [MaxLength(8000)] string? CamposPersonalizadosJson
);
