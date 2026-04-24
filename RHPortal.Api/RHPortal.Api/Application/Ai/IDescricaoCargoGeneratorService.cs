using System.Threading;
using System.Threading.Tasks;
using RhPortal.Api.Contracts.DescricaoCargo;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Gera um template DNALIO completo (estrutura <see cref="DescricaoCargoCreateRequest"/>)
/// a partir de um brief livre do gestor (título do cargo + contexto opcional).
/// LLM retorna JSON estruturado que é validado e devolvido pronto pra salvar/editar.
/// </summary>
public interface IDescricaoCargoGeneratorService
{
    /// <summary>
    /// Gera template DNALIO completo para o cargo descrito em <paramref name="titulo"/>.
    /// <paramref name="contextoAdicional"/> permite customizar (ex.: "indústria alimentícia,
    /// foco em eficiência operacional"). Retorna request pronto para o controller padrão
    /// de criação de DescricaoCargo.
    /// </summary>
    Task<DescricaoCargoGenerationResult> GenerateAsync(
        string titulo,
        string? contextoAdicional = null,
        string? areaOuDepto = null,
        CancellationToken ct = default);
}

public sealed record DescricaoCargoGenerationResult(
    bool IsSuccess,
    DescricaoCargoCreateRequest? Request,
    string? RawResponse,
    string? ErrorMessage);
