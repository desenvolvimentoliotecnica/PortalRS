using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Organograma;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Organograma visual — retorna e atualiza a hierarquia de funcionários para o canvas drag-drop.
/// </summary>
[ApiController]
[Route("api/organograma")]
[Authorize]
public sealed class OrganogramaController : ControllerBase
{
    private readonly AppDbContext _db;

    public OrganogramaController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Retorna todos os funcionários ativos com seus dados hierárquicos.
    /// O frontend constrói a árvore a partir da lista plana usando <c>gestorDiretoId</c>.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<OrganogramaNodeResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTree(CancellationToken ct)
    {
        var nodes = await _db.Funcionarios
            .AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active)
            .Select(f => new OrganogramaNodeResponse(
                f.Id,
                f.Name,
                f.JobPosition != null ? f.JobPosition.Name : null,
                f.NivelHierarquicoId,
                f.NivelHierarquico != null ? f.NivelHierarquico.Nome : null,
                f.GestorDiretoId,
                f.AreaId,
                f.Area != null ? f.Area.Name : null
            ))
            .OrderBy(n => n.NivelHierarquicoNome)
            .ThenBy(n => n.Nome)
            .ToListAsync(ct);

        return Ok(nodes);
    }

    /// <summary>
    /// Move um funcionário para um novo gestor direto (drag-drop no canvas).
    /// Apenas Admin ou Owner podem alterar a hierarquia.
    /// </summary>
    [HttpPatch("mover")]
    [Authorize(Roles = "Admin,Owner")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Mover([FromBody] MoverFuncionarioRequest request, CancellationToken ct)
    {
        var funcionario = await _db.Funcionarios.FindAsync([request.FuncionarioId], ct);
        if (funcionario is null)
            return NotFound();

        if (request.NovoGestorId.HasValue)
        {
            if (request.NovoGestorId.Value == request.FuncionarioId)
                return BadRequest(new { message = "Um funcionário não pode ser gestor de si mesmo." });

            var gestorExiste = await _db.Funcionarios
                .AnyAsync(f => f.Id == request.NovoGestorId.Value, ct);

            if (!gestorExiste)
                return BadRequest(new { message = "Gestor não encontrado." });
        }

        funcionario.GestorDiretoId = request.NovoGestorId;
        funcionario.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}
