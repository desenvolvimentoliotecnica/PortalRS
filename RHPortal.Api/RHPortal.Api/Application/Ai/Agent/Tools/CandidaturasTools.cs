using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai.Agent.Tools;

/// <summary>Distribuição de candidaturas por etapa macro do funil.</summary>
public sealed class CandidaturasPorEtapaTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CandidaturasPorEtapaTool(AppDbContext db) { _db = db; }

    public string Name => "candidaturas_por_etapa";
    public string Description =>
        "Retorna a distribuição de candidaturas pelas etapas do funil (Aplicada, EmTriagem, Entrevista, Teste, Proposta, Contratado, Recusado, Desistiu). Opcionalmente filtra por vaga (codigoVaga).";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "codigoVaga": { "type": "string", "description": "opcional — filtra pela vaga" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var q = _db.Candidaturas.AsNoTracking().AsQueryable();

        if (args.TryGetProperty("codigoVaga", out var el) && el.ValueKind == JsonValueKind.String)
        {
            var codigo = el.GetString()!.Trim();
            if (!string.IsNullOrEmpty(codigo))
            {
                var vaga = await _db.Vagas.AsNoTracking()
                    .FirstOrDefaultAsync(v => EF.Functions.ILike(v.Codigo ?? "", $"%{codigo}%"), ct);
                if (vaga is null) return new { erro = $"Vaga '{codigo}' não encontrada." };
                q = q.Where(c => c.VagaId == vaga.Id);
            }
        }

        var grouped = await q
            .GroupBy(c => c.EtapaMacro)
            .Select(g => new { etapa = g.Key.ToString(), total = g.Count() })
            .ToListAsync(ct);

        return new
        {
            funil = grouped.OrderBy(g => g.etapa).ToList(),
            totalCandidaturas = grouped.Sum(g => g.total),
        };
    }
}

/// <summary>Candidaturas com SLA estourado (mais dias na etapa atual do que o SLA configurado).</summary>
public sealed class CandidaturasSlaAtrasadasTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CandidaturasSlaAtrasadasTool(AppDbContext db) { _db = db; }

    public string Name => "candidaturas_sla_atrasadas";
    public string Description =>
        "Retorna candidaturas com SLA estourado (mais de 5 dias na mesma etapa, default). Útil para responder 'quais candidaturas estão paradas?' ou 'onde está o gargalo no funil?'.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "diasLimite": { "type": "integer", "description": "Dias máximo aceitável na etapa (default 5)" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        int limite = 5;
        if (args.TryGetProperty("diasLimite", out var el) && el.ValueKind == JsonValueKind.Number)
            limite = el.GetInt32();

        var cutoff = DateTimeOffset.UtcNow.AddDays(-limite);

        var rows = await _db.Candidaturas.AsNoTracking()
            .Where(c => c.EtapaAtualDesdeUtc != null
                     && c.EtapaAtualDesdeUtc < cutoff
                     && c.EtapaMacro != RhPortal.Api.Domain.Enums.EtapaMacroCandidatura.Contratado
                     && c.EtapaMacro != RhPortal.Api.Domain.Enums.EtapaMacroCandidatura.ReprovadoRh
                     && c.EtapaMacro != RhPortal.Api.Domain.Enums.EtapaMacroCandidatura.ReprovadoGestor
                     && c.EtapaMacro != RhPortal.Api.Domain.Enums.EtapaMacroCandidatura.Recusado
                     && c.EtapaMacro != RhPortal.Api.Domain.Enums.EtapaMacroCandidatura.Desistiu)
            .Join(_db.Candidatos.AsNoTracking(), c => c.CandidatoId, ca => ca.Id, (c, ca) => new { c, ca })
            .Join(_db.Vagas.AsNoTracking(), x => x.c.VagaId, v => v.Id, (x, v) => new
            {
                vaga = v.Codigo,
                vagaTitulo = v.Titulo,
                candidato = x.ca.Nome,
                etapa = x.c.EtapaMacro.ToString(),
                diasNaEtapa = (int)(DateTimeOffset.UtcNow - x.c.EtapaAtualDesdeUtc!.Value).TotalDays,
            })
            .OrderByDescending(r => r.diasNaEtapa)
            .Take(30)
            .ToListAsync(ct);

        return new
        {
            diasLimite = limite,
            totalAtrasadas = rows.Count,
            atrasadas = rows,
        };
    }
}

/// <summary>Conta candidaturas por fonte (LinkedIn, Site, Indicação).</summary>
public sealed class CandidaturasPorFonteTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CandidaturasPorFonteTool(AppDbContext db) { _db = db; }

    public string Name => "candidaturas_por_fonte";
    public string Description =>
        "Agrupa candidaturas por fonte de origem (LinkedIn, Site, Indicação, Portal, etc). Útil para medir ROI por canal.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {"type":"object","properties":{},"required":[]}
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var rows = await _db.Candidaturas.AsNoTracking()
            .GroupBy(c => c.Fonte ?? "Desconhecida")
            .Select(g => new { fonte = g.Key, total = g.Count() })
            .OrderByDescending(r => r.total)
            .ToListAsync(ct);
        return new { porFonte = rows, totalGeral = rows.Sum(r => r.total) };
    }
}
