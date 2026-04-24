using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.ProjetosVaga;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
[RequireModule("recrutamento")]
public sealed class ProjetoVagaController : ControllerBase
{
    private readonly IProjetoVagaService _service;

    public ProjetoVagaController(IProjetoVagaService service) => _service = service;

    // ── Projetos ──

    [HttpGet("api/vagas/{vagaId:guid}/projetos")]
    public async Task<IActionResult> ListProjetos(Guid vagaId, CancellationToken ct)
        => Ok(await _service.ListProjetosAsync(vagaId, ct));

    [HttpPost("api/vagas/{vagaId:guid}/projetos")]
    public async Task<IActionResult> CreateProjeto(Guid vagaId, [FromBody] ProjetoVagaCreateRequest request, CancellationToken ct)
        => Created("", await _service.CreateProjetoAsync(vagaId, request, ct));

    [HttpGet("api/projetos/{projetoId:guid}")]
    public async Task<IActionResult> GetProjeto(Guid projetoId, CancellationToken ct)
    {
        var result = await _service.GetProjetoAsync(projetoId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPut("api/projetos/{projetoId:guid}")]
    public async Task<IActionResult> UpdateProjeto(Guid projetoId, [FromBody] ProjetoVagaUpdateRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateProjetoAsync(projetoId, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    // ── Candidatos do projeto ──

    [HttpGet("api/projetos/{projetoId:guid}/candidatos")]
    public async Task<IActionResult> ListCandidatos(Guid projetoId, CancellationToken ct)
        => Ok(await _service.ListCandidatosAsync(projetoId, ct));

    [HttpGet("api/projetos/{projetoId:guid}/disponiveis")]
    public async Task<IActionResult> ListDisponiveis(Guid projetoId, CancellationToken ct)
        => Ok(await _service.ListDisponiveisAsync(projetoId, ct));

    [HttpPost("api/projetos/{projetoId:guid}/candidatos")]
    public async Task<IActionResult> AddCandidato(Guid projetoId, [FromBody] ProjetoCandidatoAddRequest request, CancellationToken ct)
    {
        var result = await _service.AddCandidatoAsync(projetoId, request, ct);
        return result is null ? NotFound() : Created("", result);
    }

    [HttpPut("api/projetos/{projetoId:guid}/candidatos/{id:guid}")]
    public async Task<IActionResult> UpdateCandidato(Guid projetoId, Guid id, [FromBody] ProjetoCandidatoUpdateRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateCandidatoAsync(projetoId, id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
