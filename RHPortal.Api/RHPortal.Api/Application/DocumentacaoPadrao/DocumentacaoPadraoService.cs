using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.DocumentacaoPadrao;

public interface IDocumentacaoPadraoService
{
    Task<IReadOnlyList<DocumentacaoPadraoItemResponse>> GetAsync(CancellationToken ct);
    Task SaveAsync(SalvarDocumentacaoPadraoRequest request, CancellationToken ct);

    /// <summary>Retorna configuração efetiva para um NivelCargo (override por nível sobrescreve o global).</summary>
    Task<DocumentacaoPadraoPorNivelResponse?> GetByNivelCargoAsync(Guid nivelCargoId, CancellationToken ct);

    /// <summary>
    /// Salva o conjunto de overrides por NivelCargo. Tipos ausentes na lista são removidos
    /// (isto é, voltam a herdar do padrão global do tenant).
    /// </summary>
    Task SaveByNivelCargoAsync(Guid nivelCargoId, SalvarDocumentacaoPadraoPorNivelRequest request, CancellationToken ct);

    /// <summary>
    /// Retorna configuração efetiva para um Cargo específico (JobPosition). Resolução hierárquica:
    /// override por Cargo → override por NivelCargo do cargo → padrão global. Cada item indica a origem.
    /// </summary>
    Task<DocumentacaoPadraoPorCargoResponse?> GetByCargoAsync(Guid cargoId, CancellationToken ct);

    /// <summary>
    /// Salva overrides por Cargo específico. Tipos ausentes no payload são removidos
    /// (voltam a herdar do override por NivelCargo ou do padrão global).
    /// </summary>
    Task SaveByCargoAsync(Guid cargoId, SalvarDocumentacaoPadraoPorCargoRequest request, CancellationToken ct);

    /// <summary>
    /// Retorna os tipos efetivos (tipoDocumento → obrigatório?) com resolução hierárquica
    /// Cargo → NivelCargo → Global. Usado pelo seed de <c>PreAdmissaoDocumentoSolicitado</c>.
    /// Se ambos <paramref name="cargoId"/> e <paramref name="nivelCargoId"/> forem null, retorna só o padrão global.
    /// </summary>
    Task<IReadOnlyList<(short TipoDocumento, bool Obrigatorio)>> GetTiposEfetivosAsync(
        Guid? nivelCargoId,
        Guid? cargoId,
        CancellationToken ct);

    /// <summary>
    /// Retorna o histórico de alterações da configuração (global, por NivelCargo ou por Cargo), ordenado
    /// por <c>CriadoEmUtc DESC</c>. Opcionalmente filtra por <paramref name="escopo"/>, <paramref name="nivelCargoId"/>
    /// e <paramref name="cargoId"/>. Paginação simples.
    /// </summary>
    Task<DocumentacaoPadraoHistoricoResponse> ListarHistoricoAsync(
        DocumentacaoPadraoEscopo? escopo,
        Guid? nivelCargoId,
        Guid? cargoId,
        int page,
        int pageSize,
        CancellationToken ct);
}

public sealed class DocumentacaoPadraoService : IDocumentacaoPadraoService
{
    private static readonly IReadOnlyList<(short Tipo, string Label)> TodosOsTipos =
    [
        (0,  "Carteira de Identidade (R.G.)"),
        (1,  "Cadastro de Pessoas Físicas (C.P.F.)"),
        (2,  "Carteira Nacional de Habilitação"),
        (3,  "Título de Eleitor"),
        (4,  "Reservista"),
        (5,  "Comprovante de Endereço"),
        (6,  "Certidão de Nascimento ou Casamento"),
        (7,  "Cartão do PIS"),
        (9,  "Carteira de Trabalho (CTPS)"),
        (10, "Declaração de União Estável"),
        (11, "RG dos filhos"),
        (12, "Certidão de Nascimento dos filhos"),
        (13, "Cartão de Vacinação dos filhos"),
        (14, "Abertura de Conta no Bradesco / Cartão"),
        (15, "Foto 3x4 ou de perfil (crachá)"),
        (16, "Comprovante de Escolaridade"),
        (20, "CNPJ"),
        (21, "Contrato Social/MEI"),
        (22, "Conta Bancária PJ"),
        (23, "Certidões Negativas"),
        (24, "Exame Médico"),
        (25, "Comprovante de vacinação COVID-19"),
        (26, "Carta de boas-vindas assinada"),
        (27, "Print — validação de CEP (Correios)"),
        (28, "Print — consulta CPF (Receita Federal)"),
        (29, "CPF dos filhos"),
        (30, "Comprovante de frequência escolar dos filhos"),
        (31, "RG e CPF do cônjuge/companheiro(a)"),
    ];

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext? _currentUser;

    public DocumentacaoPadraoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = null;
    }

    // Overload com ICurrentUserContext para registrar histórico com user_id/nome.
    // O ctor sem user continua para compat com testes legados que não precisam de tracking.
    public DocumentacaoPadraoService(AppDbContext db, ITenantContext tenantContext, ICurrentUserContext currentUser)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<DocumentacaoPadraoItemResponse>> GetAsync(CancellationToken ct)
    {
        // A query filter do DbContext já filtra por TenantId automaticamente
        var configs = await _db.DocumentacaoPadraoConfigs
            .AsNoTracking()
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        return TodosOsTipos
            .Select(t => new DocumentacaoPadraoItemResponse(
                TipoDocumento: t.Tipo,
                Label: t.Label,
                Configuracao: configs.TryGetValue(t.Tipo, out var cfg) ? cfg : (short)2 // padrão: Não será pedido
            ))
            .ToList();
    }

    public async Task SaveAsync(SalvarDocumentacaoPadraoRequest request, CancellationToken ct)
    {
        var existentes = await _db.DocumentacaoPadraoConfigs.ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var historicoEntries = new List<DocumentacaoPadraoHistorico>();
        var userId = _currentUser?.UserId;
        var userNome = _currentUser?.Email;
        var tenantIdForHist = _tenantContext.TenantId ?? "";

        foreach (var item in request.Documentos)
        {
            var existente = existentes.FirstOrDefault(x => x.TipoDocumento == item.TipoDocumento);
            if (existente is not null)
            {
                if (existente.Configuracao != item.Configuracao)
                {
                    historicoEntries.Add(new DocumentacaoPadraoHistorico
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantIdForHist,
                        Escopo = DocumentacaoPadraoEscopo.Global,
                        NivelCargoId = null,
                        CargoId = null,
                        TipoDocumento = item.TipoDocumento,
                        ConfiguracaoAnterior = existente.Configuracao,
                        ConfiguracaoNova = item.Configuracao,
                        Acao = DocumentacaoPadraoAcao.Alterado,
                        UserId = userId,
                        UserNome = userNome,
                        CriadoEmUtc = now,
                    });
                }
                existente.Configuracao = item.Configuracao;
                existente.UpdatedAtUtc = now;
            }
            else
            {
                _db.DocumentacaoPadraoConfigs.Add(new DocumentacaoPadraoConfig
                {
                    Id = Guid.NewGuid(),
                    TipoDocumento = item.TipoDocumento,
                    Configuracao = item.Configuracao,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                    // TenantId será injetado pelo SaveChangesAsync override do DbContext
                });
                historicoEntries.Add(new DocumentacaoPadraoHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantIdForHist,
                    Escopo = DocumentacaoPadraoEscopo.Global,
                    NivelCargoId = null,
                    CargoId = null,
                    TipoDocumento = item.TipoDocumento,
                    ConfiguracaoAnterior = null,
                    ConfiguracaoNova = item.Configuracao,
                    Acao = DocumentacaoPadraoAcao.Criado,
                    UserId = userId,
                    UserNome = userNome,
                    CriadoEmUtc = now,
                });
            }
        }

        if (historicoEntries.Count > 0)
            _db.DocumentacaoPadraoHistoricos.AddRange(historicoEntries);

        await _db.SaveChangesAsync(ct);

        // Propaga a nova configuração para todas as pré-admissões ativas,
        // respeitando os overrides por NivelCargo e Cargo de cada preadmissão.
        await SincronizarPreAdmisoesAtivasAsync(now, ct);
    }

    /// <summary>
    /// Atualiza os documentos solicitados de todas as pré-admissões que ainda não foram concluídas,
    /// recalculando a configuração efetiva (cargo → nível → global) de cada preadmissão individualmente.
    /// Garante que overrides por NivelCargo/Cargo não sejam sobrescritos pelo padrão global recém-salvo.
    /// </summary>
    private async Task SincronizarPreAdmisoesAtivasAsync(
        DateTimeOffset now,
        CancellationToken ct)
    {
        var statusesAtivos = new[]
        {
            PreAdmissaoStatus.Rascunho,
            PreAdmissaoStatus.Enviado,
            PreAdmissaoStatus.Acessado,
            PreAdmissaoStatus.PreenchidoParcial,
        };

        // Carrega preadmissões ativas com o JobPosition (para descobrir NivelCargoId).
        var preAdmissoesAtivas = await _db.Set<Domain.Entities.PreAdmissao>()
            .Where(pa => statusesAtivos.Contains(pa.Status))
            .Select(pa => new { pa.Id, pa.JobPositionId })
            .ToListAsync(ct);

        if (preAdmissoesAtivas.Count == 0) return;

        var jobPositionIds = preAdmissoesAtivas
            .Where(p => p.JobPositionId.HasValue)
            .Select(p => p.JobPositionId!.Value)
            .Distinct()
            .ToList();

        // Map JobPositionId → NivelCargoId (para resolver a hierarquia)
        var nivelCargoDoJobPosition = jobPositionIds.Count == 0
            ? new Dictionary<Guid, Guid?>()
            : await _db.Set<JobPosition>().AsNoTracking()
                .Where(j => jobPositionIds.Contains(j.Id))
                .ToDictionaryAsync(j => j.Id, j => j.NivelCargoId, ct);

        // Carrega padrão global (todas as linhas do tenant).
        var globais = await _db.DocumentacaoPadraoConfigs.AsNoTracking()
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        // Carrega todos os overrides por NivelCargo/Cargo relevantes para as preadmissões ativas, em batch.
        var nivelCargoIds = nivelCargoDoJobPosition.Values.Where(v => v.HasValue).Select(v => v!.Value).Distinct().ToList();
        var overridesPorNivel = nivelCargoIds.Count == 0
            ? new Dictionary<Guid, List<DocumentacaoPadraoPorNivelCargoConfig>>()
            : (await _db.DocumentacaoPadraoPorNivelCargoConfigs.AsNoTracking()
                .Where(x => nivelCargoIds.Contains(x.NivelCargoId))
                .ToListAsync(ct))
                .GroupBy(x => x.NivelCargoId)
                .ToDictionary(g => g.Key, g => g.ToList());

        var overridesPorCargo = jobPositionIds.Count == 0
            ? new Dictionary<Guid, List<DocumentacaoPadraoPorCargoConfig>>()
            : (await _db.DocumentacaoPadraoPorCargoConfigs.AsNoTracking()
                .Where(x => jobPositionIds.Contains(x.JobPositionId))
                .ToListAsync(ct))
                .GroupBy(x => x.JobPositionId)
                .ToDictionary(g => g.Key, g => g.ToList());

        var preAdmissaoIds = preAdmissoesAtivas.Select(p => p.Id).ToList();

        // Carrega todos os DocumentosSolicitados das preadmissões ativas em batch.
        var solicitadosPorPreAdmissao = (await _db.Set<PreAdmissaoDocumentoSolicitado>()
            .Where(ds => preAdmissaoIds.Contains(ds.PreAdmissaoId))
            .ToListAsync(ct))
            .GroupBy(ds => ds.PreAdmissaoId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var tenantId = _tenantContext.TenantId ?? "";

        foreach (var pa in preAdmissoesAtivas)
        {
            // Resolução hierárquica: global → nivel → cargo
            var efetivos = new Dictionary<short, short>(globais);

            Guid? nivelCargoId = pa.JobPositionId.HasValue && nivelCargoDoJobPosition.TryGetValue(pa.JobPositionId.Value, out var nid) ? nid : null;
            if (nivelCargoId is Guid nidVal && overridesPorNivel.TryGetValue(nidVal, out var ovNivel))
            {
                foreach (var o in ovNivel) efetivos[o.TipoDocumento] = o.Configuracao;
            }

            if (pa.JobPositionId is Guid jpId && overridesPorCargo.TryGetValue(jpId, out var ovCargo))
            {
                foreach (var o in ovCargo) efetivos[o.TipoDocumento] = o.Configuracao;
            }

            var atuais = solicitadosPorPreAdmissao.TryGetValue(pa.Id, out var list) ? list : new List<PreAdmissaoDocumentoSolicitado>();
            var tiposAtuais = atuais.ToDictionary(ds => (short)ds.TipoDocumento);

            foreach (var (tipoShort, configuracao) in efetivos)
            {
                var tipo = (TipoDocumento)tipoShort;

                if (configuracao == 2) // Não será pedido → remove se existir
                {
                    if (tiposAtuais.TryGetValue(tipoShort, out var existente))
                        _db.Set<PreAdmissaoDocumentoSolicitado>().Remove(existente);
                }
                else
                {
                    var obrigatorio = configuracao == 0;
                    if (tiposAtuais.TryGetValue(tipoShort, out var existente))
                    {
                        existente.Obrigatorio = obrigatorio;
                    }
                    else
                    {
                        _db.Set<PreAdmissaoDocumentoSolicitado>().Add(new PreAdmissaoDocumentoSolicitado
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            PreAdmissaoId = pa.Id,
                            TipoDocumento = tipo,
                            Obrigatorio = obrigatorio,
                            CreatedAtUtc = now,
                        });
                    }
                }
            }
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task<DocumentacaoPadraoPorNivelResponse?> GetByNivelCargoAsync(Guid nivelCargoId, CancellationToken ct)
    {
        var nivel = await _db.NiveisCargo.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == nivelCargoId, ct);
        if (nivel is null) return null;

        var global = await _db.DocumentacaoPadraoConfigs.AsNoTracking()
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        var overrides = await _db.DocumentacaoPadraoPorNivelCargoConfigs.AsNoTracking()
            .Where(x => x.NivelCargoId == nivelCargoId)
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        var itens = TodosOsTipos
            .Select(t =>
            {
                var overrideAtivo = overrides.TryGetValue(t.Tipo, out var cfgOverride);
                var cfg = overrideAtivo
                    ? cfgOverride
                    : global.TryGetValue(t.Tipo, out var cfgGlobal) ? cfgGlobal : (short)2;
                return new DocumentacaoPadraoPorNivelItemResponse(t.Tipo, t.Label, cfg, overrideAtivo);
            })
            .ToList();

        return new DocumentacaoPadraoPorNivelResponse(nivel.Id, nivel.NomComplet, itens);
    }

    public async Task SaveByNivelCargoAsync(Guid nivelCargoId, SalvarDocumentacaoPadraoPorNivelRequest request, CancellationToken ct)
    {
        var existe = await _db.NiveisCargo.AnyAsync(x => x.Id == nivelCargoId, ct);
        if (!existe) throw new InvalidOperationException("NivelCargo não encontrado.");

        var atuais = await _db.DocumentacaoPadraoPorNivelCargoConfigs
            .Where(x => x.NivelCargoId == nivelCargoId)
            .ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var tenantId = _tenantContext.TenantId ?? "";
        var userId = _currentUser?.UserId;
        var userNome = _currentUser?.Email;
        var historicoEntries = new List<DocumentacaoPadraoHistorico>();

        var novosTipos = request.Documentos.Select(d => d.TipoDocumento).ToHashSet();

        // Remove os que não vieram no request (voltam a herdar do global).
        foreach (var antigo in atuais)
        {
            if (!novosTipos.Contains(antigo.TipoDocumento))
            {
                historicoEntries.Add(new DocumentacaoPadraoHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Escopo = DocumentacaoPadraoEscopo.PorNivelCargo,
                    NivelCargoId = nivelCargoId,
                    CargoId = null,
                    TipoDocumento = antigo.TipoDocumento,
                    ConfiguracaoAnterior = antigo.Configuracao,
                    ConfiguracaoNova = null,
                    Acao = DocumentacaoPadraoAcao.Removido,
                    UserId = userId,
                    UserNome = userNome,
                    CriadoEmUtc = now,
                });
                _db.DocumentacaoPadraoPorNivelCargoConfigs.Remove(antigo);
            }
        }

        foreach (var item in request.Documentos)
        {
            var existente = atuais.FirstOrDefault(x => x.TipoDocumento == item.TipoDocumento);
            if (existente is not null)
            {
                if (existente.Configuracao != item.Configuracao)
                {
                    historicoEntries.Add(new DocumentacaoPadraoHistorico
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Escopo = DocumentacaoPadraoEscopo.PorNivelCargo,
                        NivelCargoId = nivelCargoId,
                        CargoId = null,
                        TipoDocumento = item.TipoDocumento,
                        ConfiguracaoAnterior = existente.Configuracao,
                        ConfiguracaoNova = item.Configuracao,
                        Acao = DocumentacaoPadraoAcao.Alterado,
                        UserId = userId,
                        UserNome = userNome,
                        CriadoEmUtc = now,
                    });
                }
                existente.Configuracao = item.Configuracao;
                existente.UpdatedAtUtc = now;
            }
            else
            {
                _db.DocumentacaoPadraoPorNivelCargoConfigs.Add(new DocumentacaoPadraoPorNivelCargoConfig
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    NivelCargoId = nivelCargoId,
                    TipoDocumento = item.TipoDocumento,
                    Configuracao = item.Configuracao,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                historicoEntries.Add(new DocumentacaoPadraoHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Escopo = DocumentacaoPadraoEscopo.PorNivelCargo,
                    NivelCargoId = nivelCargoId,
                    CargoId = null,
                    TipoDocumento = item.TipoDocumento,
                    ConfiguracaoAnterior = null,
                    ConfiguracaoNova = item.Configuracao,
                    Acao = DocumentacaoPadraoAcao.Criado,
                    UserId = userId,
                    UserNome = userNome,
                    CriadoEmUtc = now,
                });
            }
        }

        if (historicoEntries.Count > 0)
            _db.DocumentacaoPadraoHistoricos.AddRange(historicoEntries);

        await _db.SaveChangesAsync(ct);

        // Propaga para todas as pré-admissões ativas — só as que pertencem a cargos
        // com esse NivelCargoId terão mudança efetiva, mas o método é idempotente
        // e reconstrói a hierarquia (cargo → nível → global) por preadmissão.
        await SincronizarPreAdmisoesAtivasAsync(now, ct);
    }

    public async Task<DocumentacaoPadraoPorCargoResponse?> GetByCargoAsync(Guid cargoId, CancellationToken ct)
    {
        var cargo = await _db.Set<JobPosition>().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == cargoId, ct);
        if (cargo is null) return null;

        string? nivelCargoNome = null;
        if (cargo.NivelCargoId is Guid nid)
        {
            nivelCargoNome = await _db.NiveisCargo.AsNoTracking()
                .Where(n => n.Id == nid)
                .Select(n => n.NomComplet)
                .FirstOrDefaultAsync(ct);
        }

        var global = await _db.DocumentacaoPadraoConfigs.AsNoTracking()
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        var nivelOverrides = cargo.NivelCargoId is Guid nivId
            ? await _db.DocumentacaoPadraoPorNivelCargoConfigs.AsNoTracking()
                .Where(x => x.NivelCargoId == nivId)
                .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct)
            : new Dictionary<short, short>();

        var cargoOverrides = await _db.DocumentacaoPadraoPorCargoConfigs.AsNoTracking()
            .Where(x => x.JobPositionId == cargoId)
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        var itens = TodosOsTipos
            .Select(t =>
            {
                var hasCargo = cargoOverrides.TryGetValue(t.Tipo, out var cfgCargo);
                var hasNivel = nivelOverrides.TryGetValue(t.Tipo, out var cfgNivel);
                var hasGlobal = global.TryGetValue(t.Tipo, out var cfgGlobal);

                short cfg;
                string origem;
                if (hasCargo) { cfg = cfgCargo; origem = "cargo"; }
                else if (hasNivel) { cfg = cfgNivel; origem = "nivel"; }
                else if (hasGlobal) { cfg = cfgGlobal; origem = "global"; }
                else { cfg = 2; origem = "global"; }

                return new DocumentacaoPadraoPorCargoItemResponse(
                    t.Tipo, t.Label, cfg,
                    OverrideCargoAtivo: hasCargo,
                    OverrideNivelCargoAtivo: hasNivel,
                    Origem: origem);
            })
            .ToList();

        return new DocumentacaoPadraoPorCargoResponse(
            cargo.Id, cargo.Code, cargo.Name,
            cargo.NivelCargoId, nivelCargoNome, itens);
    }

    public async Task SaveByCargoAsync(Guid cargoId, SalvarDocumentacaoPadraoPorCargoRequest request, CancellationToken ct)
    {
        var existe = await _db.Set<JobPosition>().AnyAsync(x => x.Id == cargoId, ct);
        if (!existe) throw new InvalidOperationException("Cargo não encontrado.");

        var atuais = await _db.DocumentacaoPadraoPorCargoConfigs
            .Where(x => x.JobPositionId == cargoId)
            .ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var tenantId = _tenantContext.TenantId ?? "";
        var userId = _currentUser?.UserId;
        var userNome = _currentUser?.Email;
        var historicoEntries = new List<DocumentacaoPadraoHistorico>();

        var novosTipos = request.Documentos.Select(d => d.TipoDocumento).ToHashSet();

        foreach (var antigo in atuais)
        {
            if (!novosTipos.Contains(antigo.TipoDocumento))
            {
                historicoEntries.Add(new DocumentacaoPadraoHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Escopo = DocumentacaoPadraoEscopo.PorCargo,
                    NivelCargoId = null,
                    CargoId = cargoId,
                    TipoDocumento = antigo.TipoDocumento,
                    ConfiguracaoAnterior = antigo.Configuracao,
                    ConfiguracaoNova = null,
                    Acao = DocumentacaoPadraoAcao.Removido,
                    UserId = userId,
                    UserNome = userNome,
                    CriadoEmUtc = now,
                });
                _db.DocumentacaoPadraoPorCargoConfigs.Remove(antigo);
            }
        }

        foreach (var item in request.Documentos)
        {
            var existente = atuais.FirstOrDefault(x => x.TipoDocumento == item.TipoDocumento);
            if (existente is not null)
            {
                if (existente.Configuracao != item.Configuracao)
                {
                    historicoEntries.Add(new DocumentacaoPadraoHistorico
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Escopo = DocumentacaoPadraoEscopo.PorCargo,
                        NivelCargoId = null,
                        CargoId = cargoId,
                        TipoDocumento = item.TipoDocumento,
                        ConfiguracaoAnterior = existente.Configuracao,
                        ConfiguracaoNova = item.Configuracao,
                        Acao = DocumentacaoPadraoAcao.Alterado,
                        UserId = userId,
                        UserNome = userNome,
                        CriadoEmUtc = now,
                    });
                }
                existente.Configuracao = item.Configuracao;
                existente.UpdatedAtUtc = now;
            }
            else
            {
                _db.DocumentacaoPadraoPorCargoConfigs.Add(new DocumentacaoPadraoPorCargoConfig
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    JobPositionId = cargoId,
                    TipoDocumento = item.TipoDocumento,
                    Configuracao = item.Configuracao,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                historicoEntries.Add(new DocumentacaoPadraoHistorico
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Escopo = DocumentacaoPadraoEscopo.PorCargo,
                    NivelCargoId = null,
                    CargoId = cargoId,
                    TipoDocumento = item.TipoDocumento,
                    ConfiguracaoAnterior = null,
                    ConfiguracaoNova = item.Configuracao,
                    Acao = DocumentacaoPadraoAcao.Criado,
                    UserId = userId,
                    UserNome = userNome,
                    CriadoEmUtc = now,
                });
            }
        }

        if (historicoEntries.Count > 0)
            _db.DocumentacaoPadraoHistoricos.AddRange(historicoEntries);

        await _db.SaveChangesAsync(ct);

        // Propaga para todas as pré-admissões ativas — apenas as amarradas a esse
        // JobPositionId terão mudança efetiva, mas a sincronização rebate a hierarquia
        // (cargo → nível → global) por preadmissão, respeitando overrides já existentes.
        await SincronizarPreAdmisoesAtivasAsync(now, ct);
    }

    public async Task<DocumentacaoPadraoHistoricoResponse> ListarHistoricoAsync(
        DocumentacaoPadraoEscopo? escopo,
        Guid? nivelCargoId,
        Guid? cargoId,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.DocumentacaoPadraoHistoricos.AsNoTracking().AsQueryable();
        if (escopo is DocumentacaoPadraoEscopo e)
            query = query.Where(x => x.Escopo == e);
        if (nivelCargoId is Guid nid)
            query = query.Where(x => x.NivelCargoId == nid);
        if (cargoId is Guid cid)
            query = query.Where(x => x.CargoId == cid);

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(x => x.CriadoEmUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Escopo,
                x.NivelCargoId,
                NivelCargoNome = x.NivelCargo != null ? x.NivelCargo.NomComplet : null,
                x.CargoId,
                CargoNome = x.Cargo != null ? x.Cargo.Name : null,
                x.TipoDocumento,
                x.ConfiguracaoAnterior,
                x.ConfiguracaoNova,
                x.Acao,
                x.UserId,
                x.UserNome,
                x.CriadoEmUtc,
            })
            .ToListAsync(ct);

        var items = rows.Select(x => new DocumentacaoPadraoHistoricoItem(
            x.Id,
            x.Escopo,
            x.NivelCargoId,
            x.NivelCargoNome,
            x.CargoId,
            x.CargoNome,
            x.TipoDocumento,
            LabelPorTipo(x.TipoDocumento),
            x.ConfiguracaoAnterior,
            x.ConfiguracaoNova,
            x.Acao,
            x.UserId,
            x.UserNome,
            x.CriadoEmUtc)).ToList();

        var totalPages = pageSize <= 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize);
        return new DocumentacaoPadraoHistoricoResponse(items, total, page, pageSize, totalPages);
    }

    private static string LabelPorTipo(short tipo)
    {
        var match = TodosOsTipos.FirstOrDefault(t => t.Tipo == tipo);
        return match.Label ?? $"Tipo {tipo}";
    }

    public async Task<IReadOnlyList<(short TipoDocumento, bool Obrigatorio)>> GetTiposEfetivosAsync(
        Guid? nivelCargoId,
        Guid? cargoId,
        CancellationToken ct)
    {
        var global = await _db.DocumentacaoPadraoConfigs.AsNoTracking()
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        var efetivos = new Dictionary<short, short>(global);

        if (nivelCargoId is Guid nid)
        {
            var overrides = await _db.DocumentacaoPadraoPorNivelCargoConfigs.AsNoTracking()
                .Where(x => x.NivelCargoId == nid)
                .ToListAsync(ct);
            foreach (var o in overrides) efetivos[o.TipoDocumento] = o.Configuracao;
        }

        if (cargoId is Guid cid)
        {
            var overrides = await _db.DocumentacaoPadraoPorCargoConfigs.AsNoTracking()
                .Where(x => x.JobPositionId == cid)
                .ToListAsync(ct);
            foreach (var o in overrides) efetivos[o.TipoDocumento] = o.Configuracao;
        }

        return efetivos
            .Where(kv => kv.Value != 2) // exclui "Não será pedido"
            .Select(kv => (kv.Key, Obrigatorio: kv.Value == 0))
            .ToList();
    }
}
