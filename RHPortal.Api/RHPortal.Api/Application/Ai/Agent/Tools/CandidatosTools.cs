using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai.Agent.Tools;

/// <summary>Lista candidatos do tenant com filtros.</summary>
public sealed class CandidatosListarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CandidatosListarTool(AppDbContext db) { _db = db; }

    public string Name => "candidatos_listar";
    public string Description =>
        "Lista candidatos do tenant. Filtros opcionais: cidade (nome parcial), uf (2 letras), status (Novo, Triagem, Aprovado, Reprovado, Pendente), vagaCodigo, skillText (busca o texto no CV ou resumo). Retorna no máximo 30 candidatos.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "cidade": { "type": "string" },
            "uf": { "type": "string" },
            "status": { "type": "string" },
            "vagaCodigo": { "type": "string" },
            "skillText": { "type": "string", "description": "Texto buscado em CV ou resumo (ex.: 'SAP', 'LGPD')" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var q = _db.Candidatos.AsNoTracking();

        if (args.TryGetProperty("cidade", out var cidadeEl) && cidadeEl.ValueKind == JsonValueKind.String)
        {
            var cidade = cidadeEl.GetString()!.Trim();
            if (!string.IsNullOrEmpty(cidade))
                q = q.Where(c => EF.Functions.ILike(c.Cidade ?? "", $"%{cidade}%"));
        }
        if (args.TryGetProperty("uf", out var ufEl) && ufEl.ValueKind == JsonValueKind.String)
        {
            var uf = ufEl.GetString()!.Trim().ToUpper();
            if (!string.IsNullOrEmpty(uf))
                q = q.Where(c => c.Uf == uf);
        }
        if (args.TryGetProperty("status", out var statusEl) && statusEl.ValueKind == JsonValueKind.String
            && Enum.TryParse<RhPortal.Api.Domain.Enums.CandidateStatus>(statusEl.GetString()!, ignoreCase: true, out var stat))
        {
            q = q.Where(c => (int)c.Status == (int)stat);
        }
        if (args.TryGetProperty("vagaCodigo", out var vcEl) && vcEl.ValueKind == JsonValueKind.String)
        {
            var codigo = vcEl.GetString()!.Trim();
            if (!string.IsNullOrEmpty(codigo))
            {
                var vaga = await _db.Vagas.AsNoTracking()
                    .FirstOrDefaultAsync(v => EF.Functions.ILike(v.Codigo ?? "", $"%{codigo}%"), ct);
                if (vaga is null) return new { erro = $"Vaga '{codigo}' não encontrada." };
                q = q.Where(c => c.VagaId == vaga.Id);
            }
        }
        if (args.TryGetProperty("skillText", out var skEl) && skEl.ValueKind == JsonValueKind.String)
        {
            var skill = skEl.GetString()!.Trim();
            if (!string.IsNullOrEmpty(skill))
                q = q.Where(c => EF.Functions.ILike(c.CvText ?? "", $"%{skill}%")
                              || EF.Functions.ILike(c.ResumoProfissional ?? "", $"%{skill}%"));
        }

        var rows = await q
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(30)
            .Select(c => new
            {
                nome = c.Nome,
                email = c.Email,
                cidade = c.Cidade,
                uf = c.Uf,
                status = c.Status.ToString(),
                resumo = c.ResumoProfissional != null ? (c.ResumoProfissional.Length > 150 ? c.ResumoProfissional.Substring(0, 150) + "..." : c.ResumoProfissional) : null,
            })
            .ToListAsync(ct);

        return new { total = rows.Count, candidatos = rows };
    }
}

/// <summary>Detalhes de um candidato específico por nome, email ou ID.</summary>
public sealed class CandidatosInfoTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CandidatosInfoTool(AppDbContext db) { _db = db; }

    public string Name => "candidatos_info";
    public string Description =>
        "Retorna detalhes completos de 1 candidato: CV, resumo, competências declaradas, vaga atual, status, último score de match. Informe `identificador` com nome parcial, email ou ID.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "identificador": { "type": "string", "description": "Nome (parcial), email ou ID do candidato" }
          },
          "required": ["identificador"]
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var id = args.TryGetProperty("identificador", out var el) ? el.GetString() ?? "" : "";
        if (string.IsNullOrWhiteSpace(id))
            return new { erro = "identificador é obrigatório" };

        var cand = await _db.Candidatos.AsNoTracking()
            .Where(c => EF.Functions.ILike(c.Nome, $"%{id}%")
                     || EF.Functions.ILike(c.Email, $"%{id}%"))
            .FirstOrDefaultAsync(ct);

        if (cand is null && Guid.TryParse(id, out var gid))
            cand = await _db.Candidatos.AsNoTracking().FirstOrDefaultAsync(c => c.Id == gid, ct);

        if (cand is null) return new { erro = $"Candidato '{id}' não encontrado." };

        string? vagaTitulo = null;
        if (cand.VagaId.HasValue)
        {
            vagaTitulo = await _db.Vagas.AsNoTracking()
                .Where(v => v.Id == cand.VagaId.Value)
                .Select(v => v.Titulo)
                .FirstOrDefaultAsync(ct);
        }

        var competencias = await _db.CandidatoCompetencias.AsNoTracking()
            .Where(cc => cc.CandidatoId == cand.Id)
            .Select(cc => cc.Nome)
            .ToListAsync(ct);

        return new
        {
            nome = cand.Nome,
            email = cand.Email,
            telefone = cand.Fone,
            cidade = cand.Cidade,
            uf = cand.Uf,
            status = cand.Status.ToString(),
            vagaAtual = vagaTitulo,
            pretensaoSalarial = cand.PretensaoSalarial,
            ultimoMatchScore = cand.LastMatchScore,
            resumo = cand.ResumoProfissional,
            cv = cand.CvText != null
                ? (cand.CvText.Length > 1500 ? cand.CvText.Substring(0, 1500) + "..." : cand.CvText)
                : null,
            competenciasDeclaradas = competencias,
        };
    }
}

/// <summary>Conta candidatos agrupados por cidade/status/vaga.</summary>
public sealed class CandidatosContarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public CandidatosContarTool(AppDbContext db) { _db = db; }

    public string Name => "candidatos_contar";
    public string Description =>
        "Conta candidatos agrupados por dimensão. groupBy aceita 'status', 'cidade', 'uf', 'vaga'. Se omitido retorna total geral do tenant.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "groupBy": { "type": "string", "description": "status | cidade | uf | vaga" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var groupBy = args.TryGetProperty("groupBy", out var el) ? el.GetString() ?? "" : "";
        switch (groupBy.ToLowerInvariant())
        {
            case "status":
                var byStatus = await _db.Candidatos.AsNoTracking()
                    .GroupBy(c => c.Status)
                    .Select(g => new { status = g.Key.ToString(), total = g.Count() })
                    .ToListAsync(ct);
                return new { grupoPor = "status", resultado = byStatus };
            case "cidade":
                var byCidade = await _db.Candidatos.AsNoTracking()
                    .Where(c => c.Cidade != null)
                    .GroupBy(c => c.Cidade!)
                    .Select(g => new { cidade = g.Key, total = g.Count() })
                    .OrderByDescending(g => g.total).Take(20)
                    .ToListAsync(ct);
                return new { grupoPor = "cidade", resultado = byCidade };
            case "uf":
                var byUf = await _db.Candidatos.AsNoTracking()
                    .Where(c => c.Uf != null)
                    .GroupBy(c => c.Uf!)
                    .Select(g => new { uf = g.Key, total = g.Count() })
                    .OrderByDescending(g => g.total)
                    .ToListAsync(ct);
                return new { grupoPor = "uf", resultado = byUf };
            case "vaga":
                var byVaga = await _db.Candidatos.AsNoTracking()
                    .Where(c => c.VagaId != null)
                    .Join(_db.Vagas.AsNoTracking(), c => c.VagaId, v => v.Id, (c, v) => new { v.Codigo, v.Titulo })
                    .GroupBy(x => new { x.Codigo, x.Titulo })
                    .Select(g => new { vaga = g.Key.Codigo, titulo = g.Key.Titulo, total = g.Count() })
                    .OrderByDescending(g => g.total).Take(20)
                    .ToListAsync(ct);
                return new { grupoPor = "vaga", resultado = byVaga };
            default:
                var total = await _db.Candidatos.AsNoTracking().CountAsync(ct);
                return new { totalGeral = total };
        }
    }
}
