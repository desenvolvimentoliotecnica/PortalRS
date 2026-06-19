namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Título de vaga/requisição espelhando o campo Função do RM: "{codigo} - {nome}".
/// </summary>
public static class RmFuncaoTituloBuilder
{
    public const string MissingTitulo = "-";
    private const int MaxLength = 160;

    /// <summary>
    /// Monta o título a partir de PFUNCAO (código + nome/descrição). Sem fallback para outros campos.
    /// </summary>
    public static string Build(string? codFuncao, string? nomeFuncao, string? descricaoFuncao = null)
    {
        var codigo = codFuncao?.Trim();
        var nome = FirstNonBlank(nomeFuncao, descricaoFuncao)?.Trim();

        if (string.IsNullOrWhiteSpace(codigo) || string.IsNullOrWhiteSpace(nome))
            return MissingTitulo;

        if (nome.StartsWith($"{codigo} - ", StringComparison.OrdinalIgnoreCase))
            return TrimToMax(nome);

        return TrimToMax($"{codigo} - {nome}");
    }

    private static string? FirstNonBlank(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private static string TrimToMax(string value) =>
        value.Length <= MaxLength ? value : value[..MaxLength];
}
