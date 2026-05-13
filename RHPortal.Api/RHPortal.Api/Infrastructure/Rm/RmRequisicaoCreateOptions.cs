namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Criação de requisição de pessoal no RM (Fase 3 / IRM-01).
/// <para>
/// <b>Transporte (T03.T0):</b> produção pode usar SQL/procedure no mesmo SQL Server do RM ou ponte Progress/Datasul.
/// Esta versão suporta <c>Stub</c> (desenvolvimento / testes), <c>Rest</c> (endpoint RM)
/// e <c>Disabled</c> (falha explícita até configurar).
/// </para>
/// </summary>
public sealed class RmRequisicaoCreateOptions
{
    public const string SectionName = "RmRequisicaoCreate";

    /// <summary>stub | rest | disabled</summary>
    public string Mode { get; set; } = "stub";

    /// <summary>Máximo de tentativas antes de <see cref="RhPortal.Api.Domain.Enums.IntegracaoResultado.FalhaDefinitiva"/>.</summary>
    public int MaxTentativas { get; set; } = 5;

    public bool WorkerEnabled { get; set; } = true;
    public int WorkerIntervalSeconds { get; set; } = 30;
    public int WorkerMaxPerTenant { get; set; } = 20;

    /// <summary>URL completa do endpoint REST; quando preenchida, tem precedência sobre BaseUrl + EndpointPath.</summary>
    public string? EndpointUrl { get; set; }
    public string? BaseUrl { get; set; }
    public string EndpointPath { get; set; } = "RMSRestDataServer/rest/RhuReqAumentoQuadroData";
    public int RequestTimeoutSeconds { get; set; } = 60;

    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? BearerToken { get; set; }

    public short? CodColRequisicaoDefault { get; set; } = 1;
    public short? CodColRequisitanteDefault { get; set; }
    public short CodStatusInicial { get; set; } = 1;
    public int? CodLocalDefault { get; set; } = 1;
    public short? CodFilialDefault { get; set; }
    public int DiasPrevisaoPadrao { get; set; } = 5;
    public string RecCreatedBy { get; set; } = "portal";
    public string RecModifiedBy { get; set; } = "portal";
}
