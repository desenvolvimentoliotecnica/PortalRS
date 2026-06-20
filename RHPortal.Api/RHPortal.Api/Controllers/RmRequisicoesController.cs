using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>Lista consolidada de requisições do RM (CORPORERM), somente leitura.</summary>
[ApiController]
[RequirePermission("access.manage")]
[Route("api/rm/requisicoes")]
public sealed class RmRequisicoesController : ControllerBase
{
    private readonly IRmRequisicoesReadService _read;
    private readonly AppDbContext _db;

    public RmRequisicoesController(IRmRequisicoesReadService read, AppDbContext db)
    {
        _read = read;
        _db = db;
    }

    [HttpGet]
    [RequestTimeout("RmConsulta")]
    [ProducesResponseType(typeof(RmRequisicaoListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    [ProducesResponseType(StatusCodes.Status504GatewayTimeout)]
    public async Task<ActionResult<RmRequisicaoListResponse>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? tipoRequisicao = null,
        [FromQuery] DateOnly? dataAberturaDe = null,
        [FromQuery] DateOnly? dataAberturaAte = null,
        [FromQuery] string? q = null,
        [FromQuery] int[]? codStatusIn = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        CancellationToken ct = default)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(tipoRequisicao)
                && !RmRequisicaoTipos.IsVisivelConsulta(tipoRequisicao))
            {
                return Ok(new RmRequisicaoListResponse { Items = [], TotalCount = 0 });
            }

            var result = await _read.ListAsync(new RmRequisicaoListQuery
            {
                Page = page,
                PageSize = pageSize,
                TipoRequisicao = tipoRequisicao,
                DataAberturaDe = dataAberturaDe,
                DataAberturaAte = dataAberturaAte,
                Search = q,
                CodStatusIn = codStatusIn,
                SortBy = sortBy,
                SortDir = sortDir
            }, ct);
            return Ok(await EnrichAsync(result, ct));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "Integração RM indisponível",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
        catch (SqlException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "Erro ao consultar o banco RM",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
        catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout, new ProblemDetails
            {
                Title = "Consulta ao RM excedeu o tempo limite",
                Detail = "Reduza o período de abertura ou aplique filtros (tipo/status) e tente novamente.",
                Status = StatusCodes.Status504GatewayTimeout
            });
        }
    }

    private async Task<RmRequisicaoListResponse> EnrichAsync(RmRequisicaoListResponse result, CancellationToken ct)
    {
        if (result.Items.Count == 0)
            return result;

        var codStatus = result.Items
            .Where(i => i.Codstatus.HasValue)
            .Select(i => i.Codstatus!.Value)
            .Distinct()
            .ToArray();

        var statusLabels = await _db.RmRequisicaoStatusMaps
            .AsNoTracking()
            .Where(m => codStatus.Contains(m.CodStatusRm))
            .GroupBy(m => m.CodStatusRm)
            .Select(g => new
            {
                CodStatusRm = g.Key,
                PortalStatusKey = g
                    .OrderBy(m => m.Priority ?? int.MaxValue)
                    .ThenBy(m => m.CreatedAtUtc)
                    .Select(m => m.PortalStatusKey)
                    .First()
            })
            .ToDictionaryAsync(x => x.CodStatusRm, x => ToStatusLabel(x.PortalStatusKey), ct);

        var chapas = result.Items
            .Select(i => i.Chaparequisitante?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var requisitantes = chapas.Length == 0
            ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            : await _db.Funcionarios
                .AsNoTracking()
                .Where(f => f.MatriculaRm != null && chapas.Contains(f.MatriculaRm))
                .GroupBy(f => f.MatriculaRm!)
                .Select(g => new
                {
                    Chapa = g.Key,
                    Nome = g
                        .OrderByDescending(f => f.Status == Domain.Enums.FuncionarioStatus.Active)
                        .ThenBy(f => f.Name)
                        .Select(f => f.Name)
                        .First()
                })
                .ToDictionaryAsync(x => x.Chapa, x => x.Nome, StringComparer.OrdinalIgnoreCase, ct);

        var codFuncoes = result.Items
            .Select(i => i.Codfuncao?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var funcoes = codFuncoes.Length == 0
            ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            : await _db.Funcionarios
                .AsNoTracking()
                .Where(f => f.CodFuncaoRm != null && codFuncoes.Contains(f.CodFuncaoRm))
                .GroupBy(f => f.CodFuncaoRm!)
                .Select(g => new
                {
                    Codigo = g.Key,
                    Nome = g
                        .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
                        .ThenBy(f => f.FuncaoNomeRm)
                        .Select(f => f.FuncaoNomeRm)
                        .FirstOrDefault()
                })
                .Where(x => x.Nome != null && x.Nome != "")
                .ToDictionaryAsync(x => x.Codigo, x => x.Nome!, StringComparer.OrdinalIgnoreCase, ct);

        return new RmRequisicaoListResponse
        {
            TotalCount = result.TotalCount,
            Items = result.Items.Select(item => EnrichRow(item, statusLabels, requisitantes, funcoes)).ToList()
        };
    }

    private static RmRequisicaoRowDto EnrichRow(
        RmRequisicaoRowDto item,
        IReadOnlyDictionary<int, string> statusLabels,
        IReadOnlyDictionary<string, string> requisitantes,
        IReadOnlyDictionary<string, string> funcoes)
    {
        var chapa = item.Chaparequisitante?.Trim();
        var nomeRequisitante = item.NomeRequisitante;
        if (string.IsNullOrWhiteSpace(nomeRequisitante)
            && !string.IsNullOrWhiteSpace(chapa)
            && requisitantes.TryGetValue(chapa, out var nomePortal))
        {
            nomeRequisitante = nomePortal;
        }

        var statusDescricao = item.StatusDescricao;
        if (string.IsNullOrWhiteSpace(statusDescricao) && item.Codstatus.HasValue)
        {
            statusDescricao = statusLabels.TryGetValue(item.Codstatus.Value, out var label)
                ? label
                : $"CODSTATUS {item.Codstatus.Value} (sem mapa)";
        }

        var codFuncao = item.Codfuncao?.Trim();
        var nomeFuncao = item.NomeFuncao;
        if (string.IsNullOrWhiteSpace(nomeFuncao)
            && !string.IsNullOrWhiteSpace(codFuncao)
            && funcoes.TryGetValue(codFuncao, out var nomeFuncaoPortal))
        {
            nomeFuncao = nomeFuncaoPortal;
        }

        return new RmRequisicaoRowDto
        {
            TipoRequisicao = item.TipoRequisicao,
            Codcolrequisicao = item.Codcolrequisicao,
            Idreq = item.Idreq,
            Justificativa = item.Justificativa,
            Dataabertura = item.Dataabertura,
            Dataprevista = item.Dataprevista,
            Dataconclusao = item.Dataconclusao,
            Datacancelamento = item.Datacancelamento,
            Codstatus = item.Codstatus,
            StatusDescricao = statusDescricao,
            StatusPermiteAlterar = item.StatusPermiteAlterar,
            Codcolrequisitante = item.Codcolrequisitante,
            Chaparequisitante = item.Chaparequisitante,
            NomeRequisitante = nomeRequisitante,
            Codatendimento = item.Codatendimento,
            Codlocal = item.Codlocal,
            AtendimentoAssunto = item.AtendimentoAssunto,
            Tiporeqpai = item.Tiporeqpai,
            Idreqpai = item.Idreqpai,
            ChapaFuncionario = item.ChapaFuncionario,
            NomeFuncionarioEnvolvido = item.NomeFuncionarioEnvolvido,
            ChapaSubstituto = item.ChapaSubstituto,
            NomeFuncionarioSubstituto = item.NomeFuncionarioSubstituto,
            Numvagas = item.Numvagas,
            Codfilial = item.Codfilial,
            Codsecao = item.Codsecao,
            Codfuncao = item.Codfuncao,
            Codtabelasalarial = item.Codtabelasalarial,
            Codnivelsalarial = item.Codnivelsalarial,
            Codfaixasalarial = item.Codfaixasalarial,
            NomeFuncao = nomeFuncao,
            DescricaoFuncao = item.DescricaoFuncao,
            Vlrsalario = item.Vlrsalario,
            Codccusto = item.Codccusto,
            Reccreatedby = item.Reccreatedby,
            Reccreatedon = item.Reccreatedon,
            Recmodifiedby = item.Recmodifiedby,
            Recmodifiedon = item.Recmodifiedon
        };
    }

    private static string ToStatusLabel(string portalStatusKey)
    {
        return Enum.TryParse<SolicitacaoStatus>(portalStatusKey, out var status) ? status switch
        {
            SolicitacaoStatus.Rascunho => "Rascunho",
            SolicitacaoStatus.PendenteAprovacao => "Pendente aprovação",
            SolicitacaoStatus.Aprovada => "Aprovada",
            SolicitacaoStatus.Reprovada => "Reprovada",
            SolicitacaoStatus.AjustesNecessarios => "Ajustes necessários",
            SolicitacaoStatus.PendenteAprovacaoRh => "Pendente aprovação RH",
            SolicitacaoStatus.Cancelada => "Cancelada",
            SolicitacaoStatus.EmIntegracao => "Em integração",
            SolicitacaoStatus.Concluida => "Concluída",
            SolicitacaoStatus.PendenteAprovacaoAumentoHC => "Pendente aprovação aumento HC",
            SolicitacaoStatus.PendenteTriagem => "Pendente triagem",
            SolicitacaoStatus.EmTriagem => "Em triagem",
            SolicitacaoStatus.DevolvidaTriagemGestor => "Devolvida ao gestor",
            SolicitacaoStatus.PendenteIntegracaoRm => "Pendente integração RM",
            SolicitacaoStatus.ErroIntegracaoRm => "Erro integração RM",
            SolicitacaoStatus.AguardandoReprocessamentoRm => "Aguardando reprocessamento RM",
            SolicitacaoStatus.EmProcessoSeletivo => "Em processo seletivo",
            SolicitacaoStatus.Suspensa => "Suspensa",
            SolicitacaoStatus.EncerradaSemContratacao => "Encerrada sem contratação",
            SolicitacaoStatus.ContratacaoConcluida => "Contratação concluída",
            SolicitacaoStatus.EmAndamento => "Em andamento",
            _ => portalStatusKey
        } : portalStatusKey;
    }
}
