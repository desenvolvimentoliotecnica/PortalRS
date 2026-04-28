using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Auditoria de cada execução do worker <c>Liotecnica.Integration.RM</c>: uma linha por entidade RM
/// processada por ciclo (PFUNC, PPESSOA, VRSVAGAS, VHIERARQUIA, VREQDESLIGAMENTO, etc.).
/// Substitui o sink atual em arquivo (<c>extraction.log</c>) por persistência consultável,
/// alimentando a aba "Sincronização RM" da tela Owner Integração TOTVS.
/// O worker chama <c>POST /api/integracao-totvs/rm-runs</c> antes de cada entidade
/// (cria com <see cref="RmSyncStatus.InProgress"/>) e <c>PATCH .../rm-runs/{id}</c> ao final.
/// </summary>
public sealed class RmSyncRun : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Nome da tabela RM ou agregado lógico (ex.: "VRSVAGAS", "PFUNC", "VHIERARQUIA", "VREQDESLIGAMENTO").</summary>
    [MaxLength(60)]
    public string Entidade { get; set; } = default!;

    /// <summary>Tipo da execução: "incremental" (delta por watermark) ou "full" (varredura completa).</summary>
    [MaxLength(20)]
    public string Operacao { get; set; } = "full";

    public DateTimeOffset StartedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAtUtc { get; set; }

    public RmSyncStatus Status { get; set; } = RmSyncStatus.InProgress;

    public int TotalLidos { get; set; }
    public int Criados { get; set; }
    public int Atualizados { get; set; }
    public int Ignorados { get; set; }

    /// <summary>Mensagem de erro quando <see cref="Status"/> é Falha ou FalhaParcial. Truncada em 2000 chars.</summary>
    [MaxLength(2000)]
    public string? ErroMensagem { get; set; }

    /// <summary>Watermark <c>RECMODIFIEDON</c> aplicado como filtro WHERE no SELECT do RM (null em ciclo full).</summary>
    public DateTime? WatermarkAplicadoUtc { get; set; }

    /// <summary>Novo watermark capturado no batch (MAX RECMODIFIEDON dos registros lidos). Persistido em <c>RmSyncCheckpoint</c> ao final.</summary>
    public DateTime? WatermarkNovoUtc { get; set; }
}
