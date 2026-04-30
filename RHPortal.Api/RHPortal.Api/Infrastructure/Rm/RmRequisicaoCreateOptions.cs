namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Criação de requisição de pessoal no RM (Fase 3 / IRM-01).
/// <para>
/// <b>Transporte (T03.T0):</b> produção pode usar SQL/procedure no mesmo SQL Server do RM ou ponte Progress/Datasul.
/// Esta versão suporta <c>Stub</c> (desenvolvimento / testes) e <c>Disabled</c> (falha explícita até configurar).
/// </para>
/// </summary>
public sealed class RmRequisicaoCreateOptions
{
    public const string SectionName = "RmRequisicaoCreate";

    /// <summary>stub | disabled</summary>
    public string Mode { get; set; } = "stub";

    /// <summary>Máximo de tentativas antes de <see cref="RhPortal.Api.Domain.Enums.IntegracaoResultado.FalhaDefinitiva"/>.</summary>
    public int MaxTentativas { get; set; } = 5;
}
