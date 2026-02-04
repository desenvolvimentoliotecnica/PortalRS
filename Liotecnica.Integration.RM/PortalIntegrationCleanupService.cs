using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Limpa os dados integrados no Portal (Funcionários, Pessoas, Cargos, Funções, Unidades, Áreas)
/// na ordem correta de dependências para permitir nova integração.
/// </summary>
public sealed class PortalIntegrationCleanupService
{
    private readonly ILogger<PortalIntegrationCleanupService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalIntegrationCleanupService(
        ILogger<PortalIntegrationCleanupService> logger,
        PortalApiClient portalClient,
        ExtractionLogWriter logWriter)
    {
        _logger = logger;
        _portalClient = portalClient;
        _logWriter = logWriter;
    }

    /// <summary>
    /// Remove todos os candidatos e talentos do tenant via endpoint de bulk delete da API.
    /// Garante eliminação direta na base de dados (candidatos por vaga e talentos).
    /// </summary>
    public async Task DeleteAllCandidatosAndTalentosViaApiAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Chamando API para remover todos os candidatos e talentos do tenant.");
        _logWriter.WriteLine("========== Remoção em massa (API) ==========");
        var response = await _portalClient.Http.DeleteAsync("api/ops/clean-candidatos-talentos", ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("DELETE api/ops/clean-candidatos-talentos retornou {Status}. Body: {Body}", response.StatusCode, body);
            _logWriter.WriteLine($"DELETE api/ops/clean-candidatos-talentos: {response.StatusCode} {body}");
            response.EnsureSuccessStatusCode();
        }
        var result = await response.Content.ReadFromJsonAsync<CleanCandidatosTalentosResponse>(JsonOptions, ct);
        if (result != null)
        {
            _logger.LogInformation("Candidatos removidos: {C}, Talentos removidos: {T}.", result.CandidatosRemovidos, result.TalentosRemovidos);
            _logWriter.WriteLine($"Candidatos removidos: {result.CandidatosRemovidos}, Talentos removidos: {result.TalentosRemovidos}.");
        }
        _logWriter.WriteLine("========== Remoção em massa concluída ==========");
    }

    /// <summary>
    /// Remove todos os candidatos do Portal (qualquer fonte). Use antes de reintegrar do zero.
    /// Faz um segundo passe se ainda restarem candidatos (404 = já removido).
    /// </summary>
    public async Task DeleteAllCandidatosAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Removendo todos os candidatos do Portal.");
        _logWriter.WriteLine("========== Remoção de todos os candidatos ==========");
        var ids = await ListAllCandidatoIdsAsync(ct);
        var failed = await DeleteCandidatoIdsAsync(ids, ct);
        if (failed > 0)
        {
            var remaining = await ListAllCandidatoIdsAsync(ct);
            if (remaining.Count > 0)
            {
                _logger.LogInformation("Segundo passe: {Count} candidatos restantes.", remaining.Count);
                _logWriter.WriteLine($"Segundo passe: {remaining.Count} candidatos restantes.");
                await DeleteCandidatoIdsAsync(remaining, ct);
            }
        }
        _logWriter.WriteLine("========== Remoção de candidatos concluída ==========");
    }

    /// <summary>
    /// Remove todos os talentos do Portal. Deve ser chamado após eliminar candidatos (candidatos referenciam talentos).
    /// </summary>
    public async Task DeleteAllTalentosAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Removendo todos os talentos do Portal.");
        _logWriter.WriteLine("========== Remoção de todos os talentos ==========");
        var ids = await ListAllTalentoIdsAsync(ct);
        await DeleteByIdsAsync("api/talentos", ids, "Talentos", ct);
        _logWriter.WriteLine("========== Remoção de talentos concluída ==========");
    }

    /// <summary>
    /// Remove todos os candidatos com Fonte = Indicacao (sincronizados pelo RM). Permite reintegrar do zero.
    /// </summary>
    public async Task DeleteCandidatosIndicacaoAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Removendo candidatos sincronizados do RM (Fonte = Indicacao).");
        _logWriter.WriteLine("========== Remoção de candidatos (Indicacao) ==========");
        var ids = await ListAllCandidatoIdsByFonteAsync(3, ct); // 3 = CandidateOrigin.Indicacao
        await DeleteByIdsAsync("api/candidatos", ids, "Candidatos", ct);
        _logWriter.WriteLine("========== Remoção de candidatos concluída ==========");
    }

    /// <summary>
    /// Lista todos os IDs da entidade via API (paginado ou lista única) e em seguida
    /// chama DELETE para cada ID. Ordem: Funcionários → Pessoas → Cargos → Funções → Unidades → Áreas.
    /// </summary>
    public async Task RunCleanupAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Iniciando limpeza dos dados de integração no Portal.");
        _logWriter.WriteLine("========== Limpeza de dados de integração ==========");

        await DeleteAllFuncionariosAsync(ct);
        await DeleteAllPessoasAsync(ct);
        await DeleteAllJobPositionsAsync(ct);
        await DeleteAllRequisitoCategoriasAsync(ct);
        await DeleteAllUnitsAsync(ct);
        await DeleteAllAreasAsync(ct);

        _logger.LogInformation("Limpeza concluída.");
        _logWriter.WriteLine("========== Limpeza concluída ==========");
    }

    private async Task DeleteAllFuncionariosAsync(CancellationToken ct)
    {
        var ids = await ListAllIdsPagedAsync("api/funcionarios", "Funcionários", ct);
        await DeleteByIdsAsync("api/funcionarios", ids, "Funcionários", ct);
    }

    private async Task DeleteAllPessoasAsync(CancellationToken ct)
    {
        var ids = await ListAllIdsPagedAsync("api/pessoas", "Pessoas", ct);
        await DeleteByIdsAsync("api/pessoas", ids, "Pessoas", ct);
    }

    private async Task DeleteAllJobPositionsAsync(CancellationToken ct)
    {
        var ids = await ListAllIdsPagedAsync("api/job-positions", "Cargos", ct);
        await DeleteByIdsAsync("api/job-positions", ids, "Cargos", ct);
    }

    private async Task DeleteAllRequisitoCategoriasAsync(CancellationToken ct)
    {
        var ids = await ListAllIdsFromListAsync("api/requisito-categorias", "Funções", ct);
        await DeleteByIdsAsync("api/requisito-categorias", ids, "Funções", ct);
    }

    private async Task DeleteAllUnitsAsync(CancellationToken ct)
    {
        var ids = await ListAllIdsPagedAsync("api/units", "Unidades", ct);
        await DeleteByIdsAsync("api/units", ids, "Unidades", ct);
    }

    private async Task DeleteAllAreasAsync(CancellationToken ct)
    {
        // Áreas têm hierarquia (ParentId): a API retorna 409 se a área tiver filhos. Deletar filhos antes dos pais.
        var areas = await ListAllAreasWithParentAsync(ct);
        var ids = OrderAreaIdsChildrenBeforeParents(areas);
        _logWriter.WriteLine($"Listadas {ids.Count} Áreas para remoção (ordem: filhos → pais).");
        await DeleteByIdsAsync("api/areas", ids, "Áreas", ct);
    }

    private async Task<List<AreaItemWithParent>> ListAllAreasWithParentAsync(CancellationToken ct)
    {
        var list = await _portalClient.Http.GetFromJsonAsync<List<AreaItemWithParent>>("api/areas", JsonOptions, ct);
        return list ?? new List<AreaItemWithParent>();
    }

    /// <summary>Ordena IDs de áreas para que filhos sejam deletados antes dos pais (evita 409 AreaHasChildren).</summary>
    private static List<Guid> OrderAreaIdsChildrenBeforeParents(List<AreaItemWithParent> areas)
    {
        if (areas.Count == 0) return new List<Guid>();
        var idToParent = areas.Where(a => a.ParentId.HasValue).ToDictionary(a => a.Id, a => a.ParentId!.Value);
        var order = new List<Guid>();
        var remaining = new HashSet<Guid>(areas.Select(a => a.Id));
        while (remaining.Count > 0)
        {
            var leaves = remaining.Where(id => !remaining.Any(other => other != id && idToParent.TryGetValue(other, out var p) && p == id)).ToList();
            foreach (var id in leaves)
            {
                order.Add(id);
                remaining.Remove(id);
            }
            if (leaves.Count == 0)
                break;
        }
        return order;
    }

    private async Task<List<Guid>> ListAllIdsPagedAsync(string baseUrl, string entityName, CancellationToken ct)
    {
        var ids = new List<Guid>();
        var page = 1;
        const int pageSize = 500;
        while (true)
        {
            var url = $"{baseUrl}?page={page}&pageSize={pageSize}";
            var response = await _portalClient.Http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("GET {Url} retornou {Status}. Body: {Body}", url, response.StatusCode, body);
                _logWriter.WriteLine($"GET {url} retornou {response.StatusCode}: {body}");
                response.EnsureSuccessStatusCode();
            }
            var paged = await response.Content.ReadFromJsonAsync<PagedIdResponse>(JsonOptions, ct);
            if (paged?.Items == null || paged.Items.Count == 0)
                break;
            ids.AddRange(paged.Items.Select(x => x.Id));
            // API pode retornar TotalPages (PagedResult) ou TotalCount (PessoaPagedResponse).
            // Pessoas limita pageSize a 100 na API; usar PageSize da resposta para não parar cedo.
            var actualPageSize = paged.PageSize >= 1 ? paged.PageSize : pageSize;
            if (paged.TotalPages.HasValue && paged.TotalPages.Value > 0)
            {
                if (page >= paged.TotalPages.Value) break;
            }
            else if (paged.TotalCount.HasValue && page * actualPageSize >= paged.TotalCount.Value)
                break;
            else if (paged.Items.Count < actualPageSize)
                break;
            page++;
        }
        _logWriter.WriteLine($"Listados {ids.Count} {entityName} para remoção.");
        return ids;
    }

    /// <summary>Lista todos os IDs de candidatos (qualquer fonte), paginado.</summary>
    private async Task<List<Guid>> ListAllCandidatoIdsAsync(CancellationToken ct)
    {
        var ids = new List<Guid>();
        var page = 1;
        const int pageSize = 200;
        while (true)
        {
            var url = $"api/candidatos?page={page}&pageSize={pageSize}";
            var response = await _portalClient.Http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("GET {Url} retornou {Status}. Body: {Body}", url, response.StatusCode, body);
                _logWriter.WriteLine($"GET {url} retornou {response.StatusCode}: {body}");
                break;
            }
            var paged = await response.Content.ReadFromJsonAsync<CandidatePagedResponse>(JsonOptions, ct);
            if (paged?.Items == null || paged.Items.Count == 0)
                break;
            ids.AddRange(paged.Items.Select(x => x.Id));
            // Parar só quando tivermos todos (TotalCount); a API pode devolver menos que pageSize por página
            if (paged.TotalCount > 0 && ids.Count >= paged.TotalCount)
                break;
            page++;
        }
        _logWriter.WriteLine($"Listados {ids.Count} Candidatos para remoção.");
        return ids;
    }

    /// <summary>Lista todos os IDs de talentos, paginado.</summary>
    private async Task<List<Guid>> ListAllTalentoIdsAsync(CancellationToken ct)
    {
        var ids = new List<Guid>();
        var page = 1;
        const int pageSize = 200;
        while (true)
        {
            var url = $"api/talentos?page={page}&pageSize={pageSize}";
            var response = await _portalClient.Http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("GET {Url} retornou {Status}. Body: {Body}", url, response.StatusCode, body);
                _logWriter.WriteLine($"GET {url} retornou {response.StatusCode}: {body}");
                break;
            }
            var paged = await response.Content.ReadFromJsonAsync<TalentoPagedResponse>(JsonOptions, ct);
            if (paged?.Items == null || paged.Items.Count == 0)
                break;
            ids.AddRange(paged.Items.Select(x => x.Id));
            if (paged.TotalCount > 0 && ids.Count >= paged.TotalCount)
                break;
            page++;
        }
        _logWriter.WriteLine($"Listados {ids.Count} Talentos para remoção.");
        return ids;
    }

    private async Task<List<Guid>> ListAllCandidatoIdsByFonteAsync(int fonte, CancellationToken ct)
    {
        var ids = new List<Guid>();
        var page = 1;
        const int pageSize = 200;
        while (true)
        {
            var url = $"api/candidatos?fonte={fonte}&page={page}&pageSize={pageSize}";
            var response = await _portalClient.Http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("GET {Url} retornou {Status}. Body: {Body}", url, response.StatusCode, body);
                _logWriter.WriteLine($"GET {url} retornou {response.StatusCode}: {body}");
                break;
            }
            var paged = await response.Content.ReadFromJsonAsync<CandidatePagedResponse>(JsonOptions, ct);
            if (paged?.Items == null || paged.Items.Count == 0)
                break;
            ids.AddRange(paged.Items.Select(x => x.Id));
            if (paged.Items.Count < pageSize || (paged.TotalCount > 0 && page * pageSize >= paged.TotalCount))
                break;
            page++;
        }
        _logWriter.WriteLine($"Listados {ids.Count} Candidatos (Fonte=Indicacao) para remoção.");
        return ids;
    }

    private async Task<List<Guid>> ListAllIdsFromListAsync(string url, string entityName, CancellationToken ct)
    {
        var list = await _portalClient.Http.GetFromJsonAsync<List<IdItem>>(url, JsonOptions, ct);
        var ids = list?.Select(x => x.Id).ToList() ?? new List<Guid>();
        _logWriter.WriteLine($"Listados {ids.Count} {entityName} para remoção.");
        return ids;
    }

    private async Task DeleteByIdsAsync(string baseUrl, List<Guid> ids, string entityName, CancellationToken ct)
    {
        var deleted = 0;
        var failed = 0;
        foreach (var id in ids)
        {
            var response = await _portalClient.Http.DeleteAsync($"{baseUrl}/{id}", ct);
            if (response.IsSuccessStatusCode)
                deleted++;
            else
            {
                failed++;
                _logger.LogWarning("DELETE {Url}/{Id} falhou: {Status}", baseUrl, id, response.StatusCode);
                _logWriter.WriteLine($"  DELETE {entityName} {id}: {response.StatusCode}");
            }
        }
        _logger.LogInformation("{EntityName}: {Deleted} removidos, {Failed} falhas.", entityName, deleted, failed);
        _logWriter.WriteLine($"{entityName}: {deleted} removidos, {failed} falhas.");
    }

    /// <summary>Remove candidatos por ID. 204 = removido; 404 = já não existe (conta como sucesso). Outros = falha e regista body.</summary>
    private async Task<int> DeleteCandidatoIdsAsync(List<Guid> ids, CancellationToken ct)
    {
        var deleted = 0;
        var failed = 0;
        foreach (var id in ids)
        {
            var response = await _portalClient.Http.DeleteAsync($"api/candidatos/{id}", ct);
            if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
                deleted++;
            else if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                deleted++; // já removido
            else
            {
                failed++;
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("DELETE api/candidatos/{Id} falhou: {Status} Body: {Body}", id, response.StatusCode, body);
                _logWriter.WriteLine($"  DELETE Candidato {id}: {response.StatusCode} {body}");
            }
        }
        _logger.LogInformation("Candidatos: {Deleted} removidos, {Failed} falhas.", deleted, failed);
        _logWriter.WriteLine($"Candidatos: {deleted} removidos, {failed} falhas.");
        return failed;
    }

    private sealed record PagedIdResponse(
        List<IdItem>? Items,
        int Page,
        int PageSize,
        int? TotalItems,
        int? TotalPages,
        int? TotalCount);

    private sealed record IdItem(Guid Id);

    private sealed record AreaItemWithParent(Guid Id, Guid? ParentId);

    private sealed record CandidatePagedResponse(List<CandidateListItem>? Items, int TotalCount, int Page, int PageSize);

    private sealed record CandidateListItem(Guid Id);

    private sealed record TalentoPagedResponse(List<TalentoListItem>? Items, int TotalCount, int Page, int PageSize);

    private sealed record TalentoListItem(Guid Id);

    private sealed record CleanCandidatosTalentosResponse(int CandidatosRemovidos, int TalentosRemovidos);
}
