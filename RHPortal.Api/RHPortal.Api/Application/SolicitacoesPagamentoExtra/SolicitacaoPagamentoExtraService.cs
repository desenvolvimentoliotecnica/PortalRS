using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.SolicitacoesPagamentoExtra;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesPagamentoExtra;

public interface ISolicitacaoPagamentoExtraService
{
    Task<IReadOnlyList<SolicitacaoPagamentoExtraGridRow>> ListAsync(SolicitacaoPagamentoExtraListQuery query, Guid? currentFuncionarioId, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse> CreateAsync(SolicitacaoPagamentoExtraCreateRequest request, Guid? solicitanteId, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> UpdateAsync(Guid id, SolicitacaoPagamentoExtraUpdateRequest request, CancellationToken ct);
    Task<bool> SubmitAsync(Guid id, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct);
    Task<SolicitacaoPagamentoExtraResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<ImportacaoPagamentoExtraPreviewResponse> PreviewImportacaoAsync(Stream xlsxStream, CancellationToken ct);
    Task<ImportacaoPagamentoExtraConfirmarResponse> ImportarAsync(ImportacaoPagamentoExtraConfirmarRequest request, Guid? solicitanteId, CancellationToken ct);
}

public sealed class SolicitacaoPagamentoExtraService : ISolicitacaoPagamentoExtraService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ApprovalWorkflowHelper _workflow;

    public SolicitacaoPagamentoExtraService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        ApprovalWorkflowHelper workflow)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _workflow = workflow;
    }

    public async Task<IReadOnlyList<SolicitacaoPagamentoExtraGridRow>> ListAsync(
        SolicitacaoPagamentoExtraListQuery query, Guid? currentFuncionarioId, CancellationToken ct)
    {
        var q = _db.SolicitacoesPagamentoExtra.AsNoTracking()
            .Include(s => s.Solicitante)
            .Include(s => s.Funcionario)
            .AsQueryable();

        if (!_currentUser.IsAdmin && !_currentUser.IsRH && currentFuncionarioId.HasValue)
        {
            var fid = currentFuncionarioId.Value;
            // Vê registros que criou OU registros de subordinados diretos (para aprovação pelo Gestor)
            q = q.Where(s =>
                s.SolicitanteId == fid ||
                _db.Funcionarios.Any(f => f.Id == s.FuncionarioId && f.GestorDiretoId == fid));
        }

        if (query.Status.HasValue)
            q = q.Where(s => s.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(s =>
                (s.Funcionario != null && s.Funcionario.Name.ToLower().Contains(term)) ||
                s.Descricao.ToLower().Contains(term));
        }

        q = q.OrderByDescending(s => s.CreatedAtUtc);

        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 100);
        q = q.Skip((page - 1) * pageSize).Take(pageSize);

        return await q.Select(s => new SolicitacaoPagamentoExtraGridRow(
            s.Id, s.Status,
            s.Solicitante != null ? s.Solicitante.Name : null,
            s.Funcionario != null ? s.Funcionario.Name : null,
            s.TipoPagamentoExtra,
            s.Valor, s.DataPagamento,
            s.CreatedAtUtc
        )).ToListAsync(ct);
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var s = await _db.SolicitacoesPagamentoExtra.AsNoTracking()
            .Include(x => x.Solicitante)
            .Include(x => x.Funcionario)
            .Include(x => x.ImportadoPor)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s is null) return null;

        var etapas = await _db.SolicitacoesAprovacaoEtapa.AsNoTracking()
            .Include(e => e.Aprovador)
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.PagamentoExtra)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var etapasResponse = await _workflow.MapEtapasToAprovacaoResponsesAsync(etapas, ct);
        return MapToResponse(s, etapasResponse);
    }

    public async Task<SolicitacaoPagamentoExtraResponse> CreateAsync(
        SolicitacaoPagamentoExtraCreateRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível criar solicitações.");

        Guid? resolvedSolicitanteId = null;
        if (solicitanteId.HasValue && solicitanteId.Value != Guid.Empty)
        {
            var exists = await _db.Set<Funcionario>().AsNoTracking().AnyAsync(f => f.Id == solicitanteId.Value, ct);
            if (exists)
                resolvedSolicitanteId = solicitanteId.Value;
            else if (!_currentUser.IsAdmin)
                throw new InvalidOperationException("Funcionário solicitante não encontrado. Verifique se o usuário possui um cadastro de funcionário vinculado.");
        }
        else if (!_currentUser.IsAdmin)
            throw new InvalidOperationException("Funcionário solicitante não encontrado. Verifique se o usuário possui um cadastro de funcionário vinculado.");

        var now = DateTimeOffset.UtcNow;
        var entity = new SolicitacaoPagamentoExtra
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            SolicitanteId = resolvedSolicitanteId,
            FuncionarioId = request.FuncionarioId,
            TipoPagamentoExtra = request.TipoPagamentoExtra,
            Valor = request.Valor,
            Descricao = request.Descricao,
            DataPagamento = request.DataPagamento,
            Competencia = request.Competencia,
            Observacoes = request.Observacoes,
            Status = SolicitacaoStatus.Rascunho,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        if (request.ImportadoPorId.HasValue)
        {
            entity.ImportadoPorId = request.ImportadoPorId;
            entity.ImportadaEmUtc = now;
        }

        _db.SolicitacoesPagamentoExtra.Add(entity);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> UpdateAsync(
        Guid id, SolicitacaoPagamentoExtraUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.FuncionarioId = request.FuncionarioId;
        entity.TipoPagamentoExtra = request.TipoPagamentoExtra;
        entity.Valor = request.Valor;
        entity.Descricao = request.Descricao;
        entity.DataPagamento = request.DataPagamento;
        entity.Competencia = request.Competencia;
        entity.Observacoes = request.Observacoes;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> SubmitAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanEdit(entity.Status);

        entity.Status = SolicitacaoStatus.PendenteAprovacao;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Remove etapas anteriores (para re-submit após ajustes)
        var existingEtapas = _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.PagamentoExtra);
        _db.SolicitacoesAprovacaoEtapa.RemoveRange(existingEtapas);

        // Usa FuncionarioId como referência para resolver o GestorDireto correto
        var resolved = await _workflow.ResolveEtapasAsync(
            entity.FuncionarioId, entity.FuncionarioId, TipoFluxoAprovacao.PagamentoExtra, ct);

        var novasEtapas = resolved.Select(r => new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SolicitacaoId = entity.Id,
            TipoFluxo = TipoFluxoAprovacao.PagamentoExtra,
            Ordem = r.Ordem,
            Label = r.Label,
            AprovadorId = r.AprovadorId,
            RoleFilaId = r.RoleFilaId,
            AcaoEtapa = r.AcaoEtapa,
            MomentoAcao = r.MomentoAcao,
            Status = StatusAprovacao.Pendente,
        }).ToList();

        _db.SolicitacoesAprovacaoEtapa.AddRange(novasEtapas);

        // Auto-avança etapas de processo automáticas (ex: EnviarIntegracao AoChegar)
        var primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault();
        while (primeiraEtapa is not null && IsProcessoStep(primeiraEtapa))
        {
            ExecutarAcaoEtapa(primeiraEtapa.AcaoEtapa, entity);
            primeiraEtapa.Status = StatusAprovacao.Aprovado;
            primeiraEtapa.DataUtc = DateTimeOffset.UtcNow;
            primeiraEtapa = novasEtapas.OrderBy(e => e.Ordem).FirstOrDefault(e => e.Ordem > primeiraEtapa.Ordem);
        }

        await _db.SaveChangesAsync(ct);

        if (primeiraEtapa is not null && primeiraEtapa.AprovadorId.HasValue)
        {
            var funcionarioNome = (await _db.Set<Funcionario>().AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct))?.Name ?? "um funcionário";
            var solicitanteNome = entity.SolicitanteId.HasValue
                ? (await _db.Set<Funcionario>().AsNoTracking().FirstOrDefaultAsync(f => f.Id == entity.SolicitanteId.Value, ct))?.Name ?? "Alguém"
                : "Alguém";

            await _workflow.NotifyByFuncionarioIdAsync(
                primeiraEtapa.AprovadorId.Value,
                "Nova solicitação de pagamento extra para aprovação",
                $"{solicitanteNome} solicitou um pagamento extra para {funcionarioNome}.",
                $"/gestao/comissoes",
                ct);
        }

        return true;
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> ApproveAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.PagamentoExtra && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is null)
            throw new InvalidOperationException("Nenhuma etapa de aprovação pendente encontrada.");

        if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
            throw new InvalidOperationException("Você não tem permissão para aprovar esta etapa.");

        // Para fila de perfil: registra quem assumiu
        if (etapaAtual.RoleFilaId.HasValue && _currentUser.FuncionarioId.HasValue)
            etapaAtual.AprovadorId = _currentUser.FuncionarioId;

        etapaAtual.Status = StatusAprovacao.Aprovado;
        etapaAtual.DataUtc = DateTimeOffset.UtcNow;
        etapaAtual.Observacao = observacao;

        var todasEtapas = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.PagamentoExtra)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > etapaAtual.Ordem && e.Status == StatusAprovacao.Pendente);
        while (proximaEtapa is not null && IsProcessoStep(proximaEtapa))
        {
            ExecutarAcaoEtapa(proximaEtapa.AcaoEtapa, entity);
            proximaEtapa.Status = StatusAprovacao.Aprovado;
            proximaEtapa.DataUtc = DateTimeOffset.UtcNow;
            proximaEtapa = todasEtapas.FirstOrDefault(e => e.Ordem > proximaEtapa.Ordem && e.Status == StatusAprovacao.Pendente);
        }

        if (proximaEtapa is not null)
        {
            entity.Status = proximaEtapa.RoleFilaId.HasValue
                ? SolicitacaoStatus.PendenteAprovacaoRh
                : SolicitacaoStatus.PendenteAprovacao;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);

            if (proximaEtapa.AprovadorId.HasValue)
            {
                await _workflow.NotifyByFuncionarioIdAsync(
                    proximaEtapa.AprovadorId.Value,
                    "Solicitação de pagamento extra aguarda sua aprovação",
                    $"A etapa anterior foi aprovada. Etapa \"{proximaEtapa.Label}\" aguarda sua ação.",
                    "/gestao/comissoes",
                    ct);
            }
        }
        else
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc = DateTimeOffset.UtcNow;
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);

            if (entity.SolicitanteId.HasValue)
                await _workflow.NotifyByFuncionarioIdAsync(
                    entity.SolicitanteId.Value,
                    "Solicitação de pagamento extra aprovada",
                    "Sua solicitação de pagamento extra foi aprovada e encaminhada para integração." + (observacao is not null ? $" Observação: {observacao}" : ""),
                    "/gestao/comissoes",
                    ct);
        }

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> RejectAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        var etapaAtual = await _db.SolicitacoesAprovacaoEtapa
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.PagamentoExtra && e.Status == StatusAprovacao.Pendente)
            .OrderBy(e => e.Ordem)
            .FirstOrDefaultAsync(ct);

        if (etapaAtual is not null)
        {
            if (!await _workflow.CanApproveStepAsync(etapaAtual, _currentUser, ct))
                throw new InvalidOperationException("Você não tem permissão para reprovar esta etapa.");

            if (etapaAtual.RoleFilaId.HasValue && _currentUser.FuncionarioId.HasValue)
                etapaAtual.AprovadorId = _currentUser.FuncionarioId;

            etapaAtual.Status = StatusAprovacao.Rejeitado;
            etapaAtual.DataUtc = DateTimeOffset.UtcNow;
            etapaAtual.Observacao = observacao;
        }

        entity.Status = SolicitacaoStatus.Reprovada;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (entity.SolicitanteId.HasValue)
            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId.Value,
                "Solicitação de pagamento extra reprovada",
                "Sua solicitação de pagamento extra foi reprovada." + (observacao is not null ? $" Motivo: {observacao}" : ""),
                "/gestao/comissoes",
                ct,
                "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<SolicitacaoPagamentoExtraResponse?> RequestChangesAsync(Guid id, string? observacao, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return null;

        ApprovalWorkflowHelper.ValidateCanApproveAny(entity.Status);

        // A etapa atual permanece Pendente — solicitante corrige e re-submete
        entity.Status = SolicitacaoStatus.AjustesNecessarios;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (entity.SolicitanteId.HasValue)
            await _workflow.NotifyByFuncionarioIdAsync(
                entity.SolicitanteId.Value,
                "Ajustes necessários na solicitação de pagamento extra",
                "Sua solicitação de pagamento extra precisa de ajustes." + (observacao is not null ? $" Observação: {observacao}" : ""),
                "/gestao/comissoes",
                ct,
                "warning");

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesPagamentoExtra.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        ApprovalWorkflowHelper.ValidateCanDelete(entity.Status);

        _db.SolicitacoesPagamentoExtra.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<ImportacaoPagamentoExtraPreviewResponse> PreviewImportacaoAsync(Stream xlsxStream, CancellationToken ct)
    {
        var parsed = ParseXlsx(xlsxStream);

        if (parsed.Count == 0)
            return new ImportacaoPagamentoExtraPreviewResponse(0, 0, 0, []);

        var matriculas = parsed
            .Where(r => !string.IsNullOrEmpty(r.Matricula))
            .Select(r => r.Matricula)
            .Distinct()
            .ToList();

        var funcionarios = await _db.Funcionarios.AsNoTracking()
            .Where(f => f.CdnFuncionario != null && matriculas.Contains(f.CdnFuncionario))
            .Select(f => new { f.Id, f.Name, f.CdnEmpresa, f.CdnEstab, f.CdnFuncionario })
            .ToListAsync(ct);

        var funcMap = funcionarios
            .Where(f => f.CdnEmpresa != null && f.CdnEstab != null && f.CdnFuncionario != null)
            .ToDictionary(
                f => (f.CdnEmpresa!.Trim(), f.CdnEstab!.Trim(), f.CdnFuncionario!.Trim()),
                f => (f.Id, f.Name));

        var linhas = new List<ImportacaoPagamentoExtraLinhaPreview>(parsed.Count);

        foreach (var row in parsed)
        {
            funcMap.TryGetValue((row.Empresa.Trim(), row.Estabelecimento.Trim(), row.Matricula.Trim()), out var found);

            Guid? funcionarioId = null;
            string? funcionarioNome = null;
            string? erro = null;

            if (found == default)
                erro = $"Funcionário não encontrado: matrícula \"{row.Matricula}\", empresa \"{row.Empresa}\", estabelecimento \"{row.Estabelecimento}\"";
            else
            {
                funcionarioId = found.Id;
                funcionarioNome = found.Name;
            }

            linhas.Add(new ImportacaoPagamentoExtraLinhaPreview(
                row.Linha, row.Empresa, row.Estabelecimento, row.Matricula,
                row.NomePlanilha, row.CargoPlanilha, row.CentroCustoPlanilha,
                row.Valor, row.PercentualDsr, row.ValorDsr, row.TotalReceber,
                funcionarioId, funcionarioNome, erro));
        }

        var encontrados = linhas.Count(l => l.FuncionarioId.HasValue);
        var naoEncontrados = linhas.Count(l => l.FuncionarioId is null);

        return new ImportacaoPagamentoExtraPreviewResponse(linhas.Count, encontrados, naoEncontrados, linhas);
    }

    public async Task<ImportacaoPagamentoExtraConfirmarResponse> ImportarAsync(
        ImportacaoPagamentoExtraConfirmarRequest request, Guid? solicitanteId, CancellationToken ct)
    {
        if (_currentUser.IsReadOnly)
            throw new InvalidOperationException("Seu perfil é somente leitura. Não é possível importar pagamentos.");

        var funcionarioIds = request.Linhas.Select(l => l.FuncionarioId).Distinct().ToList();
        var nomes = await _db.Funcionarios.AsNoTracking()
            .Where(f => funcionarioIds.Contains(f.Id))
            .Select(f => new { f.Id, f.Name })
            .ToDictionaryAsync(f => f.Id, f => f.Name, ct);

        // solicitanteId já é o FuncionarioId do usuário autenticado (vem de _userContext.FuncionarioId)
        var importadoPorId = solicitanteId;

        var itens = new List<ImportacaoPagamentoExtraConfirmarItemResponse>(request.Linhas.Count);

        foreach (var linha in request.Linhas)
        {
            nomes.TryGetValue(linha.FuncionarioId, out var funcionarioNome);

            try
            {
                var createRequest = new SolicitacaoPagamentoExtraCreateRequest
                {
                    FuncionarioId      = linha.FuncionarioId,
                    TipoPagamentoExtra = request.TipoPagamentoExtra,
                    Valor              = linha.Valor,
                    Descricao          = request.Descricao,
                    DataPagamento      = request.DataPagamento,
                    Competencia        = request.Competencia,
                    Observacoes        = request.Observacoes,
                    ImportadoPorId     = importadoPorId,
                };

                var created = await CreateAsync(createRequest, solicitanteId, ct);
                await SubmitAsync(created.Id, ct);

                itens.Add(new ImportacaoPagamentoExtraConfirmarItemResponse(
                    linha.FuncionarioId, funcionarioNome, created.Id, null));
            }
            catch (Exception ex)
            {
                itens.Add(new ImportacaoPagamentoExtraConfirmarItemResponse(
                    linha.FuncionarioId, funcionarioNome, null, ex.Message));
            }
        }

        var criados = itens.Count(i => i.SolicitacaoId.HasValue);
        var falhas  = itens.Count(i => i.SolicitacaoId is null);

        return new ImportacaoPagamentoExtraConfirmarResponse(request.Linhas.Count, criados, falhas, itens);
    }

    // ── Helpers de etapa ────────────────────────────────────────────────────────

    private static bool IsProcessoStep(SolicitacaoAprovacaoEtapa e) =>
        e.AprovadorId == null && e.RoleFilaId == null && e.AcaoEtapa != AcaoEtapa.Nenhuma;

    private static void ExecutarAcaoEtapa(AcaoEtapa acao, SolicitacaoPagamentoExtra entity)
    {
        if (acao == AcaoEtapa.EnviarIntegracao)
        {
            entity.Status = SolicitacaoStatus.Aprovada;
            entity.ApprovedAtUtc ??= DateTimeOffset.UtcNow;
        }
    }

    private static SolicitacaoPagamentoExtraResponse MapToResponse(
        SolicitacaoPagamentoExtra s,
        IReadOnlyList<RhPortal.Api.Contracts.Common.EtapaAprovacaoResponse> etapas) => new(
        s.Id, s.Status,
        s.SolicitanteId, s.Solicitante?.Name,
        s.ImportadoPorId, s.ImportadoPor?.Name, s.ImportadaEmUtc,
        s.FuncionarioId, s.Funcionario?.Name,
        s.TipoPagamentoExtra, s.Valor,
        s.Descricao, s.DataPagamento, s.Competencia,
        s.Observacoes,
        s.CreatedAtUtc, s.UpdatedAtUtc, s.ApprovedAtUtc,
        s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc,
        etapas
    );

    // ── XLSX parser ──────────────────────────────────────────────────────────

    private sealed record XlsxParsedRow(
        int Linha, string Empresa, string Estabelecimento, string Matricula,
        string NomePlanilha, string CargoPlanilha, string CentroCustoPlanilha,
        decimal? Valor, decimal? PercentualDsr, decimal? ValorDsr, decimal? TotalReceber);

    private static List<XlsxParsedRow> ParseXlsx(Stream stream)
    {
        using var doc = SpreadsheetDocument.Open(stream, isEditable: false);
        var workbookPart = doc.WorkbookPart!;
        var firstSheet = workbookPart.Workbook.Sheets!.Elements<Sheet>().First();
        var worksheetPart = (WorksheetPart)workbookPart.GetPartById(firstSheet.Id!.Value!);
        var sharedStrings = workbookPart.SharedStringTablePart?.SharedStringTable;
        var rows = worksheetPart.Worksheet.GetFirstChild<SheetData>()!.Elements<Row>().ToList();

        int headerRowIndex = -1;
        var colMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < rows.Count; i++)
        {
            var cells = rows[i].Elements<Cell>().ToList();
            var found = cells.Any(c =>
            {
                var v = GetCellStringValue(c, sharedStrings).Trim();
                return string.Equals(v, "Matrícula", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(v, "Matricula", StringComparison.OrdinalIgnoreCase);
            });

            if (!found) continue;

            headerRowIndex = i;
            foreach (var cell in cells)
            {
                var header = GetCellStringValue(cell, sharedStrings).Trim();
                if (!string.IsNullOrEmpty(header))
                    colMap[header] = GetColumnIndex(cell.CellReference?.Value ?? "");
            }
            break;
        }

        if (headerRowIndex < 0) return [];

        int ColIdx(params string[] names)
        {
            foreach (var n in names)
                if (colMap.TryGetValue(n, out var idx)) return idx;
            return -1;
        }

        var idxEmpresa      = ColIdx("Empresa");
        var idxEstab        = ColIdx("Estab.", "Estab");
        var idxMatricula    = ColIdx("Matrícula", "Matricula");
        var idxNome         = ColIdx("Nome");
        var idxCargo        = ColIdx("Cargo Básico-Descrição", "Cargo Basico-Descricao");
        var idxCentroCusto  = ColIdx("Centro Custo-Descrição", "Centro Custo-Descricao");
        var idxValor        = ColIdx("Valor");
        var idxPercentDsr   = ColIdx("% DSR");
        var idxValorDsr     = ColIdx("Valor DSR");
        var idxTotal        = ColIdx("Total a receber");

        var result = new List<XlsxParsedRow>();

        for (int i = headerRowIndex + 1; i < rows.Count; i++)
        {
            var cellDict = BuildCellDict(rows[i], sharedStrings);

            var matricula = Get(cellDict, idxMatricula);
            var nome      = Get(cellDict, idxNome);

            if (string.IsNullOrWhiteSpace(matricula) && string.IsNullOrWhiteSpace(nome))
                continue;

            result.Add(new XlsxParsedRow(
                Linha:             i + 1,
                Empresa:           Get(cellDict, idxEmpresa),
                Estabelecimento:   Get(cellDict, idxEstab),
                Matricula:         matricula,
                NomePlanilha:      nome,
                CargoPlanilha:     Get(cellDict, idxCargo),
                CentroCustoPlanilha: Get(cellDict, idxCentroCusto),
                Valor:             ParseDecimal(Get(cellDict, idxValor)),
                PercentualDsr:     ParseDecimal(Get(cellDict, idxPercentDsr)),
                ValorDsr:          ParseDecimal(Get(cellDict, idxValorDsr)),
                TotalReceber:      ParseDecimal(Get(cellDict, idxTotal))));
        }

        return result;
    }

    private static Dictionary<int, string> BuildCellDict(Row row, SharedStringTable? sst)
    {
        var dict = new Dictionary<int, string>();
        foreach (var cell in row.Elements<Cell>())
        {
            var idx = GetColumnIndex(cell.CellReference?.Value ?? "");
            if (idx >= 0)
                dict[idx] = GetCellStringValue(cell, sst);
        }
        return dict;
    }

    private static string Get(Dictionary<int, string> dict, int colIdx)
        => colIdx >= 0 && dict.TryGetValue(colIdx, out var v) ? v.Trim() : "";

    private static string GetCellStringValue(Cell cell, SharedStringTable? sst)
    {
        if (cell.DataType?.Value == CellValues.SharedString)
        {
            if (sst != null && int.TryParse(cell.InnerText, out var idx))
                return sst.Elements<SharedStringItem>().ElementAt(idx).InnerText ?? "";
            return "";
        }
        return cell.InnerText?.Trim() ?? "";
    }

    private static int GetColumnIndex(string cellRef)
    {
        var col = new string(cellRef.TakeWhile(char.IsLetter).ToArray()).ToUpperInvariant();
        if (string.IsNullOrEmpty(col)) return -1;
        int result = 0;
        foreach (var c in col)
            result = result * 26 + (c - 'A' + 1);
        return result - 1;
    }

    private static decimal? ParseDecimal(string val)
    {
        if (string.IsNullOrWhiteSpace(val)) return null;
        if (decimal.TryParse(val, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var d)) return d;
        if (decimal.TryParse(val, System.Globalization.NumberStyles.Any,
            new System.Globalization.CultureInfo("pt-BR"), out var d2)) return d2;
        return null;
    }
}
