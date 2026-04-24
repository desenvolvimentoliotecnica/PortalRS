using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai.Agent.Tools;

/// <summary>Lista centros de custo do tenant.</summary>
public sealed class CentrosCustoListarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CentrosCustoListarTool(AppDbContext db) { _db = db; }

    public string Name => "centros_custo_listar";
    public string Description =>
        "Lista os centros de custo do tenant com código, nome, gestor e headcount. Útil para perguntas sobre estrutura organizacional.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {"type":"object","properties":{},"required":[]}
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var rows = await _db.CentrosCusto.AsNoTracking()
            .Where(cc => cc.IsActive)
            .Select(cc => new
            {
                codigo = cc.Code,
                nome = cc.Description,
                gestor = cc.Manager,
                headcount = cc.Headcount,
                local = cc.BranchOrLocation,
            })
            .ToListAsync(ct);
        return new { total = rows.Count, centros = rows };
    }
}

/// <summary>Lista descrições de cargo cadastradas.</summary>
public sealed class DescricoesCargoListarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public DescricoesCargoListarTool(AppDbContext db) { _db = db; }

    public string Name => "descricoes_cargo_listar";
    public string Description =>
        "Lista descrições de cargo (templates DNALIO) cadastradas no tenant. Inclui código, título, área e número de itens estruturados.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {"type":"object","properties":{},"required":[]}
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var rows = await _db.DescricoesCargo.AsNoTracking()
            .Where(d => d.IsActive)
            .Select(d => new
            {
                codigo = d.Code,
                titulo = d.Title,
                area = d.AreaTemplate,
                formacaoMinima = d.FormacaoMinima,
                experienciaMinima = d.ExperienciaTempoMinimo,
                totalItens = d.Itens.Count,
            })
            .OrderBy(d => d.titulo)
            .ToListAsync(ct);
        return new { total = rows.Count, descricoes = rows };
    }
}

/// <summary>Detalhes completos de uma descrição de cargo com seus itens DNALIO.</summary>
public sealed class DescricaoCargoInfoTool : IAgentTool
{
    private readonly AppDbContext _db;
    public DescricaoCargoInfoTool(AppDbContext db) { _db = db; }

    public string Name => "descricao_cargo_info";
    public string Description =>
        "Retorna detalhes completos de 1 descrição de cargo (template DNALIO) incluindo todos os itens agrupados por categoria: Atividades Específicas, Comuns, Vivências, Competências DNALIO/Liderança/Funcionais/Técnicas, Requisitos Obrigatórios. Informe code ou titulo.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "codigoOrTitulo": { "type": "string", "description": "Código (ex.: ANALISTA-FINANCEIRO-JR) ou título parcial" }
          },
          "required": ["codigoOrTitulo"]
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var q = args.TryGetProperty("codigoOrTitulo", out var el) ? el.GetString() ?? "" : "";
        if (string.IsNullOrWhiteSpace(q))
            return new { erro = "codigoOrTitulo é obrigatório" };

        var dc = await _db.DescricoesCargo.AsNoTracking()
            .Include(d => d.Itens)
            .FirstOrDefaultAsync(d => EF.Functions.ILike(d.Code, $"%{q}%") || EF.Functions.ILike(d.Title, $"%{q}%"), ct);

        if (dc is null) return new { erro = $"Descrição '{q}' não encontrada." };

        var itensPorCategoria = dc.Itens
            .GroupBy(i => i.Categoria)
            .ToDictionary(
                g => g.Key.ToString(),
                g => g.OrderBy(i => i.Ordem).Select(i => new
                {
                    texto = i.Texto,
                    obrigatoria = i.IsObrigatoria,
                    subcategoria = i.Subcategoria,
                }).ToList());

        return new
        {
            codigo = dc.Code,
            titulo = dc.Title,
            area = dc.AreaTemplate,
            sumario = dc.Summary,
            formacaoMinima = dc.FormacaoMinima,
            formacaoDesejavel = dc.FormacaoDesejavel,
            areaEstudo = dc.FormacaoAreaEstudo,
            experienciaMinima = dc.ExperienciaTempoMinimo,
            experienciaDesejavel = dc.ExperienciaTempoDesejavel,
            experienciaEspecificacao = dc.ExperienciaEspecificacao,
            gestor = dc.GestorNome,
            gestorEmail = dc.GestorEmail,
            itensPorCategoria,
        };
    }
}

/// <summary>Lista empresas do tenant.</summary>
public sealed class EmpresasListarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public EmpresasListarTool(AppDbContext db) { _db = db; }

    public string Name => "empresas_listar";
    public string Description =>
        "Lista empresas cadastradas no tenant com código, nome, cidade/UF e se está geocodificada.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {"type":"object","properties":{},"required":[]}
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var rows = await _db.Empresas.AsNoTracking()
            .Where(e => e.IsActive)
            .Select(e => new
            {
                codigo = e.Code,
                nome = e.Description,
                cidade = e.Cidade,
                uf = e.Uf,
                cep = e.Cep,
                geocodificada = e.Latitude != null && e.Longitude != null,
            })
            .ToListAsync(ct);
        return new { total = rows.Count, empresas = rows };
    }
}
