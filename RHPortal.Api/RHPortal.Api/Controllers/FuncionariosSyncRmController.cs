using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint dedicado pro worker TOTVS RM (<c>PortalFuncionarioSyncService</c>).
///
/// Padrão:
///   - Recebe array com códigos crus do RM (CHAPA + CODSECAO + CODCARGO + CODFILIAL + IDHIERARQUIADESTINO).
///   - Filtra ativos (<c>CodSituacao IN ('A','F','P')</c>) — desligados não viram Funcionario.
///   - Resolve FKs internamente via lookup tables em memória (uma query por entidade-mestre).
///   - Upsert idempotente por <c>(TenantId, MatriculaRm)</c>.
///
/// Diferente do <c>FuncionariosController.Create</c> que requer dados já resolvidos.
/// </summary>
[ApiController]
[Route("api/funcionarios/sync-rm")]
public sealed class FuncionariosSyncRmController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public FuncionariosSyncRmController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpPost("bulk")]
    [ProducesResponseType(typeof(FuncionarioSyncRmBulkResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FuncionarioSyncRmBulkResponse>> BulkSync(
        [FromBody] FuncionarioSyncRmBulkRequest request,
        CancellationToken ct)
    {
        var warnings = new List<string>();
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new FuncionarioSyncRmBulkResponse(0, 0, 0, 0, 0, warnings));

        var tenantId = _tenantContext.TenantId;
        var total = request.Items.Count;

        // 2026-04-26: aceita TODOS funcionários (ativos + desligados/inativos).
        // Status é mapeado: A,F,P → Active(1); demais (D=Desligado, I=Inativo, etc.) → Inactive(2).
        // Permite vincular Desligamento.FuncionarioId mesmo dos que já saíram, e
        // viabiliza histórico/auditoria. Tela de Funcionários filtra Active por default.
        var ativos = request.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.Chapa) && !string.IsNullOrWhiteSpace(i.Nome))
            .ToList();
        var skippedInactive = total - ativos.Count;

        FuncionarioStatus MapStatus(string? codSit)
        {
            var s = (codSit ?? "").Trim().ToUpperInvariant();
            return new[] { "A", "F", "P" }.Contains(s) ? FuncionarioStatus.Active : FuncionarioStatus.Inactive;
        }

        static DateTime? AsUtc(DateTime? value) =>
            value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

        // Mapa de descrições TOTVS RM (Liotécnica usa A,D,F,P,I,Z,W,M).
        string? MapSituacaoDescricao(string? codSit) => (codSit ?? "").Trim().ToUpperInvariant() switch
        {
            "A" => "Ativo",
            "F" => "Férias",
            "P" => "Pré-admissão",
            "D" => "Demitido",
            "I" => "Inativo",
            "T" => "Transferido",
            "R" => "Aposentado",
            "B" => "Beneficiário",
            "S" => "Substituição",
            "Z" => "Outros (Z)",
            "W" => "Outros (W)",
            "M" => "Outros (M)",
            "" => null,
            null => null,
            _ => $"Código {codSit?.Trim()}",
        };

        // ─── Lookups carregados uma vez por sync ─────────────────────────────
        var ccByCode = await _db.CentrosCusto.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        var jobByCode = await _db.JobPositions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        var unitByCode = await _db.Units.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase, ct);

        var hierarquiaByIdRm = await _db.Hierarquias.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.IdHierarquiaRm, x => x.Id, ct);

        // Pessoas — lookup por CPF (mais estável que email pra match com CPF do PFUNC/PPESSOA).
        // Carrega entity completa pra atualizar campos LUC-122 in-place.
        var cpfsPayload = ativos.Where(i => !string.IsNullOrWhiteSpace(i.Cpf)).Select(i => i.Cpf!.Trim()).Distinct().ToList();
        var pessoasByCpfRaw = await _db.Pessoas
            .Where(x => x.TenantId == tenantId && x.Cpf != null && cpfsPayload.Contains(x.Cpf))
            .ToListAsync(ct);
        var pessoasByCpf = pessoasByCpfRaw
            .GroupBy(p => p.Cpf!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First());

        // Funcionários existentes por MatriculaRm — usa GroupBy safe pra ignorar duplicatas históricas.
        var chapas = ativos.Select(i => i.Chapa.Trim()).Distinct().ToList();
        var funcByMatriculaRaw = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null && chapas.Contains(f.MatriculaRm))
            .ToListAsync(ct);
        var funcByMatricula = funcByMatriculaRaw
            .GroupBy(f => f.MatriculaRm!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First());

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;
        var skipped = 0;

        foreach (var item in ativos)
        {
            var chapa = item.Chapa.Trim();
            Guid? centroCustoId = null;
            if (!string.IsNullOrWhiteSpace(item.CodSecao) && ccByCode.TryGetValue(item.CodSecao.Trim(), out var ccId))
                centroCustoId = ccId;

            Guid? jobPositionId = null;
            if (!string.IsNullOrWhiteSpace(item.CodCargo) && jobByCode.TryGetValue(item.CodCargo.Trim(), out var jpId))
                jobPositionId = jpId;

            Guid? unitId = null;
            if (item.CodFilial.HasValue)
            {
                var codePadded = item.CodFilial.Value.ToString().PadLeft(2, '0');
                if (unitByCode.TryGetValue(codePadded, out var uId))
                    unitId = uId;
            }

            Guid? hierarquiaId = null;
            if (item.IdHierarquiaDestinoRm.HasValue && hierarquiaByIdRm.TryGetValue(item.IdHierarquiaDestinoRm.Value, out var hId))
                hierarquiaId = hId;

            // ─── Pessoa: cria/atualiza com TODO o cadastro pessoal LUC-122 ───
            Guid? pessoaId = null;
            if (!string.IsNullOrWhiteSpace(item.Cpf))
            {
                var cpf = item.Cpf.Trim();
                if (!pessoasByCpf.TryGetValue(cpf, out var pessoa))
                {
                    pessoa = new Pessoa
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Origem = OrigemPessoa.Funcionario,
                        Nome = item.Nome.Length > 160 ? item.Nome.Substring(0, 160) : item.Nome,
                        Email = string.IsNullOrWhiteSpace(item.Email) ? string.Empty : item.Email,
                        Cpf = cpf,
                        CreatedAtUtc = now,
                        UpdatedAtUtc = now,
                    };
                    _db.Pessoas.Add(pessoa);
                    pessoasByCpf[cpf] = pessoa;
                }
                // Atualizar campos LUC-122 (apenas se vieram do payload — não sobrescreve com NULL)
                pessoa.Nome = item.Nome.Length > 160 ? item.Nome.Substring(0, 160) : item.Nome;
                if (!string.IsNullOrWhiteSpace(item.Email)) pessoa.Email = item.Email;
                pessoa.Fone = item.Telefone ?? pessoa.Fone;
                pessoa.DataNascimento = item.DataNascimento.HasValue
                    ? DateTime.SpecifyKind(item.DataNascimento.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc)
                    : pessoa.DataNascimento;
                static string? Trunc(string? value, int max) =>
                    string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value.Substring(0, max));
                pessoa.Sexo = Trunc(item.Sexo, 1) ?? pessoa.Sexo;
                pessoa.EstadoCivil = Trunc(item.EstadoCivil, 2) ?? pessoa.EstadoCivil;
                pessoa.Naturalidade = Trunc(item.Naturalidade, 120) ?? pessoa.Naturalidade;
                pessoa.EstadoNatal = Trunc(item.EstadoNatal, 2) ?? pessoa.EstadoNatal;
                pessoa.GrauInstrucao = Trunc(item.GrauInstrucao, 5) ?? pessoa.GrauInstrucao;
                pessoa.Cep = Trunc(item.Cep, 20) ?? pessoa.Cep;
                pessoa.Logradouro = Trunc(item.Logradouro, 200) ?? pessoa.Logradouro;
                pessoa.Numero = Trunc(item.NumeroEndereco, 40) ?? pessoa.Numero;
                pessoa.Complemento = Trunc(item.Complemento, 120) ?? pessoa.Complemento;
                pessoa.Bairro = Trunc(item.Bairro, 120) ?? pessoa.Bairro;
                pessoa.Cidade = Trunc(item.Cidade, 120) ?? pessoa.Cidade;
                pessoa.Uf = Trunc(item.Uf, 2) ?? pessoa.Uf;
                pessoa.Rg = Trunc(item.Rg, 20) ?? pessoa.Rg;
                pessoa.RgOrgEmissor = Trunc(item.RgOrgEmissor, 20) ?? pessoa.RgOrgEmissor;
                pessoa.RgUf = Trunc(item.RgUf, 2) ?? pessoa.RgUf;
                pessoa.RgDataEmissao = AsUtc(item.RgDataEmissao) ?? pessoa.RgDataEmissao;
                pessoa.CarteiraTrabalho = Trunc(item.CarteiraTrabalho, 20) ?? pessoa.CarteiraTrabalho;
                pessoa.CarteiraTrabalhoSerie = Trunc(item.CarteiraTrabalhoSerie, 10) ?? pessoa.CarteiraTrabalhoSerie;
                pessoa.CarteiraTrabalhoUf = Trunc(item.CarteiraTrabalhoUf, 2) ?? pessoa.CarteiraTrabalhoUf;
                pessoa.CarteiraTrabalhoData = AsUtc(item.CarteiraTrabalhoData) ?? pessoa.CarteiraTrabalhoData;
                pessoa.NumeroPis = Trunc(item.NumeroPis, 20) ?? pessoa.NumeroPis;
                pessoa.TituloEleitor = Trunc(item.TituloEleitor, 20) ?? pessoa.TituloEleitor;
                pessoa.TituloEleitorZona = Trunc(item.TituloEleitorZona, 10) ?? pessoa.TituloEleitorZona;
                pessoa.TituloEleitorSecao = Trunc(item.TituloEleitorSecao, 10) ?? pessoa.TituloEleitorSecao;
                pessoa.CertificadoReservista = Trunc(item.CertificadoReservista, 20) ?? pessoa.CertificadoReservista;
                pessoa.CategoriaMilitar = Trunc(item.CategoriaMilitar, 2) ?? pessoa.CategoriaMilitar;
                pessoa.UpdatedAtUtc = now;
                pessoaId = pessoa.Id;
            }

            // LUC-122-A: popular Cdn* (que aparecem como Empresa/Estab/Matrícula na grid)
            // com dados TOTVS RM. Mesmo conceito conceitual (matrícula+empresa+estab) entre
            // TOTVS RM e Datasul — só muda a fonte. Em tenants Datasul os Cdn* continuam vindo
            // do importador Datasul; em Liotécnica vêm do PFUNC.
            var cdnEmpresa = item.CodColigada?.ToString().PadLeft(2, '0').Substring(0, Math.Min(3, item.CodColigada?.ToString().PadLeft(2, '0').Length ?? 0));
            var cdnEstab = item.CodFilial.HasValue
                ? item.CodFilial.Value.ToString().PadLeft(2, '0').Substring(0, Math.Min(5, item.CodFilial.Value.ToString().PadLeft(2, '0').Length))
                : null;
            var cdnFuncionario = chapa.Length > 12 ? chapa.Substring(0, 12) : chapa;

            if (funcByMatricula.TryGetValue(chapa, out var existing))
            {
                existing.Name = item.Nome.Length > 160 ? item.Nome.Substring(0, 160) : item.Nome;
                existing.Email = string.IsNullOrWhiteSpace(item.Email) ? null
                    : (item.Email.Length > 180 ? item.Email.Substring(0, 180) : item.Email);
                existing.Phone = string.IsNullOrWhiteSpace(item.Telefone) ? null
                    : (item.Telefone.Length > 40 ? item.Telefone.Substring(0, 40) : item.Telefone);
                existing.Status = MapStatus(item.CodSituacao);
                existing.CodSituacaoRm = item.CodSituacao?.Trim().ToUpperInvariant();
                existing.SituacaoRmDescricao = MapSituacaoDescricao(item.CodSituacao);
                existing.PessoaId = pessoaId ?? existing.PessoaId;
                existing.CentroCustoId = centroCustoId ?? existing.CentroCustoId;
                existing.JobPositionId = jobPositionId ?? existing.JobPositionId;
                existing.UnitId = unitId ?? existing.UnitId;
                existing.HierarquiaId = hierarquiaId ?? existing.HierarquiaId;
                existing.CdnEmpresa = cdnEmpresa ?? existing.CdnEmpresa;
                existing.CdnEstab = cdnEstab ?? existing.CdnEstab;
                existing.CdnFuncionario = cdnFuncionario;
                existing.UpdatedAtUtc = now;
                updated++;
            }
            else
            {
                _db.Funcionarios.Add(new Funcionario
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    MatriculaRm = chapa,
                    Name = item.Nome.Length > 160 ? item.Nome.Substring(0, 160) : item.Nome,
                    Email = string.IsNullOrWhiteSpace(item.Email) ? null
                        : (item.Email.Length > 180 ? item.Email.Substring(0, 180) : item.Email),
                    Phone = string.IsNullOrWhiteSpace(item.Telefone) ? null
                        : (item.Telefone.Length > 40 ? item.Telefone.Substring(0, 40) : item.Telefone),
                    Status = MapStatus(item.CodSituacao),
                    CodSituacaoRm = item.CodSituacao?.Trim().ToUpperInvariant(),
                    SituacaoRmDescricao = MapSituacaoDescricao(item.CodSituacao),
                    PessoaId = pessoaId,
                    CentroCustoId = centroCustoId,
                    JobPositionId = jobPositionId,
                    UnitId = unitId,
                    HierarquiaId = hierarquiaId,
                    CdnEmpresa = cdnEmpresa,
                    CdnEstab = cdnEstab,
                    CdnFuncionario = cdnFuncionario,
                    Headcount = 1,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                created++;
            }
        }

        // Salva em chunks pra não sobrecarregar a transação (637 rows é OK, mas defensivo)
        await _db.SaveChangesAsync(ct);

        return Ok(new FuncionarioSyncRmBulkResponse(created, updated, skipped, skippedInactive, total, warnings));
    }
}
