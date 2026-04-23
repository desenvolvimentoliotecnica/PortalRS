using LioTecnica.Api.Contracts.Lookups;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RHPortal.Api.Domain.Enums;
using System.Text.RegularExpressions;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Lookups e enums para preencher selects/combos do sistema.
/// </summary>
[ApiController]
[Route("api/lookup")]
public sealed class LookupController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public LookupController(AppDbContext db, IStringLocalizer<ControllerMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
    }

    /// <summary>
    /// Lista unidades (para dropdowns).
    /// </summary>
    [HttpGet("units")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> Units(CancellationToken ct)
    {
        var items = await _db.Units
            .AsNoTracking()
            .OrderBy(x => x.Code.Length)
            .ThenBy(x => x.Code)
            .Select(x => new OptionResponse(
                x.Id,
                x.Code,
                x.NomAbrevPessoaJurid != null
                    ? x.NomAbrevPessoaJurid + " – " + x.Name
                    : x.Name))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista áreas (para dropdowns).
    /// </summary>
    [HttpGet("areas")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> Areas(CancellationToken ct)
    {
        var items = await _db.Areas
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new OptionResponse(x.Id, x.Code, x.Name))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista departamentos (para dropdowns).
    /// </summary>
    [HttpGet("departments")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> Departments(CancellationToken ct)
    {
        var items = await _db.Departments
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new OptionResponse(x.Id, x.Code, x.Name))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista cargos (job positions). Pode filtrar por área.
    /// </summary>
    [HttpGet("job-positions")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> JobPositions(
        [FromQuery] Guid? areaId,
        CancellationToken ct)
    {
        var q = _db.JobPositions.AsNoTracking();

        if (areaId.HasValue && areaId.Value != Guid.Empty)
            q = q.Where(x => x.AreaId == areaId.Value);

        var items = await q
            .OrderBy(x => x.Name)
            .Select(x => new OptionResponse(x.Id, x.Code, x.Name))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista empresas ativas (para dropdowns).
    /// </summary>
    [HttpGet("empresas")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> Empresas(CancellationToken ct)
    {
        var items = await _db.Empresas
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code.Length)
            .ThenBy(x => x.Code)
            .Select(x => new OptionResponse(x.Id, x.Code, x.Description))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista centros de custo ativos e vigentes (para dropdowns).
    /// </summary>
    [HttpGet("centros-custo")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> CentrosCusto(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var items = await _db.CentrosCusto
            .AsNoTracking()
            .Where(x => x.IsActive && (x.ValidUntil == null || x.ValidUntil >= today))
            .OrderBy(x => x.Code.Length)
            .ThenBy(x => x.Code)
            .Select(x => new OptionResponse(x.Id, x.Code, x.Description))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista unidades de lotação ativas (para dropdowns).
    /// </summary>
    [HttpGet("unidades-lotacao")]
    [ProducesResponseType(typeof(List<OptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OptionResponse>>> UnidadesLotacao(CancellationToken ct)
    {
        var items = await _db.UnidadesLotacao
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code.Length)
            .ThenBy(x => x.Code)
            .Select(x => new OptionResponse(x.Id, x.CdnPlanoLotac + "/" + x.Code, x.Description))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista enums e opções específicas de Vaga para filtros e formulários.
    /// </summary>
    [HttpGet("vaga-enums")]
    [ProducesResponseType(typeof(Dictionary<string, IReadOnlyList<EnumOptionResponse>>), StatusCodes.Status200OK)]
    public ActionResult<Dictionary<string, IReadOnlyList<EnumOptionResponse>>> VagaEnums()
    {
        var areaFilterAll = _localizer["Lookup.AreaFilterAll"].Value;
        var result = new Dictionary<string, IReadOnlyList<EnumOptionResponse>>
        {
            ["vagaStatus"] = BuildEnumOptions<VagaStatus>(moveZeroToEnd: true),
            ["vagaModalidade"] = BuildEnumOptions<VagaModalidade>(),
            ["vagaSenioridade"] = BuildEnumOptions<VagaSenioridade>(moveZeroToEnd: true),
            ["vagaAreaTime"] = BuildEnumOptions<VagaAreaTime>(moveZeroToEnd: true),
            ["vagaTipoContratacao"] = BuildEnumOptions<VagaTipoContratacao>(moveZeroToEnd: true),
            ["vagaMotivoAbertura"] = BuildEnumOptions<VagaMotivoAbertura>(moveZeroToEnd: true),
            ["vagaOrcamentoAprovado"] = BuildEnumOptions<VagaOrcamentoAprovado>(moveZeroToEnd: true),
            ["vagaPrioridade"] = BuildEnumOptions<VagaPrioridade>(moveZeroToEnd: true),
            ["vagaRegimeJornada"] = BuildEnumOptions<VagaRegimeJornada>(moveZeroToEnd: true),
            ["vagaEscalaTrabalho"] = BuildEnumOptions<VagaEscalaTrabalho>(moveZeroToEnd: true),
            ["vagaMoeda"] = BuildEnumOptions<VagaMoeda>(),
            ["vagaRemuneracaoPeriodicidade"] = BuildEnumOptions<VagaRemuneracaoPeriodicidade>(),
            ["vagaBonusTipo"] = BuildEnumOptions<VagaBonusTipo>(moveZeroToEnd: true),
            ["vagaBeneficioTipo"] = BuildEnumOptions<VagaBeneficioTipo>(),
            ["vagaBeneficioRecorrencia"] = BuildEnumOptions<VagaBeneficioRecorrencia>(),
            ["vagaEscolaridade"] = BuildEnumOptions<VagaEscolaridade>(moveZeroToEnd: true),
            ["vagaFormacaoArea"] = BuildEnumOptions<VagaFormacaoArea>(moveZeroToEnd: true),
            ["vagaRequisitoNivel"] = BuildEnumOptions<VagaRequisitoNivel>(),
            ["vagaRequisitoAvaliacao"] = BuildEnumOptions<VagaRequisitoAvaliacao>(),
            ["vagaEtapaResponsavel"] = BuildEnumOptions<VagaEtapaResponsavel>(),
            ["vagaEtapaModo"] = BuildEnumOptions<VagaEtapaModo>(),
            ["vagaPerguntaTipo"] = BuildEnumOptions<VagaPerguntaTipo>(),
            ["vagaPeso"] = BuildPesoOptions(),
            ["vagaPublicacaoVisibilidade"] = BuildEnumOptions<VagaPublicacaoVisibilidade>(moveZeroToEnd: true),
            ["vagaGeneroPreferencia"] = BuildEnumOptions<VagaGeneroPreferencia>(moveZeroToEnd: true),
            ["vagaAreaFilter"] = new List<EnumOptionResponse>
            {
                new("all", areaFilterAll)
            }
        };

        return Ok(result);
    }

    /// <summary>
    /// Lista usuários que possuem o perfil (role) Gestor — para seleção no cadastro de gestores.
    /// </summary>
    [HttpGet("users-gestores")]
    [ProducesResponseType(typeof(IReadOnlyList<UserGestorLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<UserGestorLookupItem>>> UsersGestores(CancellationToken ct)
    {
        var roleGestor = await _db.Roles
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Name == "Gestor", ct);
        if (roleGestor == null)
            return Ok(new List<UserGestorLookupItem>());

        var userIds = await _db.Set<ApplicationUserRole>()
            .AsNoTracking()
            .Where(ur => ur.RoleId == roleGestor.Id)
            .Select(ur => ur.UserId)
            .ToListAsync(ct);

        if (userIds.Count == 0)
            return Ok(new List<UserGestorLookupItem>());

        var items = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id) && u.IsActive)
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.Email)
            .Select(u => new UserGestorLookupItem(u.Id, u.FullName ?? "", u.Email ?? ""))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Busca funcionários com paginação (para seleção e filtros).
    /// </summary>
    [HttpGet("funcionarios")]
    [ProducesResponseType(typeof(LookupResponse<FuncionarioLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<LookupResponse<FuncionarioLookupItem>>> Funcionarios(
        [FromQuery] string? q,
        [FromQuery] bool onlyActive = true,
        [FromQuery] Guid? jobPositionId = null,
        [FromQuery] Guid? unitId = null,
        [FromQuery] Guid? empresaId = null,
        [FromQuery] Guid? unidadeLotacaoId = null,
        [FromQuery] Guid? vagaId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 200);

        var query = _db.Funcionarios
            .AsNoTracking()
            .Include(x => x.JobPosition)
            .Include(x => x.Area)
            .Include(x => x.Unit)
            .AsQueryable();

        if (onlyActive)
        {
            query = query.Where(x => x.Status == FuncionarioStatus.Active);
        }

        // Filtro "desligar alguém da vaga X". Regra de ouro: JAMAIS retornar "todos funcionários"
        // — se não consegue identificar ocupantes, retorna vazio. Ordem de prioridade:
        //   1) Ocupantes ativos confirmados em OcupacaoHistorico (FuncionarioId preenchido).
        //   2) Estrutural: combina JobPositionId + UnidadeLotacaoId da vaga (exige ao menos um).
        //   3) Sem critério possível → vazio.
        if (vagaId.HasValue)
        {
            var vaga = await _db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == vagaId.Value)
                .Select(v => new { v.JobPositionId, v.UnidadeLotacaoId, v.CentroCustoId })
                .FirstOrDefaultAsync(ct);

            var ocupantes = await _db.Set<OcupacaoHistorico>()
                .AsNoTracking()
                .Where(o => o.VagaId == vagaId.Value && o.DataSaida == null && o.FuncionarioId.HasValue)
                .Select(o => o.FuncionarioId!.Value)
                .ToListAsync(ct);

            if (ocupantes.Count > 0)
            {
                // Prioridade 1: ocupantes ativos identificados
                query = query.Where(x => ocupantes.Contains(x.Id));
            }
            else if (vaga is not null && (vaga.JobPositionId.HasValue || vaga.UnidadeLotacaoId.HasValue))
            {
                // Prioridade 2: estrutural — só aplica SE tivermos ao menos um critério útil (cargo OU lotação).
                if (vaga.JobPositionId.HasValue)
                    query = query.Where(x => x.JobPositionId == vaga.JobPositionId.Value);
                if (vaga.UnidadeLotacaoId.HasValue)
                    query = query.Where(x => x.UnidadeLotacaoId == vaga.UnidadeLotacaoId.Value);
                if (vaga.CentroCustoId.HasValue)
                    query = query.Where(x => x.CentroCustoId == vaga.CentroCustoId.Value);
            }
            else
            {
                // Vaga não existe OU não tem nenhum critério → retorna vazio (JAMAIS retornar todos)
                query = query.Where(x => false);
            }
        }

        if (jobPositionId.HasValue)
            query = query.Where(x => x.JobPositionId == jobPositionId.Value);
        if (unitId.HasValue)
            query = query.Where(x => x.UnitId == unitId.Value);
        if (empresaId.HasValue)
            query = query.Where(x => x.Unit != null && x.Unit.EmpresaId == empresaId.Value);
        if (unidadeLotacaoId.HasValue)
            query = query.Where(x => x.UnidadeLotacaoId == unidadeLotacaoId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            q = q.Trim();
            var like = $"%{q}%";

            query = query.Where(x =>
                EF.Functions.Like(x.Name, like) ||
                (x.Email != null && EF.Functions.Like(x.Email, like)) ||
                (x.JobPosition != null && EF.Functions.Like(x.JobPosition.Name, like)) ||
                (x.Area != null && EF.Functions.Like(x.Area.Name, like)) ||
                (x.Unit != null && EF.Functions.Like(x.Unit.Name, like))
            );
        }

        var total = await query.CountAsync(ct);
        var skip = (page - 1) * pageSize;

        var items = await query
            .OrderBy(x => x.Name)
            .Skip(skip)
            .Take(pageSize)
            .Select(x => new FuncionarioLookupItem
            {
                Id = x.Id,
                Nome = x.Name,
                Email = x.Email,

                Cargo = x.JobPosition != null ? x.JobPosition.Name : null,
                Area = x.Area != null ? x.Area.Name : null,
                Unidade = x.Unit != null ? x.Unit.Name : null,

                Status = x.Status,

                Telefone = x.Phone,
                Headcount = x.Headcount,
                Observacao = x.Notes,

                CreatedAt = x.CreatedAtUtc,
                UpdatedAt = x.UpdatedAtUtc
            })
            .ToListAsync(ct);

        var count = items.Count;
        var hasMore = (skip + count) < total;

        return Ok(new LookupResponse<FuncionarioLookupItem>
        {
            Items = items,
            Total = total,
            HasMore = hasMore
        });
    }

    /// <summary>
    /// Lista enums gerais do sistema (candidatos, vagas, filtros e relatórios).
    /// </summary>
    [HttpGet("enums")]
    [ProducesResponseType(typeof(Dictionary<string, IReadOnlyList<EnumOptionResponse>>), StatusCodes.Status200OK)]
    public ActionResult<Dictionary<string, IReadOnlyList<EnumOptionResponse>>> Enums()
    {
        var candidatoStatus = BuildEnumOptions<CandidateStatus>();
        var candidatoDocumentoTipo = BuildEnumOptions<CandidateDocumentType>();

        var vagaStatus = BuildEnumOptions<VagaStatus>(moveZeroToEnd: true);
        var vagaModalidade = BuildEnumOptions<VagaModalidade>();
        var vagaSenioridade = BuildEnumOptions<VagaSenioridade>(moveZeroToEnd: true);
        var vagaArea = BuildEnumOptions<VagaArea>(moveZeroToEnd: true);
        var vagaAreaTime = BuildEnumOptions<VagaAreaTime>(moveZeroToEnd: true);
        var vagaTipoContratacao = BuildEnumOptions<VagaTipoContratacao>(moveZeroToEnd: true);
        var vagaMotivoAbertura = BuildEnumOptions<VagaMotivoAbertura>(moveZeroToEnd: true);
        var vagaOrcamentoAprovado = BuildEnumOptions<VagaOrcamentoAprovado>(moveZeroToEnd: true);
        var vagaPrioridade = BuildEnumOptions<VagaPrioridade>(moveZeroToEnd: true);
        var vagaRegimeJornada = BuildEnumOptions<VagaRegimeJornada>(moveZeroToEnd: true);
        var vagaEscalaTrabalho = BuildEnumOptions<VagaEscalaTrabalho>(moveZeroToEnd: true);
        var vagaMoeda = BuildEnumOptions<VagaMoeda>();
        var vagaRemuneracaoPeriodicidade = BuildEnumOptions<VagaRemuneracaoPeriodicidade>();
        var vagaBonusTipo = BuildEnumOptions<VagaBonusTipo>(moveZeroToEnd: true);
        var vagaBeneficioTipo = BuildEnumOptions<VagaBeneficioTipo>();
        var vagaBeneficioRecorrencia = BuildEnumOptions<VagaBeneficioRecorrencia>();
        var vagaEscolaridade = BuildEnumOptions<VagaEscolaridade>(moveZeroToEnd: true);
        var vagaFormacaoArea = BuildEnumOptions<VagaFormacaoArea>(moveZeroToEnd: true);
        var vagaRequisitoNivel = BuildEnumOptions<VagaRequisitoNivel>();
        var vagaRequisitoAvaliacao = BuildEnumOptions<VagaRequisitoAvaliacao>();
        var vagaEtapaResponsavel = BuildEnumOptions<VagaEtapaResponsavel>();
        var vagaEtapaModo = BuildEnumOptions<VagaEtapaModo>();
        var vagaPerguntaTipo = BuildEnumOptions<VagaPerguntaTipo>();
        var vagaPeso = BuildPesoOptions();
        var vagaPublicacaoVisibilidade = BuildEnumOptions<VagaPublicacaoVisibilidade>(moveZeroToEnd: true);
        var vagaGeneroPreferencia = BuildEnumOptions<VagaGeneroPreferencia>(moveZeroToEnd: true);

        var selectPlaceholder = _localizer["Lookup.SelectPlaceholder"].Value;
        var statusFilterAll = _localizer["Lookup.StatusFilterAll"].Value;
        var areaFilterAll = _localizer["Lookup.AreaFilterAll"].Value;
        var vagaFilterAll = _localizer["Lookup.VagaFilterAll"].Value;
        var allFeminine = _localizer["Lookup.AllFeminine"].Value;
        var allMasculine = _localizer["Lookup.AllMasculine"].Value;
        var origemFilterAll = _localizer["Lookup.OrigemFilterAll"].Value;

        var labelEmail = _localizer["ControllerLabels.Email"].Value;
        var labelPasta = _localizer["ControllerLabels.Pasta"].Value;
        var labelUpload = _localizer["ControllerLabels.Upload"].Value;
        var labelOutros = _localizer["ControllerLabels.Outros"].Value;

        var statusNovo = _localizer["ControllerLabels.StatusNovo"].Value;
        var statusProcessando = _localizer["ControllerLabels.StatusProcessando"].Value;
        var statusProcessado = _localizer["ControllerLabels.StatusProcessado"].Value;
        var statusFalha = _localizer["ControllerLabels.StatusFalha"].Value;
        var statusDescartado = _localizer["ControllerLabels.StatusDescartado"].Value;

        var requisitoCompetencia = _localizer["Lookup.RequirementCategoryCompetencia"].Value;
        var requisitoExperiencia = _localizer["Lookup.RequirementCategoryExperiencia"].Value;
        var requisitoFormacao = _localizer["Lookup.RequirementCategoryFormacao"].Value;
        var requisitoFerramenta = _localizer["Lookup.RequirementCategoryFerramentaTecnologia"].Value;
        var requisitoIdioma = _localizer["Lookup.RequirementCategoryIdioma"].Value;
        var requisitoCertificacao = _localizer["Lookup.RequirementCategoryCertificacao"].Value;
        var requisitoLocalidade = _localizer["Lookup.RequirementCategoryLocalidade"].Value;

        var sortMatchDesc = _localizer["Lookup.SortMatchDesc"].Value;
        var sortMatchAsc = _localizer["Lookup.SortMatchAsc"].Value;
        var sortUpdatedDesc = _localizer["Lookup.SortUpdatedDesc"].Value;
        var sortUpdatedAsc = _localizer["Lookup.SortUpdatedAsc"].Value;
        var sortNameAsc = _localizer["Lookup.SortNameAsc"].Value;

        var reportPeriod7d = _localizer["Lookup.ReportPeriod7d"].Value;
        var reportPeriod30d = _localizer["Lookup.ReportPeriod30d"].Value;
        var reportPeriod90d = _localizer["Lookup.ReportPeriod90d"].Value;
        var reportPeriodYtd = _localizer["Lookup.ReportPeriodYtd"].Value;

        var reportFrequencyDaily = _localizer["Lookup.ReportFrequencyDaily"].Value;
        var reportFrequencyWeekly = _localizer["Lookup.ReportFrequencyWeekly"].Value;
        var reportFrequencyMonthly = _localizer["Lookup.ReportFrequencyMonthly"].Value;

        var userStatusActive = _localizer["Lookup.UserStatusActive"].Value;
        var userStatusInvited = _localizer["Lookup.UserStatusInvited"].Value;
        var userStatusDisabled = _localizer["Lookup.UserStatusDisabled"].Value;

        var mfaDisabled = _localizer["Lookup.MfaDisabled"].Value;
        var mfaEnabled = _localizer["Lookup.MfaEnabled"].Value;

        var triagemActionApprove = _localizer["Lookup.TriagemActionApprove"].Value;
        var triagemActionPending = _localizer["Lookup.TriagemActionPending"].Value;
        var triagemActionReject = _localizer["Lookup.TriagemActionReject"].Value;
        var triagemActionKeep = _localizer["Lookup.TriagemActionKeep"].Value;

        var optionalLabel = _localizer["Lookup.OptionalLabel"].Value;
        var triagemReasonMissingMandatory = _localizer["Lookup.TriagemReasonMissingMandatory"].Value;
        var triagemReasonBelowThreshold = _localizer["Lookup.TriagemReasonBelowThreshold"].Value;
        var triagemReasonProfileFit = _localizer["Lookup.TriagemReasonProfileFit"].Value;
        var triagemReasonNeedsValidation = _localizer["Lookup.TriagemReasonNeedsValidation"].Value;
        var triagemReasonLowExperience = _localizer["Lookup.TriagemReasonLowExperience"].Value;
        var triagemReasonLocationAvailability = _localizer["Lookup.TriagemReasonLocationAvailability"].Value;

        var result = new Dictionary<string, IReadOnlyList<EnumOptionResponse>>
        {
            ["selectPlaceholder"] = BuildStaticOptions(("", selectPlaceholder)),

            ["candidatoStatus"] = candidatoStatus,
            ["candidatoStatusFilter"] = BuildFilterOptions(statusFilterAll, candidatoStatus),
            ["candidatoFonte"] = BuildEnumOptions<CandidateOrigin>(),
            ["candidatoDocumentoTipo"] = candidatoDocumentoTipo,

            ["vagaStatus"] = vagaStatus,
            ["vagaStatusFilter"] = BuildFilterOptions(statusFilterAll, vagaStatus),
            ["vagaArea"] = vagaArea,
            ["vagaAreaFilter"] = BuildStaticOptions(("all", areaFilterAll)),
            ["vagaModalidade"] = vagaModalidade,
            ["vagaSenioridade"] = vagaSenioridade,
            ["vagaDepartamento"] = BuildEnumOptions<VagaDepartamento>(moveZeroToEnd: true),
            ["vagaAreaTime"] = vagaAreaTime,
            ["vagaTipoContratacao"] = vagaTipoContratacao,
            ["vagaMotivoAbertura"] = vagaMotivoAbertura,
            ["vagaOrcamentoAprovado"] = vagaOrcamentoAprovado,
            ["vagaPrioridade"] = vagaPrioridade,
            ["vagaRegimeJornada"] = vagaRegimeJornada,
            ["vagaEscalaTrabalho"] = vagaEscalaTrabalho,
            ["vagaMoeda"] = vagaMoeda,
            ["vagaRemuneracaoPeriodicidade"] = vagaRemuneracaoPeriodicidade,
            ["vagaBonusTipo"] = vagaBonusTipo,
            ["vagaBeneficioTipo"] = vagaBeneficioTipo,
            ["vagaBeneficioRecorrencia"] = vagaBeneficioRecorrencia,
            ["vagaEscolaridade"] = vagaEscolaridade,
            ["vagaFormacaoArea"] = vagaFormacaoArea,
            ["vagaRequisitoNivel"] = vagaRequisitoNivel,
            ["vagaRequisitoAvaliacao"] = vagaRequisitoAvaliacao,
            ["vagaEtapaResponsavel"] = vagaEtapaResponsavel,
            ["vagaEtapaModo"] = vagaEtapaModo,
            ["vagaPerguntaTipo"] = vagaPerguntaTipo,
            ["vagaPeso"] = vagaPeso,
            ["vagaPublicacaoVisibilidade"] = vagaPublicacaoVisibilidade,
            ["vagaGeneroPreferencia"] = vagaGeneroPreferencia,
            ["vagaFilter"] = BuildStaticOptions(("all", vagaFilterAll)),
            ["vagaFilterSimple"] = BuildStaticOptions(("all", allFeminine)),

            ["requisitoCategoria"] = BuildStaticOptions(
                ("competencia", requisitoCompetencia),
                ("experiencia", requisitoExperiencia),
                ("formacao", requisitoFormacao),
                ("ferramenta_tecnologia", requisitoFerramenta),
                ("idioma", requisitoIdioma),
                ("certificacao", requisitoCertificacao),
                ("localidade", requisitoLocalidade),
                ("outros", labelOutros)
            ),

            ["matchingSort"] = BuildStaticOptions(
                ("score_desc", sortMatchDesc),
                ("score_asc", sortMatchAsc),
                ("updated_desc", sortUpdatedDesc),
                ("updated_asc", sortUpdatedAsc),
                ("name_asc", sortNameAsc)
            ),

            ["origemFilter"] = BuildStaticOptions(
                ("all", origemFilterAll),
                ("email", labelEmail),
                ("pasta", labelPasta),
                ("upload", labelUpload)
            ),
            ["origemFilterSimple"] = BuildStaticOptions(
                ("all", allFeminine),
                ("email", labelEmail),
                ("pasta", labelPasta),
                ("upload", labelUpload)
            ),

            ["inboxStatusFilter"] = BuildStaticOptions(
                ("all", statusFilterAll),
                ("novo", statusNovo),
                ("processando", statusProcessando),
                ("processado", statusProcessado),
                ("falha", statusFalha),
                ("descartado", statusDescartado)
            ),
            ["inboxStatusFilterSimple"] = BuildStaticOptions(
                ("all", allMasculine),
                ("novo", statusNovo),
                ("processando", statusProcessando),
                ("processado", statusProcessado),
                ("falha", statusFalha),
                ("descartado", statusDescartado)
            ),

            ["relatorioPeriodo"] = BuildStaticOptions(
                ("7d", reportPeriod7d),
                ("30d", reportPeriod30d),
                ("90d", reportPeriod90d),
                ("ytd", reportPeriodYtd)
            ),
            ["relatorioFrequencia"] = BuildStaticOptions(
                ("daily", reportFrequencyDaily),
                ("weekly", reportFrequencyWeekly),
                ("monthly", reportFrequencyMonthly)
            ),

            ["usuarioStatus"] = BuildStaticOptions(
                ("active", userStatusActive),
                ("invited", userStatusInvited),
                ("disabled", userStatusDisabled)
            ),
            ["usuarioStatusFilter"] = BuildStaticOptions(
                ("all", allMasculine),
                ("active", userStatusActive),
                ("invited", userStatusInvited),
                ("disabled", userStatusDisabled)
            ),
            ["usuarioMfaOption"] = BuildStaticOptions(
                ("false", mfaDisabled),
                ("true", mfaEnabled)
            ),
            ["roleFilter"] = BuildStaticOptions(("all", allMasculine)),

            ["triagemDecisionAction"] = BuildStaticOptions(
                ("aprovado", triagemActionApprove),
                ("pendente", triagemActionPending),
                ("reprovado", triagemActionReject),
                ("triagem", triagemActionKeep)
            ),
            ["triagemDecisionReason"] = BuildStaticOptions(
                ("", optionalLabel),
                ("missing_mandatory", triagemReasonMissingMandatory),
                ("below_threshold", triagemReasonBelowThreshold),
                ("profile_fit", triagemReasonProfileFit),
                ("needs_validation", triagemReasonNeedsValidation),
                ("low_experience", triagemReasonLowExperience),
                ("location_availability", triagemReasonLocationAvailability)
            ),

            ["tipoIntegracao"] = BuildEnumOptions<TipoIntegracao>(),
            ["tipoPagamentoExtra"] = BuildEnumOptions<TipoPagamentoExtra>()
        };

        return Ok(result);
    }

    /// <summary>
    /// Lista perfis (roles) ativos do sistema.
    /// </summary>
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles(CancellationToken ct)
    {
        var roles = await _db.Set<ApplicationRole>()
            .AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .Select(r => new { id = r.Id, name = r.Name, tipo = r.Tipo })
            .ToListAsync(ct);
        return Ok(roles);
    }

    /// <summary>
    /// Lista tipos de integração TOTVS com o procedure (.p) correspondente.
    /// </summary>
    [HttpGet("tipos-integracao")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(IReadOnlyList<TipoIntegracaoMapResponse>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<TipoIntegracaoMapResponse>> TiposIntegracao()
    {
        var items = Enum.GetValues<TipoIntegracao>()
            .Select(t => new TipoIntegracaoMapResponse(
                (short)t,
                t.ToString(),
                t.ToDescription(),
                t.ToProcedureName()))
            .ToList();

        return Ok(items);
    }

    private static IReadOnlyList<EnumOptionResponse> BuildEnumOptions<TEnum>(
        bool lowerCaseCode = true,
        bool moveZeroToEnd = false)
        where TEnum : struct, Enum
    {
        var values = Enum.GetValues<TEnum>().ToList();

        if (moveZeroToEnd)
        {
            values = values
                .OrderBy(v => Convert.ToInt32(v) == 0 ? int.MaxValue : Convert.ToInt32(v))
                .ToList();
        }

        return values.Select(value =>
        {
            var code = value.ToString();
            var text = HumanizeEnum(code);
            if (lowerCaseCode)
            {
                code = code.ToLowerInvariant();
            }
            return new EnumOptionResponse(code, text);
        }).ToList();
    }

    private static IReadOnlyList<EnumOptionResponse> BuildPesoOptions()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Um"] = "1",
            ["Dois"] = "2",
            ["Tres"] = "3",
            ["Quatro"] = "4",
            ["Cinco"] = "5"
        };

        return Enum.GetValues<VagaPeso>()
            .Select(value =>
            {
                var rawCode = value.ToString();
                var text = map.TryGetValue(rawCode, out var label) ? label : HumanizeEnum(rawCode);
                var code = rawCode.ToLowerInvariant();
                return new EnumOptionResponse(code, text);
            })
            .ToList();
    }

    private static IReadOnlyList<EnumOptionResponse> BuildFilterOptions(
        string allText,
        IReadOnlyList<EnumOptionResponse> items)
    {
        var list = new List<EnumOptionResponse>
        {
            new("all", allText)
        };
        list.AddRange(items);
        return list;
    }

    private static IReadOnlyList<EnumOptionResponse> BuildStaticOptions(params (string Code, string Text)[] items)
    {
        return items.Select(item => new EnumOptionResponse(item.Code, item.Text)).ToList();
    }

    private static string HumanizeEnum(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        var spaced = Regex.Replace(value, "([a-z0-9])([A-Z])", "$1 $2");
        return spaced.Replace("Nao ", "Nao ");
    }
}
