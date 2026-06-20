using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.RmConfiguracao;

public class TenantRmConfiguracaoDto
{
    public string? SqlServer { get; set; }
    public string? SqlDatabase { get; set; }
    public string? SqlUserId { get; set; }
    public bool SqlPasswordConfigured { get; set; }
    public bool SqlEncrypt { get; set; } = true;
    public bool SqlTrustServerCertificate { get; set; } = true;
    public int SqlConnectTimeoutSeconds { get; set; } = 15;
    public string? SqlApplicationIntent { get; set; } = "ReadOnly";

    public string Mode { get; set; } = "stub";
    public string? CreateEndpointUrl { get; set; }
    public string? GetEndpointUrl { get; set; }
    public string? ParecerEndpointUrl { get; set; }
    public int RequestTimeoutSeconds { get; set; } = 60;
    public string? RestUsername { get; set; }
    public bool RestPasswordConfigured { get; set; }
    public bool RestBearerTokenConfigured { get; set; }

    public int MaxTentativas { get; set; } = 5;
    public bool CreateWorkerEnabled { get; set; } = true;
    public int CreateWorkerIntervalSeconds { get; set; } = 30;
    public int CreateWorkerMaxPerTenant { get; set; } = 20;
    public short? CodColRequisicaoDefault { get; set; } = 1;
    public short? CodColRequisitanteDefault { get; set; }
    public short CodStatusInicial { get; set; } = 1;
    public int? CodLocalDefault { get; set; } = 1;
    public short? CodFilialDefault { get; set; }
    public int DiasPrevisaoPadrao { get; set; } = 5;
    public string RecCreatedBy { get; set; } = "portal";
    public string RecModifiedBy { get; set; } = "portal";

    public bool RequisicoesVagaOrigemRm { get; set; }
    public bool ImportacaoAutomaticaAtiva { get; set; }
    public int ImportacaoAutomaticaIntervaloMinutos { get; set; } = 15;
    public int ImportacaoAutomaticaMaxPorExecucao { get; set; } = 50;
    public bool StatusSyncEnabled { get; set; }
    public int StatusSyncIntervalMinutes { get; set; } = 15;
    public int StatusSyncMaxPerRun { get; set; } = 50;

    public bool SyncUnits { get; set; } = true;
    public bool SyncUnitsExecute { get; set; } = true;
    public bool SyncVagas { get; set; } = true;
    public bool SyncVagasOnly { get; set; }
    public bool SyncEmpresas { get; set; } = true;
    public bool SyncHierarquia { get; set; } = true;
    public bool SyncDesligamentos { get; set; } = true;
    public bool SyncCandidatosVagaDiagnostic { get; set; } = true;
    public bool SyncCandidatosVaga { get; set; } = true;
    public bool SyncCandidatosPerfilCv { get; set; } = true;
    public bool UseGestorHierarquiaPosicao { get; set; } = true;
    public bool UseHierarquiaOrganogramaPosicao { get; set; } = true;
    public int? MaxTalentosToSync { get; set; }
    public int? MaxCandidatosToSync { get; set; }
    public int? MaxPessoasToSync { get; set; }
    public int? MaxFuncionariosToSync { get; set; }
    public string? SyncOnlyEmail { get; set; }
    public string? VagaDefaultAreaCode { get; set; }

    public string Schema { get; set; } = "dbo";
    public string AreaTable { get; set; } = "BAREA";
    public string DepartamentoTable { get; set; } = "PSECAO";
    public string FuncaoTable { get; set; } = "PFUNCAO";
    public string CargoTable { get; set; } = "PCARGO";
    public string VagaTable { get; set; } = "VRSVAGAS";
    public string UnidadeTable { get; set; } = "GFILIAL";
    public string FuncionarioTable { get; set; } = "PFUNC";
    public string PessoaTable { get; set; } = "PPESSOA";
    public string HierarquiaTable { get; set; } = "VHIERARQUIA";
    public string? HierarquiaColigadaExternaTable { get; set; } = "VHIERARQUIACOLIGADAEXTERNA";
    public string DesligamentoTable { get; set; } = "VREQDESLIGAMENTO";
    public string AumentoQuadroTable { get; set; } = "VREQAUMENTOQUADRO";
    public string SubstituicaoTable { get; set; } = "VREQSUBSTITUICAO";
    public string TransferenciaPromocaoTable { get; set; } = "VREQTRANSFPROMOCAO";

    public string? GestoresRmUrlTemplate { get; set; }
    public string? GestoresRmUser { get; set; }
    public bool GestoresRmPasswordConfigured { get; set; }
    public short GestoresRmDefaultCodColigada { get; set; } = 1;
    public int GestoresRmDelayMsBetweenRequests { get; set; } = 250;
}

public sealed class TenantRmConfiguracaoRequest : TenantRmConfiguracaoDto
{
    public string? SqlPassword { get; set; }
    public string? RestPassword { get; set; }
    public string? RestBearerToken { get; set; }
    public string? GestoresRmPassword { get; set; }
}

public sealed class RmWorkerConfiguracaoDto : TenantRmConfiguracaoDto
{
    public string? SqlPassword { get; set; }
}

public sealed class RmGestoresConfiguracaoInternaDto
{
    public string? UrlTemplate { get; set; }
    public string? User { get; set; }
    public string Password { get; set; } = string.Empty;
    public short DefaultCodColigada { get; set; } = 1;
}

public interface ITenantRmConfiguracaoService
{
    Task<TenantRmConfiguracaoDto> GetAsync(CancellationToken ct);
    Task<TenantRmConfiguracaoDto> UpsertAsync(TenantRmConfiguracaoRequest request, CancellationToken ct);
    Task<RmConnectionOptions> GetConnectionOptionsAsync(CancellationToken ct);
    Task<RmRequisicaoCreateOptions> GetCreateOptionsAsync(CancellationToken ct);
    Task<RmSolicitacaoStatusSyncOptions> GetStatusSyncOptionsAsync(CancellationToken ct);
    Task<RmWorkerConfiguracaoDto> GetWorkerConfigAsync(CancellationToken ct);
    Task<RmGestoresConfiguracaoInternaDto> GetGestoresConfigAsync(CancellationToken ct);
}

public sealed class TenantRmConfiguracaoService : ITenantRmConfiguracaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ISecretProtector _protector;
    private readonly RmConnectionOptions _rmDefaults;
    private readonly RmRequisicaoCreateOptions _createDefaults;
    private readonly RmSolicitacaoStatusSyncOptions _statusDefaults;

    public TenantRmConfiguracaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        ISecretProtector protector,
        IOptions<RmConnectionOptions> rmDefaults,
        IOptions<RmRequisicaoCreateOptions> createDefaults,
        IOptions<RmSolicitacaoStatusSyncOptions> statusDefaults)
    {
        _db = db;
        _tenantContext = tenantContext;
        _protector = protector;
        _rmDefaults = rmDefaults.Value;
        _createDefaults = createDefaults.Value;
        _statusDefaults = statusDefaults.Value;
    }

    public async Task<TenantRmConfiguracaoDto> GetAsync(CancellationToken ct)
    {
        var config = await GetOrCreateAsync(ct);
        return Map(config);
    }

    public async Task<TenantRmConfiguracaoDto> UpsertAsync(TenantRmConfiguracaoRequest request, CancellationToken ct)
    {
        var config = await GetOrCreateAsync(ct);

        config.SqlServer = NullIfBlank(request.SqlServer);
        config.SqlDatabase = NullIfBlank(request.SqlDatabase);
        config.SqlUserId = NullIfBlank(request.SqlUserId);
        if (!string.IsNullOrWhiteSpace(request.SqlPassword))
            config.SqlPasswordEncrypted = _protector.Encrypt(request.SqlPassword);
        config.SqlEncrypt = request.SqlEncrypt;
        config.SqlTrustServerCertificate = request.SqlTrustServerCertificate;
        config.SqlConnectTimeoutSeconds = Math.Clamp(request.SqlConnectTimeoutSeconds, 1, 300);
        config.SqlApplicationIntent = NullIfBlank(request.SqlApplicationIntent);

        config.Mode = string.IsNullOrWhiteSpace(request.Mode) ? "stub" : request.Mode.Trim();
        config.CreateEndpointUrl = NullIfBlank(request.CreateEndpointUrl);
        config.GetEndpointUrl = null;
        config.ParecerEndpointUrl = NullIfBlank(request.ParecerEndpointUrl);
        config.RequestTimeoutSeconds = Math.Clamp(request.RequestTimeoutSeconds, 1, 600);
        config.RestUsername = NullIfBlank(request.RestUsername);
        if (!string.IsNullOrWhiteSpace(request.RestPassword))
            config.RestPasswordEncrypted = _protector.Encrypt(request.RestPassword);
        if (!string.IsNullOrWhiteSpace(request.RestBearerToken))
            config.RestBearerTokenEncrypted = _protector.Encrypt(request.RestBearerToken);

        config.MaxTentativas = Math.Clamp(request.MaxTentativas, 1, 50);
        config.CreateWorkerEnabled = request.CreateWorkerEnabled;
        config.CreateWorkerIntervalSeconds = Math.Clamp(request.CreateWorkerIntervalSeconds, 5, 3600);
        config.CreateWorkerMaxPerTenant = Math.Clamp(request.CreateWorkerMaxPerTenant, 1, 200);
        config.CodColRequisicaoDefault = request.CodColRequisicaoDefault;
        config.CodColRequisitanteDefault = request.CodColRequisitanteDefault;
        config.CodStatusInicial = request.CodStatusInicial;
        config.CodLocalDefault = request.CodLocalDefault;
        config.CodFilialDefault = request.CodFilialDefault;
        config.DiasPrevisaoPadrao = Math.Clamp(request.DiasPrevisaoPadrao, 1, 365);
        config.RecCreatedBy = string.IsNullOrWhiteSpace(request.RecCreatedBy) ? "portal" : request.RecCreatedBy.Trim();
        config.RecModifiedBy = string.IsNullOrWhiteSpace(request.RecModifiedBy) ? "portal" : request.RecModifiedBy.Trim();

        config.RequisicoesVagaOrigemRm = request.RequisicoesVagaOrigemRm;
        config.ImportacaoAutomaticaAtiva = request.ImportacaoAutomaticaAtiva;
        config.ImportacaoAutomaticaIntervaloMinutos = Math.Clamp(request.ImportacaoAutomaticaIntervaloMinutos, 1, 1440);
        config.ImportacaoAutomaticaMaxPorExecucao = Math.Clamp(request.ImportacaoAutomaticaMaxPorExecucao, 1, 1000);
        config.StatusSyncEnabled = request.StatusSyncEnabled;
        config.StatusSyncIntervalMinutes = Math.Clamp(request.StatusSyncIntervalMinutes, 1, 1440);
        config.StatusSyncMaxPerRun = Math.Clamp(request.StatusSyncMaxPerRun, 1, 1000);

        config.SyncUnits = request.SyncUnits;
        config.SyncUnitsExecute = request.SyncUnitsExecute;
        config.SyncVagas = request.SyncVagas;
        config.SyncVagasOnly = request.SyncVagasOnly;
        config.SyncEmpresas = request.SyncEmpresas;
        config.SyncHierarquia = request.SyncHierarquia;
        config.SyncDesligamentos = request.SyncDesligamentos;
        config.SyncCandidatosVagaDiagnostic = request.SyncCandidatosVagaDiagnostic;
        config.SyncCandidatosVaga = request.SyncCandidatosVaga;
        config.SyncCandidatosPerfilCv = request.SyncCandidatosPerfilCv;
        config.UseGestorHierarquiaPosicao = request.UseGestorHierarquiaPosicao;
        config.UseHierarquiaOrganogramaPosicao = request.UseHierarquiaOrganogramaPosicao;
        config.MaxTalentosToSync = request.MaxTalentosToSync;
        config.MaxCandidatosToSync = request.MaxCandidatosToSync;
        config.MaxPessoasToSync = request.MaxPessoasToSync;
        config.MaxFuncionariosToSync = request.MaxFuncionariosToSync;
        config.SyncOnlyEmail = NullIfBlank(request.SyncOnlyEmail);
        config.VagaDefaultAreaCode = NullIfBlank(request.VagaDefaultAreaCode);

        config.Schema = DefaultIfBlank(request.Schema, "dbo");
        config.AreaTable = DefaultIfBlank(request.AreaTable, "BAREA");
        config.DepartamentoTable = DefaultIfBlank(request.DepartamentoTable, "PSECAO");
        config.FuncaoTable = DefaultIfBlank(request.FuncaoTable, "PFUNCAO");
        config.CargoTable = DefaultIfBlank(request.CargoTable, "PCARGO");
        config.VagaTable = DefaultIfBlank(request.VagaTable, "VRSVAGAS");
        config.UnidadeTable = DefaultIfBlank(request.UnidadeTable, "GFILIAL");
        config.FuncionarioTable = DefaultIfBlank(request.FuncionarioTable, "PFUNC");
        config.PessoaTable = DefaultIfBlank(request.PessoaTable, "PPESSOA");
        config.HierarquiaTable = DefaultIfBlank(request.HierarquiaTable, "VHIERARQUIA");
        config.HierarquiaColigadaExternaTable = NullIfBlank(request.HierarquiaColigadaExternaTable);
        config.DesligamentoTable = DefaultIfBlank(request.DesligamentoTable, "VREQDESLIGAMENTO");
        config.AumentoQuadroTable = DefaultIfBlank(request.AumentoQuadroTable, "VREQAUMENTOQUADRO");
        config.SubstituicaoTable = DefaultIfBlank(request.SubstituicaoTable, "VREQSUBSTITUICAO");
        config.TransferenciaPromocaoTable = DefaultIfBlank(request.TransferenciaPromocaoTable, "VREQTRANSFPROMOCAO");

        config.GestoresRmUrlTemplate = NullIfBlank(request.GestoresRmUrlTemplate);
        config.GestoresRmUser = NullIfBlank(request.GestoresRmUser);
        if (!string.IsNullOrWhiteSpace(request.GestoresRmPassword))
            config.GestoresRmPasswordEncrypted = _protector.Encrypt(request.GestoresRmPassword);
        config.GestoresRmDefaultCodColigada = request.GestoresRmDefaultCodColigada <= 0 ? (short)1 : request.GestoresRmDefaultCodColigada;
        config.GestoresRmDelayMsBetweenRequests = Math.Clamp(request.GestoresRmDelayMsBetweenRequests, 0, 60_000);
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await SyncLegacyTenantConfiguracaoAsync(config, ct);
        await _db.SaveChangesAsync(ct);
        return Map(config);
    }

    public async Task<RmConnectionOptions> GetConnectionOptionsAsync(CancellationToken ct)
    {
        var c = await GetOrCreateAsync(ct);
        return new RmConnectionOptions
        {
            Server = c.SqlServer,
            Database = c.SqlDatabase,
            UserId = c.SqlUserId,
            Password = DecryptOrEmpty(c.SqlPasswordEncrypted),
            Encrypt = c.SqlEncrypt,
            TrustServerCertificate = c.SqlTrustServerCertificate,
            ConnectTimeout = c.SqlConnectTimeoutSeconds,
            ApplicationIntent = c.SqlApplicationIntent
        };
    }

    public async Task<RmRequisicaoCreateOptions> GetCreateOptionsAsync(CancellationToken ct)
    {
        var c = await GetOrCreateAsync(ct);
        return new RmRequisicaoCreateOptions
        {
            Mode = c.Mode,
            MaxTentativas = c.MaxTentativas,
            WorkerEnabled = c.CreateWorkerEnabled,
            WorkerIntervalSeconds = c.CreateWorkerIntervalSeconds,
            WorkerMaxPerTenant = c.CreateWorkerMaxPerTenant,
            EndpointUrl = c.CreateEndpointUrl,
            RequestTimeoutSeconds = c.RequestTimeoutSeconds,
            Username = c.RestUsername,
            Password = DecryptOrEmpty(c.RestPasswordEncrypted),
            BearerToken = DecryptOrEmpty(c.RestBearerTokenEncrypted),
            CodColRequisicaoDefault = c.CodColRequisicaoDefault,
            CodColRequisitanteDefault = c.CodColRequisitanteDefault,
            CodStatusInicial = c.CodStatusInicial,
            CodLocalDefault = c.CodLocalDefault,
            CodFilialDefault = c.CodFilialDefault,
            DiasPrevisaoPadrao = c.DiasPrevisaoPadrao,
            RecCreatedBy = c.RecCreatedBy,
            RecModifiedBy = c.RecModifiedBy
        };
    }

    public async Task<RmSolicitacaoStatusSyncOptions> GetStatusSyncOptionsAsync(CancellationToken ct)
    {
        var c = await GetOrCreateAsync(ct);
        return new RmSolicitacaoStatusSyncOptions
        {
            Enabled = c.StatusSyncEnabled,
            IntervalMinutes = c.StatusSyncIntervalMinutes,
            MaxPerRun = c.StatusSyncMaxPerRun
        };
    }

    public async Task<RmWorkerConfiguracaoDto> GetWorkerConfigAsync(CancellationToken ct)
    {
        var c = await GetOrCreateAsync(ct);
        var dto = new RmWorkerConfiguracaoDto();
        Copy(Map(c), dto);
        dto.SqlPassword = DecryptOrEmpty(c.SqlPasswordEncrypted);
        return dto;
    }

    public async Task<RmGestoresConfiguracaoInternaDto> GetGestoresConfigAsync(CancellationToken ct)
    {
        var c = await GetOrCreateAsync(ct);
        return new RmGestoresConfiguracaoInternaDto
        {
            UrlTemplate = c.GestoresRmUrlTemplate,
            User = c.GestoresRmUser,
            Password = DecryptOrEmpty(c.GestoresRmPasswordEncrypted),
            DefaultCodColigada = c.GestoresRmDefaultCodColigada
        };
    }

    private async Task<TenantRmConfiguracao> GetOrCreateAsync(CancellationToken ct)
    {
        var config = await _db.TenantRmConfiguracoes.FirstOrDefaultAsync(ct);
        if (config is not null)
            return config;

        config = new TenantRmConfiguracao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            SqlServer = _rmDefaults.Server,
            SqlDatabase = _rmDefaults.Database,
            SqlUserId = _rmDefaults.UserId,
            SqlPasswordEncrypted = string.IsNullOrWhiteSpace(_rmDefaults.Password) ? null : _protector.Encrypt(_rmDefaults.Password),
            SqlEncrypt = _rmDefaults.Encrypt,
            SqlTrustServerCertificate = _rmDefaults.TrustServerCertificate,
            SqlConnectTimeoutSeconds = _rmDefaults.ConnectTimeout,
            SqlApplicationIntent = _rmDefaults.ApplicationIntent,
            Mode = _createDefaults.Mode,
            CreateEndpointUrl = _createDefaults.EndpointUrl,
            RequestTimeoutSeconds = _createDefaults.RequestTimeoutSeconds,
            RestUsername = _createDefaults.Username,
            RestPasswordEncrypted = string.IsNullOrWhiteSpace(_createDefaults.Password) ? null : _protector.Encrypt(_createDefaults.Password),
            RestBearerTokenEncrypted = string.IsNullOrWhiteSpace(_createDefaults.BearerToken) ? null : _protector.Encrypt(_createDefaults.BearerToken),
            MaxTentativas = _createDefaults.MaxTentativas,
            CreateWorkerEnabled = _createDefaults.WorkerEnabled,
            CreateWorkerIntervalSeconds = _createDefaults.WorkerIntervalSeconds,
            CreateWorkerMaxPerTenant = _createDefaults.WorkerMaxPerTenant,
            CodColRequisicaoDefault = _createDefaults.CodColRequisicaoDefault,
            CodColRequisitanteDefault = _createDefaults.CodColRequisitanteDefault,
            CodStatusInicial = _createDefaults.CodStatusInicial,
            CodLocalDefault = _createDefaults.CodLocalDefault,
            CodFilialDefault = _createDefaults.CodFilialDefault,
            DiasPrevisaoPadrao = _createDefaults.DiasPrevisaoPadrao,
            RecCreatedBy = _createDefaults.RecCreatedBy,
            RecModifiedBy = _createDefaults.RecModifiedBy,
            StatusSyncEnabled = _statusDefaults.Enabled,
            StatusSyncIntervalMinutes = _statusDefaults.IntervalMinutes,
            StatusSyncMaxPerRun = _statusDefaults.MaxPerRun,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        await ApplyLegacyTenantConfiguracaoAsync(config, ct);
        _db.TenantRmConfiguracoes.Add(config);
        await _db.SaveChangesAsync(ct);
        return config;
    }

    private async Task ApplyLegacyTenantConfiguracaoAsync(TenantRmConfiguracao config, CancellationToken ct)
    {
        var legacy = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (legacy is null)
            return;

        config.CreateEndpointUrl ??= legacy.RmRequisicaoCreateEndpointUrl;
        config.GetEndpointUrl = null;
        config.ParecerEndpointUrl ??= legacy.RmRequisicaoParecerEndpointUrl;
        config.RestUsername ??= legacy.RmRequisicaoCreateUsername;
        if (string.IsNullOrWhiteSpace(config.RestPasswordEncrypted) && !string.IsNullOrWhiteSpace(legacy.RmRequisicaoCreatePassword))
            config.RestPasswordEncrypted = _protector.Encrypt(legacy.RmRequisicaoCreatePassword);
        config.RequisicoesVagaOrigemRm = legacy.RequisicoesVagaOrigemRm;
        config.ImportacaoAutomaticaAtiva = legacy.RmImportacaoAutomaticaAtiva;
        config.ImportacaoAutomaticaIntervaloMinutos = legacy.RmImportacaoAutomaticaIntervaloMinutos;
        config.ImportacaoAutomaticaMaxPorExecucao = legacy.RmImportacaoAutomaticaMaxPorExecucao;
    }

    private async Task SyncLegacyTenantConfiguracaoAsync(TenantRmConfiguracao config, CancellationToken ct)
    {
        var legacy = await _db.TenantConfiguracoes.FirstOrDefaultAsync(ct);
        if (legacy is null)
        {
            legacy = new RhPortal.Api.Domain.Entities.TenantConfiguracao
            {
                Id = Guid.NewGuid(),
                TenantId = config.TenantId
            };
            _db.TenantConfiguracoes.Add(legacy);
        }

        legacy.RmRequisicaoCreateEndpointUrl = config.CreateEndpointUrl;
        legacy.RmRequisicaoGetEndpointUrl = null;
        legacy.RmRequisicaoParecerEndpointUrl = config.ParecerEndpointUrl;
        legacy.RmRequisicaoCreateUsername = config.RestUsername;
        legacy.RmRequisicaoCreatePassword = null;
        legacy.RequisicoesVagaOrigemRm = config.RequisicoesVagaOrigemRm;
        legacy.RmImportacaoAutomaticaAtiva = config.ImportacaoAutomaticaAtiva;
        legacy.RmImportacaoAutomaticaIntervaloMinutos = config.ImportacaoAutomaticaIntervaloMinutos;
        legacy.RmImportacaoAutomaticaMaxPorExecucao = config.ImportacaoAutomaticaMaxPorExecucao;
        legacy.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    private static TenantRmConfiguracaoDto Map(TenantRmConfiguracao c) => new()
    {
        SqlServer = c.SqlServer,
        SqlDatabase = c.SqlDatabase,
        SqlUserId = c.SqlUserId,
        SqlPasswordConfigured = !string.IsNullOrWhiteSpace(c.SqlPasswordEncrypted),
        SqlEncrypt = c.SqlEncrypt,
        SqlTrustServerCertificate = c.SqlTrustServerCertificate,
        SqlConnectTimeoutSeconds = c.SqlConnectTimeoutSeconds,
        SqlApplicationIntent = c.SqlApplicationIntent,
        Mode = c.Mode,
        CreateEndpointUrl = c.CreateEndpointUrl,
        GetEndpointUrl = c.GetEndpointUrl,
        ParecerEndpointUrl = c.ParecerEndpointUrl,
        RequestTimeoutSeconds = c.RequestTimeoutSeconds,
        RestUsername = c.RestUsername,
        RestPasswordConfigured = !string.IsNullOrWhiteSpace(c.RestPasswordEncrypted),
        RestBearerTokenConfigured = !string.IsNullOrWhiteSpace(c.RestBearerTokenEncrypted),
        MaxTentativas = c.MaxTentativas,
        CreateWorkerEnabled = c.CreateWorkerEnabled,
        CreateWorkerIntervalSeconds = c.CreateWorkerIntervalSeconds,
        CreateWorkerMaxPerTenant = c.CreateWorkerMaxPerTenant,
        CodColRequisicaoDefault = c.CodColRequisicaoDefault,
        CodColRequisitanteDefault = c.CodColRequisitanteDefault,
        CodStatusInicial = c.CodStatusInicial,
        CodLocalDefault = c.CodLocalDefault,
        CodFilialDefault = c.CodFilialDefault,
        DiasPrevisaoPadrao = c.DiasPrevisaoPadrao,
        RecCreatedBy = c.RecCreatedBy,
        RecModifiedBy = c.RecModifiedBy,
        RequisicoesVagaOrigemRm = c.RequisicoesVagaOrigemRm,
        ImportacaoAutomaticaAtiva = c.ImportacaoAutomaticaAtiva,
        ImportacaoAutomaticaIntervaloMinutos = c.ImportacaoAutomaticaIntervaloMinutos,
        ImportacaoAutomaticaMaxPorExecucao = c.ImportacaoAutomaticaMaxPorExecucao,
        StatusSyncEnabled = c.StatusSyncEnabled,
        StatusSyncIntervalMinutes = c.StatusSyncIntervalMinutes,
        StatusSyncMaxPerRun = c.StatusSyncMaxPerRun,
        SyncUnits = c.SyncUnits,
        SyncUnitsExecute = c.SyncUnitsExecute,
        SyncVagas = c.SyncVagas,
        SyncVagasOnly = c.SyncVagasOnly,
        SyncEmpresas = c.SyncEmpresas,
        SyncHierarquia = c.SyncHierarquia,
        SyncDesligamentos = c.SyncDesligamentos,
        SyncCandidatosVagaDiagnostic = c.SyncCandidatosVagaDiagnostic,
        SyncCandidatosVaga = c.SyncCandidatosVaga,
        SyncCandidatosPerfilCv = c.SyncCandidatosPerfilCv,
        UseGestorHierarquiaPosicao = c.UseGestorHierarquiaPosicao,
        UseHierarquiaOrganogramaPosicao = c.UseHierarquiaOrganogramaPosicao,
        MaxTalentosToSync = c.MaxTalentosToSync,
        MaxCandidatosToSync = c.MaxCandidatosToSync,
        MaxPessoasToSync = c.MaxPessoasToSync,
        MaxFuncionariosToSync = c.MaxFuncionariosToSync,
        SyncOnlyEmail = c.SyncOnlyEmail,
        VagaDefaultAreaCode = c.VagaDefaultAreaCode,
        Schema = c.Schema,
        AreaTable = c.AreaTable,
        DepartamentoTable = c.DepartamentoTable,
        FuncaoTable = c.FuncaoTable,
        CargoTable = c.CargoTable,
        VagaTable = c.VagaTable,
        UnidadeTable = c.UnidadeTable,
        FuncionarioTable = c.FuncionarioTable,
        PessoaTable = c.PessoaTable,
        HierarquiaTable = c.HierarquiaTable,
        HierarquiaColigadaExternaTable = c.HierarquiaColigadaExternaTable,
        DesligamentoTable = c.DesligamentoTable,
        AumentoQuadroTable = c.AumentoQuadroTable,
        SubstituicaoTable = c.SubstituicaoTable,
        TransferenciaPromocaoTable = c.TransferenciaPromocaoTable,
        GestoresRmUrlTemplate = c.GestoresRmUrlTemplate,
        GestoresRmUser = c.GestoresRmUser,
        GestoresRmPasswordConfigured = !string.IsNullOrWhiteSpace(c.GestoresRmPasswordEncrypted),
        GestoresRmDefaultCodColigada = c.GestoresRmDefaultCodColigada,
        GestoresRmDelayMsBetweenRequests = c.GestoresRmDelayMsBetweenRequests
    };

    private string DecryptOrEmpty(string? encrypted) => string.IsNullOrWhiteSpace(encrypted) ? string.Empty : _protector.Decrypt(encrypted);

    private static void Copy(TenantRmConfiguracaoDto source, TenantRmConfiguracaoDto target)
    {
        foreach (var prop in typeof(TenantRmConfiguracaoDto).GetProperties())
            prop.SetValue(target, prop.GetValue(source));
    }

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string DefaultIfBlank(string? value, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}
