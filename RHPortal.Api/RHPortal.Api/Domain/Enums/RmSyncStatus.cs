namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Status de uma execução do worker <c>Liotecnica.Integration.RM</c>
/// para uma entidade específica (PFUNC, VRSVAGAS, VHIERARQUIA, etc.).
/// Persistido em <c>RmSyncRun</c> e exibido na tela Owner Integração TOTVS, aba "Sincronização RM".
/// </summary>
public enum RmSyncStatus : short
{
    /// <summary>Ciclo iniciado mas ainda não finalizado.</summary>
    InProgress = 1,

    /// <summary>Tudo OK — extração + POST bulk concluíram sem erro.</summary>
    Sucesso = 2,

    /// <summary>Falha total — nenhum registro foi propagado ao Portal.</summary>
    Falha = 3,

    /// <summary>Falha parcial — parte dos registros foi aceita, parte falhou (HTTP 207 ou contadores divergentes).</summary>
    FalhaParcial = 4,
}
