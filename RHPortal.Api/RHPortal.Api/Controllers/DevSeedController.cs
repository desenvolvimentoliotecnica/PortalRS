using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint de desenvolvimento para popular dados de teste.
/// NÃO usar em produção.
/// </summary>
[ApiController]
[Route("api/dev")]
[Authorize]
public sealed class DevSeedController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;

    public DevSeedController(AppDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    /// <summary>Popula banco com dados de teste para fluxo completo de recrutamento.</summary>
    [HttpPost("seed")]
    public async Task<IActionResult> Seed(CancellationToken ct)
    {
        var t = _tenant.TenantId;
        var now = DateTimeOffset.UtcNow;

        // ── 1. Verificar se já tem dados de seed ──
        var existingVaga = await _db.Vagas.AsNoTracking().AnyAsync(v => v.Codigo == "SEED-DEV-001", ct);
        if (existingVaga) return Ok(new { message = "Dados de seed já existem. Use DELETE /api/dev/seed para limpar." });

        // ── 2. Área (pré-requisito da Vaga) ──
        var area = await _db.Set<Area>().FirstOrDefaultAsync(a => a.Code == "TI", ct);
        if (area is null)
        {
            area = new Area
            {
                Id = Guid.NewGuid(),
                TenantId = t,
                Code = "TI",
                Name = "Tecnologia da Informação",
                IsActive = true,
            };
            _db.Set<Area>().Add(area);
        }

        // ── 3. Unidade ──
        var unit = await _db.Set<Unit>().FirstOrDefaultAsync(u => u.Code == "SP01", ct);
        if (unit is null)
        {
            unit = new Unit
            {
                Id = Guid.NewGuid(),
                TenantId = t,
                Code = "SP01",
                Name = "Matriz São Paulo",
            };
            _db.Set<Unit>().Add(unit);
        }

        // ── 4. Cargo ──
        var cargo = await _db.Set<JobPosition>().FirstOrDefaultAsync(j => j.Code == "DEV-SR", ct);
        if (cargo is null)
        {
            cargo = new JobPosition
            {
                Id = Guid.NewGuid(),
                TenantId = t,
                Code = "DEV-SR",
                Name = "Desenvolvedor Senior",
            };
            _db.Set<JobPosition>().Add(cargo);
        }

        await _db.SaveChangesAsync(ct);

        // ── 5. Vaga ──
        var vaga = new Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = t,
            Titulo = "Desenvolvedor Backend Senior (.NET)",
            Codigo = "SEED-DEV-001",
            AreaId = area.Id,
            Status = VagaStatus.Aberta,
            Senioridade = VagaSenioridade.Senior,
            QuantidadeVagas = 2,
            MatchMinimoPercentual = 70,
            Cidade = "São Paulo",
            Uf = "SP",
            SalarioMinimo = 8000m,
            SalarioMaximo = 15000m,
            DescricaoInterna = "Vaga para dev senior com experiência em .NET, APIs REST e SQL Server. Modelo híbrido 3x2.",
            ResumoPitch = "Buscamos um dev senior apaixonado por backend, que goste de arquitetar soluções escaláveis e liderar code reviews.",
            TagsKeywordsRaw = "dotnet;csharp;sqlserver;api;rest;backend;senior",
            TagsResponsabilidadesRaw = "arquitetura;code-review;mentoria;apis;banco-de-dados",
            PesoCompetencia = 40,
            PesoExperiencia = 30,
            PesoFormacao = 15,
            PesoLocalidade = 15,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        _db.Vagas.Add(vaga);

        // ── 6. Candidatos (5 candidatos em diferentes estágios) ──
        var candidatos = new[]
        {
            new Candidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                Nome = "Ana Clara Silva", Email = "ana.silva@testmail.com",
                Fone = "(11) 99901-1001", Cidade = "São Paulo", Uf = "SP",
                VagaId = vaga.Id, Fonte = CandidateOrigin.Site,
                Status = CandidateStatus.Aprovado,
                ResumoProfissional = "8 anos de experiência como desenvolvedora backend .NET. Especialista em APIs REST e microsserviços.",
                PretensaoSalarial = 12000m, TrabalhandoAtualmente = true,
                CvText = "Experiência:\n- 2020-atual: Tech Lead na Empresa ABC (C#, .NET 6, SQL Server, Azure)\n- 2017-2020: Dev Senior na Startup XYZ (ASP.NET Core, PostgreSQL)\n- 2015-2017: Dev Pleno na Consultoria 123 (WCF, .NET Framework)\n\nFormação: Ciência da Computação - USP\nCertificações: Azure Developer Associate, MCSD",
                LastMatchScore = 92, LastMatchPass = true, LastMatchAtUtc = now,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new Candidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                Nome = "Bruno Costa Almeida", Email = "bruno.costa@testmail.com",
                Fone = "(11) 99902-2002", Cidade = "São Paulo", Uf = "SP",
                VagaId = vaga.Id, Fonte = CandidateOrigin.LinkedIn,
                Status = CandidateStatus.Aprovado,
                ResumoProfissional = "6 anos como dev backend. Forte em C#, DDD e mensageria (RabbitMQ/Kafka).",
                PretensaoSalarial = 10000m, TrabalhandoAtualmente = false,
                CvText = "Experiência:\n- 2021-2024: Backend Developer na FinTech Omega (C#, Kafka, MongoDB)\n- 2018-2021: Dev Pleno na Corp Beta (ASP.NET, SQL Server)\n\nFormação: Engenharia da Computação - UNICAMP",
                LastMatchScore = 85, LastMatchPass = true, LastMatchAtUtc = now,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new Candidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                Nome = "Carla Mendes Ferreira", Email = "carla.mendes@testmail.com",
                Fone = "(11) 99903-3003", Cidade = "Campinas", Uf = "SP",
                VagaId = vaga.Id, Fonte = CandidateOrigin.Email,
                Status = CandidateStatus.Triagem,
                ResumoProfissional = "5 anos de experiência em desenvolvimento Java/Spring. Transição para .NET nos últimos 2 anos.",
                PretensaoSalarial = 9000m, TrabalhandoAtualmente = true,
                CvText = "Experiência:\n- 2022-atual: Dev Backend na TechCo (C#, .NET 7, PostgreSQL)\n- 2019-2022: Dev Java na Enterprise Solutions (Spring Boot, MySQL)\n\nFormação: Sistemas de Informação - PUC Campinas",
                LastMatchScore = 78, LastMatchPass = true, LastMatchAtUtc = now,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new Candidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                Nome = "Diego Rocha Santos", Email = "diego.rocha@testmail.com",
                Fone = "(21) 99904-4004", Cidade = "Rio de Janeiro", Uf = "RJ",
                VagaId = vaga.Id, Fonte = CandidateOrigin.Site,
                Status = CandidateStatus.Triagem,
                ResumoProfissional = "3 anos como dev junior/pleno. Aprendendo .NET Core.",
                PretensaoSalarial = 7000m, TrabalhandoAtualmente = true,
                CvText = "Experiência:\n- 2022-atual: Dev Pleno (Node.js, TypeScript)\n- 2021-2022: Dev Junior (JavaScript, React)\n\nFormação: Análise e Desenvolvimento - Estácio",
                LastMatchScore = 55, LastMatchPass = false, LastMatchAtUtc = now,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new Candidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                Nome = "Elena Ribeiro Lima", Email = "elena.ribeiro@testmail.com",
                Fone = "(11) 99905-5005", Cidade = "São Paulo", Uf = "SP",
                VagaId = vaga.Id, Fonte = CandidateOrigin.Indicacao,
                Status = CandidateStatus.Triagem,
                ResumoProfissional = "10 anos como arquiteta de software .NET. Liderança de equipes e projetos de grande porte.",
                PretensaoSalarial = 15000m, TrabalhandoAtualmente = true,
                CvText = "Experiência:\n- 2019-atual: Arquiteta de Software na BigCorp (C#, Azure, Kubernetes)\n- 2014-2019: Tech Lead na MidSize Co (ASP.NET, SQL Server, CI/CD)\n\nFormação: Mestrado em Computação - USP\nCertificações: AWS Solutions Architect, Azure Architect Expert",
                LastMatchScore = 95, LastMatchPass = true, LastMatchAtUtc = now,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
        };

        _db.Candidatos.AddRange(candidatos);

        // ── 7. Talentos no Banco de Talentos ──
        var pessoa1 = new Pessoa
        {
            Id = Guid.NewGuid(), TenantId = t,
            Nome = "Felipe Augusto Martins", Email = "felipe.martins@testmail.com",
            Fone = "(31) 99906-6006", Cidade = "Belo Horizonte", Uf = "MG",
            Cpf = "11122233344",
            DataNascimento = new DateTime(1988, 3, 12),
            Origem = OrigemPessoa.Manual,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };

        var pessoa2 = new Pessoa
        {
            Id = Guid.NewGuid(), TenantId = t,
            Nome = "Gabriela Souza Nunes", Email = "gabriela.souza@testmail.com",
            Fone = "(41) 99907-7007", Cidade = "Curitiba", Uf = "PR",
            Cpf = "55566677788",
            DataNascimento = new DateTime(1992, 7, 25),
            Origem = OrigemPessoa.Manual,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };

        _db.Set<Pessoa>().AddRange(pessoa1, pessoa2);

        var talento1 = new Talento
        {
            Id = Guid.NewGuid(), TenantId = t,
            PessoaId = pessoa1.Id,
            Origem = OrigemTalento.Manual,
            Versao = 1,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };

        var talento2 = new Talento
        {
            Id = Guid.NewGuid(), TenantId = t,
            PessoaId = pessoa2.Id,
            Origem = OrigemTalento.Manual,
            Versao = 1,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };

        _db.Set<Talento>().AddRange(talento1, talento2);

        // ── 8. Projeto de Seleção + Fases ──
        var projeto = new ProjetoVaga
        {
            Id = Guid.NewGuid(), TenantId = t,
            VagaId = vaga.Id,
            Numero = 1,
            Descricao = "Rodada 1 - Dev Senior Backend",
            Status = StatusProjeto.Ativo,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };
        _db.Set<ProjetoVaga>().Add(projeto);

        var faseTriagem = new FaseProcesso
        {
            Id = Guid.NewGuid(), TenantId = t,
            ProjetoId = projeto.Id,
            Nome = "Triagem RH",
            Ordem = 0,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };
        var faseEntrevistaRh = new FaseProcesso
        {
            Id = Guid.NewGuid(), TenantId = t,
            ProjetoId = projeto.Id,
            Nome = "Entrevista RH",
            Ordem = 1,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };
        var faseTecnica = new FaseProcesso
        {
            Id = Guid.NewGuid(), TenantId = t,
            ProjetoId = projeto.Id,
            Nome = "Entrevista Técnica / Gestor",
            Ordem = 2,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };
        var faseProposta = new FaseProcesso
        {
            Id = Guid.NewGuid(), TenantId = t,
            ProjetoId = projeto.Id,
            Nome = "Proposta Final",
            Ordem = 3,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };

        _db.Set<FaseProcesso>().AddRange(faseTriagem, faseEntrevistaRh, faseTecnica, faseProposta);

        // ── 9. Candidatos no Projeto (em diferentes fases) ──
        var projetoCandidatos = new[]
        {
            new ProjetoCandidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                ProjetoId = projeto.Id,
                CandidatoId = candidatos[0].Id, // Ana - na fase Proposta (pronta pra aprovar)
                Status = StatusCandidatoProjeto.Ativo,
                FaseAtualId = faseProposta.Id,
                Observacoes = "Excelente desempenho em todas as etapas. Gestor quer aprovar contratação.",
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new ProjetoCandidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                ProjetoId = projeto.Id,
                CandidatoId = candidatos[1].Id, // Bruno - na fase Entrevista Técnica
                Status = StatusCandidatoProjeto.Ativo,
                FaseAtualId = faseTecnica.Id,
                Observacoes = "Bom perfil técnico. Agendada entrevista com gestor.",
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new ProjetoCandidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                ProjetoId = projeto.Id,
                CandidatoId = candidatos[2].Id, // Carla - na fase Entrevista RH
                Status = StatusCandidatoProjeto.Ativo,
                FaseAtualId = faseEntrevistaRh.Id,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
            new ProjetoCandidato
            {
                Id = Guid.NewGuid(), TenantId = t,
                ProjetoId = projeto.Id,
                CandidatoId = candidatos[4].Id, // Elena - na fase Proposta
                Status = StatusCandidatoProjeto.Aprovado,
                FaseAtualId = faseProposta.Id,
                Observacoes = "Perfil excepcional. Já aprovada pelo gestor.",
                CreatedAtUtc = now, UpdatedAtUtc = now,
            },
        };
        _db.Set<ProjetoCandidato>().AddRange(projetoCandidatos);

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            message = "Dados de teste criados com sucesso!",
            vaga = new { vaga.Id, vaga.Titulo, vaga.Codigo },
            candidatos = candidatos.Select(c => new { c.Id, c.Nome, c.Email, Status = c.Status.ToString(), MatchScore = c.LastMatchScore }),
            talentos = new[]
            {
                new { talento1.Id, pessoa1.Nome, pessoa1.Email },
                new { talento2.Id, pessoa2.Nome, pessoa2.Email },
            },
            projeto = new { projeto.Id, projeto.Descricao },
            fases = new[]
            {
                new { faseTriagem.Nome, faseTriagem.Ordem },
                new { faseEntrevistaRh.Nome, faseEntrevistaRh.Ordem },
                new { faseTecnica.Nome, faseTecnica.Ordem },
                new { faseProposta.Nome, faseProposta.Ordem },
            },
            dica = "Use o Processo Seletivo para visualizar os candidatos. Ana e Elena estão na fase 'Proposta Final' — prontas para 'Aprovar Contratação'."
        });
    }

    /// <summary>Remove dados de teste criados pelo seed.</summary>
    [HttpDelete("seed")]
    public async Task<IActionResult> ClearSeed(CancellationToken ct)
    {
        var vaga = await _db.Vagas.FirstOrDefaultAsync(v => v.Codigo == "SEED-DEV-001", ct);
        if (vaga is null) return Ok(new { message = "Nenhum dado de seed encontrado." });

        // Deletar projetos e cascatas
        var projetos = await _db.Set<ProjetoVaga>().Where(p => p.VagaId == vaga.Id).ToListAsync(ct);
        _db.Set<ProjetoVaga>().RemoveRange(projetos);

        // Deletar candidatos da vaga
        var candidatos = await _db.Candidatos.Where(c => c.VagaId == vaga.Id).ToListAsync(ct);
        _db.Candidatos.RemoveRange(candidatos);

        // Deletar vaga
        _db.Vagas.Remove(vaga);

        // Deletar pessoas/talentos de teste
        var pessoasTest = await _db.Set<Pessoa>().Where(p =>
            p.Email == "felipe.martins@testmail.com" || p.Email == "gabriela.souza@testmail.com").ToListAsync(ct);
        if (pessoasTest.Count > 0)
        {
            var pessoaIds = pessoasTest.Select(p => p.Id).ToList();
            var talentos = await _db.Set<Talento>().Where(t => pessoaIds.Contains(t.PessoaId)).ToListAsync(ct);
            _db.Set<Talento>().RemoveRange(talentos);
            _db.Set<Pessoa>().RemoveRange(pessoasTest);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Dados de seed removidos." });
    }
}
