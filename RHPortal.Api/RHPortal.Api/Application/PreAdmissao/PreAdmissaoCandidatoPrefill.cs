using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Preenche campos vazios da pré-admissão a partir do candidato e da pessoa vinculada (talento).
/// </summary>
public static class PreAdmissaoCandidatoPrefill
{
    public static void ApplyIfEmpty(Domain.Entities.PreAdmissao pa, Candidato candidato)
    {
        pa.Nome = PickIfEmpty(pa.Nome, candidato.Nome);
        pa.Email = PickIfEmpty(pa.Email, candidato.Email);
        pa.Celular = PickIfEmpty(pa.Celular, candidato.Celular, candidato.Fone);
        pa.Cidade = PickIfEmpty(pa.Cidade, candidato.Cidade);
        pa.Uf = PickIfEmpty(pa.Uf, candidato.Uf);

        var pessoa = candidato.Talento?.Pessoa;
        if (pessoa is null)
            return;

        pa.Nome = PickIfEmpty(pa.Nome, pessoa.Nome);
        pa.Cpf = PickIfEmpty(pa.Cpf, pessoa.Cpf);
        pa.Rg = PickIfEmpty(pa.Rg, pessoa.Rg);
        pa.RgOrgaoExpedidor = PickIfEmpty(pa.RgOrgaoExpedidor, pessoa.RgOrgEmissor);
        pa.RgUfExpedidor = PickIfEmpty(pa.RgUfExpedidor, pessoa.RgUf);
        pa.NomeMae = PickIfEmpty(pa.NomeMae, pessoa.NomeMae);
        pa.NomePai = PickIfEmpty(pa.NomePai, pessoa.NomePai);
        pa.PisPasep = PickIfEmpty(pa.PisPasep, pessoa.NumeroPis);
        pa.Cep = PickIfEmpty(pa.Cep, pessoa.Cep);
        pa.Logradouro = PickIfEmpty(pa.Logradouro, pessoa.Logradouro);
        pa.Numero = PickIfEmpty(pa.Numero, pessoa.Numero);
        pa.Complemento = PickIfEmpty(pa.Complemento, pessoa.Complemento);
        pa.Bairro = PickIfEmpty(pa.Bairro, pessoa.Bairro);
        pa.Cidade = PickIfEmpty(pa.Cidade, pessoa.Cidade);
        pa.Uf = PickIfEmpty(pa.Uf, pessoa.Uf);
        pa.NaturalCidade = PickIfEmpty(pa.NaturalCidade, pessoa.Naturalidade);
        pa.NaturalUf = PickIfEmpty(pa.NaturalUf, pessoa.EstadoNatal);
        pa.Nacionalidade = PickIfEmpty(pa.Nacionalidade, pessoa.Nacionalidade);

        if (pa.DataNascimento is null && pessoa.DataNascimento.HasValue)
            pa.DataNascimento = DateOnly.FromDateTime(pessoa.DataNascimento.Value.Date);

        if (pa.RgDataExpedicao is null && pessoa.RgDataEmissao.HasValue)
            pa.RgDataExpedicao = DateOnly.FromDateTime(pessoa.RgDataEmissao.Value.Date);
    }

    private static string? PickIfEmpty(string? current, params string?[] sources)
    {
        if (!string.IsNullOrWhiteSpace(current))
            return current.Trim();

        foreach (var value in sources)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }

        return current;
    }
}
