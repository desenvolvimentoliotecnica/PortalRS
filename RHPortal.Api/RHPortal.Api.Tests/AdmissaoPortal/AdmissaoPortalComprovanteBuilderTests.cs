using RhPortal.Api.Application.AdmissaoPortal;
using RhPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.AdmissaoPortal;

public sealed class AdmissaoPortalComprovanteBuilderTests
{
    [Fact]
    public void BuildPdf_GeraBytesValidosComAcentosEVariosDocumentos()
    {
        var pa = new Domain.Entities.PreAdmissao
        {
            Id = Guid.Parse("3be96c7b-ec54-4771-b474-5b4bf6ba07ac"),
            TenantId = "liotecnica",
            Nome = "Leonardo Mendes UAT — teste acentuação",
            Cpf = "32593118822",
            Email = "leonardomendes201704@gmail.com",
            Status = PreAdmissaoStatus.Preenchido,
            SubmittedAtUtc = DateTimeOffset.UtcNow,
            WizardCompletionPercent = 83,
            Logradouro = "Rua José da Silva",
            Cidade = "São Paulo",
            Uf = "SP",
            BancoNome = "Bradesco",
            DocumentosSolicitados =
            {
                new Domain.Entities.PreAdmissaoDocumentoSolicitado { TipoDocumento = TipoDocumento.CPF, Obrigatorio = true },
                new Domain.Entities.PreAdmissaoDocumentoSolicitado { TipoDocumento = TipoDocumento.ComprovanteResidencia, Obrigatorio = true },
                new Domain.Entities.PreAdmissaoDocumentoSolicitado { TipoDocumento = TipoDocumento.TituloEleitor, Obrigatorio = true },
            },
            Documentos =
            {
                new Domain.Entities.PreAdmissaoDocumento { Tipo = TipoDocumento.CPF },
                new Domain.Entities.PreAdmissaoDocumento { Tipo = TipoDocumento.ComprovanteResidencia },
            },
            Dependentes =
            {
                new Domain.Entities.PreAdmissaoDependente
                {
                    NomeCompleto = "Filho Teste",
                    Parentesco = Parentesco.Filho,
                    DataNascimento = new DateOnly(2015, 3, 10),
                },
            },
        };

        var pdf = AdmissaoPortalComprovanteBuilder.BuildPdf(pa, "430 - SUP. DE VENDAS", "Liotecnica");

        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 500);
        Assert.Equal((byte)'%', pdf[0]);
        Assert.Equal((byte)'P', pdf[1]);
        Assert.Contains("%PDF-"u8.ToArray(), pdf.AsSpan(0, 8));
    }
}
