using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Contracts.Vagas;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RHPortal.Api.Tests.IntegracaoTotvs;

public sealed class VagaRmSyncApplicatorTests
{
    [Fact]
    public void ApplyImportFields_SetsClt_Moeda_Salario_FromVlr()
    {
        var v = new Vaga { Titulo = "X", TenantId = "t1" };
        var item = new VagaSyncRmItem
        {
            Titulo = "X",
            VlrSalario = 14124.00m,
            DataPrevistaInicio = new DateTime(2021, 8, 16),
            DataAbertura = new DateTime(2021, 8, 3),
        };

        VagaRmSyncApplicator.ApplyImportFields(v, item);

        Assert.Equal(VagaTipoContratacao.CLT, v.TipoContratacao);
        Assert.Equal(VagaMoeda.BRL, v.Moeda);
        Assert.Equal(14124.00m, v.SalarioMinimo);
        Assert.Equal(14124.00m, v.SalarioMaximo);
        Assert.Equal(new DateOnly(2021, 8, 16), v.DataInicio);
    }

    [Fact]
    public void ApplyImportFields_ExistingVaga_AlwaysSetsClt()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            TipoContratacao = VagaTipoContratacao.PJ,
        };

        VagaRmSyncApplicator.ApplyImportFields(v, new VagaSyncRmItem { Titulo = "X" });

        Assert.Equal(VagaTipoContratacao.CLT, v.TipoContratacao);
    }

    [Fact]
    public void ApplyImportFields_ClearsDataEncerramento_WhenDataFechamentoIsNull()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            DataEncerramento = new DateOnly(2024, 1, 10),
        };

        VagaRmSyncApplicator.ApplyImportFields(v, new VagaSyncRmItem { Titulo = "X", DataFechamento = null });

        Assert.Null(v.DataEncerramento);
    }

    [Fact]
    public void ApplyImportFields_ZeroSalary_DoesNotOverwriteExistingSalary()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            SalarioMinimo = 3000m,
            SalarioMaximo = 4000m,
        };

        VagaRmSyncApplicator.ApplyImportFields(v, new VagaSyncRmItem { Titulo = "X", VlrSalario = 0m });

        Assert.Equal(3000m, v.SalarioMinimo);
        Assert.Equal(4000m, v.SalarioMaximo);
    }

    [Fact]
    public void ApplyImportFields_AmbiguousSalaryText_DoesNotOverwriteAndKeepsObservation()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            SalarioMinimo = 3000m,
            SalarioMaximo = 4000m,
        };

        VagaRmSyncApplicator.ApplyImportFields(v, new VagaSyncRmItem
        {
            Titulo = "X",
            Remuneracao = "R$ 1.200,00 a R$ 1.800,00",
        });

        Assert.Equal(3000m, v.SalarioMinimo);
        Assert.Equal(4000m, v.SalarioMaximo);
        Assert.Contains("Remuneracao", v.ObservacoesRemuneracao ?? "");
    }

    [Fact]
    public void ApplyImportFields_UnknownEducationCode_DoesNotOverwriteExistingEducation()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            Escolaridade = VagaEscolaridade.SuperiorCompleto,
        };

        VagaRmSyncApplicator.ApplyImportFields(v, new VagaSyncRmItem { Titulo = "X", CodGrauInstrucao = 999 });

        Assert.Equal(VagaEscolaridade.SuperiorCompleto, v.Escolaridade);
    }

    [Fact]
    public void TryParseDecimalPtBr_ParsesSingleMonetaryValue()
    {
        Assert.Equal(14124.00m, VagaRmSyncApplicator.TryParseDecimalPtBr("14124,00"));
        Assert.Equal(1234.56m, VagaRmSyncApplicator.TryParseDecimalPtBr("1.234,56"));
        Assert.Equal(1234.56m, VagaRmSyncApplicator.TryParseDecimalPtBr("R$ 1.234,56"));
        Assert.Null(VagaRmSyncApplicator.TryParseDecimalPtBr("1.200,00 a 1.800,00"));
    }

    [Fact]
    public void MapCodGrauInstrucaoRm_MapsKnownCodes()
    {
        Assert.Equal(VagaEscolaridade.Medio, VagaRmSyncApplicator.MapCodGrauInstrucaoRm(2));
        Assert.Equal(VagaEscolaridade.SuperiorCompleto, VagaRmSyncApplicator.MapCodGrauInstrucaoRm(5));
        Assert.Null(VagaRmSyncApplicator.MapCodGrauInstrucaoRm(null));
        Assert.Null(VagaRmSyncApplicator.MapCodGrauInstrucaoRm(999));
    }

    [Fact]
    public void ApplyImportFields_BuildsObservacaoFaixa_WhenSalaryIsOnlyText()
    {
        var v = new Vaga { Titulo = "X", TenantId = "t1" };
        var item = new VagaSyncRmItem
        {
            Titulo = "X",
            Remuneracao = "Valor a combinar sem numero na string",
            CodTabelaSalarial = "001",
            CodNivelSalarial = "38",
            CodFaixaSalarial = "A080",
        };

        VagaRmSyncApplicator.ApplyImportFields(v, item);

        Assert.Contains("Faixa RM", v.ObservacoesRemuneracao ?? "");
        Assert.Contains("Remuneracao", v.ObservacoesRemuneracao ?? "");
    }

    [Fact]
    public void ApplyCltDefaultForImportedRmVaga_SetsClt_WhenRmVagaHasNullType()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            IdReqRmOrigem = "123",
            TipoContratacao = null,
        };

        var changed = VagaRmSyncApplicator.ApplyCltDefaultForImportedRmVaga(v);

        Assert.True(changed);
        Assert.Equal(VagaTipoContratacao.CLT, v.TipoContratacao);
    }

    [Fact]
    public void ApplyCltDefaultForImportedRmVaga_IgnoresManualVaga()
    {
        var v = new Vaga
        {
            Titulo = "X",
            TenantId = "t1",
            TipoContratacao = null,
        };

        var changed = VagaRmSyncApplicator.ApplyCltDefaultForImportedRmVaga(v);

        Assert.False(changed);
        Assert.Null(v.TipoContratacao);
    }
}
