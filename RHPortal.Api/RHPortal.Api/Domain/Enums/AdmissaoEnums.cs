namespace RhPortal.Api.Domain.Enums;

public enum Sexo : short
{
    NaoInformado = 0,
    Masculino = 1,
    Feminino = 2,
    Outro = 3
}

public enum EstadoCivil : short
{
    NaoInformado = 0,
    Solteiro = 1,
    Casado = 2,
    Divorciado = 3,
    Viuvo = 4,
    UniaoEstavel = 5,
    Separado = 6
}

public enum TipoContratacaoAdmissao : short
{
    CLT = 0,
    PJ = 1,
    Estagio = 2,
    Temporario = 3,
    Aprendiz = 4,
    Terceirizado = 5
}

public enum TipoContaBancaria : short
{
    ContaCorrente = 0,
    ContaPoupanca = 1,
    ContaSalario = 2
}

public enum PreenchidoPor : short
{
    Candidato = 0,
    RH = 1
}
