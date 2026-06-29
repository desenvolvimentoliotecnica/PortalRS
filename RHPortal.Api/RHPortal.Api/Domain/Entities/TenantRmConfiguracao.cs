namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Configuração centralizada de integração TOTVS RM por tenant.
/// </summary>
public sealed class TenantRmConfiguracao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // SQL Server RM
    public string? SqlServer { get; set; }
    public string? SqlDatabase { get; set; }
    public string? SqlUserId { get; set; }
    public string? SqlPasswordEncrypted { get; set; }
    public bool SqlEncrypt { get; set; } = true;
    public bool SqlTrustServerCertificate { get; set; } = true;
    public int SqlConnectTimeoutSeconds { get; set; } = 15;
    public string? SqlApplicationIntent { get; set; } = "ReadOnly";

    // REST RM
    public string Mode { get; set; } = "stub";
    public string? CreateEndpointUrl { get; set; }
    public string? GetEndpointUrl { get; set; }
    public string? ParecerEndpointUrl { get; set; }
    public int RequestTimeoutSeconds { get; set; } = 60;
    public string? RestUsername { get; set; }
    public string? RestPasswordEncrypted { get; set; }
    public string? RestBearerTokenEncrypted { get; set; }

    // Criação de requisições RM
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

    // Importação e status
    public bool RequisicoesVagaOrigemRm { get; set; } = true;
    public bool ImportacaoAutomaticaAtiva { get; set; }
    public int ImportacaoAutomaticaIntervaloMinutos { get; set; } = 15;
    public int ImportacaoAutomaticaMaxPorExecucao { get; set; } = 50;
    public bool StatusSyncEnabled { get; set; }
    public int StatusSyncIntervalMinutes { get; set; } = 15;
    public int StatusSyncMaxPerRun { get; set; } = 50;

    // Worker RM
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

    // Schema / tabelas / views RM
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

    // Gestores RM
    public string? GestoresRmUrlTemplate { get; set; }
    public string? GestoresRmUser { get; set; }
    public string? GestoresRmPasswordEncrypted { get; set; }
    public short GestoresRmDefaultCodColigada { get; set; } = 1;
    public int GestoresRmDelayMsBetweenRequests { get; set; } = 250;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
