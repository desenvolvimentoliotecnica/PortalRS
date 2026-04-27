namespace RhPortal.Api.Contracts.Pessoas;

/// <summary>Item enviado pelo worker TOTVS RM no bulk upsert de pessoas.</summary>
public sealed class PessoaBulkItem
{
    public string Nome { get; set; } = default!;
    public string? Email { get; set; }
    public string? Cpf { get; set; }
    public string? Telefone { get; set; }
    public string? Telefone2 { get; set; }

    // Endereço
    public string? Cep { get; set; }
    public string? Logradouro { get; set; }
    public string? Numero { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }

    // Identificação
    public DateTime? DataNascimento { get; set; }
    public string? Sexo { get; set; }
    public string? EstadoCivil { get; set; }
    public string? Naturalidade { get; set; }
    public string? EstadoNatal { get; set; }
    public string? GrauInstrucao { get; set; }
    public string? Nacionalidade { get; set; }

    // Filiação
    public string? NomePai { get; set; }
    public string? NomeMae { get; set; }

    // Documentos
    public string? Rg { get; set; }
    public string? RgOrgEmissor { get; set; }
    public string? RgUf { get; set; }
    public DateTime? RgDataEmissao { get; set; }
    public string? CarteiraTrabalho { get; set; }
    public string? CarteiraTrabalhoSerie { get; set; }
    public string? CarteiraTrabalhoUf { get; set; }
    public DateTime? CarteiraTrabalhoData { get; set; }
    public string? NumeroPis { get; set; }
    public string? TituloEleitor { get; set; }
    public string? TituloEleitorZona { get; set; }
    public string? TituloEleitorSecao { get; set; }
    public string? CertificadoReservista { get; set; }
    public string? CategoriaMilitar { get; set; }
}

public sealed class PessoaBulkRequest
{
    public List<PessoaBulkItem> Items { get; set; } = new();
}

public sealed record PessoaBulkResponse(int Created, int Updated, int Skipped, int Total);
