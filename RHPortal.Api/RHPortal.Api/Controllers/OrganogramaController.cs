using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Organograma;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/organograma")]
[Authorize]
public sealed class OrganogramaController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _userContext;

    public OrganogramaController(AppDbContext db, ICurrentUserContext userContext)
    {
        _db = db;
        _userContext = userContext;
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

        // 4. Headcount por lotação (autorizado e provisório via Vagas; ocupado via OcupacoesHistorico)
        var vagasByLotacao = await _db.Vagas.AsNoTracking()
            .Where(v => v.UnidadeLotacaoId != null)
            .GroupBy(v => v.UnidadeLotacaoId!.Value)
            .Select(g => new
            {
                LotacaoId = g.Key,
                Autorizado = g.Sum(v => v.HeadcountAutorizado),
                Provisorio = g.Sum(v => v.HeadcountProvisorio),
            })
            .ToListAsync(ct);

        var vagaIdsByLotacao = await _db.Vagas.AsNoTracking()
            .Where(v => v.UnidadeLotacaoId != null)
            .Select(v => new { v.Id, LotacaoId = v.UnidadeLotacaoId!.Value })
            .ToListAsync(ct);

        var ocupacaosByVaga = await _db.OcupacoesHistorico.AsNoTracking()
            .Where(h => h.DataSaida == null)
            .Select(h => h.VagaId)
            .ToListAsync(ct);

        var ocupadoSet = ocupacaosByVaga.ToHashSet();
        var vagaLotacaoMap = vagaIdsByLotacao.ToDictionary(v => v.Id, v => v.LotacaoId);

        var ocupadoByLotacao = ocupadoSet
            .Where(id => id.HasValue && vagaLotacaoMap.ContainsKey(id.Value))
            .GroupBy(id => vagaLotacaoMap[id!.Value])
            .ToDictionary(g => g.Key, g => g.Count());

        var headcountMap = vagasByLotacao.ToDictionary(
            v => v.LotacaoId,
            v => (Autorizado: v.Autorizado, Provisorio: v.Provisorio));

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

            var hc = headcountMap.TryGetValue(u.Id, out var hcVal) ? hcVal : (Autorizado: 0, Provisorio: 0);
            var ocupado = ocupadoByLotacao.TryGetValue(u.Id, out var oc) ? oc : 0;

            return new OrganogramaLotacaoDto(
                u.Id, u.Codigo, u.Descricao, u.Level, u.ParentId,
                responsavel, funcionariosDto,
                hc.Autorizado, ocupado, hc.Provisorio);
        }).ToList();

        return Ok(new OrganogramaEstruturaResponse(lotacoesDto, semLotacao));
    }

    /// <summary>
    /// Move um funcionário para um novo gestor direto.
    /// Admin/Owner: qualquer movimentação.
    /// Gestor: pode mover apenas funcionários dentro de sua subárvore (subordinados diretos/indiretos).
    /// </summary>
    [HttpPatch("mover")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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

        // Autorização: Admin/Owner passam; Gestores só podem mover dentro de sua subárvore
        var isAdminOrOwner = _userContext.IsAdmin || User.IsInRole("Owner");
        if (!isAdminOrOwner)
        {
            var gestorId = _userContext.FuncionarioId;
            if (!gestorId.HasValue)
                return Forbid();

            // Coleta todos os subordinados diretos e indiretos do gestor logado
            var subtree = await BuildSubtreeAsync(gestorId.Value, ct);

            var funcionarioInSubtree = subtree.Contains(request.FuncionarioId);
            var novoGestorInSubtreeOrSelf = request.NovoGestorId == gestorId ||
                (request.NovoGestorId.HasValue && subtree.Contains(request.NovoGestorId.Value));

            if (!funcionarioInSubtree || !novoGestorInSubtreeOrSelf)
                return Forbid();
        }

        funcionario.GestorDiretoId = request.NovoGestorId;
        funcionario.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>Retorna os IDs de todos os subordinados diretos e indiretos de um gestor.</summary>
    private async Task<HashSet<Guid>> BuildSubtreeAsync(Guid gestorId, CancellationToken ct)
    {
        // Carrega todos os funcionários ativos com seu gestor direto em uma única query
        var allFuncs = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active && f.GestorDiretoId.HasValue)
            .Select(f => new { f.Id, f.GestorDiretoId })
            .ToListAsync(ct);

        var byGestor = allFuncs
            .GroupBy(f => f.GestorDiretoId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(f => f.Id).ToList());

        var result = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(gestorId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!byGestor.TryGetValue(current, out var children)) continue;
            foreach (var child in children)
            {
                if (result.Add(child))
                    queue.Enqueue(child);
            }
        }

        return result;
    }
}
