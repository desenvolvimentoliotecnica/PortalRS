namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Categoria de item estruturado dentro de uma <see cref="Domain.Entities.DescricaoCargo"/>.
///
/// Adotado a partir do template DNALIO (modelo de descrição de cargo do usuário —
/// anexo "Assistente de Suporte Tecnico.docx"). Cada categoria mapeia uma seção
/// do documento, e o <see cref="Domain.Entities.DescricaoCargoItem"/> armazena
/// uma linha (atividade, vivência, competência ou requisito) tipada.
///
/// Esses itens são consumidos pelo `MatchingService` para calcular score do
/// candidato vs descrição de cargo, granularmente por categoria. O texto livre
/// HTML/Markdown na entidade pai (`Responsibilities`, `Requirements`, etc.)
/// continua existindo para apresentação pública (publicação de vaga, portal),
/// enquanto os itens estruturados servem o algoritmo de matching.
/// </summary>
public enum DescricaoCargoItemCategoria
{
    /// <summary>Atividades específicas do cargo (técnicas, do dia-a-dia da função).</summary>
    AtividadeEspecifica = 1,

    /// <summary>Atividades comuns ao nível do cargo (alinhadas com missão/valores da empresa).</summary>
    AtividadeComum = 2,

    /// <summary>
    /// Vivências/experiências específicas esperadas do candidato.
    /// Use <see cref="Domain.Entities.DescricaoCargoItem.IsObrigatoria"/> para distinguir
    /// "Obrigatório" vs "Desejável".
    /// </summary>
    VivenciaEspecifica = 3,

    /// <summary>Competências comportamentais — pilares de cultura DNALIO (ex.: Prioridade ao Cliente, Alta Performance).</summary>
    CompetenciaDnalio = 10,

    /// <summary>Competências de liderança e relacionamento (ex.: Trabalho em Equipe).</summary>
    CompetenciaLideranca = 11,

    /// <summary>Competências comportamentais funcionais — habilidades e atitudes (ex.: Administração do Tempo, Organização).</summary>
    CompetenciaFuncional = 12,

    /// <summary>Competências técnicas — conhecimentos e habilidades técnicas (ex.: Hardware, Microsoft Office, Redes).</summary>
    CompetenciaTecnica = 13,

    /// <summary>Requisitos obrigatórios do perfil (linha de corte do recrutamento).</summary>
    RequisitoObrigatorio = 20,
}
