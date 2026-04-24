using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai.Agent.Tools;

/// <summary>Lista propostas de vaga por status.</summary>
public sealed class PropostasListarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public PropostasListarTool(AppDbContext db) { _db = db; }

    public string Name => "propostas_listar";
    public string Description =>
        "Lista propostas de vaga. Filtros opcionais: status (Rascunho, Pendente, Aceita, Recusada, Expirada). Mostra candidato, vaga, salário oferecido, data envio.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "status": { "type": "string" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var q = _db.PropostasVaga.AsNoTracking();
        if (args.TryGetProperty("status", out var el) && el.ValueKind == JsonValueKind.String
            && Enum.TryParse<RhPortal.Api.Domain.Enums.PropostaVagaStatus>(el.GetString()!, ignoreCase: true, out var st))
        {
            q = q.Where(p => p.Status == st);
        }

        var rows = await q
            .Join(_db.Candidatos.AsNoTracking(), p => p.CandidatoId, c => c.Id, (p, c) => new { p, c })
            .Join(_db.Vagas.AsNoTracking(), x => x.p.VagaId, v => v.Id, (x, v) => new
            {
                candidato = x.c.Nome,
                vaga = v.Codigo,
                vagaTitulo = v.Titulo,
                status = x.p.Status.ToString(),
                salarioOferecido = x.p.SalarioOferecido,
                moeda = x.p.Moeda,
                dataEnvio = x.p.EnviadaEmUtc,
                dataResposta = x.p.RespondidaEmUtc,
                dataExpiracao = x.p.ExpiraEmUtc,
                motivoRecusa = x.p.MotivoRecusa,
            })
            .OrderByDescending(r => r.dataEnvio)
            .Take(30)
            .ToListAsync(ct);

        return new { total = rows.Count, propostas = rows };
    }
}

/// <summary>Estatísticas agregadas de propostas (taxa de aceitação, salário médio).</summary>
public sealed class PropostasEstatisticasTool : IAgentTool
{
    private readonly AppDbContext _db;
    public PropostasEstatisticasTool(AppDbContext db) { _db = db; }

    public string Name => "propostas_estatisticas";
    public string Description =>
        "Retorna estatísticas agregadas de propostas: total, taxa de aceitação/recusa, salário médio oferecido.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {"type":"object","properties":{},"required":[]}
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var all = await _db.PropostasVaga.AsNoTracking()
            .Select(p => new { p.Status, p.SalarioOferecido })
            .ToListAsync(ct);

        int total = all.Count;
        if (total == 0) return new { erro = "Nenhuma proposta cadastrada." };

        int aceitas = all.Count(p => p.Status == RhPortal.Api.Domain.Enums.PropostaVagaStatus.Aceita);
        int recusadas = all.Count(p => p.Status == RhPortal.Api.Domain.Enums.PropostaVagaStatus.Recusada);
        int pendentes = all.Count(p =>
            p.Status == RhPortal.Api.Domain.Enums.PropostaVagaStatus.Enviada ||
            p.Status == RhPortal.Api.Domain.Enums.PropostaVagaStatus.Visualizada);
        var salarios = all.Where(p => p.SalarioOferecido.HasValue).Select(p => p.SalarioOferecido!.Value).ToList();

        return new
        {
            total,
            aceitas,
            recusadas,
            pendentes,
            taxaAceitacaoPct = total > 0 ? Math.Round(aceitas * 100m / total, 1) : 0,
            salarioMedio = salarios.Any() ? Math.Round(salarios.Average(), 2) : (decimal?)null,
            salarioMinimo = salarios.Any() ? salarios.Min() : (decimal?)null,
            salarioMaximo = salarios.Any() ? salarios.Max() : (decimal?)null,
        };
    }
}
