using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Gera pré-admissões com status Aprovada para testes de integração TOTVS.
/// </summary>
public static class PreAdmissaoSeeder
{
    private const int TargetCount = 5;

    // Dados fixos e realistas — sem dependência de Bogus.Extensions.Brazil
    private static readonly (string Nome, string Cpf, string Rg, string OrgaoRg, string Email,
        string NomeMae, string Celular, string Cep, string Logradouro, string Numero,
        string Bairro, string Cidade, string Uf, string BancoCod, string BancoNome,
        string Agencia, string Conta, string ContaDig, TipoContaBancaria TipoConta,
        decimal Salario, TipoContratacaoAdmissao Contrato, short CargaHoraria,
        string PisPasep, string Ctps, string CtpsSerie, string CtpsUf,
        Sexo Sexo, EstadoCivil EstadoCivil)[] _pessoas =
    [
        ("Ana Clara Silva",      "11122233344", "11.222.333-4", "SSP/SP", "ana.clara.silva@testmail.com",
         "Maria das Graças Silva",  "(11) 99901-1001", "01310-100", "Avenida Paulista",     "1000",
         "Bela Vista",    "São Paulo",      "SP", "033", "Santander",
         "0001", "12345678", "9", TipoContaBancaria.ContaCorrente,
         9500m,  TipoContratacaoAdmissao.CLT,     44, "123.45678.12-3", "0001234", "001", "SP",
         Sexo.Feminino,  EstadoCivil.Solteiro),

        ("Bruno Henrique Costa", "22233344455", "22.333.444-5", "SSP/SP", "bruno.henrique.costa@testmail.com",
         "Rosana Costa",            "(19) 99802-2002", "13010-110", "Rua Barão de Jaguara", "500",
         "Centro",        "Campinas",       "SP", "001", "Banco do Brasil",
         "1234", "87654321", "0", TipoContaBancaria.ContaCorrente,
         7200m,  TipoContratacaoAdmissao.CLT,     44, "234.56789.23-4", "0004567", "002", "SP",
         Sexo.Masculino, EstadoCivil.Casado),

        ("Carla Mendes Ferreira","33344455566", "33.444.555-6", "SSP/MG", "carla.mendes.ferreira@testmail.com",
         "Simone Ferreira",          "(31) 99803-3003", "30130-110", "Rua dos Carijós",      "123",
         "Centro",        "Belo Horizonte", "MG", "104", "Caixa Econômica Federal",
         "0547", "12345670", "1", TipoContaBancaria.ContaSalario,
         2200m,  TipoContratacaoAdmissao.Estagio, 30, "",              "0007890", "003", "MG",
         Sexo.Feminino,  EstadoCivil.Solteiro),

        ("Diego Rocha Santos",   "44455566677", "44.555.666-7", "SSP/RJ", "diego.rocha.santos@testmail.com",
         "Lucia Santos",             "(21) 99804-4004", "20040-020", "Rua da Assembleia",    "77",
         "Centro",        "Rio de Janeiro", "RJ", "237", "Bradesco",
         "2222", "55544433", "2", TipoContaBancaria.ContaCorrente,
         5800m,  TipoContratacaoAdmissao.CLT,     44, "345.67890.34-5", "0007891", "003", "RJ",
         Sexo.Masculino, EstadoCivil.Solteiro),

        ("Elena Ribeiro Lima",   "55566677788", "55.666.777-8", "SSP/SP", "elena.ribeiro.lima@testmail.com",
         "Teresa Ribeiro",           "(11) 99905-5005", "04552-050", "Rua Funchal",          "263",
         "Vila Olímpia",  "São Paulo",      "SP", "341", "Itaú",
         "3333", "99988877", "7", TipoContaBancaria.ContaCorrente,
         14000m, TipoContratacaoAdmissao.PJ,      44, "456.78901.45-6", "0009012", "004", "SP",
         Sexo.Feminino,  EstadoCivil.Casado),
    ];

    public static async Task EnsureAsync(
        AppDbContext db,
        string tenantId,
        int? randomSeed,
        CancellationToken ct)
    {
        try
        {
            // Usa IgnoreQueryFilters + filtro explícito para evitar problema de tenant context
            // no scope reutilizado do DbSeeder em modo multi-banco
            var existing = await db.PreAdmissoes
                .IgnoreQueryFilters()
                .AsNoTracking()
                .CountAsync(p => p.TenantId == tenantId && p.Status == PreAdmissaoStatus.Aprovada, ct);

            var now = DateTimeOffset.UtcNow;
            var records = new List<PreAdmissao>();

            if (existing >= TargetCount)
            {
                await EnsureFuncionarioCompletoQaAsync(db, tenantId, now, ct);
                return;
            }

            for (var i = existing; i < TargetCount; i++)
            {
                var p = _pessoas[i];
                var createdAt   = now.AddDays(-(10 - i * 2));
                var submittedAt = createdAt.AddDays(2);
                var approvedAt  = submittedAt.AddDays(1);
                var admissao    = DateOnly.FromDateTime(DateTime.Today.AddDays(7 + i * 7));

                records.Add(new PreAdmissao
                {
                    Id            = Guid.NewGuid(),
                    TenantId      = tenantId,
                    Status        = PreAdmissaoStatus.Aprovada,
                    PreenchidoPor = i % 2 == 0 ? PreenchidoPor.RH : PreenchidoPor.Candidato,

                    Nome             = p.Nome,
                    Cpf              = p.Cpf,
                    Rg               = p.Rg,
                    RgOrgaoExpedidor = p.OrgaoRg,
                    RgDataExpedicao  = new DateOnly(2018 - i, 3 + i, 10),
                    DataNascimento   = new DateOnly(1990 - i * 2, 1 + i, 15 + i),
                    Sexo             = p.Sexo,
                    EstadoCivil      = p.EstadoCivil,
                    Nacionalidade    = "Brasileira",
                    NomeMae          = p.NomeMae,
                    NaturalCidade    = p.Cidade,
                    NaturalUf        = p.Uf,

                    Cep        = p.Cep,
                    Logradouro = p.Logradouro,
                    Numero     = p.Numero,
                    Bairro     = p.Bairro,
                    Cidade     = p.Cidade,
                    Uf         = p.Uf,

                    Email                 = p.Email,
                    Celular               = p.Celular,
                    ContatoEmergenciaNome = p.NomeMae,
                    ContatoEmergenciaFone = p.Celular,

                    BancoCodigo   = p.BancoCod,
                    BancoNome     = p.BancoNome,
                    Agencia       = p.Agencia,
                    AgenciaDigito = "0",
                    Conta         = p.Conta,
                    ContaDigito   = p.ContaDig,
                    TipoConta     = p.TipoConta,

                    DataAdmissao        = admissao,
                    Salario             = p.Salario,
                    TipoContratacao     = p.Contrato,
                    CargaHorariaSemanal = p.CargaHoraria,
                    PisPasep            = string.IsNullOrEmpty(p.PisPasep) ? null : p.PisPasep,
                    Ctps                = p.Ctps,
                    CtpsSerie           = p.CtpsSerie,
                    CtpsUf              = p.CtpsUf,

                    // ── TOTVS: Jornada, Ponto e Sindicato (mocks para teste) ──
                    CodTurma                    = 100 + i,
                    IndFuncVinculado            = 1,
                    TipoMaoDeObra               = i % 2 == 0 ? "D" : "I",
                    CodSindicato                = 10 + i,
                    CodLocalMarcacao            = 200 + i,
                    CodClassFuncPontoEletronico = 300 + i,
                    CodLocalidade               = 400 + i,

                    ValidacaoCpfOk     = true,
                    ValidacaoCepOk     = true,
                    ValidacaoBancoOk   = p.Contrato != TipoContratacaoAdmissao.Estagio,
                    ValidacaoSalarioOk = true,

                    CreatedAtUtc   = createdAt,
                    UpdatedAtUtc   = approvedAt,
                    SubmittedAtUtc = submittedAt,
                    ApprovedAtUtc  = approvedAt,
                });
            }

            db.PreAdmissoes.AddRange(records);
            await db.SaveChangesAsync(ct);

            await EnsureFuncionarioCompletoQaAsync(db, tenantId, now, ct);
        }
        catch (Exception ex)
        {
            // Não quebra o startup, mas loga explicitamente para debug
            Console.Error.WriteLine($"[PreAdmissaoSeeder:{tenantId}] ERRO ao criar mock TOTVS: {ex.GetType().Name}: {ex.Message}");
            if (ex.InnerException is not null)
                Console.Error.WriteLine($"[PreAdmissaoSeeder:{tenantId}] Inner: {ex.InnerException.Message}");
        }
    }

    /// <summary>
    /// Mock QA: pré-admissão com TODOS os campos preenchidos (dados pessoais, bancários,
    /// trabalhistas e TOTVS completos) usando documentos com DVs válidos. Idempotente
    /// por CPF — não duplica se já existir.
    /// </summary>
    private static async Task EnsureFuncionarioCompletoQaAsync(
        AppDbContext db,
        string tenantId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        // CPF 458.271.630-07 — dígitos verificadores calculados (DV1=0, DV2=7).
        const string cpfQa = "45827163007";

        var ja = await db.PreAdmissoes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Cpf == cpfQa, ct);

        if (ja) return;

        var admissao = DateOnly.FromDateTime(DateTime.Today.AddDays(45));

        db.PreAdmissoes.Add(new PreAdmissao
        {
            Id            = Guid.NewGuid(),
            TenantId      = tenantId,
            Status        = PreAdmissaoStatus.Aprovada,
            PreenchidoPor = PreenchidoPor.RH,

            // ── Dados pessoais (RG-SP 45.678.901-4 com DV válido) ──
            Nome             = "Felipe Moreira Andrade",
            Cpf              = cpfQa,
            Rg               = "456789014",
            RgOrgaoExpedidor = "SSP/SP",
            RgDataExpedicao  = new DateOnly(2015, 6, 10),
            DataNascimento   = new DateOnly(1988, 5, 22),
            Sexo             = Sexo.Masculino,
            EstadoCivil      = EstadoCivil.Casado,
            Nacionalidade    = "Brasileira",
            NomeMae          = "Patrícia Moreira Andrade",
            NomePai          = "Roberto Henrique Andrade",
            NaturalCidade    = "São Paulo",
            NaturalUf        = "SP",

            // ── Endereço (CEP real — Pinheiros/SP) ──
            Cep        = "05409022",
            Logradouro = "Rua Cardeal Arcoverde",
            Numero     = "1345",
            Complemento = "Apto 72",
            Bairro     = "Pinheiros",
            Cidade     = "São Paulo",
            Uf         = "SP",

            // ── Contato ──
            Email                 = "felipe.moreira.andrade@testmail.com",
            Telefone              = "(11) 3030-4040",
            Celular               = "(11) 99906-6006",
            ContatoEmergenciaNome = "Patrícia Moreira Andrade",
            ContatoEmergenciaFone = "(11) 99903-3003",

            // ── Bancário ──
            BancoCodigo   = "341",
            BancoNome     = "Itaú Unibanco",
            Agencia       = "1234",
            AgenciaDigito = "0",
            Conta         = "567890",
            ContaDigito   = "0",
            TipoConta     = TipoContaBancaria.ContaCorrente,

            // ── Trabalhista (PIS 120.12345.67-2, Título 1234.5678.0191 — DVs válidos) ──
            EstabelecimentoCodigo = "001",
            DataAdmissao          = admissao,
            Salario               = 8500m,
            TipoContratacao       = TipoContratacaoAdmissao.CLT,
            CargaHorariaSemanal   = 40,
            PisPasep              = "12012345672",
            Ctps                  = "1234567",
            CtpsSerie             = "0015",
            CtpsUf                = "SP",
            TituloEleitorNumero   = "123456780191",
            TituloEleitorZona     = "123",
            TituloEleitorSecao    = "0245",
            TituloEleitorCidade   = "São Paulo",
            TituloEleitorUf       = "SP",

            // ── TOTVS: Integração base ──
            CodCargoTotvs          = 105,
            CodVinculoEmpregaticio = 10,  // CLT Prazo Indeterminado
            TipoFuncionario        = 1,   // Mensalista
            TipoEstatistica        = 1,   // Normal
            CategoriaSalarial      = 1,   // A
            GrauInstrucao          = 7,   // Superior Completo
            CodTurno               = 1,
            CentroCusto            = "001.01",
            UnidadeLotacao         = "001.001",

            // ── TOTVS: Jornada, Ponto e Sindicato (7 campos novos) ──
            CodTurma                    = 105,
            IndFuncVinculado            = 1,
            TipoMaoDeObra               = "D",  // Direta
            CodSindicato                = 15,
            CodLocalMarcacao            = 205,
            CodClassFuncPontoEletronico = 305,
            CodLocalidade               = 405,

            ValidacaoCpfOk     = true,
            ValidacaoCepOk     = true,
            ValidacaoBancoOk   = true,
            ValidacaoSalarioOk = true,

            CreatedAtUtc   = now.AddDays(-5),
            UpdatedAtUtc   = now.AddDays(-1),
            SubmittedAtUtc = now.AddDays(-3),
            ApprovedAtUtc  = now.AddDays(-2),
        });

        await db.SaveChangesAsync(ct);
    }
}
