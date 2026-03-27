using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.AdmissaoPortal;

// ── Login ──

public sealed record AdmissaoPortalLoginRequest(Guid PreAdmissaoId, string Cpf);

public sealed record AdmissaoPortalLoginResponse(Guid PreAdmissaoId, string Nome, string TenantId);

// ── Dados do portal ──

public sealed record AdmissaoPortalDataResponse(
    Guid PreAdmissaoId,
    string Nome,
    int Status,
    List<PortalDocumentoSolicitadoItem> DocumentosSolicitados,
    List<PortalDocumentoEnviadoItem> DocumentosEnviados,
    PortalDadosPessoais DadosPessoais
);

public sealed record PortalDocumentoSolicitadoItem(
    int Tipo,
    string Label,
    bool Obrigatorio,
    bool JaEnviado
);

public sealed record PortalDocumentoEnviadoItem(
    Guid Id,
    int Tipo,
    string NomeArquivo,
    long TamanhoBytes,
    int Status,
    string? ObservacaoRh,
    string PresignedUrl
);

public sealed record PortalDadosPessoais(
    string? Nome, string? Cpf, string? Rg, string? RgOrgaoExpedidor,
    string? DataNascimento, int? Sexo, int? EstadoCivil,
    string? Nacionalidade, string? NomeMae, string? NomePai,
    string? Cep, string? Logradouro, string? Numero,
    string? Complemento, string? Bairro, string? Cidade, string? Uf,
    string? Email, string? Telefone, string? Celular,
    string? ContatoEmergenciaNome, string? ContatoEmergenciaFone,
    string? BancoCodigo, string? BancoNome, string? Agencia,
    string? AgenciaDigito, string? Conta, string? ContaDigito, int? TipoConta,
    string? PisPasep, string? Ctps, string? CtpsSerie, string? CtpsUf
);

// ── Salvar dados pessoais ──

public sealed record PortalSalvarDadosRequest(
    string? Nome, string? Cpf, string? Rg, string? RgOrgaoExpedidor,
    string? DataNascimento, int? Sexo, int? EstadoCivil,
    string? Nacionalidade, string? NomeMae, string? NomePai,
    string? Cep, string? Logradouro, string? Numero,
    string? Complemento, string? Bairro, string? Cidade, string? Uf,
    string? Email, string? Telefone, string? Celular,
    string? ContatoEmergenciaNome, string? ContatoEmergenciaFone,
    string? BancoCodigo, string? BancoNome, string? Agencia,
    string? AgenciaDigito, string? Conta, string? ContaDigito, int? TipoConta,
    string? PisPasep, string? Ctps, string? CtpsSerie, string? CtpsUf
);

// ── Upload de documento ──

public sealed class PortalUploadDocumentoRequest
{
    public IFormFile File { get; set; } = null!;
    public TipoDocumento Tipo { get; set; }
}
