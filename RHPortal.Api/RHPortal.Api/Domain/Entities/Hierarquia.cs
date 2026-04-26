using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Espelho do organograma TOTVS RM (<c>VHIERARQUIA</c>) sincronizado a cada ciclo do worker.
///
/// Cada registro representa um nó da árvore (ex.: "ANALISTAS/ASSISTENTES SISTEMAS" ID=21).
/// A árvore é representada por:
///   - <see cref="HierarquiaSuperiorId"/> — FK self-reference (Guid local)
///   - <see cref="IdHierarquiaSuperiorRm"/> — id do pai no RM (uso para lookup durante sync)
///   - <see cref="Estrutura"/> — caminho material da raiz até o nó (ex.: "1.2.20.21")
///
/// Usado por:
///   - <c>Funcionario.HierarquiaId</c> — derivado da última <c>VREQTRANSFPROMOCAO</c> aprovada
///   - <c>Vaga.HierarquiaId</c> — derivado do <c>VREQAUMENTOQUADRO</c> ou <c>VREQSUBSTITUICAO</c> que originou
///   - Tela "Organograma" do Portal (<c>/admin/organograma</c>)
/// </summary>
public sealed class Hierarquia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>IDHIERARQUIA do RM. Único por tenant + coligada (mas usamos por tenant pois só temos uma coligada por sync).</summary>
    public int IdHierarquiaRm { get; set; }

    /// <summary>DESCHIERARQUIA — ex.: "ANALISTAS/ASSISTENTES SISTEMAS".</summary>
    [MaxLength(200)]
    public string Descricao { get; set; } = default!;

    /// <summary>IDHIERARQUIASUPERIOR do RM (id do nó pai no organograma). Null = raiz.</summary>
    public int? IdHierarquiaSuperiorRm { get; set; }

    /// <summary>FK para a hierarquia pai no Portal. Resolvida em 2ª passada do sync.</summary>
    public Guid? HierarquiaSuperiorId { get; set; }
    public Hierarquia? HierarquiaSuperior { get; set; }

    /// <summary>ESTRUTURA — caminho material da raiz até o nó (ex.: "1.2.20.21"). Útil pra ordenação e queries de subárvore.</summary>
    [MaxLength(200)]
    public string? Estrutura { get; set; }

    /// <summary>IDNIVELHIERARQUIA do RM — qual camada do organograma o nó pertence.</summary>
    public int? IdNivelHierarquiaRm { get; set; }

    /// <summary>STATUS do RM: 1=ativo, 0=inativo.</summary>
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
