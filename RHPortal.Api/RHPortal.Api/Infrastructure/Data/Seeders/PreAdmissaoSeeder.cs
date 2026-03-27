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

            if (existing >= TargetCount)
                return;

            var now = DateTimeOffset.UtcNow;
            var records = new List<PreAdmissao>();

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
        }
        catch (Exception ex)
        {
            // Não quebra o startup, mas loga explicitamente para debug
            Console.Error.WriteLine($"[PreAdmissaoSeeder:{tenantId}] ERRO ao criar mock TOTVS: {ex.GetType().Name}: {ex.Message}");
            if (ex.InnerException is not null)
                Console.Error.WriteLine($"[PreAdmissaoSeeder:{tenantId}] Inner: {ex.InnerException.Message}");
        }
    }
}
