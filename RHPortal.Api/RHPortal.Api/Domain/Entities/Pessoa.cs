using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Entidade de pessoa — registra dados da pessoa. Base para Talento e Funcionário.</summary>
public sealed class Pessoa : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Origem do cadastro: manual, talento, vaga, email, site, pasta, funcionário ou outro.</summary>
    public OrigemPessoa Origem { get; set; } = OrigemPessoa.Manual;

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [Required, StringLength(180)]
    public string Email { get; set; } = string.Empty;

    [StringLength(40)]
    public string? Fone { get; set; }

    [StringLength(120)]
    public string? Cidade { get; set; }

    [StringLength(2)]
    public string? Uf { get; set; }

    [StringLength(260)]
    public string? LinkedinUrl { get; set; }

    [StringLength(2000)]
    public string? ResumoProfissional { get; set; }

    [StringLength(2000)]
    public string? Obs { get; set; }

    [StringLength(20)]
    public string? Cep { get; set; }

    [StringLength(200)]
    public string? Logradouro { get; set; }

    [StringLength(40)]
    public string? Numero { get; set; }

    [StringLength(120)]
    public string? Bairro { get; set; }

    [StringLength(120)]
    public string? Complemento { get; set; }

    [StringLength(14)]
    public string? Cpf { get; set; }

    [StringLength(20)]
    public string? Rg { get; set; }

    [StringLength(40)]
    public string? FoneContato { get; set; }

    /// <summary>Data de nascimento (apenas data, sem hora).</summary>
    public DateTime? DataNascimento { get; set; }

    // ── Documentos pessoais (LUC-122 — vida completa do colaborador) ─────────

    /// <summary>"M" = Masculino, "F" = Feminino, "O" = Outros.</summary>
    [StringLength(1)]
    public string? Sexo { get; set; }

    /// <summary>Estado civil (TOTVS: S=Solteiro, C=Casado, D=Divorciado, V=Viúvo, etc.).</summary>
    [StringLength(2)]
    public string? EstadoCivil { get; set; }

    /// <summary>Naturalidade (cidade onde nasceu).</summary>
    [StringLength(120)]
    public string? Naturalidade { get; set; }

    /// <summary>UF de nascimento.</summary>
    [StringLength(2)]
    public string? EstadoNatal { get; set; }

    /// <summary>Grau de instrução (TOTVS usa códigos: A=Analf, B=Fundamental, C=Médio, D=Superior, E=Especialização, F=Mestrado, G=Doutorado).</summary>
    [StringLength(5)]
    public string? GrauInstrucao { get; set; }

    /// <summary>Órgão emissor do RG (ex.: "SSP").</summary>
    [StringLength(20)]
    public string? RgOrgEmissor { get; set; }

    /// <summary>UF do RG.</summary>
    [StringLength(2)]
    public string? RgUf { get; set; }

    /// <summary>Data de emissão do RG.</summary>
    public DateTime? RgDataEmissao { get; set; }

    /// <summary>Número da CTPS.</summary>
    [StringLength(20)]
    public string? CarteiraTrabalho { get; set; }

    /// <summary>Série da CTPS.</summary>
    [StringLength(10)]
    public string? CarteiraTrabalhoSerie { get; set; }

    /// <summary>UF da CTPS.</summary>
    [StringLength(2)]
    public string? CarteiraTrabalhoUf { get; set; }

    /// <summary>Data de emissão da CTPS.</summary>
    public DateTime? CarteiraTrabalhoData { get; set; }

    /// <summary>PIS/PASEP/NIS.</summary>
    [StringLength(20)]
    public string? NumeroPis { get; set; }

    /// <summary>Título de eleitor.</summary>
    [StringLength(20)]
    public string? TituloEleitor { get; set; }

    /// <summary>Zona do título.</summary>
    [StringLength(10)]
    public string? TituloEleitorZona { get; set; }

    /// <summary>Seção do título.</summary>
    [StringLength(10)]
    public string? TituloEleitorSecao { get; set; }

    /// <summary>Certificado militar (reservista).</summary>
    [StringLength(20)]
    public string? CertificadoReservista { get; set; }

    /// <summary>Categoria militar (P=Permanente, etc.).</summary>
    [StringLength(2)]
    public string? CategoriaMilitar { get; set; }

    /// <summary>Nome do pai (Filiação — vem do PPESSOA).</summary>
    [StringLength(160)]
    public string? NomePai { get; set; }

    /// <summary>Nome da mãe (Filiação — vem do PPESSOA).</summary>
    [StringLength(160)]
    public string? NomeMae { get; set; }

    /// <summary>Nacionalidade (PPESSOA.NACIONALIDADE — código TOTVS, ex.: "10" = Brasileira).</summary>
    [StringLength(60)]
    public string? Nacionalidade { get; set; }

    /// <summary>
    /// Latitude geocodificada (graus decimais, WGS84). Cache do resultado de
    /// `IGeocodingService.GeocodeAsync` baseado no endereço (CEP+rua+cidade+UF).
    /// Recalculada quando endereço muda. Usada pelo MatchingService para
    /// calcular distância candidato × empresa.
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>Longitude geocodificada. Veja nota em <see cref="Latitude"/>.</summary>
    public decimal? Longitude { get; set; }

    /// <summary>Quando a geocodificação foi computada pela última vez. Null = nunca.</summary>
    public DateTimeOffset? GeocodificadoEmUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public List<PessoaBloqueio> Bloqueios { get; set; } = new();
}
