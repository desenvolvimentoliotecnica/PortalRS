using System.Text.Json;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Monta um resumo audível para log/tentativa (IRM-04) sem expor texto livre sensível integral.
/// </summary>
public static class RmRequisicaoPayloadBuilder
{
    public static void EnsureCanBuild(SolicitacaoVaga s)
    {
        if (s.JobPositionId is null || s.JobPositionId == Guid.Empty)
            throw new InvalidOperationException(
                "Não é possível enviar ao RM sem cargo definido.");

        if (s.UnitId is null || s.UnitId == Guid.Empty)
            throw new InvalidOperationException(
                "Não é possível enviar ao RM sem unidade/filial definida.");

        if (!s.MotivoRequisicaoId.HasValue || s.MotivoRequisicaoId == Guid.Empty)
            throw new InvalidOperationException(
                "Não é possível enviar ao RM sem motivo parametrizado da requisição.");

        if (s.QtdPosicoes <= 0)
            throw new InvalidOperationException(
                "Quantidade de posições deve ser maior que zero antes do envio ao RM.");

        if (string.IsNullOrWhiteSpace(s.Titulo))
            throw new InvalidOperationException(
                "Título da solicitação é obrigatório antes do envio ao RM.");

        if (!s.FaixaSalarialMin.HasValue || !s.FaixaSalarialMax.HasValue)
            throw new InvalidOperationException(
                "Informe a faixa salarial (valores mínimo e máximo) antes do envio ao RM.");

        if (s.FaixaSalarialMin!.Value >= s.FaixaSalarialMax!.Value)
            throw new InvalidOperationException(
                "Faixa salarial inválida: o mínimo deve ser menor que o máximo antes do envio ao RM.");
    }

    /// <returns>JSON compacto; truncar antes de gravar na entidade de tentativa se necessário.</returns>
    public static string BuildResumoJson(SolicitacaoVaga s)
    {
        var mdLen = (s.MotivoDesligamentoTexto ?? "").Length;
        var payload = new
        {
            s.Id,
            s.TipoSolicitacao,
            TituloChars = Math.Min(s.Titulo.Length, 80),
            s.QtdPosicoes,
            s.TipoContrato,
            s.Urgencia,
            s.JobPositionId,
            s.UnitId,
            s.MotivoRequisicaoId,
            s.DecisaoRH,
            Substituicao = s.TipoSolicitacao == TipoSolicitacaoVaga.Substituicao,
            MotivoDesligamentoTextoApprox = mdLen > 400 ? 400 : mdLen,
            FaixaSalarialMin = s.FaixaSalarialMin,
            FaixaSalarialMax = s.FaixaSalarialMax,
            s.CnhObrigatoria,
            s.DisponibilidadeViagens,
            EscalaTrabalhoDeclarada = !string.IsNullOrWhiteSpace(s.EscalaTrabalho),
            s.IsConfidencial
        };

        return JsonSerializer.Serialize(payload);
    }

    /// <summary>Limita ao tamanho da coluna de auditoria.</summary>
    public static string TruncateResumo(string json, int maxLen = 8000)
        => json.Length <= maxLen ? json : json[..maxLen];
}
