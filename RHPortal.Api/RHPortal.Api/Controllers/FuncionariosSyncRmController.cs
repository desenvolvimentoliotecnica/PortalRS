using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
///   - Hierarquia: <c>IdHierarquiaOrganogramaRm</c> (posição) com precedência sobre <c>IdHierarquiaDestinoRm</c> (promoção).
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
    private readonly IConfiguration _config;

    public FuncionariosSyncRmController(AppDbContext db, ITenantContext tenantContext, IConfiguration config)
    {
        _db = db;
        _tenantContext = tenantContext;
        _config = config;
    }

    /// <summary>Threshold de ciclos consecutivos sem aparecer no payload do RM antes de gerar alerta. Default 3.</summary>
    private int ZumbiThresholdCiclos => _config.GetValue<int?>("RmSync:ZumbiThresholdCiclos") ?? 3;

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
        var runStartUtc = DateTimeOffset.UtcNow;
        var organogramaRmSemNoPortal = 0;

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

        // Matrícula RM (CHAPA) → entidade para resolver GestorDiretoId a partir de ChapaGestorDireto (inclui criadas neste batch).
        var matriculaToFuncionario = new Dictionary<string, Funcionario>(StringComparer.OrdinalIgnoreCase);
        foreach (var f in funcByMatricula.Values)
        {
            if (!string.IsNullOrWhiteSpace(f.MatriculaRm))
                matriculaToFuncionario[f.MatriculaRm.Trim()] = f;
        }

        static int ResolveCodColigadaRm(string? cdnEmpresa, int fallbackColigadaEmpregado)
        {
            if (string.IsNullOrWhiteSpace(cdnEmpresa))
                return fallbackColigadaEmpregado;
            var t = cdnEmpresa.Trim();
            return int.TryParse(t, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) && v > 0 ? v : fallbackColigadaEmpregado;
        }

        /// <summary>Resolve gestor no batch atual por matrícula; opcionalmente filtra pela coligada do gestor (&quot;CDN&quot;) no Portal.</summary>
        static Funcionario? ResolveGestorNoBatch(
            IEnumerable<Funcionario> batchFuncionarios,
            string chapaGestor,
            int? codColigadaGestorRm,
            int fallbackColEmpregadoRm)
        {
            var lista = batchFuncionarios
                .Where(f => f.MatriculaRm != null
                            && string.Equals(f.MatriculaRm.Trim(), chapaGestor, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (lista.Count == 0)
                return null;
            if (codColigadaGestorRm is int cg && cg > 0)
            {
                var colMatch = lista.FirstOrDefault(f => ResolveCodColigadaRm(f.CdnEmpresa, fallbackColEmpregadoRm) == cg);
                if (colMatch is not null)
                    return colMatch;
            }
            return lista[0];
        }

        static void ApplyGestorDiretoRm(
            Funcionario emp,
            FuncionarioSyncRmItem it,
            IReadOnlyCollection<Funcionario> batchFuncionariosParaGestor)
        {
            var colEmpRm = it.CodColigada ?? 1;

            if (!it.AplicarGestorDiretoInformado)
            {
                if (string.IsNullOrWhiteSpace(it.ChapaGestorDireto))
                    return;
                var gh = it.ChapaGestorDireto.Trim();
                var gest = ResolveGestorNoBatch(batchFuncionariosParaGestor, gh, it.CodColigadaGestorDireto, colEmpRm);
                emp.GestorDiretoId = gest == null || gest.Id == emp.Id ? null : gest.Id;
                return;
            }

            // Hierarquia de posição (bulk): sem chefe ⇒ topo ⇒ limpa FK; com chefe ⇒ só atualiza se o gestor existe no Portal neste ciclo (evita zerar vínculos por falta de inclusão da chapa no batch).
            if (string.IsNullOrWhiteSpace(it.ChapaGestorDireto))
            {
                emp.GestorDiretoId = null;
                return;
            }

            var gDir = ResolveGestorNoBatch(batchFuncionariosParaGestor, it.ChapaGestorDireto.Trim(), it.CodColigadaGestorDireto, colEmpRm);
            if (gDir is null || gDir.Id == emp.Id)
                return;
            emp.GestorDiretoId = gDir.Id;
        }

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
                // Tenta sem padding ("1") primeiro — Units do Portal vêm com codes curtos.
                // Fallback pra padded ("01") por compatibilidade com filiais 2+ dígitos.
                var raw = item.CodFilial.Value.ToString();
                var padded = raw.PadLeft(2, '0');
                if (unitByCode.TryGetValue(raw, out var uId)) unitId = uId;
                else if (unitByCode.TryGetValue(padded, out uId)) unitId = uId;
            }

            Guid? hierarquiaId = null;
            if (item.IdHierarquiaOrganogramaRm.HasValue && item.IdHierarquiaOrganogramaRm.Value > 0)
            {
                if (hierarquiaByIdRm.TryGetValue(item.IdHierarquiaOrganogramaRm.Value, out var hOrg))
                    hierarquiaId = hOrg;
                else
                    organogramaRmSemNoPortal++;
            }

            if (hierarquiaId is null && item.IdHierarquiaDestinoRm.HasValue
                                     && hierarquiaByIdRm.TryGetValue(item.IdHierarquiaDestinoRm.Value, out var hId))
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
                pessoa.NomePai = Trunc(item.NomePai, 160) ?? pessoa.NomePai;
                pessoa.NomeMae = Trunc(item.NomeMae, 160) ?? pessoa.NomeMae;
                pessoa.Nacionalidade = Trunc(item.Nacionalidade, 60) ?? pessoa.Nacionalidade;
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
                existing.DataAdmissao = item.DataAdmissao ?? existing.DataAdmissao;
                existing.CodFuncaoRm = string.IsNullOrEmpty(item.CodFuncao?.Trim()) ? existing.CodFuncaoRm : item.CodFuncao!.Trim().Substring(0, Math.Min(20, item.CodFuncao.Trim().Length));
                existing.FuncaoNomeRm = string.IsNullOrEmpty(item.FuncaoNome?.Trim()) ? existing.FuncaoNomeRm : item.FuncaoNome!.Trim().Substring(0, Math.Min(160, item.FuncaoNome.Trim().Length));
                existing.UpdatedAtUtc = now;
                // Frente C: funcionário apareceu neste ciclo — zera contador.
                existing.CiclosAusenteRm = 0;
                existing.UltimoCicloRmObservadoUtc = runStartUtc;
                updated++;
            }
            else
            {
                var novo = new Funcionario
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    MatriculaRm = chapa,
                    UltimoCicloRmObservadoUtc = runStartUtc,
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
                    DataAdmissao = item.DataAdmissao,
                    CodFuncaoRm = string.IsNullOrEmpty(item.CodFuncao?.Trim()) ? null : item.CodFuncao!.Trim().Substring(0, Math.Min(20, item.CodFuncao.Trim().Length)),
                    FuncaoNomeRm = string.IsNullOrEmpty(item.FuncaoNome?.Trim()) ? null : item.FuncaoNome!.Trim().Substring(0, Math.Min(160, item.FuncaoNome.Trim().Length)),
                    Headcount = 1,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                };
                _db.Funcionarios.Add(novo);
                matriculaToFuncionario[chapa] = novo;
                created++;
            }
        }

        // Gestor direto — segunda passagem (hierarquia de posição e/ou CHAPALIDER). O vínculo é entre matrículas do batch atual.
        var batchParaGestor = matriculaToFuncionario.Values.ToList();
        foreach (var item in ativos)
        {
            var ch = item.Chapa.Trim();
            if (!matriculaToFuncionario.TryGetValue(ch, out var emp))
                continue;
            ApplyGestorDiretoRm(emp, item, batchParaGestor);
        }

        // Salva em chunks pra não sobrecarregar a transação (637 rows é OK, mas defensivo)
        await _db.SaveChangesAsync(ct);

        // Frente C — Detecção de zumbis (full sync only): funcionários no Portal com MatriculaRm
        // e Status=Active que NÃO foram observados neste ciclo são candidatos. Threshold default 3.
        if (request.Items.Count > 0)
            await DetectarZumbisFuncionariosAsync(tenantId, runStartUtc, ct);

        if (organogramaRmSemNoPortal > 0)
            warnings.Add(
                $"{organogramaRmSemNoPortal} item(ns) com IdHierarquiaOrganogramaRm sem nó correspondente em Hierarquias (usado IdHierarquiaDestinoRm quando existir).");

        return Ok(new FuncionarioSyncRmBulkResponse(created, updated, skipped, skippedInactive, total, warnings));
    }

    /// <summary>Análogo a <c>DetectarZumbisVagasAsync</c> mas para funcionários com <c>MatriculaRm</c>.</summary>
    private async Task DetectarZumbisFuncionariosAsync(string tenantId, DateTimeOffset runStartUtc, CancellationToken ct)
    {
        var threshold = ZumbiThresholdCiclos;

        var ausentes = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId
                && f.MatriculaRm != null
                && f.Status == FuncionarioStatus.Active
                && (f.UltimoCicloRmObservadoUtc == null || f.UltimoCicloRmObservadoUtc < runStartUtc))
            .Select(f => new { f.Id, f.MatriculaRm, f.CiclosAusenteRm })
            .ToListAsync(ct);

        if (ausentes.Count == 0)
        {
            await AutoResolverAlertasFuncionariosAsync(tenantId, ct);
            return;
        }

        var ausentesIds = ausentes.Select(a => a.Id).ToList();
        await _db.Funcionarios
            .Where(f => ausentesIds.Contains(f.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.CiclosAusenteRm, f => f.CiclosAusenteRm + 1), ct);

        var cruzaramThreshold = ausentes
            .Where(a => a.CiclosAusenteRm + 1 >= threshold && !string.IsNullOrEmpty(a.MatriculaRm))
            .ToList();

        if (cruzaramThreshold.Count > 0)
        {
            var chaves = cruzaramThreshold.Select(a => a.MatriculaRm!).ToList();
            var existentes = await _db.Set<RmSyncAlerta>()
                .Where(x => x.TenantId == tenantId && x.Tipo == "FuncionarioAusente" && chaves.Contains(x.ChaveRm))
                .ToListAsync(ct);

            var now = DateTimeOffset.UtcNow;
            foreach (var a in cruzaramThreshold)
            {
                var alerta = existentes.FirstOrDefault(x => x.ChaveRm == a.MatriculaRm);
                if (alerta is null)
                {
                    _db.Set<RmSyncAlerta>().Add(new RmSyncAlerta
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Tipo = "FuncionarioAusente",
                        EntidadeNome = "Funcionario",
                        EntidadeId = a.Id,
                        ChaveRm = a.MatriculaRm!,
                        DetectadoEmUtc = now,
                        CiclosAusente = a.CiclosAusenteRm + 1,
                    });
                }
                else if (alerta.ResolvidoEmUtc.HasValue)
                {
                    alerta.ResolvidoEmUtc = null;
                    alerta.Acao = null;
                    alerta.DetectadoEmUtc = now;
                    alerta.CiclosAusente = a.CiclosAusenteRm + 1;
                }
                else
                {
                    alerta.CiclosAusente = a.CiclosAusenteRm + 1;
                }
            }
            await _db.SaveChangesAsync(ct);
        }

        await AutoResolverAlertasFuncionariosAsync(tenantId, ct);
    }

    private async Task AutoResolverAlertasFuncionariosAsync(string tenantId, CancellationToken ct)
    {
        var presentes = await _db.Funcionarios
            .Where(f => f.TenantId == tenantId && f.MatriculaRm != null && f.CiclosAusenteRm == 0)
            .Select(f => f.MatriculaRm!)
            .ToListAsync(ct);

        if (presentes.Count == 0) return;

        var paraResolver = await _db.Set<RmSyncAlerta>()
            .Where(x => x.TenantId == tenantId
                && x.Tipo == "FuncionarioAusente"
                && x.ResolvidoEmUtc == null
                && presentes.Contains(x.ChaveRm))
            .ToListAsync(ct);

        if (paraResolver.Count == 0) return;

        var now = DateTimeOffset.UtcNow;
        foreach (var a in paraResolver)
        {
            a.ResolvidoEmUtc = now;
            a.Acao = "Auto-resolvido — chave reapareceu no RM";
        }
        await _db.SaveChangesAsync(ct);
    }
}
