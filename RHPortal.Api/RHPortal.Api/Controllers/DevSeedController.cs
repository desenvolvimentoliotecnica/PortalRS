using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
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
/// NÃO usar em produção. Protegido em runtime por <see cref="IHostEnvironment.IsDevelopment"/>
/// — em qualquer ambiente fora Development, todas as actions retornam 404.
/// </summary>
[ApiController]
[Route("api/dev")]
[AllowAnonymous]
public sealed class DevSeedController : ControllerBase, IActionFilter
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _env;

    public DevSeedController(
        AppDbContext db,
        ITenantContext tenant,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        IHostEnvironment env)
    {
        _db = db;
        _tenant = tenant;
        _userManager = userManager;
        _configuration = configuration;
        _env = env;
    }

    /// <summary>Guard central — bloqueia toda action fora de Development retornando 404.</summary>
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!_env.IsDevelopment())
        {
            context.Result = NotFound();
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }

    /// <summary>URL pública do front (Next.js) — `Frontend:BaseUrl` ou `http://localhost:{Frontend:Port}`.</summary>
    private string FrontendBaseUrl()
    {
        var baseOverride = _configuration["Frontend:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(baseOverride))
            return baseOverride.TrimEnd('/');
        var port = _configuration.GetValue<int?>("Frontend:Port") ?? 3005;
        return $"http://localhost:{port}";
    }

    /// <summary>
    /// Cria 3 usuários de teste para o fluxo completo de admissão:
    /// - Gestor: solicita vaga
    /// - Diretor (Superior): aprova solicitação de vaga
    /// - RH: preenche vaga, cadastra candidatos, conduz processo seletivo, aprova admissão
    /// </summary>
    [HttpPost("seed/usuarios-teste")]
    public async Task<IActionResult> SeedUsuariosTeste(CancellationToken ct)
    {
        var t = _tenant.TenantId;
        var now = DateTimeOffset.UtcNow;
        const string senha = "YkmF@2022*";

        // ── Verificar se já existem todos ──
        var gestorExiste = await _userManager.FindByEmailAsync("gestor@teste.local");
        var diretorExiste = await _userManager.FindByEmailAsync("diretor@teste.local");
        var rhExiste = await _userManager.FindByEmailAsync("rh@teste.local");
        if (gestorExiste != null && diretorExiste != null && rhExiste != null)
            return Ok(new
            {
                message = "Usuários de teste já existem.",
                gestor = new { email = "gestor@teste.local", senha, papel = "Gestor — solicita vaga" },
                diretor = new { email = "diretor@teste.local", senha, papel = "Diretor — aprova solicitação" },
                rh = new { email = "rh@teste.local", senha, papel = "RH — preenche vaga, candidatos, admissão" },
            });

        // ── Buscar roles ──
        var adminRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin", ct);
        var gestorRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Gestor", ct);
        var recrutadorRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Recrutador", ct);

        if (gestorRole is null || recrutadorRole is null || adminRole is null)
            return BadRequest(new { message = "Roles 'Admin', 'Gestor' ou 'Recrutador' não encontradas. Execute o seed principal primeiro (suba a API com Seed:Enabled=true)." });

        // ── Buscar/criar Centro de Custo e Unidade ──
        var centroCusto = await _db.Set<CentroCusto>().FirstOrDefaultAsync(cc => cc.IsActive, ct);
        if (centroCusto is null)
        {
            centroCusto = new CentroCusto { Id = Guid.NewGuid(), TenantId = t, Code = "OPS", Description = "Operações", IsActive = true };
            _db.Set<CentroCusto>().Add(centroCusto);
            await _db.SaveChangesAsync(ct);
        }

        var unit = await _db.Set<Unit>().FirstOrDefaultAsync(ct);
        var cargo = await _db.Set<JobPosition>().FirstOrDefaultAsync(ct);

        // ── 1. Funcionário Diretor (Superior / Aprovador) ──
        var diretorFunc = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Email == "diretor@teste.local", ct);
        if (diretorFunc is null)
        {
            diretorFunc = new Funcionario
            {
                Id = Guid.NewGuid(), TenantId = t,
                Name = "Roberto Diretor", Email = "diretor@teste.local", Phone = "(11) 99999-0000",
                Status = FuncionarioStatus.Active, CentroCustoId = centroCusto.Id, UnitId = unit?.Id, JobPositionId = cargo?.Id,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            };
            _db.Set<Funcionario>().Add(diretorFunc);
        }

        // ── 2. Funcionário Gestor (subordinado do Diretor) ──
        var gestorFunc = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Email == "gestor@teste.local", ct);
        if (gestorFunc is null)
        {
            gestorFunc = new Funcionario
            {
                Id = Guid.NewGuid(), TenantId = t,
                Name = "Carlos Gestor", Email = "gestor@teste.local", Phone = "(11) 99999-0001",
                Status = FuncionarioStatus.Active, CentroCustoId = centroCusto.Id, UnitId = unit?.Id, JobPositionId = cargo?.Id,
                GestorDiretoId = diretorFunc.Id,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            };
            _db.Set<Funcionario>().Add(gestorFunc);
        }

        // ── 3. Funcionário RH ──
        var rhFunc = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Email == "rh@teste.local", ct);
        if (rhFunc is null)
        {
            rhFunc = new Funcionario
            {
                Id = Guid.NewGuid(), TenantId = t,
                Name = "Ana RH", Email = "rh@teste.local", Phone = "(11) 99999-0002",
                Status = FuncionarioStatus.Active, CentroCustoId = centroCusto.Id, UnitId = unit?.Id, JobPositionId = cargo?.Id,
                GestorDiretoId = diretorFunc.Id,
                CreatedAtUtc = now, UpdatedAtUtc = now,
            };
            _db.Set<Funcionario>().Add(rhFunc);
        }

        await _db.SaveChangesAsync(ct);

        // ── Criar Users ──
        async Task<(bool ok, string? error)> CriarUserAsync(
            ApplicationUser? existente, string email, string fullName, Guid funcId,
            Funcionario func, string[] roles)
        {
            if (existente != null) return (true, null);
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(), Email = email, UserName = email,
                FullName = fullName, IsActive = true, FuncionarioId = funcId,
                TenantId = t, CreatedAtUtc = now, UpdatedAtUtc = now,
            };
            var result = await _userManager.CreateAsync(user, senha);
            if (!result.Succeeded)
                return (false, string.Join("; ", result.Errors.Select(e => e.Description)));
            foreach (var role in roles)
                await _userManager.AddToRoleAsync(user, role);
            func.UserId = user.Id;
            await _db.SaveChangesAsync(ct);
            return (true, null);
        }

        var (ok1, err1) = await CriarUserAsync(diretorExiste, "diretor@teste.local", "Roberto Diretor", diretorFunc.Id, diretorFunc, ["Admin"]);
        if (!ok1) return BadRequest(new { message = "Erro ao criar user diretor", error = err1 });

        var (ok2, err2) = await CriarUserAsync(gestorExiste, "gestor@teste.local", "Carlos Gestor", gestorFunc.Id, gestorFunc, ["Gestor", "Admin"]);
        if (!ok2) return BadRequest(new { message = "Erro ao criar user gestor", error = err2 });

        var (ok3, err3) = await CriarUserAsync(rhExiste, "rh@teste.local", "Ana RH", rhFunc.Id, rhFunc, ["Admin", "Recrutador"]);
        if (!ok3) return BadRequest(new { message = "Erro ao criar user RH", error = err3 });

        return Ok(new
        {
            message = "3 usuários de teste criados com sucesso!",
            tenant = t,
            senha,
            usuarios = new[]
            {
                new { email = "gestor@teste.local", nome = "Carlos Gestor", papel = "Gestor — solicita vaga", funcionarioId = gestorFunc.Id },
                new { email = "diretor@teste.local", nome = "Roberto Diretor", papel = "Diretor — aprova solicitação de vaga", funcionarioId = diretorFunc.Id },
                new { email = "rh@teste.local", nome = "Ana RH", papel = "RH — preenche vaga, candidatos, processo seletivo, admissão", funcionarioId = rhFunc.Id },
            },
            proximoPasso = $"Abra {FrontendBaseUrl()}/app/login e faça login com cada perfil. Consulte TESTE_FLUXO_ADMISSAO.md para o passo a passo.",
        });
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

        // ── 2. Centro de Custo (pré-requisito da Vaga) ──
        var centroCusto = await _db.Set<CentroCusto>().FirstOrDefaultAsync(cc => cc.Code == "TI", ct);
        if (centroCusto is null)
        {
            centroCusto = new CentroCusto
            {
                Id = Guid.NewGuid(),
                TenantId = t,
                Code = "TI",
                Description = "Tecnologia da Informação",
                IsActive = true,
            };
            _db.Set<CentroCusto>().Add(centroCusto);
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
            CentroCustoId = centroCusto.Id,
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
            DataNascimento = DateTime.SpecifyKind(new DateTime(1988, 3, 12), DateTimeKind.Utc),
            Origem = OrigemPessoa.Manual,
            CreatedAtUtc = now, UpdatedAtUtc = now,
        };

        var pessoa2 = new Pessoa
        {
            Id = Guid.NewGuid(), TenantId = t,
            Nome = "Gabriela Souza Nunes", Email = "gabriela.souza@testmail.com",
            Fone = "(41) 99907-7007", Cidade = "Curitiba", Uf = "PR",
            Cpf = "55566677788",
            DataNascimento = DateTime.SpecifyKind(new DateTime(1992, 7, 25), DateTimeKind.Utc),
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

    /// <summary>
    /// Cria pré-admissões com status Aprovada para teste de integração TOTVS.
    /// Disponibiliza dados em GET /api/pre-admissao/integracao/pendentes
    /// </summary>
    [HttpPost("seed/pre-admissoes")]
    public async Task<IActionResult> SeedPreAdmissoes(CancellationToken ct)
    {
        var t = _tenant.TenantId;
        var now = DateTimeOffset.UtcNow;

        var jaExiste = await _db.PreAdmissoes
            .AsNoTracking()
            .AnyAsync(p => p.Status == PreAdmissaoStatus.Aprovada
                        && p.Nome == "Ana Clara Silva (Mock TOTVS)", ct);

        if (jaExiste)
            return Ok(new { message = "Mock TOTVS já existe. Use DELETE /api/dev/seed/pre-admissoes para limpar e recriar." });

        var admissoes = new[]
        {
            new PreAdmissao
            {
                Id = Guid.NewGuid(), TenantId = t,
                Status = PreAdmissaoStatus.Aprovada, PreenchidoPor = PreenchidoPor.RH,
                Nome = "Ana Clara Silva (Mock TOTVS)",
                Cpf = "11122233344", Rg = "11.222.333-4", RgOrgaoExpedidor = "SSP/SP",
                RgDataExpedicao = new DateOnly(2018, 5, 10),
                DataNascimento = new DateOnly(1990, 7, 22),
                Sexo = Sexo.Feminino, EstadoCivil = EstadoCivil.Solteiro,
                Nacionalidade = "Brasileira",
                NomeMae = "Maria das Graças Silva", NomePai = "José Carlos Silva",
                NaturalCidade = "São Paulo", NaturalUf = "SP",
                Cep = "01310-100", Logradouro = "Avenida Paulista", Numero = "1000",
                Bairro = "Bela Vista", Cidade = "São Paulo", Uf = "SP",
                Email = "ana.silva.mock@testmail.com",
                Telefone = "(11) 3344-5566", Celular = "(11) 99901-1001",
                ContatoEmergenciaNome = "Carlos Silva", ContatoEmergenciaFone = "(11) 98800-0001",
                BancoCodigo = "033", BancoNome = "Santander",
                Agencia = "0001", Conta = "12345678", ContaDigito = "9",
                TipoConta = TipoContaBancaria.ContaCorrente,
                DataAdmissao = DateOnly.FromDateTime(DateTime.Today.AddDays(30)),
                Salario = 9500.00m, TipoContratacao = TipoContratacaoAdmissao.CLT,
                CargaHorariaSemanal = 44,
                PisPasep = "123.45678.12-3", Ctps = "0001234", CtpsSerie = "001", CtpsUf = "SP",
                ValidacaoCpfOk = true, ValidacaoCepOk = true, ValidacaoBancoOk = true, ValidacaoSalarioOk = true,
                CreatedAtUtc = now.AddDays(-10), UpdatedAtUtc = now.AddDays(-2),
                SubmittedAtUtc = now.AddDays(-5), ApprovedAtUtc = now.AddDays(-2),
            },
            new PreAdmissao
            {
                Id = Guid.NewGuid(), TenantId = t,
                Status = PreAdmissaoStatus.Aprovada, PreenchidoPor = PreenchidoPor.RH,
                Nome = "Bruno Henrique Costa (Mock TOTVS)",
                Cpf = "22233344455", Rg = "22.333.444-5", RgOrgaoExpedidor = "SSP/SP",
                RgDataExpedicao = new DateOnly(2016, 3, 20),
                DataNascimento = new DateOnly(1988, 11, 5),
                Sexo = Sexo.Masculino, EstadoCivil = EstadoCivil.Casado,
                Nacionalidade = "Brasileira",
                NomeMae = "Rosana Costa", NomePai = "Roberto Costa",
                NaturalCidade = "Campinas", NaturalUf = "SP",
                Cep = "13010-110", Logradouro = "Rua Barão de Jaguara", Numero = "500",
                Bairro = "Centro", Cidade = "Campinas", Uf = "SP",
                Email = "bruno.costa.mock@testmail.com",
                Telefone = "(19) 3344-2002", Celular = "(19) 99802-2002",
                ContatoEmergenciaNome = "Patricia Costa", ContatoEmergenciaFone = "(19) 98700-0002",
                BancoCodigo = "001", BancoNome = "Banco do Brasil",
                Agencia = "1234", Conta = "87654321", ContaDigito = "0",
                TipoConta = TipoContaBancaria.ContaCorrente,
                DataAdmissao = DateOnly.FromDateTime(DateTime.Today.AddDays(30)),
                Salario = 7200.00m, TipoContratacao = TipoContratacaoAdmissao.CLT,
                CargaHorariaSemanal = 44,
                PisPasep = "234.56789.23-4", Ctps = "0004567", CtpsSerie = "002", CtpsUf = "SP",
                ValidacaoCpfOk = true, ValidacaoCepOk = true, ValidacaoBancoOk = true, ValidacaoSalarioOk = true,
                CreatedAtUtc = now.AddDays(-7), UpdatedAtUtc = now.AddDays(-1),
                SubmittedAtUtc = now.AddDays(-3), ApprovedAtUtc = now.AddDays(-1),
            },
            new PreAdmissao
            {
                Id = Guid.NewGuid(), TenantId = t,
                Status = PreAdmissaoStatus.Aprovada, PreenchidoPor = PreenchidoPor.Candidato,
                Nome = "Carla Mendes Ferreira (Mock TOTVS)",
                Cpf = "33344455566", Rg = "33.444.555-6", RgOrgaoExpedidor = "SSP/MG",
                RgDataExpedicao = new DateOnly(2019, 8, 14),
                DataNascimento = new DateOnly(1995, 4, 14),
                Sexo = Sexo.Feminino, EstadoCivil = EstadoCivil.Solteiro,
                Nacionalidade = "Brasileira",
                NomeMae = "Simone Ferreira",
                NaturalCidade = "Belo Horizonte", NaturalUf = "MG",
                Cep = "30130-110", Logradouro = "Rua dos Carijós", Numero = "123",
                Bairro = "Centro", Cidade = "Belo Horizonte", Uf = "MG",
                Email = "carla.mendes.mock@testmail.com",
                Celular = "(31) 99803-3003",
                ContatoEmergenciaNome = "Simone Ferreira", ContatoEmergenciaFone = "(31) 98800-0003",
                BancoCodigo = "104", BancoNome = "Caixa Econômica Federal",
                Agencia = "0547", Conta = "12345678", ContaDigito = "1",
                TipoConta = TipoContaBancaria.ContaSalario,
                DataAdmissao = DateOnly.FromDateTime(DateTime.Today.AddDays(7)),
                Salario = 2200.00m, TipoContratacao = TipoContratacaoAdmissao.Estagio,
                CargaHorariaSemanal = 30,
                ValidacaoCpfOk = true, ValidacaoCepOk = true, ValidacaoBancoOk = false, ValidacaoSalarioOk = true,
                CreatedAtUtc = now.AddDays(-4), UpdatedAtUtc = now,
                SubmittedAtUtc = now.AddDays(-2), ApprovedAtUtc = now,
            },
            new PreAdmissao
            {
                Id = Guid.NewGuid(), TenantId = t,
                Status = PreAdmissaoStatus.Aprovada, PreenchidoPor = PreenchidoPor.RH,
                Nome = "Diego Rocha Santos (Mock TOTVS)",
                Cpf = "44455566677", Rg = "44.555.666-7", RgOrgaoExpedidor = "SSP/RJ",
                RgDataExpedicao = new DateOnly(2017, 1, 30),
                DataNascimento = new DateOnly(1992, 9, 18),
                Sexo = Sexo.Masculino, EstadoCivil = EstadoCivil.Solteiro,
                Nacionalidade = "Brasileira",
                NomeMae = "Lucia Santos", NomePai = "Paulo Rocha",
                NaturalCidade = "Rio de Janeiro", NaturalUf = "RJ",
                Cep = "20040-020", Logradouro = "Rua da Assembleia", Numero = "77",
                Bairro = "Centro", Cidade = "Rio de Janeiro", Uf = "RJ",
                Email = "diego.rocha.mock@testmail.com",
                Telefone = "(21) 3344-4004", Celular = "(21) 99804-4004",
                ContatoEmergenciaNome = "Lucia Santos", ContatoEmergenciaFone = "(21) 98800-0004",
                BancoCodigo = "237", BancoNome = "Bradesco",
                Agencia = "2222", Conta = "55544433", ContaDigito = "2",
                TipoConta = TipoContaBancaria.ContaCorrente,
                DataAdmissao = DateOnly.FromDateTime(DateTime.Today.AddDays(14)),
                Salario = 5800.00m, TipoContratacao = TipoContratacaoAdmissao.CLT,
                CargaHorariaSemanal = 44,
                PisPasep = "345.67890.34-5", Ctps = "0007890", CtpsSerie = "003", CtpsUf = "RJ",
                ValidacaoCpfOk = true, ValidacaoCepOk = true, ValidacaoBancoOk = true, ValidacaoSalarioOk = true,
                CreatedAtUtc = now.AddDays(-6), UpdatedAtUtc = now.AddDays(-1),
                SubmittedAtUtc = now.AddDays(-4), ApprovedAtUtc = now.AddDays(-1),
            },
            new PreAdmissao
            {
                Id = Guid.NewGuid(), TenantId = t,
                Status = PreAdmissaoStatus.Aprovada, PreenchidoPor = PreenchidoPor.RH,
                Nome = "Elena Ribeiro Lima (Mock TOTVS)",
                Cpf = "55566677788", Rg = "55.666.777-8", RgOrgaoExpedidor = "SSP/SP",
                RgDataExpedicao = new DateOnly(2020, 11, 5),
                DataNascimento = new DateOnly(1985, 2, 28),
                Sexo = Sexo.Feminino, EstadoCivil = EstadoCivil.Casado,
                Nacionalidade = "Brasileira",
                NomeMae = "Teresa Ribeiro", NomePai = "Fernando Lima",
                NaturalCidade = "São Paulo", NaturalUf = "SP",
                Cep = "04552-050", Logradouro = "Rua Funchal", Numero = "263",
                Complemento = "Apto 82", Bairro = "Vila Olímpia", Cidade = "São Paulo", Uf = "SP",
                Email = "elena.ribeiro.mock@testmail.com",
                Telefone = "(11) 3344-5005", Celular = "(11) 99905-5005",
                ContatoEmergenciaNome = "Fernando Lima", ContatoEmergenciaFone = "(11) 98800-0005",
                BancoCodigo = "341", BancoNome = "Itaú",
                Agencia = "3333", Conta = "99988877", ContaDigito = "7",
                TipoConta = TipoContaBancaria.ContaCorrente,
                DataAdmissao = DateOnly.FromDateTime(DateTime.Today.AddDays(21)),
                Salario = 14000.00m, TipoContratacao = TipoContratacaoAdmissao.PJ,
                CargaHorariaSemanal = 44,
                PisPasep = "456.78901.45-6", Ctps = "0009012", CtpsSerie = "004", CtpsUf = "SP",
                ValidacaoCpfOk = true, ValidacaoCepOk = true, ValidacaoBancoOk = true, ValidacaoSalarioOk = true,
                CreatedAtUtc = now.AddDays(-8), UpdatedAtUtc = now.AddDays(-3),
                SubmittedAtUtc = now.AddDays(-5), ApprovedAtUtc = now.AddDays(-3),
            },
        };

        _db.PreAdmissoes.AddRange(admissoes);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            message = $"5 pré-admissões com status Aprovada criadas no tenant '{t}'. Disponíveis em GET /api/pre-admissao/integracao/pendentes",
            tenant = t,
            preAdmissoes = admissoes.Select(a => new
            {
                a.Id,
                a.Nome,
                a.Cpf,
                Contrato = a.TipoContratacao!.ToString(),
                Salario = a.Salario,
                Admissao = a.DataAdmissao!.Value.ToString("dd/MM/yyyy"),
                Status = a.Status.ToString(),
            }),
            endpoints = new
            {
                fila = "GET /api/pre-admissao/integracao/pendentes",
                resultado = "POST /api/pre-admissao/{id}/integracao/resultado",
                limpar = "DELETE /api/dev/seed/pre-admissoes",
            }
        });
    }

    /// <summary>Remove os mocks de pré-admissão TOTVS criados pelo seed.</summary>
    [HttpDelete("seed/pre-admissoes")]
    public async Task<IActionResult> ClearPreAdmissoes(CancellationToken ct)
    {
        var mocks = await _db.PreAdmissoes
            .Where(p => p.Nome.EndsWith("(Mock TOTVS)"))
            .ToListAsync(ct);

        if (mocks.Count == 0)
            return Ok(new { message = "Nenhum mock TOTVS encontrado." });

        _db.PreAdmissoes.RemoveRange(mocks);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = $"{mocks.Count} mocks removidos.", removidos = mocks.Select(p => p.Nome) });
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
