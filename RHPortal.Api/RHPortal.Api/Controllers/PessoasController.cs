using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.Pessoas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// CRUD de pessoa (dados da pessoa). Lista todas as pessoas com indicação de bloqueio.
/// </summary>
[ApiController]
[Route("api/pessoas")]
[Authorize]
public sealed class PessoasController : ControllerBase
{
    /// <summary>
    /// Lista pessoas (paginado), com indicação se estão bloqueadas.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PessoaPagedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<PessoaPagedResponse>> List(
        [FromServices] IPessoaService service,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string sort = "nome",
        [FromQuery] string dir = "asc",
        CancellationToken ct = default)
    {
        var query = new PessoaListQuery(q, page, pageSize, sort, dir);
        var result = await service.ListAsync(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Obtém uma pessoa pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PessoaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PessoaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria uma nova pessoa.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PessoaResponse>> Create(
        [FromBody] PessoaCreateRequest request,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        // #region agent log
        const string logPath = "/Users/victoralves/Projects/Voltage.RenderRH/.cursor/debug.log";
        try
        {
            var line = JsonSerializer.Serialize(new { hypothesisId = "B", location = "PessoasController.Create:entry", message = "Model binding OK", data = new { requestNotNull = request != null, origem = request?.Origem.ToString() }, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), sessionId = "debug-session", runId = "run1" }) + "\n";
            System.IO.File.AppendAllText(logPath, line);
        }
        catch { /* no-op */ }
        // #endregion
        var result = await service.CreateAsync(request!, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Atualiza uma pessoa.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PessoaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PessoaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] PessoaUpdateRequest request,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Bulk upsert idempotente — usado pelo worker TOTVS RM (PortalPessoaBulkSyncService).
    /// Chave: CPF (preferencial) ou Email (fallback). Roda numa transação só.
    /// </summary>
    [HttpPost("bulk")]
    [AllowAnonymous] // Worker autentica via X-Api-Key + X-Tenant-Id (TenantMiddleware)
    [ProducesResponseType(typeof(PessoaBulkResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<PessoaBulkResponse>> BulkUpsert(
        [FromBody] PessoaBulkRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new PessoaBulkResponse(0, 0, 0, 0));

        var tenantId = tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;

        var cpfs = request.Items.Where(i => !string.IsNullOrWhiteSpace(i.Cpf))
            .Select(i => i.Cpf!.Trim()).Distinct().ToList();
        var emails = request.Items.Where(i => !string.IsNullOrWhiteSpace(i.Email))
            .Select(i => i.Email!.Trim().ToLowerInvariant()).Distinct().ToList();

        // PPESSOA legacy às vezes tem CPF duplicado entre pessoas distintas (cadastros antigos);
        // GroupBy + First() escolhe determinístico (menor Id) pra evitar exceção em ToDictionary.
        var existingByCpf = (await db.Pessoas
                .Where(p => p.TenantId == tenantId && p.Cpf != null && cpfs.Contains(p.Cpf))
                .ToListAsync(ct))
            .GroupBy(p => p.Cpf!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);
        var existingByEmail = (await db.Pessoas
                .Where(p => p.TenantId == tenantId && p.Email != null && emails.Contains(p.Email.ToLower()))
                .ToListAsync(ct))
            .GroupBy(p => p.Email.ToLowerInvariant(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);

        static string? Trunc(string? value, int max) =>
            string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value.Substring(0, max));

        var created = 0;
        var updated = 0;
        var skipped = 0;
        foreach (var item in request.Items)
        {
            var nome = (item.Nome ?? "").Trim();
            if (string.IsNullOrEmpty(nome)) { skipped++; continue; }

            var cpf = Trunc(item.Cpf?.Trim(), 14);
            var email = Trunc(item.Email?.Trim().ToLowerInvariant(), 180);

            Pessoa? p = null;
            if (!string.IsNullOrEmpty(cpf) && existingByCpf.TryGetValue(cpf, out var byCpf)) p = byCpf;
            else if (!string.IsNullOrEmpty(email) && existingByEmail.TryGetValue(email, out var byEmail)) p = byEmail;

            if (p is null)
            {
                p = new Pessoa
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Origem = OrigemPessoa.Funcionario,
                    Nome = Trunc(nome, 160)!,
                    Email = email ?? string.Empty,
                    Cpf = cpf,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                };
                db.Pessoas.Add(p);
                created++;
                if (!string.IsNullOrEmpty(cpf)) existingByCpf[cpf] = p;
                if (!string.IsNullOrEmpty(email)) existingByEmail[email] = p;
            }
            else updated++;

            // Upsert (não sobrescreve com null)
            p.Nome = Trunc(nome, 160)!;
            if (!string.IsNullOrEmpty(email)) p.Email = email;
            p.Cpf = cpf ?? p.Cpf;
            p.Fone = Trunc(item.Telefone, 40) ?? p.Fone;
            p.FoneContato = Trunc(item.Telefone2, 40) ?? p.FoneContato;
            p.Cidade = Trunc(item.Cidade, 120) ?? p.Cidade;
            p.Uf = Trunc(item.Uf, 2) ?? p.Uf;
            p.Cep = Trunc(item.Cep, 20) ?? p.Cep;
            p.Logradouro = Trunc(item.Logradouro, 200) ?? p.Logradouro;
            p.Numero = Trunc(item.Numero, 40) ?? p.Numero;
            p.Bairro = Trunc(item.Bairro, 120) ?? p.Bairro;
            p.Complemento = Trunc(item.Complemento, 120) ?? p.Complemento;
            p.Rg = Trunc(item.Rg, 20) ?? p.Rg;
            p.RgOrgEmissor = Trunc(item.RgOrgEmissor, 20) ?? p.RgOrgEmissor;
            p.RgUf = Trunc(item.RgUf, 2) ?? p.RgUf;
            p.RgDataEmissao = item.RgDataEmissao.HasValue
                ? DateTime.SpecifyKind(item.RgDataEmissao.Value, DateTimeKind.Utc)
                : p.RgDataEmissao;
            p.DataNascimento = item.DataNascimento.HasValue
                ? DateTime.SpecifyKind(item.DataNascimento.Value, DateTimeKind.Utc)
                : p.DataNascimento;
            p.Sexo = Trunc(item.Sexo, 1) ?? p.Sexo;
            p.EstadoCivil = Trunc(item.EstadoCivil, 2) ?? p.EstadoCivil;
            p.Naturalidade = Trunc(item.Naturalidade, 120) ?? p.Naturalidade;
            p.EstadoNatal = Trunc(item.EstadoNatal, 2) ?? p.EstadoNatal;
            p.GrauInstrucao = Trunc(item.GrauInstrucao, 5) ?? p.GrauInstrucao;
            p.CarteiraTrabalho = Trunc(item.CarteiraTrabalho, 20) ?? p.CarteiraTrabalho;
            p.CarteiraTrabalhoSerie = Trunc(item.CarteiraTrabalhoSerie, 10) ?? p.CarteiraTrabalhoSerie;
            p.CarteiraTrabalhoUf = Trunc(item.CarteiraTrabalhoUf, 2) ?? p.CarteiraTrabalhoUf;
            p.CarteiraTrabalhoData = item.CarteiraTrabalhoData.HasValue
                ? DateTime.SpecifyKind(item.CarteiraTrabalhoData.Value, DateTimeKind.Utc)
                : p.CarteiraTrabalhoData;
            p.NumeroPis = Trunc(item.NumeroPis, 20) ?? p.NumeroPis;
            p.TituloEleitor = Trunc(item.TituloEleitor, 20) ?? p.TituloEleitor;
            p.TituloEleitorZona = Trunc(item.TituloEleitorZona, 10) ?? p.TituloEleitorZona;
            p.TituloEleitorSecao = Trunc(item.TituloEleitorSecao, 10) ?? p.TituloEleitorSecao;
            p.CertificadoReservista = Trunc(item.CertificadoReservista, 20) ?? p.CertificadoReservista;
            p.CategoriaMilitar = Trunc(item.CategoriaMilitar, 2) ?? p.CategoriaMilitar;
            p.NomePai = Trunc(item.NomePai, 160) ?? p.NomePai;
            p.NomeMae = Trunc(item.NomeMae, 160) ?? p.NomeMae;
            p.Nacionalidade = Trunc(item.Nacionalidade, 60) ?? p.Nacionalidade;
            p.UpdatedAtUtc = now;
        }

        await db.SaveChangesAsync(ct);
        return Ok(new PessoaBulkResponse(created, updated, skipped, request.Items.Count));
    }

    /// <summary>Remove uma pessoa (bloqueado se houver funcionário ativo ou candidaturas ativas).</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        try
        {
            var deleted = await service.DeleteAsync(id, ct);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
