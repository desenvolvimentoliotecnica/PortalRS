namespace RhPortal.Api.Domain.Enums;

/// <summary>Origem do cadastro da pessoa: manual, talento, vaga (candidatura), email, site, pasta, funcionário ou outro.</summary>
public enum OrigemPessoa
{
    Manual = 0,
    Talento = 1,
    Vaga = 2,
    Email = 3,
    Site = 4,
    Candidatura = 5,
    Pasta = 6,
    Funcionario = 7,
    Outro = 8
}
