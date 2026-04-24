using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai.Agent.Tools;

/// <summary>Lista vagas do tenant filtradas por status, senioridade ou centro de custo.</summary>
public sealed class VagasListarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public VagasListarTool(AppDbContext db) { _db = db; }

    public string Name => "vagas_listar";
    public string Description =>
        "Lista vagas do tenant. Filtros opcionais: status (Rascunho, Aberta, Pausada, EmTriagem, EmEntrevistas, EmOferta, Encerrada, Cancelada, Preenchida), senioridade (Estagiario, Trainee, Junior, Pleno, Senior, Especialista, Coordenador, Gerente, Diretor), centroCustoCode (ex.: TI-OPS), gestorRequisitante (nome parcial). Retorna no máximo 30 vagas.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "status": { "type": "string", "description": "Aberta | Rascunho | EmTriagem | EmEntrevistas | Preenchida | Cancelada" },
            "senioridade": { "type": "string", "description": "Junior | Pleno | Senior | etc" },
            "centroCustoCode": { "type": "string" },
            "gestorRequisitante": { "type": "string" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var q = _db.Vagas.AsNoTracking();

        if (args.TryGetProperty("status", out var statusEl) && statusEl.ValueKind == JsonValueKind.String)
        {
            var statusStr = statusEl.GetString()!;
            if (Enum.TryParse<RHPortal.Api.Domain.Enums.VagaStatus>(statusStr, ignoreCase: true, out var st))
                q = q.Where(v => v.Status == st);
        }
        if (args.TryGetProperty("senioridade", out var seniorEl) && seniorEl.ValueKind == JsonValueKind.String)
        {
            var seniorStr = seniorEl.GetString()!;
            if (Enum.TryParse<RHPortal.Api.Domain.Enums.VagaSenioridade>(seniorStr, ignoreCase: true, out var sr))
                q = q.Where(v => v.Senioridade == sr);
        }
        if (args.TryGetProperty("centroCustoCode", out var ccEl) && ccEl.ValueKind == JsonValueKind.String)
        {
            var ccCode = ccEl.GetString()!.Trim();
            if (!string.IsNullOrEmpty(ccCode))
                q = q.Where(v => v.CentroCusto != null && EF.Functions.ILike(v.CentroCusto.Code, ccCode));
        }
        if (args.TryGetProperty("gestorRequisitante", out var gestorEl) && gestorEl.ValueKind == JsonValueKind.String)
        {
            var gestorFiltro = gestorEl.GetString()!.Trim();
            if (!string.IsNullOrEmpty(gestorFiltro))
                q = q.Where(v => EF.Functions.ILike(v.GestorRequisitante ?? "", $"%{gestorFiltro}%"));
        }

        var rows = await q
            .OrderByDescending(v => v.DataAbertura)
            .Take(30)
            .Select(v => new
            {
                codigo = v.Codigo,
                titulo = v.Titulo,
                status = v.Status.ToString(),
                senioridade = v.Senioridade != null ? v.Senioridade.ToString() : null,
                cidade = v.Cidade,
                uf = v.Uf,
                salarioMin = v.SalarioMinimo,
                salarioMax = v.SalarioMaximo,
                gestor = v.GestorRequisitante,
                recrutador = v.RecrutadorResponsavel,
                dataAbertura = v.DataAbertura,
            })
            .ToListAsync(ct);

        return new { total = rows.Count, vagas = rows };
    }
}

/// <summary>Conta vagas do tenant por status.</summary>
public sealed class VagasContarTool : IAgentTool
{
    private readonly AppDbContext _db;
    public VagasContarTool(AppDbContext db) { _db = db; }

    public string Name => "vagas_contar";
    public string Description =>
        "Conta vagas por status. Se status não for informado, retorna contagem por cada status (Rascunho, Aberta, EmTriagem, EmEntrevistas, Preenchida, Cancelada). Use para responder perguntas como 'quantas vagas abertas temos?'.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "status": { "type": "string", "description": "opcional — filtra contagem por 1 status" }
          },
          "required": []
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        if (args.TryGetProperty("status", out var statusEl)
            && statusEl.ValueKind == JsonValueKind.String
            && Enum.TryParse<RHPortal.Api.Domain.Enums.VagaStatus>(statusEl.GetString()!, ignoreCase: true, out var st))
        {
            var count = await _db.Vagas.AsNoTracking().CountAsync(v => v.Status == st, ct);
            return new { status = st.ToString(), total = count };
        }

        var grouped = await _db.Vagas.AsNoTracking()
            .GroupBy(v => v.Status)
            .Select(g => new { status = g.Key.ToString(), total = g.Count() })
            .ToListAsync(ct);
        return new { porStatus = grouped.OrderByDescending(g => g.total).ToList(), totalGeral = grouped.Sum(g => g.total) };
    }
}

/// <summary>Detalhes completos de uma vaga específica (código, status, pesos, etc).</summary>
public sealed class VagasInfoTool : IAgentTool
{
    private readonly AppDbContext _db;
    public VagasInfoTool(AppDbContext db) { _db = db; }

    public string Name => "vagas_info";
    public string Description =>
        "Retorna detalhes completos de 1 vaga específica pelo código (ex.: VAG-FIN-001). Inclui: título, status, senioridade, faixa salarial, localização, pesos calibrados do matching, descrição de cargo vinculada, centro de custo, gestor, recrutador, match mínimo.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "codigo": { "type": "string", "description": "Código ou parte do código da vaga (ex.: VAG-FIN-001 ou FIN-001)" }
          },
          "required": ["codigo"]
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var codigo = args.TryGetProperty("codigo", out var el) ? el.GetString() ?? "" : "";
        if (string.IsNullOrWhiteSpace(codigo))
            return new { erro = "codigo é obrigatório" };

        var vaga = await _db.Vagas.AsNoTracking()
            .Include(v => v.DescricaoCargo)
            .Include(v => v.CentroCusto)
            .FirstOrDefaultAsync(v => EF.Functions.ILike(v.Codigo ?? "", $"%{codigo}%"), ct);

        if (vaga is null) return new { erro = $"Vaga '{codigo}' não encontrada." };

        return new
        {
            codigo = vaga.Codigo,
            titulo = vaga.Titulo,
            status = vaga.Status.ToString(),
            senioridade = vaga.Senioridade?.ToString(),
            modalidade = vaga.Modalidade?.ToString(),
            tipoContratacao = vaga.TipoContratacao?.ToString(),
            quantidadeVagas = vaga.QuantidadeVagas,
            cidade = vaga.Cidade,
            uf = vaga.Uf,
            salarioMinimo = vaga.SalarioMinimo,
            salarioMaximo = vaga.SalarioMaximo,
            matchMinimoPercentual = vaga.MatchMinimoPercentual,
            descricaoCargo = vaga.DescricaoCargo != null ? new
            {
                codigo = vaga.DescricaoCargo.Code,
                titulo = vaga.DescricaoCargo.Title,
            } : null,
            centroCusto = vaga.CentroCusto != null ? new
            {
                codigo = vaga.CentroCusto.Code,
                nome = vaga.CentroCusto.Description,
            } : null,
            gestor = vaga.GestorRequisitante,
            recrutador = vaga.RecrutadorResponsavel,
            dataAbertura = vaga.DataAbertura,
            slaDiasMetaFechamento = vaga.SlaDiasMetaFechamento,
            pesos = new
            {
                competencia = vaga.PesoCompetencia,
                experiencia = vaga.PesoExperiencia,
                formacao = vaga.PesoFormacao,
                localidade = vaga.PesoLocalidade,
                idioma = vaga.PesoIdioma,
                conhecimentoTecnico = vaga.PesoConhecimentoTecnico,
                vivenciaEspecifica = vaga.PesoVivenciaEspecifica,
            },
            raioMaximoKm = vaga.LocalidadeMaxDistanciaKm,
        };
    }
}

/// <summary>Lista candidatos de uma vaga específica com status e score.</summary>
public sealed class VagasCandidatosTool : IAgentTool
{
    private readonly AppDbContext _db;
    public VagasCandidatosTool(AppDbContext db) { _db = db; }

    public string Name => "vagas_candidatos";
    public string Description =>
        "Lista candidatos de uma vaga específica pelo código. Inclui nome, email, cidade, status (Novo/Triagem/Aprovado/Reprovado), score de último matching. Use para responder 'quem são os candidatos da vaga X?'.";
    public JsonElement ParametersSchema => _schema;
    private static readonly JsonElement _schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "codigoVaga": { "type": "string", "description": "Código da vaga (ex.: VAG-FIN-001)" }
          },
          "required": ["codigoVaga"]
        }
        """).RootElement;

    public async Task<object> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var codigo = args.TryGetProperty("codigoVaga", out var el) ? el.GetString() ?? "" : "";
        if (string.IsNullOrWhiteSpace(codigo))
            return new { erro = "codigoVaga é obrigatório" };

        var vaga = await _db.Vagas.AsNoTracking()
            .FirstOrDefaultAsync(v => EF.Functions.ILike(v.Codigo ?? "", $"%{codigo}%"), ct);
        if (vaga is null) return new { erro = $"Vaga '{codigo}' não encontrada." };

        var rows = await _db.Candidatos.AsNoTracking()
            .Where(c => c.VagaId == vaga.Id)
            .OrderByDescending(c => c.LastMatchScore ?? 0)
            .Take(50)
            .Select(c => new
            {
                nome = c.Nome,
                email = c.Email,
                cidade = c.Cidade,
                uf = c.Uf,
                status = c.Status.ToString(),
                ultimoMatchScore = c.LastMatchScore,
                dataCandidatura = c.CreatedAtUtc,
            })
            .ToListAsync(ct);

        return new { vaga = vaga.Codigo, vagaTitulo = vaga.Titulo, total = rows.Count, candidatos = rows };
    }
}
