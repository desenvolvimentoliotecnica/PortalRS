using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public sealed class SolicitacaoVagaRmImportService : ISolicitacaoVagaRmImportService
{
    private static readonly int[] CodStatusPadraoImportacao = [1, 3];

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IRmRequisicoesReadService _rmRead;
    private readonly IRmRequisicaoParecerReadService _parecerRead;
    private readonly ISolicitacaoVagaService _solicitacaoVagaService;
    private readonly ILogger<SolicitacaoVagaRmImportService> _logger;

    public SolicitacaoVagaRmImportService(
        AppDbContext db,
        ITenantContext tenantContext,
        IRmRequisicoesReadService rmRead,
        IRmRequisicaoParecerReadService parecerRead,
        ISolicitacaoVagaService solicitacaoVagaService,
        ILogger<SolicitacaoVagaRmImportService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _rmRead = rmRead;
        _parecerRead = parecerRead;
        _solicitacaoVagaService = solicitacaoVagaService;
        _logger = logger;
    }

    public async Task<RmRequisicaoImportResponse> ImportarAprovadasAsync(RmRequisicaoImportRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("TenantId ausente para importação de requisições RM.");

        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (config?.RequisicoesVagaOrigemRm != true)
            return new RmRequisicaoImportResponse(0, 0, 0, 0, 0, 0, ["Importação ignorada: flag RequisicoesVagaOrigemRm desligada para o tenant."]);

        var maps = await _db.RmRequisicaoStatusMaps
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId)
            .ToListAsync(ct);

        var rmRows = await _rmRead.ListAsync(new RmRequisicaoListQuery
        {
            Page = 1,
            PageSize = Math.Clamp(request.PageSize < 1 ? 100 : request.PageSize, 1, 500),
            TipoRequisicao = request.TipoRequisicao,
            DataAberturaDe = request.DataAberturaDe,
            DataAberturaAte = request.DataAberturaAte,
            CodStatusIn = request.CodStatusIn is { Length: > 0 }
                ? request.CodStatusIn
                : CodStatusPadraoImportacao,
        }, ct);

        var criados = 0;
        var atualizados = 0;
        var vagasCriadas = 0;
        var ignorados = 0;
        var erros = 0;
        var mensagens = new List<string>();

        foreach (var row in rmRows.Items)
        {
            try
            {
                ImportLineResult result;
                if (RmRequisicaoTipos.IsImportavelComoSolicitacaoDesligamento(row.TipoRequisicao))
                    result = await ImportarLinhaDesligamentoAsync(row, maps, tenantId, ct);
                else if (RmRequisicaoTipos.IsImportavelComoSolicitacaoVaga(row.TipoRequisicao))
                    result = await ImportarLinhaVagaAsync(row, maps, tenantId, ct);
                else
                    result = ImportLineResult.Ignored($"{BuildHumanKey(row)}: tipo {row.TipoRequisicao} não importável.");

                switch (result.Status)
                {
                    case ImportLineStatus.Created:
                        criados++;
                        if (result.VagaCriada) vagasCriadas++;
                        break;
                    case ImportLineStatus.Updated:
                        atualizados++;
                        if (result.VagaCriada) vagasCriadas++;
                        break;
                    case ImportLineStatus.Ignored:
                        ignorados++;
                        break;
                }

                if (!string.IsNullOrWhiteSpace(result.Message))
                    mensagens.Add(result.Message);
            }
            catch (Exception ex)
            {
                erros++;
                var chave = BuildHumanKey(row);
                mensagens.Add($"{chave}: erro ao importar ({ex.Message}).");
                _logger.LogError(ex, "Erro ao importar requisição RM {Tipo}/{CodCol}/{IdReq}", row.TipoRequisicao, row.Codcolrequisicao, row.Idreq);
            }
        }

        var (pareceresRefreshOk, pareceresRefreshFail, pareceresRefreshMsgs) =
            await RefreshPareceresSolicitacoesExistentesAsync(
                Math.Clamp(request.PageSize < 1 ? 100 : request.PageSize, 1, 500),
                ct);
        mensagens.AddRange(pareceresRefreshMsgs);
        if (pareceresRefreshFail > 0)
            erros += pareceresRefreshFail;
        if (pareceresRefreshOk > 0 || pareceresRefreshFail > 0)
        {
            mensagens.Insert(
                0,
                $"Refresh pareceres existentes: ok={pareceresRefreshOk}, falhas={pareceresRefreshFail}.");
        }

        return new RmRequisicaoImportResponse(rmRows.Items.Count, criados, atualizados, vagasCriadas, ignorados, erros, mensagens);
    }

    private async Task<ImportLineResult> ImportarLinhaVagaAsync(
        RmRequisicaoRowDto row,
        IReadOnlyList<RmRequisicaoStatusMap> maps,
        string tenantId,
        CancellationToken ct)
    {
        if (!row.Codcolrequisicao.HasValue || row.Idreq <= 0 || string.IsNullOrWhiteSpace(row.TipoRequisicao))
            return ImportLineResult.Ignored($"{BuildHumanKey(row)}: vínculo RM incompleto.");

        if (!TryResolveMappedStatus(row, maps, out var mappedStatus, out var statusError))
            return statusError!;

        var rmCodigo = RmPortalRequisicaoVinculo.Build(row.TipoRequisicao.Trim(), row.Codcolrequisicao.Value, row.Idreq);
        var now = DateTimeOffset.UtcNow;
        var entity = await _db.SolicitacoesVaga.FirstOrDefaultAsync(s => s.RmRequisicaoCodigo == rmCodigo, ct);
        var created = entity is null;
        var vagaAntes = entity?.VagaId;

        if (entity is null)
        {
            var solicitante = await ResolveSolicitanteAsync(row, ct);
            if (solicitante is null)
                return ImportLineResult.Ignored($"{BuildHumanKey(row)}: requisitante RM não encontrado no Portal.");

            var dataAberturaRm = ResolveDataAberturaRm(row, now);
            entity = new SolicitacaoVaga
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SolicitanteId = solicitante.Id,
                CreatedAtUtc = dataAberturaRm,
            };
            _db.SolicitacoesVaga.Add(entity);
        }

        await MapRowAsync(entity, row, mappedStatus, now, ct);
        await _db.SaveChangesAsync(ct);

        await _solicitacaoVagaService.GarantirVagaRascunhoParaSolicitacaoAprovadaAsync(entity.Id, ct);
        await SincronizarTituloVagaVinculadaAsync(entity, now, ct);
        var parecerResult = await ImportarPareceresAsync(
            entity,
            row.TipoRequisicao!.Trim(),
            row.Codcolrequisicao!.Value,
            row.Idreq,
            now,
            ct);
        await _db.Entry(entity).ReloadAsync(ct);

        var vagaCriada = !vagaAntes.HasValue && entity.VagaId.HasValue;
        var status = created ? ImportLineStatus.Created : ImportLineStatus.Updated;
        var parecerMsg = parecerResult.Ok
            ? $"{parecerResult.Count} parecer(es)"
            : $"pareceres falharam ({parecerResult.Error})";
        return new ImportLineResult(
            status,
            vagaCriada,
            $"{BuildHumanKey(row)}: {(created ? "importada" : "atualizada")} e vaga {(vagaCriada ? "criada" : "mantida")}; {parecerMsg}.");
    }

    private async Task<ImportLineResult> ImportarLinhaDesligamentoAsync(
        RmRequisicaoRowDto row,
        IReadOnlyList<RmRequisicaoStatusMap> maps,
        string tenantId,
        CancellationToken ct)
    {
        if (!row.Codcolrequisicao.HasValue || row.Idreq <= 0 || string.IsNullOrWhiteSpace(row.TipoRequisicao))
            return ImportLineResult.Ignored($"{BuildHumanKey(row)}: vínculo RM incompleto.");

        if (!TryResolveMappedStatus(row, maps, out var mappedStatus, out var statusError))
            return statusError!;

        var funcionario = await ResolveFuncionarioDesligamentoAsync(row, ct);
        if (funcionario is null)
        {
            var chapa = row.ChapaFuncionario?.Trim();
            return ImportLineResult.Ignored(
                $"{BuildHumanKey(row)}: funcionário RM{(string.IsNullOrWhiteSpace(chapa) ? "" : $" (chapa {chapa})")} não encontrado no Portal.");
        }

        var rmCodigo = RmPortalRequisicaoVinculo.Build(row.TipoRequisicao.Trim(), row.Codcolrequisicao.Value, row.Idreq);
        var now = DateTimeOffset.UtcNow;
        var entity = await _db.SolicitacoesDesligamento.FirstOrDefaultAsync(s => s.RmRequisicaoCodigo == rmCodigo, ct);
        var created = entity is null;

        if (entity is null)
        {
            var solicitante = await ResolveSolicitanteAsync(row, ct);
            if (solicitante is null)
                return ImportLineResult.Ignored($"{BuildHumanKey(row)}: requisitante RM não encontrado no Portal.");

            entity = new SolicitacaoDesligamento
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SolicitanteId = solicitante.Id,
                FuncionarioId = funcionario.Id,
                CreatedAtUtc = ResolveDataAberturaRm(row, now),
            };
            _db.SolicitacoesDesligamento.Add(entity);
        }

        await MapDesligamentoRowAsync(entity, row, mappedStatus, funcionario, now, ct);
        await _db.SaveChangesAsync(ct);

        var status = created ? ImportLineStatus.Created : ImportLineStatus.Updated;
        return new ImportLineResult(
            status,
            false,
            $"{BuildHumanKey(row)}: solicitação de desligamento {(created ? "importada" : "atualizada")} (IDREQ {row.Idreq}).");
    }

    private static bool TryResolveMappedStatus(
        RmRequisicaoRowDto row,
        IReadOnlyList<RmRequisicaoStatusMap> maps,
        out SolicitacaoStatus mappedStatus,
        out ImportLineResult? error)
    {
        mappedStatus = default;
        error = null;

        var map = row.Codstatus.HasValue
            ? RmRequisicaoStatusMapResolver.ResolveFirst(maps, row.Codstatus.Value)
            : null;

        if (map is null || !RmRequisicaoStatusMapResolver.TryParsePortalStatus(map, out mappedStatus))
        {
            error = ImportLineResult.Ignored($"{BuildHumanKey(row)}: CODSTATUS {row.Codstatus?.ToString() ?? "null"} sem mapa válido.");
            return false;
        }

        if (mappedStatus is not (SolicitacaoStatus.Aprovada or SolicitacaoStatus.Concluida))
        {
            error = ImportLineResult.Ignored($"{BuildHumanKey(row)}: status RM mapeado para {mappedStatus}, não aprovado.");
            return false;
        }

        return true;
    }

    private async Task<(int Ok, int Fail, List<string> Messages)> RefreshPareceresSolicitacoesExistentesAsync(
        int maxPerRun,
        CancellationToken ct)
    {
        var limit = Math.Clamp(maxPerRun, 1, 500);
        var existentes = await _db.SolicitacoesVaga
            .Where(s => s.RmIdReq != null && s.RmIdReq > 0 && s.RmCodColRequisicao != null && s.RmCodColRequisicao > 0)
            .OrderByDescending(s => s.UpdatedAtUtc)
            .Take(limit)
            .ToListAsync(ct);

        var ok = 0;
        var fail = 0;
        var messages = new List<string>();
        var now = DateTimeOffset.UtcNow;

        foreach (var entity in existentes)
        {
            var tipo = ResolveTipoRequisicaoRm(entity);
            if (string.IsNullOrWhiteSpace(tipo)
                || !RmRequisicaoTipos.IsImportavelComoSolicitacaoVaga(tipo)
                || !entity.RmCodColRequisicao.HasValue
                || !entity.RmIdReq.HasValue)
            {
                continue;
            }

            var result = await ImportarPareceresAsync(
                entity,
                tipo,
                entity.RmCodColRequisicao.Value,
                entity.RmIdReq.Value,
                now,
                ct);

            if (result.Ok)
            {
                ok++;
                if (result.Count > 0)
                    messages.Add($"{tipo}|{entity.RmCodColRequisicao}|{entity.RmIdReq}: refresh {result.Count} parecer(es).");
            }
            else
            {
                fail++;
                messages.Add($"{tipo}|{entity.RmCodColRequisicao}|{entity.RmIdReq}: falha no refresh de pareceres ({result.Error}).");
            }
        }

        return (ok, fail, messages);
    }

    private async Task<ParecerImportResult> ImportarPareceresAsync(
        SolicitacaoVaga entity,
        string tipoRequisicao,
        int codColRequisicao,
        int idReq,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (codColRequisicao <= 0 || idReq <= 0 || string.IsNullOrWhiteSpace(tipoRequisicao))
            return ParecerImportResult.Skipped("vínculo RM incompleto");

        var tipo = tipoRequisicao.Trim();
        IReadOnlyList<RmRequisicaoParecerRowDto> pareceres;
        try
        {
            pareceres = await _parecerRead.ListAsync(tipo, codColRequisicao, idReq, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao importar pareceres RM {Tipo}/{CodCol}/{IdReq}", tipo, codColRequisicao, idReq);
            return ParecerImportResult.Failed(ex.Message);
        }

        foreach (var parecer in pareceres)
        {
            var existing = await _db.RmRequisicaoPareceres.FirstOrDefaultAsync(x =>
                x.TipoRequisicao == tipo
                && x.CodColRequisicao == (short)parecer.CodColRequisicao
                && x.IdReq == parecer.IdReq
                && x.IdParecer == parecer.IdParecer, ct);

            if (existing is null)
            {
                existing = new RmRequisicaoParecer
                {
                    Id = Guid.NewGuid(),
                    TenantId = entity.TenantId,
                    TipoRequisicao = tipo,
                    CodColRequisicao = (short)parecer.CodColRequisicao,
                    IdReq = parecer.IdReq,
                    IdParecer = parecer.IdParecer,
                    CreatedAtUtc = now,
                };
                _db.RmRequisicaoPareceres.Add(existing);
            }

            existing.SolicitacaoVagaId = entity.Id;
            existing.DataParecer = parecer.DataParecer;
            existing.CodStatus = (short?)parecer.CodStatus;
            existing.Suspensao = (short?)parecer.Suspensao;
            existing.Solicitante = TrimTo(parecer.Solicitante, 200);
            existing.Img1 = (short?)parecer.Img1;
            existing.CodColSolicitante = (short?)parecer.CodColSolicitante;
            existing.ChapaSolicitante = TrimTo(parecer.ChapaSolicitante, 30);
            existing.Parecer = TrimTo(parecer.Parecer, 4000);
            existing.Status = TrimTo(parecer.Status, 120);
            existing.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return ParecerImportResult.Succeeded(pareceres.Count);
    }

    private static string? ResolveTipoRequisicaoRm(SolicitacaoVaga entity)
    {
        var fromCodigo = RmRequisicaoTipos.TryParseTipoFromVinculo(entity.RmRequisicaoCodigo);
        if (!string.IsNullOrWhiteSpace(fromCodigo))
            return fromCodigo;

        return entity.TipoSolicitacao switch
        {
            TipoSolicitacaoVaga.Substituicao => RmRequisicaoTipos.Substituicao,
            TipoSolicitacaoVaga.AumentoQuadro => RmRequisicaoTipos.AumentoQuadro,
            _ => null,
        };
    }

    private readonly record struct ParecerImportResult(bool Ok, int Count, string? Error)
    {
        public static ParecerImportResult Succeeded(int count) => new(true, count, null);
        public static ParecerImportResult Failed(string error) => new(false, 0, error);
        public static ParecerImportResult Skipped(string reason) => new(true, 0, reason);
    }

    private async Task MapRowAsync(SolicitacaoVaga entity, RmRequisicaoRowDto row, SolicitacaoStatus status, DateTimeOffset now, CancellationToken ct)
    {
        entity.Titulo = RmFuncaoTituloBuilder.Build(row.Codfuncao, row.NomeFuncao, row.DescricaoFuncao);
        entity.Justificativa = TrimTo(row.Justificativa, 2000);
        entity.QtdPosicoes = Math.Max(1, row.Numvagas ?? 1);
        entity.Status = status == SolicitacaoStatus.Concluida ? SolicitacaoStatus.Aprovada : status;
        entity.ApprovedAtUtc ??= now;
        entity.CreatedAtUtc = ResolveDataAberturaRm(row, entity.CreatedAtUtc);
        entity.UpdatedAtUtc = now;
        entity.TipoSolicitacao = MapTipoSolicitacao(row.TipoRequisicao)
            ?? throw new InvalidOperationException($"Tipo RM inesperado na importação: {row.TipoRequisicao}");
        entity.TipoContrato = TipoContratoVaga.CLT;
        entity.DecisaoRH = TipoDecisaoHeadcount.AumentoDefinitivo;
        entity.CodFuncaoRm = TrimTo(row.Codfuncao, 20);
        entity.FuncaoNomeRm = TrimTo(await ResolveFuncaoNomeRmAsync(row, ct), 160);
        entity.FaixaSalarialMin = row.Vlrsalario;
        entity.FaixaSalarialMax = row.Vlrsalario;
        entity.RmRequisicaoCodigo = RmPortalRequisicaoVinculo.Build(row.TipoRequisicao.Trim(), row.Codcolrequisicao!.Value, row.Idreq);
        entity.RmCodColRequisicao = (short?)row.Codcolrequisicao;
        entity.RmIdReq = row.Idreq;
        entity.RmCodStatus = (short?)row.Codstatus;
        entity.RmUltimaStatusDescricaoRm = TrimTo(row.StatusDescricao, 240);
        entity.RmUltimaSincronizacaoUtc = now;
        entity.IntegracaoResultado = IntegracaoResultado.Sucesso;
        entity.IntegracaoMensagem = "Requisição importada do RM como origem aprovada.";
        entity.IntegradaEmUtc ??= now;

        entity.CentroCustoId = await ResolveCentroCustoIdAsync(row.Codccusto, row.Codsecao, ct);
        entity.UnitId = await ResolveUnitIdAsync(row.Codfilial, ct);
        entity.EmpresaId = await ResolveEmpresaIdAsync(row.Codcolrequisicao, row.Codfilial, entity.CentroCustoId, entity.UnitId, ct);
        entity.JobPositionId = await ResolveJobPositionIdAsync(row.Codfuncao, row.NomeFuncao, ct);
    }

    private async Task MapDesligamentoRowAsync(
        SolicitacaoDesligamento entity,
        RmRequisicaoRowDto row,
        SolicitacaoStatus status,
        Funcionario funcionario,
        DateTimeOffset now,
        CancellationToken ct)
    {
        entity.FuncionarioId = funcionario.Id;
        entity.DataDesligamento = ResolveDataDesligamentoRm(row);
        entity.TipoDesligamento = TipoDesligamento.SemJustaCausa;
        entity.MotivoDesligamento = TrimTo(row.Justificativa, 4000)
            ?? $"Desligamento importado do RM (IDREQ {row.Idreq}).";
        entity.TipoAvisoPrevio = TipoAvisoPrevio.Indenizado;
        entity.DiasAvisoPrevio = 30;
        entity.PossuiEstabilidade = false;
        entity.ElegivelRecontratacao = false;
        entity.SubstituirPosicao = false;
        entity.Status = status == SolicitacaoStatus.Concluida ? SolicitacaoStatus.Aprovada : status;
        entity.ApprovedAtUtc ??= now;
        entity.CreatedAtUtc = ResolveDataAberturaRm(row, entity.CreatedAtUtc);
        entity.UpdatedAtUtc = now;
        entity.RmRequisicaoCodigo = RmPortalRequisicaoVinculo.Build(row.TipoRequisicao.Trim(), row.Codcolrequisicao!.Value, row.Idreq);
        entity.RmCodColRequisicao = (short?)row.Codcolrequisicao;
        entity.RmIdReq = row.Idreq;
        entity.RmCodStatus = (short?)row.Codstatus;
        entity.RmUltimaStatusDescricaoRm = TrimTo(row.StatusDescricao, 240);
        entity.RmUltimaSincronizacaoUtc = now;
        entity.IntegracaoResultado = IntegracaoResultado.Sucesso;
        entity.IntegracaoMensagem = "Desligamento importado do RM como origem aprovada.";
        entity.IntegradaEmUtc ??= now;

        var centroCustoId = funcionario.CentroCustoId
            ?? await ResolveCentroCustoIdAsync(row.Codccusto, row.Codsecao, ct);
        entity.UnitId = funcionario.UnitId ?? await ResolveUnitIdAsync(row.Codfilial, ct);
        entity.EmpresaId = await ResolveEmpresaIdAsync(row.Codcolrequisicao, row.Codfilial, centroCustoId, entity.UnitId, ct);
    }

    private static DateOnly ResolveDataDesligamentoRm(RmRequisicaoRowDto row)
    {
        var source = row.Dataprevista ?? row.Dataabertura ?? row.Reccreatedon;
        if (!source.HasValue)
            return DateOnly.FromDateTime(DateTime.UtcNow);

        var value = source.Value;
        if (value.Kind == DateTimeKind.Unspecified)
            value = DateTime.SpecifyKind(value, DateTimeKind.Local);

        return DateOnly.FromDateTime(value);
    }

    private static DateTimeOffset ResolveDataAberturaRm(RmRequisicaoRowDto row, DateTimeOffset fallback)
    {
        var source = row.Dataabertura ?? row.Reccreatedon;
        if (!source.HasValue)
            return fallback;

        var value = source.Value;
        if (value.Kind == DateTimeKind.Unspecified)
            value = DateTime.SpecifyKind(value, DateTimeKind.Local);

        return new DateTimeOffset(value).ToUniversalTime();
    }

    private async Task<Funcionario?> ResolveSolicitanteAsync(RmRequisicaoRowDto row, CancellationToken ct)
    {
        var chapa = row.Chaparequisitante?.Trim();
        if (!string.IsNullOrWhiteSpace(chapa))
        {
            var byChapa = await _db.Funcionarios
                .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
                .FirstOrDefaultAsync(f => f.MatriculaRm == chapa, ct);
            if (byChapa is not null)
                return byChapa;
        }

        var nome = row.NomeRequisitante?.Trim();
        if (!string.IsNullOrWhiteSpace(nome))
        {
            var byName = await _db.Funcionarios
                .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
                .FirstOrDefaultAsync(f => f.Name == nome, ct);
            if (byName is not null)
                return byName;
        }

        return await _db.Funcionarios
            .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
            .ThenBy(f => f.Name)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<Funcionario?> ResolveFuncionarioDesligamentoAsync(RmRequisicaoRowDto row, CancellationToken ct)
    {
        var chapa = row.ChapaFuncionario?.Trim();
        if (!string.IsNullOrWhiteSpace(chapa))
        {
            var byChapa = await _db.Funcionarios
                .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
                .FirstOrDefaultAsync(f => f.MatriculaRm == chapa, ct);
            if (byChapa is not null)
                return byChapa;
        }

        var nome = row.NomeFuncionarioEnvolvido?.Trim();
        if (!string.IsNullOrWhiteSpace(nome))
        {
            return await _db.Funcionarios
                .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
                .FirstOrDefaultAsync(f => f.Name == nome, ct);
        }

        return null;
    }

    private async Task<Guid?> ResolveCentroCustoIdAsync(string? codCcusto, string? codSecao, CancellationToken ct)
    {
        var values = new[] { codCcusto?.Trim(), codSecao?.Trim() }
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (values.Count == 0) return null;
        return await _db.CentrosCusto
            .Where(c => values.Contains(c.Code))
            .OrderByDescending(c => c.IsActive)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<Guid?> ResolveUnitIdAsync(string? code, CancellationToken ct)
    {
        var value = code?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;
        return await _db.Units
            .Where(u => u.Code == value)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<Guid?> ResolveEmpresaIdAsync(int? codColigada, string? codFilial, Guid? centroCustoId, Guid? unitId, CancellationToken ct)
    {
        if (centroCustoId.HasValue)
        {
            var empresaId = await _db.CentrosCusto
                .Where(c => c.Id == centroCustoId.Value)
                .Select(c => c.EmpresaId)
                .FirstOrDefaultAsync(ct);
            if (empresaId.HasValue) return empresaId;
        }

        if (unitId.HasValue)
        {
            var empresaId = await _db.Units
                .Where(u => u.Id == unitId.Value)
                .Select(u => u.EmpresaId)
                .FirstOrDefaultAsync(ct);
            if (empresaId.HasValue) return empresaId;
        }

        var codes = BuildEmpresaCodeCandidates(codFilial, codColigada).ToList();
        if (codes.Count == 0) return null;
        return await _db.Empresas
            .Where(e => codes.Contains(e.Code))
            .OrderByDescending(e => e.IsActive)
            .Select(e => (Guid?)e.Id)
            .FirstOrDefaultAsync(ct);
    }

    private static IEnumerable<string> BuildEmpresaCodeCandidates(string? codFilial, int? codColigada)
    {
        foreach (var code in BuildCodeCandidates(codFilial))
            yield return code;

        if (codColigada.HasValue)
        {
            foreach (var code in BuildCodeCandidates(codColigada.Value.ToString()))
                yield return code;
        }
    }

    private static IEnumerable<string> BuildCodeCandidates(string? rawCode)
    {
        var value = rawCode?.Trim();
        if (string.IsNullOrWhiteSpace(value))
            yield break;

        yield return value;

        if (int.TryParse(value, out var numeric))
        {
            yield return numeric.ToString();
            yield return numeric.ToString().PadLeft(2, '0');
        }
    }

    private async Task<string?> ResolveFuncaoNomeRmAsync(RmRequisicaoRowDto row, CancellationToken ct)
    {
        var direct = FirstNonBlank(row.NomeFuncao, row.DescricaoFuncao);
        var code = row.Codfuncao?.Trim();
        if (!string.IsNullOrWhiteSpace(direct) && !string.Equals(direct, code, StringComparison.OrdinalIgnoreCase))
            return direct;

        if (string.IsNullOrWhiteSpace(code))
            return direct;

        var local = await _db.Funcionarios
            .AsNoTracking()
            .Where(f => f.CodFuncaoRm == code && f.FuncaoNomeRm != null && f.FuncaoNomeRm != "")
            .OrderByDescending(f => f.Status == FuncionarioStatus.Active)
            .Select(f => f.FuncaoNomeRm)
            .FirstOrDefaultAsync(ct);

        return FirstNonBlank(local, direct);
    }

    private async Task SincronizarTituloVagaVinculadaAsync(SolicitacaoVaga entity, DateTimeOffset now, CancellationToken ct)
    {
        if (!entity.VagaId.HasValue)
            return;

        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Id == entity.VagaId.Value, ct);
        if (vaga is null)
            return;

        var titulo = entity.Titulo ?? RmFuncaoTituloBuilder.MissingTitulo;
        if (vaga.Titulo == titulo
            && vaga.CodFuncaoRm == entity.CodFuncaoRm
            && vaga.FuncaoNomeRm == entity.FuncaoNomeRm)
        {
            return;
        }

        vaga.Titulo = titulo;
        vaga.CodFuncaoRm = entity.CodFuncaoRm;
        vaga.FuncaoNomeRm = entity.FuncaoNomeRm;
        vaga.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<Guid?> ResolveJobPositionIdAsync(string? code, string? name, CancellationToken ct)
    {
        var codeValue = code?.Trim();
        var nameValue = name?.Trim();
        return await _db.JobPositions
            .Where(j =>
                (!string.IsNullOrWhiteSpace(codeValue) && j.Code == codeValue) ||
                (!string.IsNullOrWhiteSpace(nameValue) && j.Name == nameValue))
            .Select(j => (Guid?)j.Id)
            .FirstOrDefaultAsync(ct);
    }

    private static TipoSolicitacaoVaga? MapTipoSolicitacao(string tipo)
    {
        var value = tipo.Trim();
        if (value.Equals(RmRequisicaoTipos.Substituicao, StringComparison.OrdinalIgnoreCase))
            return TipoSolicitacaoVaga.Substituicao;
        if (value.Equals(RmRequisicaoTipos.AumentoQuadro, StringComparison.OrdinalIgnoreCase))
            return TipoSolicitacaoVaga.AumentoQuadro;
        return null;
    }

    private static string BuildHumanKey(RmRequisicaoRowDto row) =>
        $"{row.TipoRequisicao ?? "RM"}|{row.Codcolrequisicao?.ToString() ?? "?"}|{row.Idreq}";

    private static string? FirstNonBlank(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private static string? TrimTo(string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return null;
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private enum ImportLineStatus { Created, Updated, Ignored }

    private sealed record ImportLineResult(ImportLineStatus Status, bool VagaCriada, string? Message)
    {
        public static ImportLineResult Ignored(string message) => new(ImportLineStatus.Ignored, false, message);
    }
}
