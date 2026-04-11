using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Organograma;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

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
    /// Retorna a estrutura organizacional: lotações ativas com seus funcionários agrupados.
    /// Funcionários sem lotação são retornados em lista separada.
    /// </summary>
    [HttpGet("estrutura")]
    [ProducesResponseType(typeof(OrganogramaEstruturaResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEstrutura(CancellationToken ct)
    {
        // 1. Todas as lotações ativas
        var lotacoes = await _db.UnidadesLotacao
            .AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.Level)
            .ThenBy(u => u.Description)
            .Select(u => new
            {
                u.Id,
                Codigo = u.Code,
                Descricao = u.Description,
                u.Level,
                u.ParentId,
                u.OwnerFuncionarioId,
            })
            .ToListAsync(ct);

        // 2. Todos os funcionários ativos
        var funcionarios = await _db.Funcionarios
            .AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active)
            .OrderBy(f => f.NivelHierarquico != null ? f.NivelHierarquico.Ordem : (int?)null)
            .ThenBy(f => f.Name)
            .Select(f => new
            {
                f.Id,
                Nome = f.Name,
                Cargo = f.JobPosition != null ? f.JobPosition.Name : null,
                NivelHierarquicoNome = f.NivelHierarquico != null ? f.NivelHierarquico.Nome : null,
                NivelHierarquicoOrdem = f.NivelHierarquico != null ? f.NivelHierarquico.Ordem : (int?)null,
                f.UnidadeLotacaoId,
            })
            .ToListAsync(ct);

        // 3. Agrupar funcionários por lotação (em memória)
        var byLotacao = funcionarios
            .Where(f => f.UnidadeLotacaoId.HasValue)
            .GroupBy(f => f.UnidadeLotacaoId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var semLotacao = funcionarios
            .Where(f => f.UnidadeLotacaoId == null)
            .Select(f => new OrganogramaFuncionarioDto(f.Id, f.Nome, f.Cargo, f.NivelHierarquicoNome, f.NivelHierarquicoOrdem))
            .ToList();

        var lotacoesDto = lotacoes.Select(u =>
        {
            var funcs = byLotacao.TryGetValue(u.Id, out var list) ? list : [];

            var respRaw = u.OwnerFuncionarioId.HasValue
                ? funcs.FirstOrDefault(f => f.Id == u.OwnerFuncionarioId.Value)
                : null;

            var responsavel = respRaw is not null
                ? new OrganogramaFuncionarioDto(respRaw.Id, respRaw.Nome, respRaw.Cargo, respRaw.NivelHierarquicoNome, respRaw.NivelHierarquicoOrdem)
                : null;

            var funcionariosDto = funcs
                .Select(f => new OrganogramaFuncionarioDto(f.Id, f.Nome, f.Cargo, f.NivelHierarquicoNome, f.NivelHierarquicoOrdem))
                .ToList();

            return new OrganogramaLotacaoDto(u.Id, u.Codigo, u.Descricao, u.Level, u.ParentId, responsavel, funcionariosDto);
        }).ToList();

        return Ok(new OrganogramaEstruturaResponse(lotacoesDto, semLotacao));
    }

    /// <summary>
    /// Move um funcionário para um novo gestor direto.
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
