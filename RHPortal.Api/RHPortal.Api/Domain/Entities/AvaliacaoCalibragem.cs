using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Linha de calibragem do comitê sobre um funcionário dentro de um ciclo.
/// Armazena a nota bruta do gestor (média das avaliações de ResponderAsync) e a
/// nota ajustada pelo comitê; o gestor tem a palavra final via <see cref="Decisao"/>.
/// </summary>
public sealed class AvaliacaoCalibragem : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CicloId { get; set; }
    public AvaliacaoCiclo? Ciclo { get; set; }

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Média das respostas recebidas até o snapshot.</summary>
    public decimal ScoreGestor { get; set; }

    /// <summary>1-3; categoria de Desempenho do gestor (mapeia na Nine Box).</summary>
    public int? DesempenhoGestor { get; set; }

    /// <summary>1-3; categoria de Potencial do gestor.</summary>
    public int? PotencialGestor { get; set; }

    /// <summary>Score ajustado pelo comitê (pode igualar ou divergir do gestor).</summary>
    public decimal? ScoreComite { get; set; }

    public int? DesempenhoComite { get; set; }
    public int? PotencialComite { get; set; }

    /// <summary>Justificativa do comitê quando diverge da nota do gestor.</summary>
    public string? JustificativaComite { get; set; }

    public AvaliacaoCalibragemStatus Status { get; set; } = AvaliacaoCalibragemStatus.Pendente;

    /// <summary>Versão finalmente homologada (Gestor ou Comitê).</summary>
    public AvaliacaoCalibragemVersao Decisao { get; set; } = AvaliacaoCalibragemVersao.Indefinida;

    public Guid? DecididoPorUserId { get; set; }
    public DateTimeOffset? DecididoEmUtc { get; set; }

    /// <summary>Observação final do gestor (quando decide).</summary>
    public string? ObservacaoDecisao { get; set; }

    /// <summary>Nine Box materializada a partir da decisão final (opcional).</summary>
    public Guid? NineBoxAssessmentId { get; set; }
    public NineBoxAssessment? NineBoxAssessment { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }
}
