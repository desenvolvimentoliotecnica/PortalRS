using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza vagas TOTVS RM para o Portal via <c>POST /api/vagas/sync-rm/bulk</c>.
///
/// Refactor 2026-04-27: fonte primária invertida — agora <c>VREQAUMENTOQUADRO</c> e
/// <c>VREQSUBSTITUICAO</c> são a verdade. <c>VRSVAGAS</c> é apenas enriquecimento
/// (descrição, requisitos, salário negociado pelo R&S). Resolve o problema das vagas
/// zumbi na <c>VRSVAGAS</c> (R&S esquecia de fechar após admissão), porque o
/// <c>CODSTATUS</c> da req-mãe é atualizado automaticamente pelo workflow do TOTVS.
///
/// Fluxo:
///   1. Iterar VREQAUMENTOQUADRO/VREQSUBSTITUICAO com CODSTATUS IN (3, 4, 6, 7).
///   2. Para cada req, mapear CODSTATUS → VagaStatus (3=Aberta, 4=Encerrada,
///      6=Cancelada, 7=Pausada).
///   3. Tentar enriquecer com VRSVAGAS via heurística CODFUNCAO + DataAbertura
///      mais recente entre as ATIVO=1.
///   4. VRSVAGAS abertas que não casaram com nenhuma VREQ entram como itens
///      "Direta" (sem IdReqRm), mantendo a chave por CODVAGA.
///
/// Chave de upsert no Portal:
///   - Itens RM: <c>IdReqRm</c> (= IDREQ da req-mãe)
///   - Itens Direta: <c>CodVaga</c> (= CODVAGA da VRSVAGAS)
/// </summary>
public sealed class PortalVagaSyncService
{
    // CODSTATUS no RM → mapeado para VagaStatus (curto numérico, ver
    // RHPortal.Api/Domain/Enums/VagaStatus.cs).
    private const short StatusNaoInformado = 0;
    private const short StatusAberta = 2;
    private const short StatusPausada = 3;
    private const short StatusEncerrada = 7;
    private const short StatusCancelada = 8;

    private readonly ILogger<PortalVagaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly RmSyncOptions _syncOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public PortalVagaSyncService(
        ILogger<PortalVagaSyncService> logger,
        PortalApiClient portalClient,
        IOptions<OutputOptions> outputOptions,
        IOptions<RmSyncOptions> syncOptions,
        IHostEnvironment env,
        ExtractionLogWriter logWriter)
    {
        _logger = logger;
        _portalClient = portalClient;
        _outputOptions = outputOptions.Value;
        _syncOptions = syncOptions.Value;
        _env = env;
        _logWriter = logWriter;
    }

    public async Task SyncVagasFromVagaJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Vagas: falha geral.");
            _logWriter.WriteLine($"Sync Vagas: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();

        var vagas = await LoadJsonAsync<VrsVagaRow>(path, "vaga.json", ct);
        var aumentos = await LoadJsonAsync<AumentoQuadroRow>(path, "aumento_quadro.json", ct);
        var substituicoes = await LoadJsonAsync<SubstituicaoRow>(path, "substituicao.json", ct);

        if (vagas.Count == 0 && aumentos.Count == 0 && substituicoes.Count == 0)
        {
            _logWriter.WriteLine("Sync Vagas: nenhum dump (vaga/aumento/substituicao) encontrado.");
            return;
        }

        var pfuncaoToCargo = await LoadPfuncaoCargoLookupAsync(path, ct);
        var pfuncaoToNome = await LoadPfuncaoNomeLookupAsync(path, ct);
        var pfuncaoDetailByCodigo = await LoadPfuncaoDetailLookupAsync(path, ct);
        var gestorNomeByChapa = await LoadGestorNomeByChapaAsync(path, ct);

        // Índice de VRSVAGAS abertas por CODFUNCAO — para enriquecimento das VREQ.
        // "Aberta" = ATIVO=1 E (DATAFECHAMENTO null ou futura). Mesma regra do sync legado.
        var hoje = DateTime.UtcNow.Date;
        var vrsAbertasByFuncao = vagas
            .Where(v => v.Ativo == 1
                && !string.IsNullOrWhiteSpace(v.CodFuncao)
                && v.CodVaga.HasValue
                && (!v.DataFechamento.HasValue || v.DataFechamento.Value.Date >= hoje))
            .GroupBy(v => v.CodFuncao!.Trim())
            .ToDictionary(
                g => g.Key,
                g => new Queue<VrsVagaRow>(g.OrderByDescending(x => x.DataAbertura ?? DateTime.MinValue)));

        var vrsUsadas = new HashSet<long>();

        var items = new List<object>();
        var origemCounters = new Dictionary<string, int>
        {
            ["AumentoQuadro"] = 0,
            ["SubstituicaoDesligamento"] = 0,
            ["SubstituicaoPromocao"] = 0,
            ["Direta"] = 0,
        };
        var statusCounters = new Dictionary<short, int>();

        VrsVagaRow? TryMatchVrs(string? codFuncao)
        {
            if (string.IsNullOrWhiteSpace(codFuncao)) return null;
            if (!vrsAbertasByFuncao.TryGetValue(codFuncao.Trim(), out var fila)) return null;
            while (fila.Count > 0)
            {
                var candidato = fila.Dequeue();
                if (candidato.CodVaga.HasValue && vrsUsadas.Add(candidato.CodVaga.Value))
                    return candidato;
            }
            return null;
        }

        // ========== VREQAUMENTOQUADRO ==========
        foreach (var aum in aumentos.Where(a => a.CodStatus is 3 or 4 or 6 or 7))
        {
            var idReq = aum.IdReq?.ToString();
            if (string.IsNullOrEmpty(idReq)) continue;

            var status = MapStatus(aum.CodStatus);
            var codFuncao = aum.CodFuncao?.Trim();
            // Sempre tenta match com VRSVAGAS pra "consumir" e evitar que ela vire item Direta
            // depois (o que causaria duplicata da mesma vaga). Os dados de enriquecimento
            // (descrição, salário) só fazem sentido pra vagas vivas, então só usa quando o
            // status no Portal é Aberta/Pausada — pra Encerrada/Cancelada o match é só pra
            // marcar como consumida.
            var vrsMatchRaw = TryMatchVrs(codFuncao);
            var vrsMatch = (status == StatusAberta || status == StatusPausada) ? vrsMatchRaw : null;

            var (codCargo, funcaoNome) = ResolveFuncao(codFuncao, pfuncaoToCargo, pfuncaoToNome);
            var titulo = ResolveTitulo(vrsMatch?.Nome, funcaoNome, idReq);
            var dataFechamento = ResolveDataFechamento(status, aum.DataConclusao, aum.DataCancelamento);
            pfuncaoDetailByCodigo.TryGetValue(codFuncao ?? "", out var pfDetailAum);
            var gestorAum = ResolveGestorNome(aum.ChapaRequisitante, gestorNomeByChapa);

            items.Add(MakeRmItem(
                idReqRm: idReq,
                codVaga: vrsMatch?.CodVaga?.ToString(),
                titulo: titulo,
                status: status,
                dataAbertura: aum.DataAbertura,
                dataFechamento: dataFechamento,
                quantidade: aum.NumVagas ?? 1,
                remuneracao: vrsMatch?.Remuneracao,
                descricao: vrsMatch?.Complemento,
                experienciasExigidas: vrsMatch?.ExperienciasExigidas,
                experienciasDesejadas: vrsMatch?.ExperienciasDesejadas,
                codFuncao: codFuncao,
                codCargo: codCargo,
                funcaoNome: funcaoNome,
                codSecao: aum.CodSecao,
                codFilial: aum.CodFilial,
                idHierarquiaDestinoRm: aum.IdHierarquiaDestino,
                origemTipo: "AumentoQuadro",
                idReqRmOrigem: idReq,
                idReqDesligamentoRm: null,
                aberta: null,
                dataPrevistaInicio: aum.Dataprevista,
                vlrSalario: aum.VlrSalario,
                justificativa: aum.Justificativa,
                codTabelaSalarial: aum.CodTabelaSalarial,
                codNivelSalarial: aum.CodNivelSalarial,
                codFaixaSalarial: aum.CodFaixaSalarial,
                codGrauInstrucao: vrsMatch?.CodGrauInstrucao,
                complementoGrauInstrucao: vrsMatch?.ComplementoGrauInstrucao,
                funcaoCbo: pfDetailAum.Cbo,
                funcaoDescricao: pfDetailAum.Descricao,
                gestorRequisitanteNome: gestorAum));
            origemCounters["AumentoQuadro"]++;
            statusCounters[status] = statusCounters.GetValueOrDefault(status) + 1;
        }

        // ========== VREQSUBSTITUICAO ==========
        foreach (var sub in substituicoes.Where(s => s.CodStatus is 3 or 4 or 6 or 7))
        {
            var idReq = sub.IdReq?.ToString();
            if (string.IsNullOrEmpty(idReq)) continue;

            var status = MapStatus(sub.CodStatus);
            var codFuncao = sub.CodFuncao?.Trim();
            // Mesmo padrão da seção AumentoQuadro: sempre consome VRSVAGAS pra evitar
            // que ela vire item Direta depois (duplicata).
            var vrsMatchRawSub = TryMatchVrs(codFuncao);
            var vrsMatch = (status == StatusAberta || status == StatusPausada) ? vrsMatchRawSub : null;

            var (codCargo, funcaoNome) = ResolveFuncao(codFuncao, pfuncaoToCargo, pfuncaoToNome);
            var titulo = ResolveTitulo(vrsMatch?.Nome, funcaoNome, idReq);
            var dataFechamento = ResolveDataFechamento(status, sub.DataConclusao, sub.DataCancelamento);
            pfuncaoDetailByCodigo.TryGetValue(codFuncao ?? "", out var pfDetailSub);
            var gestorSub = ResolveGestorNome(sub.ChapaRequisitante, gestorNomeByChapa);

            // TIPOREQPAI observado nos dumps:
            //   1 = Desligamento (esperado pela doc original)
            //   2 = também aparece com IDREQPAI apontando para VREQDESLIGAMENTO
            //       (caso Natera — IDREQPAI=250 → VREQDESLIGAMENTO)
            //   30/40 = códigos legados/alternativos
            // Estratégia: tratar como Desligamento por padrão (caso mais comum). Promoção
            // só quando explicitamente sinalizada e validada via lookup contra VREQTRANSFPROMOCAO.
            var origemTipo = sub.TipoReqPai switch
            {
                3 or 30 => "SubstituicaoPromocao",
                _ => "SubstituicaoDesligamento",
            };

            items.Add(MakeRmItem(
                idReqRm: idReq,
                codVaga: vrsMatch?.CodVaga?.ToString(),
                titulo: titulo,
                status: status,
                dataAbertura: sub.DataAbertura,
                dataFechamento: dataFechamento,
                quantidade: 1,
                remuneracao: vrsMatch?.Remuneracao,
                descricao: vrsMatch?.Complemento,
                experienciasExigidas: vrsMatch?.ExperienciasExigidas,
                experienciasDesejadas: vrsMatch?.ExperienciasDesejadas,
                codFuncao: codFuncao,
                codCargo: codCargo,
                funcaoNome: funcaoNome,
                codSecao: sub.CodSecao,
                codFilial: sub.CodFilial,
                idHierarquiaDestinoRm: sub.IdHierarquiaDestino,
                origemTipo: origemTipo,
                idReqRmOrigem: idReq,
                idReqDesligamentoRm: origemTipo == "SubstituicaoDesligamento" ? sub.IdReqPai?.ToString() : null,
                aberta: null,
                dataPrevistaInicio: sub.Dataprevista,
                vlrSalario: sub.VlrSalario,
                justificativa: sub.Justificativa,
                codTabelaSalarial: sub.CodTabelaSalarial,
                codNivelSalarial: sub.CodNivelSalarial,
                codFaixaSalarial: sub.CodFaixaSalarial,
                codGrauInstrucao: vrsMatch?.CodGrauInstrucao,
                complementoGrauInstrucao: vrsMatch?.ComplementoGrauInstrucao,
                funcaoCbo: pfDetailSub.Cbo,
                funcaoDescricao: pfDetailSub.Descricao,
                gestorRequisitanteNome: gestorSub));
            origemCounters[origemTipo]++;
            statusCounters[status] = statusCounters.GetValueOrDefault(status) + 1;
        }

        // ========== Direta (VRSVAGAS abertas sem match com VREQ viva) ==========
        foreach (var v in vagas.Where(x => x.Ativo == 1
            && x.CodVaga.HasValue
            && (!x.DataFechamento.HasValue || x.DataFechamento.Value.Date >= hoje)))
        {
            if (vrsUsadas.Contains(v.CodVaga!.Value)) continue;

            var codFuncao = v.CodFuncao?.Trim();
            var (codCargo, funcaoNome) = ResolveFuncao(codFuncao, pfuncaoToCargo, pfuncaoToNome);
            var titulo = ResolveTitulo(v.Nome, funcaoNome, v.CodVaga!.Value.ToString());
            pfuncaoDetailByCodigo.TryGetValue(codFuncao ?? "", out var pfDetailDir);

            items.Add(MakeRmItem(
                idReqRm: null,
                codVaga: v.CodVaga.Value.ToString(),
                titulo: titulo,
                status: StatusAberta,
                dataAbertura: v.DataAbertura,
                dataFechamento: v.DataFechamento,
                quantidade: 1,
                remuneracao: v.Remuneracao,
                descricao: v.Complemento,
                experienciasExigidas: v.ExperienciasExigidas,
                experienciasDesejadas: v.ExperienciasDesejadas,
                codFuncao: codFuncao,
                codCargo: codCargo,
                funcaoNome: funcaoNome,
                codSecao: null,
                codFilial: null,
                idHierarquiaDestinoRm: null,
                origemTipo: "Direta",
                idReqRmOrigem: null,
                idReqDesligamentoRm: null,
                aberta: true,
                dataPrevistaInicio: null,
                vlrSalario: null,
                justificativa: null,
                codTabelaSalarial: null,
                codNivelSalarial: null,
                codFaixaSalarial: null,
                codGrauInstrucao: v.CodGrauInstrucao,
                complementoGrauInstrucao: v.ComplementoGrauInstrucao,
                funcaoCbo: pfDetailDir.Cbo,
                funcaoDescricao: pfDetailDir.Descricao,
                gestorRequisitanteNome: null));
            origemCounters["Direta"]++;
            statusCounters[StatusAberta] = statusCounters.GetValueOrDefault(StatusAberta) + 1;
        }

        var body = new { items };
        var statusBreakdown = string.Join(", ", statusCounters
            .OrderBy(kv => kv.Key)
            .Select(kv => $"{StatusName(kv.Key)}={kv.Value}"));
        _logWriter.WriteLine(
            $"Sync Vagas: enviando {items.Count} itens. " +
            $"Origens: AumentoQuadro={origemCounters["AumentoQuadro"]}, " +
            $"SubstituicaoDesligamento={origemCounters["SubstituicaoDesligamento"]}, " +
            $"SubstituicaoPromocao={origemCounters["SubstituicaoPromocao"]}, " +
            $"Direta={origemCounters["Direta"]}. Status: {statusBreakdown}");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/vagas/sync-rm/bulk", body, JsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Vagas: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/vagas/sync-rm/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Vagas: OK — criadas={result?.Created ?? 0}, atualizadas={result?.Updated ?? 0}, total={result?.Total ?? 0}");
    }

    private static short MapStatus(int? codStatus) => codStatus switch
    {
        3 => StatusAberta,     // Aprovada no RM → Aberta no Portal (R&S trabalhando)
        4 => StatusEncerrada,  // Concluída no RM (preenchida) → Encerrada no Portal
        6 => StatusCancelada,  // Cancelada no RM → Cancelada no Portal
        7 => StatusPausada,    // Suspensa no RM → Pausada no Portal
        _ => StatusNaoInformado,
    };

    private static string StatusName(short status) => status switch
    {
        StatusAberta => "Aberta",
        StatusPausada => "Pausada",
        StatusEncerrada => "Encerrada",
        StatusCancelada => "Cancelada",
        _ => $"Status({status})",
    };

    private static (string? codCargo, string? funcaoNome) ResolveFuncao(
        string? codFuncao,
        Dictionary<string, string> pfuncaoToCargo,
        Dictionary<string, string> pfuncaoToNome)
    {
        if (string.IsNullOrWhiteSpace(codFuncao)) return (null, null);
        string? codCargo = null;
        string? funcaoNome = null;
        if (pfuncaoToCargo.TryGetValue(codFuncao, out var cc))
            codCargo = PortalCargoSyncService.ToPortalJobCode(cc);
        if (pfuncaoToNome.TryGetValue(codFuncao, out var fn))
            funcaoNome = fn;
        return (codCargo, funcaoNome);
    }

    private static string ResolveTitulo(string? nomeVrs, string? funcaoNome, string fallback)
    {
        var t = nomeVrs?.Trim();
        if (!string.IsNullOrWhiteSpace(t)) return t;
        t = funcaoNome?.Trim();
        if (!string.IsNullOrWhiteSpace(t)) return t;
        return $"Vaga {fallback}";
    }

    private static DateTime? ResolveDataFechamento(short status, DateTime? dataConclusao, DateTime? dataCancelamento) => status switch
    {
        StatusEncerrada => dataConclusao,
        StatusCancelada => dataCancelamento,
        _ => null,
    };

    private static string? ResolveGestorNome(string? chapa, Dictionary<string, string> nomePorChapa)
    {
        if (string.IsNullOrWhiteSpace(chapa)) return null;
        return nomePorChapa.TryGetValue(chapa.Trim(), out var n) ? n : null;
    }

    private static object MakeRmItem(
        string? idReqRm,
        string? codVaga,
        string titulo,
        short status,
        DateTime? dataAbertura,
        DateTime? dataFechamento,
        int? quantidade,
        string? remuneracao,
        string? descricao,
        string? experienciasExigidas,
        string? experienciasDesejadas,
        string? codFuncao,
        string? codCargo,
        string? funcaoNome,
        string? codSecao,
        int? codFilial,
        int? idHierarquiaDestinoRm,
        string origemTipo,
        string? idReqRmOrigem,
        string? idReqDesligamentoRm,
        bool? aberta,
        DateTime? dataPrevistaInicio,
        decimal? vlrSalario,
        string? justificativa,
        string? codTabelaSalarial,
        string? codNivelSalarial,
        string? codFaixaSalarial,
        int? codGrauInstrucao,
        string? complementoGrauInstrucao,
        string? funcaoCbo,
        string? funcaoDescricao,
        string? gestorRequisitanteNome) =>
        new
        {
            idReqRm,
            codVaga,
            titulo,
            status,
            dataAbertura,
            dataFechamento,
            quantidade,
            remuneracao,
            descricao,
            experienciasExigidas,
            experienciasDesejadas,
            codFuncao,
            codCargo,
            funcaoNome,
            codSecao,
            codFilial,
            idHierarquiaDestinoRm,
            origemTipo,
            idReqRmOrigem,
            idReqDesligamentoRm,
            aberta,
            dataPrevistaInicio,
            vlrSalario,
            justificativa,
            codTabelaSalarial,
            codNivelSalarial,
            codFaixaSalarial,
            codGrauInstrucao,
            complementoGrauInstrucao,
            funcaoCbo,
            funcaoDescricao,
            gestorRequisitanteNome,
        };

    private async Task<List<T>> LoadJsonAsync<T>(string path, string fileName, CancellationToken ct)
    {
        var f = Path.Combine(path, fileName);
        if (!File.Exists(f)) return new();
        return JsonSerializer.Deserialize<List<T>>(await File.ReadAllTextAsync(f, ct), JsonOptions) ?? new();
    }

    private async Task<Dictionary<string, string>> LoadPfuncaoCargoLookupAsync(string path, CancellationToken ct)
    {
        var rows = await LoadJsonAsync<PfuncaoRow>(path, "funcao.json", ct);
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo) && !string.IsNullOrWhiteSpace(r.Cargo))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Cargo!.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, string>> LoadPfuncaoNomeLookupAsync(string path, CancellationToken ct)
    {
        var rows = await LoadJsonAsync<PfuncaoRow>(path, "funcao.json", ct);
        // PFUNCAO duplica por CODCOLIGADA (1 e 2). Coligada 2 costuma ter o nome completo
        // ("ANALISTA DE PRICING SR"), coligada 1 tem versão curta ("ANL PRICING SR").
        // Pega sempre o mais longo pra exibição mais clara.
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo) && !string.IsNullOrWhiteSpace(r.Nome))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Nome!.Length).First().Nome!.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>CBO + descrição longa da função (para descrição pública / CBO na vaga).</summary>
    private async Task<Dictionary<string, (string? Cbo, string? Descricao)>> LoadPfuncaoDetailLookupAsync(string path, CancellationToken ct)
    {
        var rows = await LoadJsonAsync<PfuncaoDetailRow>(path, "funcao.json", ct);
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var best = g.OrderByDescending(x => x.Descricao?.Length ?? 0).First();
                    var cbo = string.IsNullOrWhiteSpace(best.Cbo) ? null : best.Cbo!.Trim();
                    var desc = string.IsNullOrWhiteSpace(best.Descricao) ? null : best.Descricao!.Trim();
                    return (cbo, desc);
                },
                StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>CHAPA (PFUNC) → nome (PPESSOA.NOME).</summary>
    private async Task<Dictionary<string, string>> LoadGestorNomeByChapaAsync(string path, CancellationToken ct)
    {
        var pessoaPath = Path.Combine(path, "pessoa.json");
        var funcPath = Path.Combine(path, "funcionario.json");
        if (!File.Exists(pessoaPath) || !File.Exists(funcPath))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var pessoas = await LoadJsonAsync<PessoaNomeRow>(path, "pessoa.json", ct);
        var codigoToNome = pessoas
            .Where(p => p.Codigo.HasValue && !string.IsNullOrWhiteSpace(p.Nome))
            .GroupBy(p => p.Codigo!.Value)
            .ToDictionary(g => g.Key, g => g.First().Nome!.Trim());

        var nomes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var f in await LoadJsonAsync<PfuncChapaRow>(path, "funcionario.json", ct))
        {
            if (string.IsNullOrWhiteSpace(f.Chapa) || !f.CodPessoa.HasValue) continue;
            if (!codigoToNome.TryGetValue(f.CodPessoa.Value, out var nome)) continue;
            nomes[f.Chapa.Trim()] = nome;
        }

        return nomes;
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed class VrsVagaRow
    {
        [JsonPropertyName("CODVAGA")] public long? CodVaga { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
        [JsonPropertyName("CODFUNCAO")] public string? CodFuncao { get; set; }
        [JsonPropertyName("ATIVO")] public int? Ativo { get; set; }
        [JsonPropertyName("DATAABERTURA")] public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATAFECHAMENTO")] public DateTime? DataFechamento { get; set; }
        [JsonPropertyName("REMUNERACAO")] public string? Remuneracao { get; set; }
        [JsonPropertyName("COMPLEMENTO")] public string? Complemento { get; set; }
        [JsonPropertyName("EXPERIENCIASEXIGIDAS")] public string? ExperienciasExigidas { get; set; }
        [JsonPropertyName("EXPERIENCIASDESEJADAS")] public string? ExperienciasDesejadas { get; set; }
        [JsonPropertyName("CODGRAUINSTRUCAO")] public int? CodGrauInstrucao { get; set; }
        [JsonPropertyName("COMPLEMENTOGRAUINSTRUCAO")] public string? ComplementoGrauInstrucao { get; set; }
    }

    private sealed class AumentoQuadroRow
    {
        [JsonPropertyName("IDREQ")] public long? IdReq { get; set; }
        [JsonPropertyName("CODSECAO")] public string? CodSecao { get; set; }
        [JsonPropertyName("CODFUNCAO")] public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFILIAL")] public int? CodFilial { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")] public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("CODSTATUS")] public int? CodStatus { get; set; }
        [JsonPropertyName("DATAABERTURA")] public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATACONCLUSAO")] public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("DATACANCELAMENTO")] public DateTime? DataCancelamento { get; set; }
        [JsonPropertyName("DATAPREVISTA")] public DateTime? Dataprevista { get; set; }
        [JsonPropertyName("NUMVAGAS")] public int? NumVagas { get; set; }
        [JsonPropertyName("JUSTIFICATIVA")] public string? Justificativa { get; set; }
        [JsonPropertyName("VLRSALARIO")] public decimal? VlrSalario { get; set; }
        [JsonPropertyName("CODTABELASALARIAL")] public string? CodTabelaSalarial { get; set; }
        [JsonPropertyName("CODNIVELSALARIAL")] public string? CodNivelSalarial { get; set; }
        [JsonPropertyName("CODFAIXASALARIAL")] public string? CodFaixaSalarial { get; set; }
        [JsonPropertyName("CHAPAREQUISITANTE")] public string? ChapaRequisitante { get; set; }
    }

    private sealed class SubstituicaoRow
    {
        [JsonPropertyName("IDREQ")] public long? IdReq { get; set; }
        [JsonPropertyName("IDREQPAI")] public long? IdReqPai { get; set; }
        [JsonPropertyName("TIPOREQPAI")] public int? TipoReqPai { get; set; }
        [JsonPropertyName("CODSECAO")] public string? CodSecao { get; set; }
        [JsonPropertyName("CODFUNCAO")] public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFILIAL")] public int? CodFilial { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")] public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("CODSTATUS")] public int? CodStatus { get; set; }
        [JsonPropertyName("DATAABERTURA")] public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATACONCLUSAO")] public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("DATACANCELAMENTO")] public DateTime? DataCancelamento { get; set; }
        [JsonPropertyName("DATAPREVISTA")] public DateTime? Dataprevista { get; set; }
        [JsonPropertyName("JUSTIFICATIVA")] public string? Justificativa { get; set; }
        [JsonPropertyName("VLRSALARIO")] public decimal? VlrSalario { get; set; }
        [JsonPropertyName("CODTABELASALARIAL")] public string? CodTabelaSalarial { get; set; }
        [JsonPropertyName("CODNIVELSALARIAL")] public string? CodNivelSalarial { get; set; }
        [JsonPropertyName("CODFAIXASALARIAL")] public string? CodFaixaSalarial { get; set; }
        [JsonPropertyName("CHAPAREQUISITANTE")] public string? ChapaRequisitante { get; set; }
    }

    private sealed class PfuncaoRow
    {
        [JsonPropertyName("CODIGO")] public string? Codigo { get; set; }
        [JsonPropertyName("CARGO")] public string? Cargo { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
    }

    private sealed class PfuncaoDetailRow
    {
        [JsonPropertyName("CODIGO")] public string? Codigo { get; set; }
        [JsonPropertyName("CARGO")] public string? Cargo { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
        [JsonPropertyName("CBO")] public string? Cbo { get; set; }
        [JsonPropertyName("DESCRICAO")] public string? Descricao { get; set; }
    }

    private sealed class PfuncChapaRow
    {
        [JsonPropertyName("CHAPA")] public string? Chapa { get; set; }
        [JsonPropertyName("CODPESSOA")] public int? CodPessoa { get; set; }
    }

    private sealed class PessoaNomeRow
    {
        [JsonPropertyName("CODIGO")] public int? Codigo { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Total);
}
