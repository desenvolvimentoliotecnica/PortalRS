using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using System.Text;

namespace RhPortal.Api.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task MigrateAndSeedAsync(IServiceProvider services, IConfiguration config, IHostEnvironment env, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

        var resetDb = config.GetValue<bool>("Seed:ResetDatabase");

        // MUITO IMPORTANTE: proteja para não apagar em produção
        if (!env.IsDevelopment())
            resetDb = false;

        if (resetDb)
        {
            if (string.Equals(db.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.OrdinalIgnoreCase))
            {
                await db.Database.ExecuteSqlRawAsync("DROP SCHEMA IF EXISTS public CASCADE;", ct);
                await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA public;", ct);
            }
            else
            {
                await db.Database.EnsureDeletedAsync(ct);
            }
        }

        await db.Database.MigrateAsync(ct);

        var adminPassword = config.GetValue<string>("Seed:AdminPassword");
        if (string.IsNullOrWhiteSpace(adminPassword))
            throw new InvalidOperationException("Seed:AdminPassword is required.");

        await SeedTenantAsync(db, tenantContext, userManager, roleManager, "liotecnica", "Liotecnica", adminPassword);
        await SeedTenantAsync(db, tenantContext, userManager, roleManager, "dev", "Development", adminPassword);
    }

    private sealed record DepartmentSeed(
        string Code,
        string Name,
        string AreaCode,
        int Headcount,
        string ManagerName,
        string CostCenter,
        string BranchOrLocation,
        string Description);

    private sealed record RequisitoCategoriaSeed(
        string Code,
        string Name,
        string Description);

    private sealed record CostCenterSeed(
        string Code,
        string Name);

    private static async Task SeedTenantAsync(
        AppDbContext db,
        ITenantContext tenantContext,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        string tenantId,
        string tenantName,
        string adminPassword)
    {
        await EnsureTenantAsync(db, tenantId, tenantName);
        tenantContext.SetTenantId(tenantId);

        var emailDomain = tenantId.Equals("liotecnica", StringComparison.OrdinalIgnoreCase)
            ? "liotecnica.com.br"
            : "dev.local";

        await EnsureAdminAccessAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword);

        // Áreas (bem realistas pra indústria alimentícia)
        var areas = new (string Code, string Name)[]
        {
            ("ADM","Administrativo"),
            ("FIN","Financeiro & Controladoria"),
            ("RH","Gente & Gestão"),
            ("OPS","Operações Industriais"),
            ("QUA","Qualidade & Segurança de Alimentos"),
            ("ENG","Engenharia & Manutenção"),
            ("PDI","Pesquisa & Desenvolvimento"),
            ("SCM","Supply Chain"),
            ("COM","Comercial & Marketing"),
            ("TEC","Tecnologia (TI & Dados)")
        };

        await EnsureAreasAsync(db, areas);

        var agendaTypes = new (string Code, string Label, string Color, string Icon, int SortOrder)[]
        {
            ("entrevista", "Entrevista", "#1f6feb", "bi-camera-video", 1),
            ("reuniao", "Reuniao", "#0ea5e9", "bi-people", 2),
            ("onboarding", "Onboarding", "#22c55e", "bi-stars", 3),
            ("assessment", "Assessment", "#f59e0b", "bi-clipboard-check", 4),
            ("followup", "Follow-up", "#8b5cf6", "bi-chat-dots", 5),
            ("outro", "Outro", "#6b7280", "bi-calendar", 6)
        };

        await EnsureAgendaTypesAsync(db, agendaTypes);
        await EnsureAgendaEventsSeedAsync(db, tenantId);

        var requisitoCategorias = new RequisitoCategoriaSeed[]
        {
            new("competencia", "Competencia", "Habilidades comportamentais e competencias."),
            new("experiencia", "Experiencia", "Tempo e tipo de experiencia profissional."),
            new("formacao", "Formacao", "Formacao academica e cursos."),
            new("ferramenta_tecnologia", "Ferramenta/Tecnologia", "Conhecimentos tecnicos e ferramentas."),
            new("idioma", "Idioma", "Idiomas e niveis requeridos."),
            new("certificacao", "Certificacao", "Certificacoes exigidas ou desejaveis."),
            new("localidade", "Localidade", "Disponibilidade geografica e deslocamento."),
            new("outros", "Outros", "Requisitos adicionais.")
        };

        await EnsureRequisitoCategoriasAsync(db, requisitoCategorias);

        var areaByCode = await db.Areas
            .AsNoTracking()
            .ToDictionaryAsync(a => a.Code, a => a.Id);

        // Seeds (50 departamentos)
        var seeds = BuildFoodIndustryDepartments();

        // Se existir só o "DEP-001" antigo, remove pra ficar limpo e entrar o pacote completo de 50
        var existingDepts = await db.Departments.ToListAsync();
        if (existingDepts.Count == 1 && string.Equals(existingDepts[0].Code, "DEP-001", StringComparison.OrdinalIgnoreCase))
        {
            db.Departments.Remove(existingDepts[0]);
            await db.SaveChangesAsync();
            existingDepts.Clear();
        }

        // Se estiver vazio, cria os 50; se já existir coisa, só garante os seeds (não destrutivo)
        if (existingDepts.Count == 0)
        {
            await InsertDepartmentsAsync(db, areaByCode, seeds, emailDomain);
        }
        else
        {
            await EnsureDepartmentsAsync(db, areaByCode, seeds, emailDomain);
        }

        await EnsureCostCentersFromDepartmentsAsync(db);

        var hasAnyUnit = await db.Units.AnyAsync();
        if (!hasAnyUnit)
        {
            db.Units.AddRange(
                new Unit
                {
                    Id = Guid.NewGuid(),
                    Code = "UNI-EMB",
                    Name = "Embu das Artes - SP",
                    Status = Domain.Enums.UnitStatus.Active,
                    City = "Embu das Artes",
                    Uf = "SP",
                    AddressLine = "Rua Exemplo, 100",
                    Neighborhood = "Industrial",
                    ZipCode = "06800-000",
                    Email = "embu@liotecnica.com.br",
                    Phone = "(11) 4001-1001",
                    ResponsibleName = "Responsável EMB",
                    Type = "Industria / Matriz",
                    Headcount = 420,
                    Notes = "Unidade principal."
                },
                new Unit
                {
                    Id = Guid.NewGuid(),
                    Code = "UNI-SPC",
                    Name = "São Paulo - SP",
                    Status = Domain.Enums.UnitStatus.Active,
                    City = "São Paulo",
                    Uf = "SP",
                    Email = "sp@liotecnica.com.br",
                    Phone = "(11) 4001-1002",
                    ResponsibleName = "Responsável SPC",
                    Type = "Escritório / Administrativo",
                    Headcount = 180,
                    Notes = "Unidade administrativa."
                }
            );

            await db.SaveChangesAsync();
        }

        // =========================
        // Seed de Cargos (JobPositions) - 50 cargos (Indústria Alimentícia)
        // =========================

        var areaIdByCode = await db.Areas
            .AsNoTracking()
            .ToDictionaryAsync(a => a.Code, a => a.Id);

        Guid GetAreaId(string areaCode)
        {
            if (!areaIdByCode.TryGetValue(areaCode, out var id))
                throw new InvalidOperationException($"Área '{areaCode}' não foi encontrada no seed.");
            return id;
        }

        // Códigos desejados (evita duplicar)
        var existingCodes = await db.JobPositions
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync();

        var existingCodesSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        // helper para padronizar código
        static string MakeCode(string areaCode, int seq) => $"CAR-{areaCode}-{seq:000}";

        // Lista de 50 cargos (com contexto de indústria alimentícia)
        var cargos = new (string AreaCode, string Name, SeniorityLevel Seniority, string Type, string Description)[]
        {
            // OPS - Operações Industriais
            ("OPS","Operador de Produção (Linha)", SeniorityLevel.Junior, "Operacional", "Operação de linha de envase/embalagem e rotina 5S."),
            ("OPS","Operador de Máquina de Envase", SeniorityLevel.Pleno, "Operacional", "Setup, ajuste e operação de máquinas de envase."),
            ("OPS","Líder de Turno (Produção)", SeniorityLevel.Coordenacao, "Liderança", "Gestão do turno, metas, segurança e qualidade na produção."),
            ("OPS","Supervisor de Produção", SeniorityLevel.Gerencia, "Gestão", "Acompanha indicadores (OEE, perdas, paradas) e produtividade."),
            ("OPS","Técnico de Processos (Chão de fábrica)", SeniorityLevel.Pleno, "Técnico", "Padronização de processos e melhoria contínua (Kaizen)."),
            ("OPS","Analista de PCP (Operações)", SeniorityLevel.Pleno, "Administrativo", "Planejamento e controle de produção, sequenciamento e apontamentos."),
            ("OPS","Encarregado de Embalagem", SeniorityLevel.Coordenacao, "Liderança", "Coordena equipe de embalagem e controle de consumo."),
            ("OPS","Operador de Caldeira", SeniorityLevel.Senior, "Operacional", "Operação e rotinas de segurança em caldeiras/utilidades."),
            ("OPS","Operador de Câmara Fria", SeniorityLevel.Junior, "Operacional", "Controle de armazenagem refrigerada e FIFO/FEFO."),
            ("OPS","Analista de Eficiência (OEE)", SeniorityLevel.Especialista, "Especialista", "Análise de perdas, paradas e planos de ação."),

            // QUA - Qualidade & Segurança de Alimentos
            ("QUA","Assistente de Qualidade", SeniorityLevel.Junior, "Administrativo", "Registros, tratativas de não conformidade e suporte à qualidade."),
            ("QUA","Técnico de Controle de Qualidade", SeniorityLevel.Pleno, "Técnico", "Inspeções em processo, coleta e análises básicas."),
            ("QUA","Analista de Qualidade", SeniorityLevel.Senior, "Especialista", "Garantia da qualidade, indicadores e auditorias internas."),
            ("QUA","Especialista em BPF/APPCC", SeniorityLevel.Especialista, "Especialista", "Implantação e manutenção de BPF/APPCC."),
            ("QUA","Coordenador de Qualidade", SeniorityLevel.Coordenacao, "Gestão", "Coordena rotina de qualidade e segurança de alimentos."),
            ("QUA","Analista de Rastreabilidade", SeniorityLevel.Pleno, "Administrativo", "Controle de lotes, rastreabilidade e simulado de recall."),
            ("QUA","Auditor Interno de Qualidade", SeniorityLevel.Senior, "Especialista", "Auditorias internas e suporte a certificações."),
            ("QUA","Analista de Laboratório (Microbiologia)", SeniorityLevel.Pleno, "Técnico", "Análises microbiológicas e liberação de produto."),
            ("QUA","Analista de Laboratório (Físico-Químico)", SeniorityLevel.Pleno, "Técnico", "Análises físico-químicas e controle de especificações."),
            ("QUA","Gerente de Qualidade & Segurança de Alimentos", SeniorityLevel.Diretoria, "Gestão", "Estratégia de qualidade, compliance e governança."),

            // ENG - Engenharia & Manutenção
            ("ENG","Técnico de Manutenção (Mecânica)", SeniorityLevel.Pleno, "Técnico", "Manutenção preventiva/corretiva em equipamentos industriais."),
            ("ENG","Técnico de Manutenção (Elétrica)", SeniorityLevel.Pleno, "Técnico", "Manutenção elétrica, painéis e comandos."),
            ("ENG","Analista de Manutenção (PCM)", SeniorityLevel.Senior, "Administrativo", "Planejamento, ordens de serviço, MTBF/MTTR."),
            ("ENG","Engenheiro de Manutenção", SeniorityLevel.Gerencia, "Gestão", "Gestão de manutenção, confiabilidade e orçamento."),
            ("ENG","Engenheiro de Processos", SeniorityLevel.Senior, "Especialista", "Otimização de processos, perdas e produtividade."),
            ("ENG","Técnico de Automação", SeniorityLevel.Senior, "Técnico", "CLPs, IHMs e instrumentação industrial."),
            ("ENG","Coordenador de Engenharia", SeniorityLevel.Coordenacao, "Gestão", "Coordena projetos, melhorias e capex."),
            ("ENG","Analista de Utilidades", SeniorityLevel.Pleno, "Técnico", "Gestão de utilidades: vapor, ar comprimido, água gelada."),
            ("ENG","Especialista em Confiabilidade", SeniorityLevel.Especialista, "Especialista", "RCM, análise de falhas e planos de confiabilidade."),
            ("ENG","Supervisor de Manutenção", SeniorityLevel.Gerencia, "Gestão", "Coordena equipe, paradas programadas e indicadores."),

            // SCM - Supply Chain
            ("SCM","Analista de Logística", SeniorityLevel.Pleno, "Administrativo", "Recebimento, armazenagem, expedição e transporte."),
            ("SCM","Comprador (Matéria-prima)", SeniorityLevel.Pleno, "Administrativo", "Compras de insumos e negociações com fornecedores."),
            ("SCM","Comprador Sênior", SeniorityLevel.Senior, "Administrativo", "Estratégia de compras, contratos e redução de custos."),
            ("SCM","Planejador de Demanda", SeniorityLevel.Senior, "Especialista", "Previsão de demanda e S&OP."),
            ("SCM","Analista de Estoques", SeniorityLevel.Pleno, "Administrativo", "Acuracidade, inventário e giro de estoque."),
            ("SCM","Supervisor de Expedição", SeniorityLevel.Coordenacao, "Liderança", "Coordena expedição, carregamento e SLA."),
            ("SCM","Coordenador de Supply Chain", SeniorityLevel.Gerencia, "Gestão", "Integra compras, PCP e logística."),
            ("SCM","Analista de Transporte", SeniorityLevel.Pleno, "Administrativo", "Roteirização, frete e performance de transportadoras."),
            ("SCM","Analista de Armazém", SeniorityLevel.Junior, "Operacional", "Rotinas de armazém, conferência e endereçamento."),
            ("SCM","Gerente de Supply Chain", SeniorityLevel.Diretoria, "Gestão", "Estratégia e governança de supply chain."),

            // PDI - Pesquisa & Desenvolvimento
            ("PDI","Técnico de P&D", SeniorityLevel.Pleno, "Técnico", "Testes piloto, preparo de amostras e documentação."),
            ("PDI","Analista de P&D (Produtos)", SeniorityLevel.Senior, "Especialista", "Desenvolvimento de produtos, formulação e testes."),
            ("PDI","Especialista em Formulação", SeniorityLevel.Especialista, "Especialista", "Formulações, estabilidade e redução de custo."),
            ("PDI","Coordenador de P&D", SeniorityLevel.Coordenacao, "Gestão", "Coordena portfólio e pipelines de inovação."),
            ("PDI","Gerente de P&D", SeniorityLevel.Gerencia, "Gestão", "Estratégia de inovação e governança de projetos."),

            // COM - Comercial & Marketing
            ("COM","Executivo de Vendas (Key Account)", SeniorityLevel.Senior, "Comercial", "Gestão de contas, negociações e crescimento de receita."),
            ("COM","Analista de Trade Marketing", SeniorityLevel.Pleno, "Marketing", "Ações em PDV, campanhas e materiais."),
            ("COM","Coordenador Comercial", SeniorityLevel.Coordenacao, "Gestão", "Coordena time comercial e metas."),
            ("COM","Gerente Comercial", SeniorityLevel.Gerencia, "Gestão", "Estratégia comercial, pricing e expansão."),
            ("COM","Analista de Marketing", SeniorityLevel.Junior, "Marketing", "Suporte a campanhas e comunicação."),

            // ADM / FIN / RH / TEC
            ("ADM","Assistente Administrativo (Planta)", SeniorityLevel.Junior, "Administrativo", "Rotinas administrativas da planta e apoio às áreas."),
            ("FIN","Analista Financeiro", SeniorityLevel.Pleno, "Financeiro", "Fluxo de caixa, contas a pagar/receber e conciliações."),
            ("RH","Analista de RH (Generalista)", SeniorityLevel.Pleno, "RH", "Recrutamento, treinamento e apoio a lideranças."),
            ("TEC","Analista de Dados (BI)", SeniorityLevel.Senior, "Tecnologia", "Dashboards (KPI), qualidade de dados e governança."),
            ("TEC","Desenvolvedor de Sistemas (ERP/Integrações)", SeniorityLevel.Pleno, "Tecnologia", "APIs, integrações e suporte ao ERP industrial."),
        };

        // Cria/insere 50 cargos com códigos determinísticos: CAR-{AREA}-{001..050}
        var seq = 1;
        foreach (var c in cargos)
        {
            var code = MakeCode(c.AreaCode, seq);

            if (!existingCodesSet.Contains(code))
            {
                db.JobPositions.Add(new Domain.Entities.JobPosition
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    Name = c.Name,
                    AreaId = GetAreaId(c.AreaCode),
                    Status = Domain.Enums.CargoStatus.Active,
                    Seniority = c.Seniority,
                    Type = c.Type,
                    Description = c.Description
                });

                existingCodesSet.Add(code);
            }

            seq++;
        }

        await db.SaveChangesAsync();

        var hasAnyManager = await db.Managers.AnyAsync();
        if (!hasAnyManager)
        {
            var units = await db.Units.AsNoTracking().ToListAsync();
            var areasManagers = await db.Areas.AsNoTracking().ToListAsync();
            var cargosManagers = await db.JobPositions.AsNoTracking().ToListAsync();

            if (units.Count == 0) return; // ou throw, como preferir

            Guid PickArea(string code) => areasManagers.First(a => a.Code == code).Id;

            Guid PickCargoByArea(string areaCode)
            {
                var areaId = PickArea(areaCode);
                return cargosManagers.First(c => c.AreaId == areaId).Id;
            }

            // Random determinístico (sempre a mesma distribuição)
            var rng = new Random(42);

            // Embaralha as unidades e distribui em round-robin
            var shuffledUnits = units
                .OrderBy(_ => rng.Next())
                .ToList();

            Guid PickRandomUnitId(int index)
                => shuffledUnits[index % shuffledUnits.Count].Id;

            var seed = new[]
            {
                new { Name="Marina Souza",   Email="marina.souza@empresa.com",   Phone="(11) 90000-0001", Area="OPS", Headcount = 5 },
                new { Name="Carlos Lima",    Email="carlos.lima@empresa.com",    Phone="(11) 90000-0002", Area="QUA", Headcount = 7 },
                new { Name="Fernanda Rocha", Email="fernanda.rocha@empresa.com", Phone="(11) 90000-0003", Area="ENG", Headcount = 4 },
                new { Name="Bruno Alves",    Email="bruno.alves@empresa.com",    Phone="(11) 90000-0004", Area="SCM", Headcount = 8 },
                new { Name="Juliana Martins",Email="juliana.martins@empresa.com",Phone="(11) 90000-0005", Area="PDI", Headcount = 23 },
                new { Name="Rafael Pereira", Email="rafael.pereira@empresa.com", Phone="(11) 90000-0006", Area="COM", Headcount = 14 },
                new { Name="Paula Santos",   Email="paula.santos@empresa.com",   Phone="(11) 90000-0007", Area="RH",  Headcount = 4 },
                new { Name="Diego Oliveira", Email="diego.oliveira@empresa.com", Phone="(11) 90000-0008", Area="FIN", Headcount = 2 },
                new { Name="Aline Costa",    Email="aline.costa@empresa.com",    Phone="(11) 90000-0009", Area="TEC", Headcount = 9 },
                new { Name="João Mendes",    Email="joao.mendes@empresa.com",    Phone="(11) 90000-0010", Area="ADM", Headcount = 11 },
            };

            for (var i = 0; i < seed.Length; i++)
            {
                var s = seed[i];

                var areaId = PickArea(s.Area);
                var cargoId = PickCargoByArea(s.Area);
                var unitId = PickRandomUnitId(i); // <-- aqui distribui

                db.Managers.Add(new Domain.Entities.Manager
                {
                    Id = Guid.NewGuid(),
                    Name = s.Name,
                    Email = s.Email,
                    Phone = s.Phone,
                    Status = ManagerStatus.Active,
                    UnitId = unitId,
                    AreaId = areaId,
                    Headcount = s.Headcount,
                    JobPositionId = cargoId,
                    Notes = "Seed inicial de gestor"
                });
            }

            await db.SaveChangesAsync();
        }

        await EnsureFoodIndustryVagasAsync(db, tenantId);
        await EnsureFoodIndustryCandidatosAsync(db, tenantId, emailDomain);
        await EnsureInboxItemsAsync(db, tenantId);


    }

    private sealed record VagaSeed(
    string Code,
    string DepartmentCode,
    string UnitCode,
    string Title,
    SeniorityLevel Seniority,
    string Description,
    bool IsShiftBased,
    bool IsOnSite
);

    private static async Task EnsureFoodIndustryVagasAsync(
    AppDbContext db,
    string tenantId,
    CancellationToken ct = default)
    {
        var departmentsByCode = await db.Departments
            .AsNoTracking()
            .Where(d => d.Status == DepartmentStatus.Active)
            .ToDictionaryAsync(x => x.Code, x => x, StringComparer.OrdinalIgnoreCase, ct);

        var unitsByCode = await db.Units
            .AsNoTracking()
            .ToDictionaryAsync(x => x.Code, x => x, StringComparer.OrdinalIgnoreCase, ct);

        var managers = await db.Managers.AsNoTracking().ToListAsync(ct);
        var jobPositions = await db.JobPositions.AsNoTracking().ToListAsync(ct);

        // ✅ Áreas ativas
        var areas = await db.Areas.AsNoTracking()
            .Where(a => a.IsActive)
            .ToListAsync(ct);

        if (areas.Count == 0)
            throw new InvalidOperationException("Nenhuma Area ativa encontrada. Rode o seed de Areas antes.");

        if (departmentsByCode.Count == 0)
            throw new InvalidOperationException("Nenhum Department encontrado/ativo. Rode o seed de Departments antes.");

        if (unitsByCode.Count == 0)
            throw new InvalidOperationException("Nenhuma Unit encontrada. Rode o seed de Units antes.");

        if (managers.Count == 0)
            throw new InvalidOperationException("Nenhum manager encontrado. Rode o seed de Managers antes.");

        if (jobPositions.Count == 0)
            throw new InvalidOperationException("Nenhum JobPosition encontrado. Rode o seed de JobPositions antes.");

        // Index: managers por AreaId
        var managersByArea = managers
            .GroupBy(m => m.AreaId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Index: cargos por AreaId
        var cargosByArea = jobPositions
            .GroupBy(j => j.AreaId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var seeds = BuildFoodIndustryVagasDemo();

        var existingCodes = await db.Vagas
            .AsNoTracking()
            .Select(v => v.Codigo)
            .ToListAsync(ct);

        var existingSet = existingCodes
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var rng = new Random(42);
        var toAdd = new List<Vaga>();

        // fallback: mapeia Area.Code -> Department.Code (se teu seed vier “desalinhado”)
        static string? MapDepartmentCodeFromAreaCode(string? areaCode)
        {
            var c = (areaCode ?? "").Trim().ToUpperInvariant();
            return c switch
            {
                "OPS" => "OPS",
                "SCM" => "LOG", // supply chain ~ logística (ajuste se seu department code for outro)
                "COM" => "COM",
                "TEC" => "TEC",
                "FIN" => "FIN",
                "RH" => "RH",
                "QUA" => "QUA",
                "ENG" => "ENG",
                "ADM" => "ADM",
                "PDI" => "PDI",
                _ => null
            };
        }

        foreach (var s in seeds)
        {
            if (existingSet.Contains(s.Code))
                continue;

            if (!unitsByCode.TryGetValue(s.UnitCode, out var unit))
                throw new InvalidOperationException($"Unidade '{s.UnitCode}' não encontrada.");

            // ✅ sorteia Area
            var areaEntity = areas[rng.Next(areas.Count)];
            var areaId = areaEntity.Id;
            var areaCode = (areaEntity.Code ?? "").Trim().ToUpperInvariant();

            // ✅ resolve Department (DB) pelo code do seed; fallback por Area.Code; fallback aleatório
            Department? depEntity = null;

            if (!string.IsNullOrWhiteSpace(s.DepartmentCode) &&
                departmentsByCode.TryGetValue(s.DepartmentCode.Trim(), out var d1))
            {
                depEntity = d1;
            }
            else
            {
                var depCodeFromArea = MapDepartmentCodeFromAreaCode(areaCode);
                if (!string.IsNullOrWhiteSpace(depCodeFromArea) &&
                    departmentsByCode.TryGetValue(depCodeFromArea, out var d2))
                {
                    depEntity = d2;
                }
            }

            depEntity ??= departmentsByCode.Values.ElementAt(rng.Next(departmentsByCode.Count));

            if (depEntity.Id == Guid.Empty)
                throw new InvalidOperationException("Department inválido (Id vazio).");

            // ✅ escolhe Manager pelo AreaId sorteado (fallback: qualquer)
            var managerId =
                (managersByArea.TryGetValue(areaId, out var mgrs) && mgrs.Count > 0)
                    ? mgrs[rng.Next(mgrs.Count)].Id
                    : managers[rng.Next(managers.Count)].Id;

            if (managerId == Guid.Empty)
                throw new InvalidOperationException("Nenhum manager válido encontrado.");

            // ✅ escolhe JobPosition pelo AreaId sorteado (fallback: qualquer)
            var cargoId =
                (cargosByArea.TryGetValue(areaId, out var cargos) && cargos.Count > 0)
                    ? cargos[rng.Next(cargos.Count)].Id
                    : jobPositions[rng.Next(jobPositions.Count)].Id;

            if (cargoId == Guid.Empty)
                throw new InvalidOperationException("Nenhum JobPosition válido encontrado.");

            var published = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-rng.Next(3, 35)));
            var closing = published.AddDays(rng.Next(10, 45));

            var senior = MapSenioridade(s.Seniority);

            var (salMin, salMax, expMin) = senior switch
            {
                null => (3500m, 5200m, 1),
                _ when IsEnumName(senior.Value, "Junior", "Jr") => (3200m, 4500m, 0),
                _ when IsEnumName(senior.Value, "Pleno") => (4800m, 7200m, 2),
                _ when IsEnumName(senior.Value, "Senior", "Sênior") => (7800m, 11500m, 4),
                _ when IsEnumName(senior.Value, "Especialista") => (9800m, 15000m, 5),
                _ when IsEnumName(senior.Value, "Coordenacao", "Coordenador", "Coordenação") => (11000m, 16000m, 6),
                _ when IsEnumName(senior.Value, "Gerencia", "Gerente", "Gerência") => (15000m, 22000m, 8),
                _ => (4500m, 8500m, 2)
            };

            var now = DateTimeOffset.UtcNow;

            var vaga = new Vaga
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,

                Codigo = s.Code,
                Titulo = s.Title,

                // ✅ FKs (DB)
                AreaId = areaId,
                DepartmentId = depEntity.Id,

                Status = ParseEnumOrFirst<VagaStatus>("Aberta", "Open", "Ativa", "EmAberto"),
                Senioridade = senior,

                QuantidadeVagas = rng.Next(1, 6),
                TipoContratacao = ParseEnumOrFirst<VagaTipoContratacao>("CLT", "Efetivo", "FullTime"),
                MatchMinimoPercentual = 70 + rng.Next(0, 16),

                DescricaoInterna = s.Description,
                DescricaoPublica = s.Description,

                // tags podem continuar usando areaCode / dep code
                TagsKeywordsRaw = BuildKeywords(areaCode),
                TagsResponsabilidadesRaw = BuildResponsibilities(areaCode),

                AceitaPcd = true,
                LinguagemInclusiva = true,
                Confidencial = false,
                Urgente = rng.NextDouble() < 0.18,

                Modalidade = s.IsOnSite
                    ? ParseEnumOrFirst<VagaModalidade>("Presencial", "OnSite")
                    : ParseEnumOrFirst<VagaModalidade>("Hibrido", "Hybrid", "Remoto", "Remote"),

                Regime = ParseEnumOrFirst<VagaRegimeJornada>("Integral", "FullTime"),
                CargaSemanalHoras = s.IsShiftBased ? 44 : 40,
                Escala = s.IsShiftBased
                    ? ParseEnumOrFirst<VagaEscalaTrabalho>("6x1", "6X1", "Turno")
                    : ParseEnumOrFirst<VagaEscalaTrabalho>("5x2", "5X2"),

                HoraEntrada = s.IsShiftBased ? new TimeOnly(06, 00) : new TimeOnly(08, 00),
                HoraSaida = s.IsShiftBased ? new TimeOnly(14, 00) : new TimeOnly(17, 00),
                Intervalo = TimeSpan.FromHours(1),

                Cep = unit.ZipCode,
                Logradouro = unit.AddressLine,
                Numero = "100",
                Bairro = unit.Neighborhood,
                Cidade = unit.City,
                Uf = unit.Uf,

                Moeda = ParseEnumOrFirst<VagaMoeda>("BRL", "Real"),
                Periodicidade = ParseEnumOrFirst<VagaRemuneracaoPeriodicidade>("Mensal", "Monthly"),
                SalarioMinimo = salMin,
                SalarioMaximo = salMax,
                ExperienciaMinimaAnos = expMin,

                Visibilidade = ParseEnumOrFirst<VagaPublicacaoVisibilidade>("Publica", "Externa", "Public", "Interna"),
                DataInicio = published,
                DataEncerramento = closing,

                CanalLinkedIn = true,
                CanalSiteCarreiras = true,
                CanalIndicacao = true,
                CanalPortaisEmprego = true,

                LgpdSolicitarConsentimentoExplicito = true,
                LgpdCompartilharCurriculoInternamente = true,
                LgpdRetencaoAtiva = true,
                LgpdRetencaoMeses = 12,

                ChecagemAntecedentes = true,
                ExigeCnh = false,
                DisponibilidadeParaViagens = rng.NextDouble() < 0.10,

                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };


            // ✅ seed de requisitos (exemplo)
            var reqs = BuildDemoRequisitos(areaCode);

            var ordem = 0;
            foreach (var r in reqs)
            {
                vaga.Requisitos.Add(new VagaRequisito
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    VagaId = vaga.Id,              // importante
                    Ordem = ordem++,
                    Nome = r.Nome,
                    Peso = r.Peso,                 // enum
                    Obrigatorio = r.Obrigatorio,
                    AnosMinimos = r.AnosMinimos,
                    Nivel = r.Nivel,
                    Avaliacao = r.Avaliacao,
                    SinonimosRaw = JoinSinonimos(r.Sinonimos),
                    Observacoes = r.Obs,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            // Se seu model tiver FKs, aqui é o lugar.
            // (Comente/adicione conforme existir no seu Vaga)
            // vaga.ManagerId = managerId;
            // vaga.JobPositionId = cargoId;

            toAdd.Add(vaga);
            existingSet.Add(s.Code);
        }

        if (toAdd.Count > 0)
        {
            db.Vagas.AddRange(toAdd);
            await db.SaveChangesAsync(ct);
        }
    }


    private static List<(string Nome, VagaPeso Peso, bool Obrigatorio, int? AnosMinimos, VagaRequisitoNivel? Nivel, VagaRequisitoAvaliacao? Avaliacao, string? Obs, IReadOnlyList<string>? Sinonimos)>
BuildDemoRequisitos(string areaCode)
    {
        areaCode = (areaCode ?? "").Trim().ToUpperInvariant();

        // ajuste os enums conforme os seus nomes/valores
        return areaCode switch
        {
            "TEC" => new()
        {
            ("Windows/Office 365", (VagaPeso)4, true, 1, null, null, null, new[] { "Office", "Pacote Office", "Microsoft 365" }),
            ("Atendimento ao usuário", (VagaPeso)4, true, 1, null, null, null, new[] { "Suporte ao usuario", "Help desk" }),
            ("ITIL (desejável)", (VagaPeso)2, false, null, null, null, null, new[] { "ITIL Foundation" }),
            ("Redes básicas", (VagaPeso)3, false, 1, null, null, null, new[] { "TCP/IP", "LAN", "WAN" }),
        },

            "FIN" => new()
        {
            ("Excel intermediário/avançado", (VagaPeso)4, true, 2, null, null, null, new[] { "Excel avancado", "Planilhas" }),
            ("Contas a receber", (VagaPeso)4, true, 2, null, null, null, new[] { "CR", "Recebiveis" }),
            ("Conciliação bancária", (VagaPeso)3, false, 1, null, null, null, new[] { "Conciliacao", "Extrato" }),
        },

            _ => new()
        {
            ("Comunicação", (VagaPeso)3, true, null, null, null, null, new[] { "Comunicacao", "Boa comunicacao" }),
            ("Trabalho em equipe", (VagaPeso)3, false, null, null, null, null, new[] { "Teamwork", "Colaboracao" }),
        }
        };
    }

    private static string? JoinSinonimos(IReadOnlyList<string>? sinonimos)
    {
        if (sinonimos is null || sinonimos.Count == 0) return null;
        var cleaned = sinonimos
            .Select(s => (s ?? string.Empty).Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return cleaned.Length == 0 ? null : string.Join(";", cleaned);
    }


    private static async Task EnsureFoodIndustryCandidatosAsync(AppDbContext db, string tenantId, string emailDomain)
    {
        if (await db.Candidatos.AnyAsync())
            return;

        var vagas = await db.Vagas
            .AsNoTracking()
            .Select(v => new { v.Id, v.Titulo, v.Codigo, v.MatchMinimoPercentual })
            .ToListAsync();

        if (vagas.Count == 0) return;

        var now = DateTimeOffset.UtcNow;
        var rng = new Random(51);

        var nomes = new[]
        {
            "Mariana", "Ana", "Carlos", "Bruno", "Daniela", "Rafael", "Patricia", "Camila", "Tiago", "Sofia",
            "Lucas", "Juliana", "Renata", "Marcelo", "Paulo", "Guilherme", "Fernanda", "Beatriz", "Luciana", "Andre",
            "Aline", "Priscila", "Fabio", "Eduardo", "Vanessa", "Carla", "Pedro", "Gabriela", "Henrique", "Isabela"
        };

        var sobrenomes = new[]
        {
            "Souza", "Silva", "Oliveira", "Pereira", "Lima", "Almeida", "Costa", "Rodrigues", "Mendes", "Santos",
            "Ferreira", "Martins", "Araujo", "Gomes", "Barbosa", "Cardoso", "Ribeiro", "Teixeira", "Carvalho", "Araujo"
        };

        var cidades = new[]
        {
            "Embu das Artes", "Sao Paulo", "Osasco", "Taboao da Serra", "Cotia", "Itapecerica da Serra", "Barueri"
        };

        var fontes = Enum.GetValues<CandidatoFonte>();
        var statuses = Enum.GetValues<CandidatoStatus>();

        var cvSnippets = new[]
        {
            "Experiencia com processos industriais, indicadores e qualidade.",
            "Atuacao em rotinas administrativas, controles e atendimento interno.",
            "Vivencia com auditorias internas, BPF e suporte a laboratorio.",
            "Forte em analise de dados, dashboards e SQL.",
            "Conhecimento em manutencao preventiva e corretiva.",
            "Atendimento a clientes, negociacoes e suporte comercial."
        };

        var obsSnippets = new[]
        {
            "Boa comunicacao e postura consultiva.",
            "Perfil analitico e organizado.",
            "Disponivel para inicio imediato.",
            "Experiencia em industria alimenticia.",
            "Boa aderencia ao perfil da vaga."
        };

        var candidatos = new List<Candidato>();

        for (var i = 0; i < 50; i++)
        {
            var nome = $"{nomes[i % nomes.Length]} {sobrenomes[(i * 3 + 1) % sobrenomes.Length]}";
            var email = $"{ToEmailUser(nome)}@{emailDomain}";
            var vaga = vagas[rng.Next(vagas.Count)];
            var createdAt = now.AddDays(-rng.Next(2, 60));
            var updatedAt = createdAt.AddDays(rng.Next(0, 15));
            if (updatedAt > now) updatedAt = now.AddDays(-1);

            var status = statuses[rng.Next(statuses.Length)];
            var fonte = fontes[rng.Next(fontes.Length)];
            var cidade = cidades[rng.Next(cidades.Length)];

            var candidato = new Candidato
            {
                Id = Guid.NewGuid(),
                Nome = nome,
                Email = email,
                Fone = PhoneFromIndex(100 + i),
                Cidade = cidade,
                Uf = "SP",
                Fonte = fonte,
                Status = status,
                VagaId = vaga.Id,
                Obs = obsSnippets[rng.Next(obsSnippets.Length)],
                CvText = cvSnippets[rng.Next(cvSnippets.Length)],
                CreatedAtUtc = createdAt,
                UpdatedAtUtc = updatedAt
            };

            if (rng.NextDouble() > 0.35)
            {
                var score = rng.Next(40, 96);
                candidato.LastMatchScore = score;
                candidato.LastMatchPass = score >= vaga.MatchMinimoPercentual;
                candidato.LastMatchAtUtc = updatedAt.AddHours(-rng.Next(1, 72));
                candidato.LastMatchVagaId = vaga.Id;
            }

            candidato.Documentos.Add(new CandidatoDocumento
            {
                Id = Guid.NewGuid(),
                CandidatoId = candidato.Id,
                Tipo = CandidatoDocumentoTipo.Curriculo,
                NomeArquivo = $"{ToEmailUser(nome)}_CV.pdf",
                ContentType = "application/pdf",
                TamanhoBytes = 120_000 + rng.Next(80_000, 320_000),
                Url = null
            });

            if (rng.NextDouble() > 0.6)
            {
                candidato.Documentos.Add(new CandidatoDocumento
                {
                    Id = Guid.NewGuid(),
                    CandidatoId = candidato.Id,
                    Tipo = CandidatoDocumentoTipo.Certificado,
                    NomeArquivo = $"certificado_{ToEmailUser(nome)}.pdf",
                    ContentType = "application/pdf",
                    TamanhoBytes = 80_000 + rng.Next(20_000, 120_000),
                    Url = null
                });
            }

            candidatos.Add(candidato);
        }

        db.Candidatos.AddRange(candidatos);
        await db.SaveChangesAsync();
    }

    private static async Task EnsureInboxItemsAsync(AppDbContext db, string tenantId)
    {
        if (await db.InboxItems.AnyAsync())
            return;

        var vaga = await db.Vagas.AsNoTracking().FirstOrDefaultAsync();
        if (vaga is null)
            return;

        var now = DateTimeOffset.UtcNow;
        var log = new[] { "Arquivo detectado", "Upload ok", "Extraindo texto..." };
        var logRaw = System.Text.Json.JsonSerializer.Serialize(log);

        var items = new List<InboxItem>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Origem = InboxOrigem.Email,
                Status = InboxStatus.Novo,
                RecebidoEm = now.AddMinutes(-30),
                Remetente = $"mariana.souza@{tenantId}.com",
                Assunto = "Curriculo - Analista de Dados",
                Destinatario = "rh@liotecnica.com.br",
                VagaId = vaga.Id,
                PreviewText = "Experiencia com excel avancado, dashboards e power bi.",
                ProcessamentoPct = 0,
                ProcessamentoEtapa = "Aguardando",
                ProcessamentoTentativas = 0,
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        Nome = "Mariana_Souza_CV.pdf",
                        Tipo = "pdf",
                        TamanhoKB = 284,
                        Hash = "demo-1"
                    }
                }
            },
            new()
            {
                Id = Guid.NewGuid(),
                Origem = InboxOrigem.Pasta,
                Status = InboxStatus.Processando,
                RecebidoEm = now.AddMinutes(-12),
                Remetente = "watcher@server",
                Assunto = "Novo arquivo em pasta monitorada",
                Destinatario = "FS: \\\\RH\\Curriculos\\Entrada",
                VagaId = vaga.Id,
                PreviewText = "PowerBI, SQL, modelagem dimensional e analytics.",
                ProcessamentoPct = 55,
                ProcessamentoEtapa = "Extraindo texto",
                ProcessamentoTentativas = 1,
                ProcessamentoLogRaw = logRaw,
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        Nome = "Ana_Ribeiro.docx",
                        Tipo = "docx",
                        TamanhoKB = 512,
                        Hash = "demo-2"
                    }
                }
            },
            new()
            {
                Id = Guid.NewGuid(),
                Origem = InboxOrigem.Email,
                Status = InboxStatus.Falha,
                RecebidoEm = now.AddMinutes(-90),
                Remetente = $"carlos.h@{tenantId}.com",
                Assunto = "CV atualizado (PDF protegido)",
                Destinatario = "rh@liotecnica.com.br",
                VagaId = vaga.Id,
                ProcessamentoPct = 100,
                ProcessamentoEtapa = "Falha",
                ProcessamentoTentativas = 2,
                ProcessamentoUltimoErro = "PDF protegido por senha",
                ProcessamentoLogRaw = System.Text.Json.JsonSerializer.Serialize(new[] { "Anexo encontrado", "Tentativa de leitura", "PDF com senha" }),
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        Nome = "CarlosH_CV.pdf",
                        Tipo = "pdf",
                        TamanhoKB = 190,
                        Hash = "demo-3"
                    }
                }
            }
        };

        db.InboxItems.AddRange(items);
        await db.SaveChangesAsync();
    }



    static TEnum ParseEnumOrFirst<TEnum>(params string[] names) where TEnum : struct, Enum
    {
        foreach (var n in names)
            if (!string.IsNullOrWhiteSpace(n) && Enum.TryParse<TEnum>(n, true, out var v))
                return v;

        return Enum.GetValues<TEnum>()[0];
    }

    static bool IsEnumName<TEnum>(TEnum value, params string[] names) where TEnum : struct, Enum
    {
        var s = value.ToString();
        return names.Any(n => string.Equals(s, n, StringComparison.OrdinalIgnoreCase));
    }

    static VagaArea MapArea(string areaCode)
    {
        areaCode = (areaCode ?? "").Trim().ToUpperInvariant();

        return areaCode switch
        {
            "ADM" => VagaArea.Administrativa,
            "FIN" => VagaArea.Financeira,
            "RH" => VagaArea.RecursosHumanos,
            "OPS" => VagaArea.Operacional,
            "QUA" => VagaArea.Qualidade,
            "ENG" => VagaArea.Tecnica,
            "PDI" => VagaArea.Projetos,               // P&D encaixa melhor aqui
            "SCM" => VagaArea.Suprimentos,
            "COM" => VagaArea.Comercial,
            "TEC" => VagaArea.TecnologiaInformacao,
            _ => VagaArea.NaoInformado
        };
    }
    static VagaDepartamento MapDepartamento(string areaCode)
    {
        areaCode = (areaCode ?? "").Trim().ToUpperInvariant();

        return areaCode switch
        {
            "OPS" => VagaDepartamento.Operacoes,
            "SCM" => VagaDepartamento.Logistica,          // supply chain / logística
            "TEC" => VagaDepartamento.Tecnologia,
            "PDI" => VagaDepartamento.Produto,            // P&D / produto (ajuste se quiser "Qualidade" ou "Operacoes")
            "COM" => VagaDepartamento.Comercial,
            "FIN" => VagaDepartamento.Financeiro,
            "RH" => VagaDepartamento.RecursosHumanos,
            "ADM" => VagaDepartamento.Administracao,
            "QUA" => VagaDepartamento.Qualidade,
            "ENG" => VagaDepartamento.Manutencao,         // engenharia/manutenção
            _ => VagaDepartamento.NaoInformado
        };
    }

    static VagaSenioridade? MapSenioridade(SeniorityLevel seniority)
    {
        // Mapeia o enum do seed (SeniorityLevel) para o seu (VagaSenioridade)
        return seniority switch
        {
            SeniorityLevel.Junior => ParseEnumOrFirst<VagaSenioridade>("Junior", "Jr"),
            SeniorityLevel.Pleno => ParseEnumOrFirst<VagaSenioridade>("Pleno"),
            SeniorityLevel.Senior => ParseEnumOrFirst<VagaSenioridade>("Senior", "Sênior"),
            SeniorityLevel.Especialista => ParseEnumOrFirst<VagaSenioridade>("Especialista"),
            SeniorityLevel.Coordenacao => ParseEnumOrFirst<VagaSenioridade>("Coordenacao", "Coordenador", "Coordenação"),
            SeniorityLevel.Gerencia => ParseEnumOrFirst<VagaSenioridade>("Gerencia", "Gerente", "Gerência"),
            SeniorityLevel.Diretoria => ParseEnumOrFirst<VagaSenioridade>("Diretoria", "Diretor"),
            _ => null
        };
    }

    static string BuildKeywords(string areaCode) => areaCode switch
    {
        "OPS" => "BPF;5S;Segurança;OEE;Setup;Linha de produção;Rastreabilidade",
        "QUA" => "BPF;APPCC;HACCP;Auditoria;Não conformidade;Rastreabilidade;Microbiologia",
        "ENG" => "Manutenção;PCM;MTBF;MTTR;Automação;CLP;Utilidades",
        "SCM" => "PCP;FEFO;FIFO;Inventário;Expedição;Transporte;WMS",
        "PDI" => "Formulação;Estabilidade;Escalonamento;Embalagens;Sensorial;Inovação",
        "COM" => "Key Account;Pricing;Trade;Sell-in;Sell-out;Campanhas",
        "TEC" => "BI;Integrações;ERP;Dados;KPIs;Governança",
        "RH" => "R&S;Treinamento;DP;Turnos;Onboarding",
        "FIN" => "Custos;Controladoria;Fiscal;Tesouraria;Conciliação",
        _ => "Administrativo;Rotinas;Organização;Compliance"
    };

    static string BuildResponsibilities(string areaCode) => areaCode switch
    {
        "OPS" => "Operar processos;Registrar produção;Seguir POPs;Garantir 5S;Reportar desvios",
        "QUA" => "Coletar amostras;Registrar análises;Tratar não conformidades;Apoiar auditorias",
        "ENG" => "Executar manutenção;Prevenir falhas;Registrar OS;Apoiar paradas programadas",
        "SCM" => "Planejar/abastecer;Controlar estoque;Garantir FEFO;Apoiar expedição",
        _ => "Apoiar rotina da área;Garantir organização;Cumprir prazos;Comunicar riscos"
    };


    private static IReadOnlyList<VagaSeed> BuildFoodIndustryVagasDemo()
    {
        // 50 vagas (1 por departamento) — todas com contexto de indústria alimentícia
        return new List<VagaSeed>
    {
        // ADM (5)
        new("VAG-ADM-001","ADM-001","UNI-SPC","Assistente de Facilities & Recepção", SeniorityLevel.Junior,
            "Rotinas de recepção, controle de acessos, apoio a facilities, interface com prestadores e suporte administrativo.",
            false, false),
        new("VAG-ADM-002","ADM-002","UNI-SPC","Analista de Compliance & LGPD", SeniorityLevel.Pleno,
            "Apoio em compliance, políticas internas, análise de riscos, adequação LGPD e suporte a auditorias/regulatórios.",
            false, false),
        new("VAG-ADM-003","ADM-003","UNI-SPC","Assistente de Gestão Documental", SeniorityLevel.Junior,
            "Organização e versionamento de documentos (POPs, registros, evidências), controle de arquivos e suporte a auditorias.",
            false, false),
        new("VAG-ADM-004","ADM-004","UNI-EMB","Técnico de Infraestrutura Predial", SeniorityLevel.Pleno,
            "Manutenção predial (não industrial), acompanhamento de serviços, melhorias de infraestrutura e rotinas de segurança predial.",
            false, true),
        new("VAG-ADM-005","ADM-005","UNI-SPC","Comprador de Indiretos & Serviços", SeniorityLevel.Pleno,
            "Compras indiretas (EPI, MRO leve, serviços), cotações, contratos e gestão de fornecedores de serviços.",
            false, false),

        // FIN (5)
        new("VAG-FIN-001","FIN-001","UNI-SPC","Analista de Contas a Pagar", SeniorityLevel.Pleno,
            "Processamento de títulos, conciliações, fluxo de aprovações, relacionamento com fornecedores e compliance financeiro.",
            false, false),
        new("VAG-FIN-002","FIN-002","UNI-SPC","Analista de Contas a Receber", SeniorityLevel.Pleno,
            "Faturamento, cobrança, conciliação de recebíveis e suporte a políticas de crédito para canais varejo/atacado.",
            false, false),
        new("VAG-FIN-003","FIN-003","UNI-SPC","Analista de Tesouraria", SeniorityLevel.Senior,
            "Gestão de caixa, bancos, pagamentos críticos, rotinas de tesouraria e apoio em aplicações de curto prazo.",
            false, false),
        new("VAG-FIN-004","FIN-004","UNI-SPC","Analista de Custos Industriais", SeniorityLevel.Senior,
            "Apuração de custos industriais, variações, perdas, rendimento, suporte a PCP/produção e análises gerenciais.",
            false, false),
        new("VAG-FIN-005","FIN-005","UNI-SPC","Analista Fiscal & Tributário", SeniorityLevel.Senior,
            "Escrituração fiscal, apuração, SPED e suporte a operações/transportes com visão de compliance tributário.",
            false, false),

        // RH (5)
        new("VAG-RH-001","RH-001","UNI-SPC","Analista de Recrutamento & Seleção", SeniorityLevel.Pleno,
            "Triagem, entrevistas e contratação (operacional/técnico), alinhamento com gestores e onboarding de fábrica.",
            false, false),
        new("VAG-RH-002","RH-002","UNI-SPC","Analista de Treinamento & Desenvolvimento", SeniorityLevel.Pleno,
            "Treinamentos de BPF, segurança de alimentos, integração, reciclagens e trilhas de capacitação na planta.",
            false, false),
        new("VAG-RH-003","RH-003","UNI-SPC","Analista de Departamento Pessoal", SeniorityLevel.Pleno,
            "Folha, ponto, benefícios e rotinas trabalhistas (turnos, adicionais, escalas) com foco em ambiente fabril.",
            false, false),
        new("VAG-RH-004","RH-004","UNI-SPC","Analista de Comunicação Interna", SeniorityLevel.Junior,
            "Campanhas internas, comunicados de turnos, avisos operacionais e apoio a ações de clima/engajamento.",
            false, false),
        new("VAG-RH-005","RH-005","UNI-EMB","Técnico de Enfermagem do Trabalho", SeniorityLevel.Pleno,
            "Rotinas de ambulatório, ASO, acompanhamento de afastamentos e ações preventivas em áreas operacionais.",
            true, true),

        // OPS (5)
        new("VAG-OPS-001","OPS-001","UNI-EMB","Operador de Produção — Preparação & Mistura", SeniorityLevel.Junior,
            "Execução de receitas, dosagem, mistura e registros conforme POPs/BPF. Atenção a rastreabilidade por lote.",
            true, true),
        new("VAG-OPS-002","OPS-002","UNI-EMB","Operador de Processo Térmico — Cozimento/Pasteurização", SeniorityLevel.Pleno,
            "Operação de processos térmicos, controle de tempo/temperatura, registros de CCP e liberação de linha.",
            true, true),
        new("VAG-OPS-003","OPS-003","UNI-EMB","Operador de Máquina de Envase", SeniorityLevel.Pleno,
            "Setup, ajuste e operação de envase. Controle de perdas, rendimento, integridade de selagem e codificação.",
            true, true),
        new("VAG-OPS-004","OPS-004","UNI-EMB","Encarregado de Embalagem & Rotulagem", SeniorityLevel.Coordenacao,
            "Coordenação da equipe de embalagem, controle de consumo, conferência de rótulos, validade e padrões de qualidade.",
            true, true),
        new("VAG-OPS-005","OPS-005","UNI-EMB","Auxiliar de Higienização — CIP/COP", SeniorityLevel.Junior,
            "Rotinas CIP/COP, preparação de químicos, verificação de eficácia e liberação sanitária de equipamentos/linhas.",
            true, true),

        // QUA (5)
        new("VAG-QUA-001","QUA-001","UNI-EMB","Analista de Laboratório (Físico-Químico)", SeniorityLevel.Pleno,
            "Análises físico-químicas (pH, Brix, densidade), controle de especificações e suporte a investigação de desvios.",
            false, true),
        new("VAG-QUA-002","QUA-002","UNI-EMB","Analista de Laboratório (Microbiologia)", SeniorityLevel.Pleno,
            "Análises microbiológicas, monitoramento ambiental, água/superfícies e apoio em validações de higiene.",
            false, true),
        new("VAG-QUA-003","QUA-003","UNI-EMB","Auditor Interno — BPF & Sistema da Qualidade", SeniorityLevel.Senior,
            "Auditorias internas, planos de ação, gestão de não conformidades e fortalecimento do sistema de qualidade.",
            false, true),
        new("VAG-QUA-004","QUA-004","UNI-EMB","Especialista em APPCC/HACCP", SeniorityLevel.Especialista,
            "Gestão de APPCC/HACCP, riscos, CCPs, revisão de POPs e governança de segurança de alimentos.",
            false, true),
        new("VAG-QUA-005","QUA-005","UNI-SPC","Analista de Assuntos Regulatórios (ANVISA/MAPA)", SeniorityLevel.Senior,
            "Regularização, rotulagem legal, interface com órgãos reguladores e suporte a claims e composição.",
            false, false),

        // ENG (5)
        new("VAG-ENG-001","ENG-001","UNI-EMB","Técnico de Manutenção Mecânica", SeniorityLevel.Pleno,
            "Manutenção preventiva/corretiva em equipamentos de linha, redução de paradas e gestão de peças críticas.",
            true, true),
        new("VAG-ENG-002","ENG-002","UNI-EMB","Técnico de Manutenção Elétrica", SeniorityLevel.Pleno,
            "Intervenções elétricas, painéis, motores/sensores, leitura de diagramas e confiabilidade de processo.",
            true, true),
        new("VAG-ENG-003","ENG-003","UNI-EMB","Analista de Utilidades Industriais", SeniorityLevel.Pleno,
            "Gestão de utilidades (vapor, refrigeração, ar comprimido), consumo e estabilidade para garantir qualidade.",
            true, true),
        new("VAG-ENG-004","ENG-004","UNI-EMB","Técnico de Automação Industrial", SeniorityLevel.Senior,
            "CLPs, IHMs, instrumentação, parametrização e suporte à estabilidade de processo / coleta de dados.",
            true, true),
        new("VAG-ENG-005","ENG-005","UNI-EMB","Engenheiro de Processos & Melhoria Contínua", SeniorityLevel.Senior,
            "OEE, perdas, Kaizen, padronização, otimização de setups e suporte ao aumento de capacidade produtiva.",
            false, true),

        // PDI (5)
        new("VAG-PDI-001","PDI-001","UNI-EMB","Analista de P&D (Produtos)", SeniorityLevel.Senior,
            "Desenvolvimento/reformulação, testes de estabilidade, escalonamento e documentação técnica de produto.",
            false, true),
        new("VAG-PDI-002","PDI-002","UNI-EMB","Técnico de P&D — Cozinha Piloto", SeniorityLevel.Pleno,
            "Execução de testes piloto, preparo de amostras, controles e registros conforme padrões de qualidade.",
            false, true),
        new("VAG-PDI-003","PDI-003","UNI-EMB","Analista de Desenvolvimento de Embalagens", SeniorityLevel.Pleno,
            "Especificação de materiais, testes de barreira/selagem, compatibilidade com envase e otimização de custos.",
            false, true),
        new("VAG-PDI-004","PDI-004","UNI-EMB","Analista de Pesquisa Sensorial", SeniorityLevel.Pleno,
            "Planejamento e execução de testes sensoriais, análise de aceitação e suporte à decisão de portfólio.",
            false, true),
        new("VAG-PDI-005","PDI-005","UNI-SPC","Analista de Gestão de Portfólio", SeniorityLevel.Pleno,
            "Pipeline de inovação, priorização de projetos e alinhamento com comercial/marketing para lançamentos.",
            false, false),

        // SCM (5)
        new("VAG-SCM-001","SCM-001","UNI-EMB","Analista de PCP", SeniorityLevel.Pleno,
            "Sequenciamento, MPS, balanceamento capacidade x demanda e apontamentos para eficiência da planta.",
            false, true),
        new("VAG-SCM-002","SCM-002","UNI-SPC","Comprador de Matéria-Prima e Ingredientes", SeniorityLevel.Pleno,
            "Compras de ingredientes, homologação, lead time, contratos e performance de fornecedores críticos.",
            false, false),
        new("VAG-SCM-003","SCM-003","UNI-EMB","Analista de Recebimento & Armazenagem (Insumos)", SeniorityLevel.Junior,
            "Recebimento, conferência, FEFO/FIFO, rastreabilidade e controle de armazenagem em ambiente industrial.",
            true, true),
        new("VAG-SCM-004","SCM-004","UNI-EMB","Analista de Estoques (Embalagens)", SeniorityLevel.Pleno,
            "Inventários, acuracidade, abastecimento de linha e controle de consumo por ordem/lote.",
            true, true),
        new("VAG-SCM-005","SCM-005","UNI-EMB","Analista de Transporte & Distribuição", SeniorityLevel.Pleno,
            "Roteirização, frete, agendamento, SLAs e interface com transportadoras para atender clientes e CDs.",
            false, true),

        // COM (5)
        new("VAG-COM-001","COM-001","UNI-SPC","Executivo de Vendas — Atacado/Distribuidores", SeniorityLevel.Senior,
            "Gestão de distribuidores, políticas comerciais, mix, campanhas e acompanhamento de sell-in/sell-out.",
            false, false),
        new("VAG-COM-002","COM-002","UNI-SPC","Key Account — Grandes Redes", SeniorityLevel.Senior,
            "Negociação com grandes redes, contratos, verbas, planejamento de demanda e gestão de ruptura.",
            false, false),
        new("VAG-COM-003","COM-003","UNI-SPC","Analista de Trade Marketing", SeniorityLevel.Pleno,
            "Execução de planos em PDV, campanhas, materiais e análise de performance por canal.",
            false, false),
        new("VAG-COM-004","COM-004","UNI-SPC","Analista de SAC & Pós-venda", SeniorityLevel.Pleno,
            "Tratativa de reclamações, rastreabilidade, retorno ao consumidor e interface com Qualidade/Regulatório.",
            false, false),
        new("VAG-COM-005","COM-005","UNI-SPC","Analista de Inteligência de Mercado & Pricing", SeniorityLevel.Senior,
            "Análise de concorrência, rentabilidade, precificação e suporte a decisões comerciais por SKU/canal.",
            false, false),

        // TEC (5)
        new("VAG-TEC-001","TEC-001","UNI-SPC","Analista de Suporte — Service Desk", SeniorityLevel.Junior,
            "Atendimento N1/N2, gestão de chamados, inventário e suporte a usuários administrativos e fábrica.",
            false, false),
        new("VAG-TEC-002","TEC-002","UNI-EMB","Analista de Sistemas Industriais (MES/SCADA)", SeniorityLevel.Senior,
            "Sustentação de sistemas industriais, integrações com coleta de dados e suporte a automação/rastreabilidade.",
            true, true),
        new("VAG-TEC-003","TEC-003","UNI-SPC","Analista de ERP & Integrações", SeniorityLevel.Pleno,
            "Sustentação de ERP, cadastros mestres, integrações e apoio a processos de compras/finanças/produção.",
            false, false),
        new("VAG-TEC-004","TEC-004","UNI-SPC","Analista de Dados (BI) — KPIs Industriais", SeniorityLevel.Senior,
            "Dashboards, qualidade de dados e indicadores (OEE, perdas, produtividade) para tomada de decisão.",
            false, false),
        new("VAG-TEC-005","TEC-005","UNI-SPC","Analista de Segurança da Informação", SeniorityLevel.Pleno,
            "Políticas de segurança, acessos, vulnerabilidades e governança LGPD com visão corporativa.",
            false, false),

        // ======= Até aqui são 50? Não: são 45. Completo com +5 vagas extras “plantão/chão de fábrica” =======
        new("VAG-OPS-006","OPS-003","UNI-EMB","Líder de Turno — Produção", SeniorityLevel.Coordenacao,
            "Gestão do turno, metas, segurança, qualidade e produtividade. Acompanha OEE e planos de ação.",
            true, true),
        new("VAG-QUA-006","QUA-003","UNI-EMB","Analista de Rastreabilidade & Recall", SeniorityLevel.Pleno,
            "Controle de lotes, rastreabilidade ponta a ponta e simulado de recall com interface SCM/Qualidade.",
            false, true),
        new("VAG-ENG-006","ENG-003","UNI-EMB","Operador de Caldeira", SeniorityLevel.Senior,
            "Operação e rotinas de segurança em caldeiras/utilidades, controles e inspeções regulamentares.",
            true, true),
        new("VAG-SCM-006","SCM-005","UNI-EMB","Supervisor de Expedição", SeniorityLevel.Coordenacao,
            "Coordena expedição, carregamento e SLA, interface com transportadoras e roteirização diária.",
            true, true),
        new("VAG-OPS-007","OPS-004","UNI-EMB","Conferente de Embalagem & Rotulagem", SeniorityLevel.Junior,
            "Conferência de rotulagem, codificação, datas e integridade de embalagem para evitar desvios e retrabalho.",
            true, true),
    };
    }

    private static async Task EnsureAreasAsync(AppDbContext db, IEnumerable<(string Code, string Name)> areas)
    {
        var existingCodes = await db.Areas
            .AsNoTracking()
            .Select(a => a.Code)
            .ToListAsync();

        var set = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);
        var toAdd = new List<Area>();

        foreach (var (code, name) in areas)
        {
            if (set.Contains(code)) continue;

            toAdd.Add(new Area
            {
                Id = Guid.NewGuid(),
                Code = code,
                Name = name
            });
        }

        if (toAdd.Count > 0)
        {
            db.Areas.AddRange(toAdd);
            await db.SaveChangesAsync();
        }
    }

    private static async Task EnsureRequisitoCategoriasAsync(AppDbContext db, IEnumerable<RequisitoCategoriaSeed> seeds)
    {
        var existingCodes = await db.RequisitoCategorias
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync();

        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var toAdd = new List<RequisitoCategoria>();

        foreach (var s in seeds)
        {
            if (existingSet.Contains(s.Code)) continue;
            toAdd.Add(new RequisitoCategoria
            {
                Id = Guid.NewGuid(),
                Code = s.Code,
                Name = s.Name,
                Description = s.Description,
                IsActive = true
            });
            existingSet.Add(s.Code);
        }

        if (toAdd.Count > 0)
        {
            db.RequisitoCategorias.AddRange(toAdd);
            await db.SaveChangesAsync();
        }
    }

    private static async Task EnsureAgendaTypesAsync(
        AppDbContext db,
        IEnumerable<(string Code, string Label, string Color, string Icon, int SortOrder)> seeds)
    {
        foreach (var seed in seeds)
        {
            var exists = await db.AgendaEventTypes.AnyAsync(x => x.Code == seed.Code);
            if (exists) continue;

            db.AgendaEventTypes.Add(new AgendaEventType
            {
                Id = Guid.NewGuid(),
                Code = seed.Code,
                Label = seed.Label,
                Color = seed.Color,
                Icon = seed.Icon,
                SortOrder = seed.SortOrder,
                IsActive = true
            });
        }

        await db.SaveChangesAsync();
    }

    private static async Task EnsureCostCentersFromDepartmentsAsync(AppDbContext db)
    {
        var deptCostCenters = await db.Departments
            .AsNoTracking()
            .Select(x => x.CostCenter)
            .Where(x => x != null && x != "")
            .Distinct()
            .ToListAsync();

        if (deptCostCenters.Count == 0) return;

        var existingCodes = await db.CostCenters
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync();

        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var toAdd = new List<CostCenter>();

        foreach (var cc in deptCostCenters)
        {
            var code = cc!.Trim();
            if (existingSet.Contains(code)) continue;

            toAdd.Add(new CostCenter
            {
                Id = Guid.NewGuid(),
                Code = code,
                Name = code,
                IsActive = true
            });
            existingSet.Add(code);
        }

        if (toAdd.Count > 0)
        {
            db.CostCenters.AddRange(toAdd);
            await db.SaveChangesAsync();
        }
    }

    private static async Task InsertDepartmentsAsync(
        AppDbContext db,
        Dictionary<string, Guid> areaByCode,
        IReadOnlyList<DepartmentSeed> seeds,
        string emailDomain)
    {
        var departments = seeds
            .Select((s, idx) =>
            {
                if (!areaByCode.TryGetValue(s.AreaCode, out var areaId))
                    throw new InvalidOperationException($"Área '{s.AreaCode}' não encontrada para o departamento '{s.Code}'.");

                return new Department
                {
                    Id = Guid.NewGuid(),
                    Code = s.Code,
                    Name = s.Name,
                    AreaId = areaId,
                    Status = DepartmentStatus.Active,
                    Headcount = s.Headcount,
                    ManagerName = s.ManagerName,
                    ManagerEmail = $"{ToEmailUser(s.ManagerName)}@{emailDomain}",
                    Phone = PhoneFromIndex(idx + 1),
                    CostCenter = s.CostCenter,
                    BranchOrLocation = s.BranchOrLocation,
                    Description = s.Description
                };
            })
            .ToList();

        db.Departments.AddRange(departments);
        await db.SaveChangesAsync();
    }

    private static async Task EnsureDepartmentsAsync(
        AppDbContext db,
        Dictionary<string, Guid> areaByCode,
        IReadOnlyList<DepartmentSeed> seeds,
        string emailDomain)
    {
        var existingCodes = await db.Departments
            .AsNoTracking()
            .Select(d => d.Code)
            .ToListAsync();

        var set = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);
        var toAdd = new List<Department>();

        for (var i = 0; i < seeds.Count; i++)
        {
            var s = seeds[i];
            if (set.Contains(s.Code)) continue;

            if (!areaByCode.TryGetValue(s.AreaCode, out var areaId))
                throw new InvalidOperationException($"Área '{s.AreaCode}' não encontrada para o departamento '{s.Code}'.");

            toAdd.Add(new Department
            {
                Id = Guid.NewGuid(),
                Code = s.Code,
                Name = s.Name,
                AreaId = areaId,
                Status = DepartmentStatus.Active,
                Headcount = s.Headcount,
                ManagerName = s.ManagerName,
                ManagerEmail = $"{ToEmailUser(s.ManagerName)}@{emailDomain}",
                Phone = PhoneFromIndex(i + 1),
                CostCenter = s.CostCenter,
                BranchOrLocation = s.BranchOrLocation,
                Description = s.Description
            });
        }

        if (toAdd.Count > 0)
        {
            db.Departments.AddRange(toAdd);
            await db.SaveChangesAsync();
        }
    }

    private static IReadOnlyList<DepartmentSeed> BuildFoodIndustryDepartments()
        => new List<DepartmentSeed>
        {
            // ================= ADM (5) =================
            new("ADM-001","Facilities & Recepção","ADM",6,"Patrícia Almeida","CC-ADM-010","Escritório - Matriz","Gestão de recepção, limpeza administrativa, utilidades do escritório, contratos prediais e suporte a visitantes."),
            new("ADM-002","Jurídico & Compliance","ADM",3,"Rodrigo Barbosa","CC-ADM-020","Escritório - Matriz","Apoio jurídico, contratos, compliance, LGPD e alinhamento de políticas internas com requisitos regulatórios e clientes."),
            new("ADM-003","Gestão Documental & Arquivo","ADM",2,"Renata Paiva","CC-ADM-030","Escritório - Matriz","Controle de documentos críticos (procedimentos, registros, contratos), versionamento e organização de evidências para auditorias."),
            new("ADM-004","Administração Predial","ADM",4,"Gilberto Nunes","CC-ADM-040","Escritório - Matriz","Manutenção predial administrativa, gestão de prestadores, adequações de layout e melhorias de infraestrutura não industriais."),
            new("ADM-005","Compras Indiretas & Serviços","ADM",5,"Camila Fernandes","CC-ADM-050","Escritório - Matriz","Aquisição de itens indiretos (EPI, MRO leve, serviços), cotações, contratos e gestão de fornecedores de serviços."),

            // ================= FIN (5) =================
            new("FIN-001","Contas a Pagar","FIN",4,"Juliana Ribeiro","CC-FIN-110","Escritório - Matriz","Processamento de títulos, conciliações, fluxo de aprovações e relacionamento com fornecedores (condições e prazos)."),
            new("FIN-002","Contas a Receber","FIN",4,"Marcos Vinícius Costa","CC-FIN-120","Escritório - Matriz","Faturamento, cobrança, gestão de inadimplência e conciliação de recebíveis (varejo/atacado)."),
            new("FIN-003","Tesouraria & Bancos","FIN",3,"Bruno Siqueira","CC-FIN-130","Escritório - Matriz","Gestão de caixa, bancos, aplicações de curto prazo, pagamentos críticos e rotinas de tesouraria."),
            new("FIN-004","Controladoria & Custos Industriais","FIN",5,"Fernanda Azevedo","CC-FIN-140","Escritório - Matriz","Apuração de custos (matéria-prima, embalagem, perdas), análise de variações e suporte a decisões industriais."),
            new("FIN-005","Fiscal & Tributário","FIN",4,"Cláudia Menezes","CC-FIN-150","Escritório - Matriz","Escrituração fiscal, apuração de tributos, SPED, suporte a auditorias e orientação tributária em operações."),

            // ================= RH (5) =================
            new("RH-001","Recrutamento & Seleção","RH",3,"Larissa Martins","CC-RH-210","Escritório - Matriz","Atração de talentos (operacional/técnico), triagem, entrevistas e onboarding alinhado à rotina fabril."),
            new("RH-002","Treinamento & Desenvolvimento","RH",4,"Eduardo Pires","CC-RH-220","Escritório - Matriz","Treinamentos de BPF, segurança de alimentos, integração, reciclagens e trilhas técnicas/gestão."),
            new("RH-003","Departamento Pessoal","RH",4,"Simone Carvalho","CC-RH-230","Escritório - Matriz","Folha, ponto, benefícios, admissões/demissões e rotinas trabalhistas (turnos, adicionais e escalas)."),
            new("RH-004","Comunicação Interna & Endomarketing","RH",2,"Débora Lopes","CC-RH-240","Escritório - Matriz","Campanhas internas, comunicação de turnos, avisos operacionais e suporte a clima e engajamento."),
            new("RH-005","Saúde Ocupacional & Bem-Estar","RH",3,"Andre Santos","CC-RH-250","Ambulatório - Unidade Industrial","ASO, acompanhamento de afastamentos, ações preventivas e suporte à ergonomia em áreas operacionais."),

            // ================= OPS (5) =================
            new("OPS-001","Produção — Preparação & Mistura","OPS",55,"Sérgio Oliveira","CC-OPS-310","Planta Industrial - Unidade 01","Preparação de receitas, dosagem, mistura e controle de parâmetros operacionais conforme POPs e BPF."),
            new("OPS-002","Produção — Cozimento/Pasteurização","OPS",45,"Márcia Coutinho","CC-OPS-320","Planta Industrial - Unidade 01","Operação de processos térmicos (cozimento/pasteurização), registros de tempo/temperatura e controle de CCP."),
            new("OPS-003","Produção — Envasamento/Envase","OPS",60,"Diego Rocha","CC-OPS-330","Planta Industrial - Unidade 01","Operação de envase (líquidos/sólidos), controle de setup, perdas, rendimento e rastreabilidade por lote."),
            new("OPS-004","Embalagem & Rotulagem","OPS",70,"Elaine Freitas","CC-OPS-340","Planta Industrial - Unidade 01","Embalagem final, conferência de rótulos, codificação, validação de datas e inspeções de integridade."),
            new("OPS-005","Higienização & Sanitização (CIP/COP)","OPS",25,"Paulo César Lima","CC-OPS-350","Planta Industrial - Unidade 01","Rotinas CIP/COP, verificação de eficácia, liberação de linha e suporte a cronogramas de sanitização."),

            // ================= QUA (5) =================
            new("QUA-001","Controle de Qualidade — Físico-Químico","QUA",8,"Aline Batista","CC-QUA-410","Laboratório - Unidade 01","Análises físico-químicas (pH, Brix, umidade, densidade), liberação de lotes e suporte a investigação de desvios."),
            new("QUA-002","Controle de Qualidade — Microbiologia","QUA",7,"João Pedro Silva","CC-QUA-420","Laboratório - Unidade 01","Análises microbiológicas, monitoramento ambiental, água e superfícies, e suporte a validações de higiene."),
            new("QUA-003","Garantia da Qualidade — Auditorias & BPF","QUA",6,"Vanessa Moura","CC-QUA-430","Planta Industrial - Unidade 01","Gestão de BPF, auditorias internas, tratamento de não conformidades e melhoria de sistema de qualidade."),
            new("QUA-004","Segurança de Alimentos — HACCP/APPCC","QUA",5,"Gustavo Teixeira","CC-QUA-440","Planta Industrial - Unidade 01","Gestão de APPCC/HACCP, pontos críticos de controle, avaliação de riscos e manutenção de planos de segurança."),
            new("QUA-005","Assuntos Regulatórios — ANVISA/MAPA","QUA",4,"Carolina Fonseca","CC-QUA-450","Escritório - Matriz","Regularização de produtos, rotulagem legal, interface com órgãos reguladores e suporte a claims e composição."),

            // ================= ENG (5) =================
            new("ENG-001","Manutenção Mecânica","ENG",18,"Leandro Ferreira","CC-ENG-510","Planta Industrial - Unidade 01","Manutenção preventiva/corretiva em equipamentos, gestão de backlog, peças críticas e suporte a paradas programadas."),
            new("ENG-002","Manutenção Elétrica","ENG",12,"Ricardo Mendes","CC-ENG-520","Planta Industrial - Unidade 01","Intervenções elétricas, painéis, motores, sensores e confiabilidade para reduzir paradas e microparadas."),
            new("ENG-003","Utilidades — Refrigeração/Caldeiras/Ar Comprimido","ENG",10,"Cássio Moreira","CC-ENG-530","Planta Industrial - Unidade 01","Operação e manutenção de utilidades industriais, controle de consumo e suporte a qualidade (temperatura/pressão)."),
            new("ENG-004","Automação Industrial & Instrumentação","ENG",6,"Tiago Vieira","CC-ENG-540","Planta Industrial - Unidade 01","CLPs, instrumentação, calibrações, integração com SCADA e melhoria de estabilidade de processo."),
            new("ENG-005","Engenharia de Processos & Melhoria Contínua","ENG",8,"Priscila Andrade","CC-ENG-550","Planta Industrial - Unidade 01","OEE, redução de perdas, projetos de melhoria, padronização e otimização de setups e fluxos produtivos."),

            // ================= PDI (5) =================
            new("PDI-001","Desenvolvimento de Produtos","PDI",10,"Helena Cardoso","CC-PDI-610","Centro de Inovação - Unidade 01","Desenvolvimento e reformulação de produtos, testes de estabilidade, escalonamento e suporte a lançamentos."),
            new("PDI-002","Cozinha Piloto & Testes","PDI",6,"Rafael Lima","CC-PDI-620","Centro de Inovação - Unidade 01","Execução de testes piloto, preparo de amostras, validação sensorial interna e suporte a industrialização."),
            new("PDI-003","Desenvolvimento de Embalagens","PDI",5,"Bianca Torres","CC-PDI-630","Centro de Inovação - Unidade 01","Especificação de embalagens, testes de selagem/barreira, compatibilidade com linha e otimização de custos."),
            new("PDI-004","Sensório & Pesquisa com Consumidores","PDI",4,"Luciana Prado","CC-PDI-640","Centro de Inovação - Unidade 01","Painéis sensoriais, testes com consumidores e suporte à decisão de portfólio com base em preferência e aceitação."),
            new("PDI-005","Gestão de Portfólio & Inovação","PDI",3,"Bruno Guimarães","CC-PDI-650","Escritório - Matriz","Pipeline de inovação, priorização de projetos, governança de portfólio e alinhamento com comercial/marketing."),

            // ================= SCM (5) =================
            new("SCM-001","PCP — Planejamento e Controle de Produção","SCM",6,"Daniela Pacheco","CC-SCM-710","Planta Industrial - Unidade 01","Planejamento de curto/médio prazo, sequenciamento, MPS e balanceamento entre demanda, capacidade e estoques."),
            new("SCM-002","Suprimentos — Matérias-Primas e Ingredientes","SCM",8,"Felipe Carvalho","CC-SCM-720","Escritório - Matriz","Compras de ingredientes e matérias-primas, homologação de fornecedores, lead time e gestão de contratos."),
            new("SCM-003","Recebimento & Armazenagem de Insumos","SCM",22,"Michele Pinto","CC-SCM-730","Armazém de Insumos - Unidade 01","Recebimento, conferência, armazenagem, FEFO/FIFO, rastreabilidade e controle de temperatura/umidade quando aplicável."),
            new("SCM-004","Almoxarifado de Embalagens","SCM",12,"Ivan Rocha","CC-SCM-740","Almoxarifado - Unidade 01","Gestão de materiais de embalagem, inventários, abastecimento de linha e controle de consumo por ordem."),
            new("SCM-005","Distribuição & Transporte","SCM",15,"Cristiane Borges","CC-SCM-750","Centro de Distribuição - CD 01","Gestão de fretes, roteirização, nível de serviço, agendamento e interface com transportadoras e clientes."),

            // ================= COM (5) =================
            new("COM-001","Vendas — Atacado/Distribuidores","COM",8,"Amanda Lima","CC-COM-810","Escritório - São Paulo","Gestão de distribuidores, políticas comerciais, mix, campanhas e acompanhamento de sell-in/sell-out."),
            new("COM-002","Vendas — Key Accounts (Grandes Redes)","COM",6,"Thiago Monteiro","CC-COM-820","Escritório - São Paulo","Negociação com grandes redes, contratos, verbas, planejamento de demanda e gestão de ruptura."),
            new("COM-003","Trade Marketing","COM",5,"Natália Faria","CC-COM-830","Escritório - São Paulo","Execução de planos no ponto de venda, materiais, ações promocionais e acompanhamento de performance por canal."),
            new("COM-004","Atendimento ao Cliente (SAC) & Pós-venda","COM",10,"Paula Nascimento","CC-COM-840","Escritório - Matriz","Tratativa de reclamações, rastreabilidade, resposta ao consumidor e interface com Qualidade/Regulatório."),
            new("COM-005","Inteligência de Mercado & Pricing","COM",4,"Vinícius Barros","CC-COM-850","Escritório - São Paulo","Análise de mercado, concorrência, rentabilidade por SKU/canal, precificação e suporte a decisões comerciais."),

            // ================= TEC (5) =================
            new("TEC-001","Service Desk & Suporte ao Usuário","TEC",4,"Henrique Costa","CC-TEC-910","Escritório - Matriz","Suporte N1/N2, gestão de chamados, inventário de equipamentos e atendimento a usuários administrativos e fábrica."),
            new("TEC-002","Sistemas Industriais (MES/SCADA) & Integrações","TEC",3,"Sofia Neves","CC-TEC-920","Planta Industrial - Unidade 01","Sustentação de sistemas industriais, integrações com coleta de dados e suporte a automação e rastreabilidade."),
            new("TEC-003","ERP & Aplicações Corporativas","TEC",3,"Lucas Rangel","CC-TEC-930","Escritório - Matriz","Sustentação de ERP, cadastros mestres, processos financeiros/compras e integrações com sistemas satélites."),
            new("TEC-004","Dados & BI (KPIs, OEE, perdas)","TEC",3,"Mário Tavares","CC-TEC-940","Escritório - Matriz","Modelagem de dados, dashboards, indicadores industriais (OEE, perdas) e suporte à tomada de decisão."),
            new("TEC-005","Segurança da Informação & Governança","TEC",2,"Hugo Lima","CC-TEC-950","Escritório - Matriz","Políticas de segurança, acessos, gestão de vulnerabilidades e governança mínima (LGPD e auditorias)."),
        };

    private static async Task EnsureTenantAsync(AppDbContext db, string tenantId, string tenantName)
    {
        var existing = await db.Tenants.FirstOrDefaultAsync(x => x.TenantId == tenantId);
        if (existing is null)
        {
            db.Tenants.Add(new Tenant
            {
                TenantId = tenantId,
                Name = tenantName,
                IsActive = true
            });
            await db.SaveChangesAsync();
            return;
        }

        if (!string.Equals(existing.Name, tenantName, StringComparison.OrdinalIgnoreCase))
        {
            existing.Name = tenantName;
            await db.SaveChangesAsync();
        }
    }

    private static async Task EnsureAdminAccessAsync(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        string tenantId,
        string emailDomain,
        string adminPassword)
    {
        var adminRole = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Admin");
        if (adminRole is null)
        {
            adminRole = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = "Admin",
                Description = "Tenant administrator",
                IsActive = true
            };

            var roleResult = await roleManager.CreateAsync(adminRole);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(x => x.Description)));
        }

        var adminEmail = $"admin@{emailDomain}";
        var adminUser = await userManager.Users.FirstOrDefaultAsync(x => x.Email == adminEmail);
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                Email = adminEmail,
                UserName = adminEmail,
                FullName = $"{tenantId.ToUpperInvariant()} Admin",
                IsActive = true
            };

            var userResult = await userManager.CreateAsync(adminUser, adminPassword);
            if (!userResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", userResult.Errors.Select(x => x.Description)));
        }

        var isInRole = await userManager.IsInRoleAsync(adminUser, "Admin");
        if (!isInRole)
        {
            var addToRole = await userManager.AddToRoleAsync(adminUser, "Admin");
            if (!addToRole.Succeeded)
                throw new InvalidOperationException(string.Join("; ", addToRole.Errors.Select(x => x.Description)));
        }

        var menus = BuildDefaultMenus();
        foreach (var menu in menus)
        {
            var exists = await db.Menus.AnyAsync(x => x.PermissionKey == menu.PermissionKey);
            if (!exists)
            {
                db.Menus.Add(menu);
            }
        }

        await db.SaveChangesAsync();

        var menuByKey = await db.Menus.ToDictionaryAsync(x => x.PermissionKey, x => x);

        var adminMenuAssignments = menuByKey.Values
            .Select(x => (MenuId: x.Id, x.PermissionKey))
            .ToList();

        if (menuByKey.TryGetValue("users.read", out var usersMenu))
            adminMenuAssignments.Add((usersMenu.Id, "users.write"));

        var existingAssignments = await db.RoleMenus
            .Where(x => x.RoleId == adminRole.Id)
            .Select(x => new { x.MenuId, x.PermissionKey })
            .ToListAsync();

        var existingKeys = existingAssignments
            .Select(x => $"{x.MenuId}:{x.PermissionKey}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var toAdd = adminMenuAssignments
            .Where(x => !existingKeys.Contains($"{x.MenuId}:{x.PermissionKey}"))
            .Select(x => new RoleMenu
            {
                Id = Guid.NewGuid(),
                RoleId = adminRole.Id,
                MenuId = x.MenuId,
                PermissionKey = x.PermissionKey
            })
            .ToList();

        if (toAdd.Count() > 0)
        {
            db.RoleMenus.AddRange(toAdd);
            await db.SaveChangesAsync();
        }

        await EnsureEmailTemplatesAsync(db);
        await EnsureEmailMessagesSeedAsync(db, tenantId);
    }

    private static async Task EnsureEmailTemplatesAsync(AppDbContext db)
    {
        var exists = await db.EmailTemplates.AnyAsync(x => x.Name == "CandidaturaConfirmacao" && x.IsActive);
        if (exists) return;

        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = "CandidaturaConfirmacao",
            SubjectTemplate = "Confirmacao da sua candidatura - {{VagaTitulo}}",
            BodyHtml = @"<div style=""font-family:Arial,sans-serif;line-height:1.6"">
                <h2>Obrigado pela candidatura, {{Nome}}!</h2>
                <p>Recebemos sua candidatura para a vaga <strong>{{VagaTitulo}}</strong>.</p>
                <p>Guarde sua chave unica de acesso ao portal:</p>
                <p style=""font-size:18px;font-weight:bold"">{{PortalAccessKey}}</p>
                <p>Em breve voce recebera novidades sobre o processo seletivo.</p>
                <p>Equipe RH</p>
            </div>",
            Version = 1,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync();
    }

    private static async Task EnsureAgendaEventsSeedAsync(AppDbContext db, string tenantId)
    {
        var hasEvents = await db.AgendaEvents.AnyAsync(x => x.TenantId == tenantId);
        if (hasEvents) return;

        var types = await db.AgendaEventTypes
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Code, x => x.Id);

        if (types.Count == 0) return;

        var now = DateTime.UtcNow;
        var seeds = new[]
        {
            new { Code = "entrevista", Title = "Entrevista - Analista de Qualidade", Candidate = "Carlos Lima", Vaga = "Assistente de Qualidade", VagaCode = "VAG-QUA-004", Owner = "Ana (RH)", Location = "Google Meet" },
            new { Code = "entrevista", Title = "Entrevista - Operador de Producao", Candidate = "Marina Souza", Vaga = "Operador de Producao (Linha)", VagaCode = "VAG-OPS-002", Owner = "Joao (RH)", Location = "Sala 2" },
            new { Code = "reuniao", Title = "Reuniao com gestor requisitante", Candidate = "Fernanda Rocha", Vaga = "Tecnico de Manutencao", VagaCode = "VAG-ENG-001", Owner = "Diego (RH)", Location = "Teams" },
            new { Code = "assessment", Title = "Assessment tecnico", Candidate = "Juliana Martins", Vaga = "Tecnico de P&D", VagaCode = "VAG-PDI-003", Owner = "Bruno (RH)", Location = "Sala 4" },
            new { Code = "followup", Title = "Follow-up de documentacao", Candidate = "Rafael Pereira", Vaga = "Executivo de Vendas", VagaCode = "VAG-COM-001", Owner = "Paula (RH)", Location = "Email" },
            new { Code = "onboarding", Title = "Onboarding - novo colaborador", Candidate = "Aline Costa", Vaga = "Analista de Dados (BI)", VagaCode = "VAG-TEC-002", Owner = "Marina (RH)", Location = "Sala 1" },
            new { Code = "reuniao", Title = "Reuniao de alinhamento", Candidate = "Bruno Alves", Vaga = "Analista de Logistica", VagaCode = "VAG-SCM-003", Owner = "Fernanda (RH)", Location = "Teams" },
            new { Code = "entrevista", Title = "Entrevista - Administrativo", Candidate = "Paula Santos", Vaga = "Assistente Administrativo", VagaCode = "VAG-ADM-001", Owner = "Carlos (RH)", Location = "Sala 3" },
            new { Code = "outro", Title = "Contato inicial com candidato", Candidate = "Diego Oliveira", Vaga = "Analista Financeiro", VagaCode = "VAG-FIN-002", Owner = "Aline (RH)", Location = "Ligacao" },
            new { Code = "assessment", Title = "Teste comportamental", Candidate = "Joao Mendes", Vaga = "Assistente Administrativo (Planta)", VagaCode = "VAG-ADM-002", Owner = "Juliana (RH)", Location = "Online" }
        };

        var events = new List<AgendaEvent>();
        for (var i = 0; i < seeds.Length; i++)
        {
            var seed = seeds[i];
            if (!types.TryGetValue(seed.Code, out var typeId)) continue;

            var start = now.Date.AddDays(i - 3).AddHours(9 + (i % 5));
            var end = start.AddMinutes(30 + (i % 3) * 15);

            events.Add(new AgendaEvent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TypeId = typeId,
                Title = seed.Title,
                StartAtUtc = DateTime.SpecifyKind(start, DateTimeKind.Utc),
                EndAtUtc = DateTime.SpecifyKind(end, DateTimeKind.Utc),
                AllDay = false,
                Status = "confirmado",
                Location = seed.Location,
                Owner = seed.Owner,
                Candidate = seed.Candidate,
                VagaTitle = seed.Vaga,
                VagaCode = seed.VagaCode,
                Notes = "Evento gerado no seed para validacao.",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            });
        }

        if (events.Count > 0)
        {
            db.AgendaEvents.AddRange(events);
            await db.SaveChangesAsync();
        }
    }

    private static async Task EnsureEmailMessagesSeedAsync(AppDbContext db, string tenantId)
    {
        var exists = await db.EmailMessages.AnyAsync(x => x.TenantId == tenantId);
        if (exists) return;

        var now = DateTimeOffset.UtcNow;
        var random = new Random(42);
        var subjects = new[]
        {
            "Confirmacao de candidatura",
            "Convite para entrevista",
            "Retorno sobre candidatura",
            "Atualizacao do processo seletivo",
            "Lembrete de documentacao",
            "Feedback da vaga"
        };

        var sources = new[] { "portal", "sistema", "triagem", "agenda" };
        var owners = new[]
        {
            new { Id = "user-1", Name = "LIOTECNICA Admin" },
            new { Id = "user-2", Name = "Recrutadora Ana" }
        };

        var messages = new List<EmailMessage>();
        for (var i = 0; i < 40; i++)
        {
            var owner = owners[random.Next(owners.Length)];
            var isSystem = i % 7 == 0;
            var status = (EmailMessageStatus)random.Next(0, 4);
            var created = now.AddMinutes(-random.Next(15, 6000));
            var attemptCount = status switch
            {
                EmailMessageStatus.Sent => random.Next(1, 3),
                EmailMessageStatus.Failed => random.Next(2, 4),
                _ => random.Next(0, 2)
            };

            var msg = new EmailMessage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                OwnerUserId = isSystem ? null : owner.Id,
                OwnerUserName = isSystem ? null : owner.Name,
                IsSystem = isSystem,
                Source = sources[random.Next(sources.Length)],
                To = $"candidato{i + 1}@email.com",
                Subject = subjects[random.Next(subjects.Length)],
                BodyHtml = "<p>Mensagem de teste para validacao do layout.</p>",
                Status = status,
                AttemptCount = attemptCount,
                MaxAttempts = 3,
                NextAttemptAtUtc = status == EmailMessageStatus.Queued || status == EmailMessageStatus.InProgress
                    ? created.AddMinutes(5)
                    : null,
                LastError = status == EmailMessageStatus.Failed ? "Falha ao enviar email (SMTP)." : null,
                CreatedAtUtc = created,
                UpdatedAtUtc = created.AddMinutes(random.Next(1, 120))
            };

            for (var a = 1; a <= attemptCount; a++)
            {
                var attempt = new EmailAttempt
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EmailMessageId = msg.Id,
                    AttemptNumber = a,
                    Provider = "smtp",
                    StartedAtUtc = created.AddMinutes(a),
                    CompletedAtUtc = created.AddMinutes(a).AddSeconds(20),
                    IsSuccess = status == EmailMessageStatus.Sent && a == attemptCount,
                    ErrorMessage = status == EmailMessageStatus.Failed ? "Timeout no servidor SMTP." : null
                };
                msg.Attempts.Add(attempt);
            }

            messages.Add(msg);
        }

        db.EmailMessages.AddRange(messages);
        await db.SaveChangesAsync();
    }

    private static List<Menu> BuildDefaultMenus()
    {
        return new List<Menu>
        {
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Dashboard",
                Route = "/Dashboard",
                Icon = "bi-speedometer2",
                Order = 1,
                PermissionKey = "dashboard.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Agenda",
                Route = "/Agendas",
                Icon = "bi-calendar-event",
                Order = 2,
                PermissionKey = "agenda.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Vagas",
                Route = "/Vagas",
                Icon = "bi-briefcase",
                Order = 3,
                PermissionKey = "vagas.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Candidatos",
                Route = "/Candidatos",
                Icon = "bi-people",
                Order = 4,
                PermissionKey = "candidatos.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Triagem",
                Route = "/Triagem",
                Icon = "bi-funnel",
                Order = 5,
                PermissionKey = "triagem.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Matching",
                Route = "/Matching",
                Icon = "bi-stars",
                Order = 6,
                PermissionKey = "matching.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Portal de Vagas",
                Route = "/PortalVagas",
                Icon = "bi-globe2",
                Order = 7,
                PermissionKey = "portalvagas.view",
                IsActive = true,
                OpenInNewTab = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Entrada (Email/Pasta)",
                Route = "/EntradaEmailPasta",
                Icon = "bi-inbox",
                Order = 20,
                PermissionKey = "entrada.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Relatorios",
                Route = "/Relatorios",
                Icon = "bi-graph-up",
                Order = 40,
                PermissionKey = "relatorios.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Departamentos",
                Route = "/Departamentos",
                Icon = "bi-diagram-2",
                Order = 41,
                PermissionKey = "departments.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Centros de Custo",
                Route = "/CentrosCustos",
                Icon = "bi-cash-coin",
                Order = 42,
                PermissionKey = "costcenters.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Areas",
                Route = "/Areas",
                Icon = "bi-diagram-3",
                Order = 43,
                PermissionKey = "areas.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Categorias",
                Route = "/Categorias",
                Icon = "bi-tags",
                Order = 44,
                PermissionKey = "categories.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Cargos",
                Route = "/Cargos",
                Icon = "bi-briefcase",
                Order = 45,
                PermissionKey = "jobpositions.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Unidades",
                Route = "/Unidades",
                Icon = "bi-building",
                Order = 46,
                PermissionKey = "units.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Gestores",
                Route = "/Gestores",
                Icon = "bi-person-badge",
                Order = 47,
                PermissionKey = "managers.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Usuarios",
                Route = "/Admin/Users",
                Icon = "bi-people",
                Order = 80,
                PermissionKey = "users.read",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Perfis",
                Route = "/Admin/Roles",
                Icon = "bi-shield-lock",
                Order = 81,
                PermissionKey = "roles.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Menus",
                Route = "/Admin/Menus",
                Icon = "bi-list-check",
                Order = 82,
                PermissionKey = "menus.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Acessos",
                Route = "/Admin/Accesses",
                Icon = "bi-key",
                Order = 83,
                PermissionKey = "access.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Logs Transacionais",
                Route = "/Admin/Logs",
                Icon = "bi-activity",
                Order = 84,
                PermissionKey = "audit.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Logs Operacionais",
                Route = "/Admin/OperationalLogs",
                Icon = "bi-journal-text",
                Order = 85,
                PermissionKey = "logs.view",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Templates de Email",
                Route = "/Admin/EmailTemplates",
                Icon = "bi-envelope-paper",
                Order = 86,
                PermissionKey = "email-templates.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Emails",
                Route = "/Admin/Emails",
                Icon = "bi-envelope",
                Order = 87,
                PermissionKey = "emails.manage",
                IsActive = true
            },
            new()
            {
                Id = Guid.NewGuid(),
                DisplayName = "Config Email",
                Route = "/Admin/EmailConfig",
                Icon = "bi-gear",
                Order = 88,
                PermissionKey = "email-config.manage",
                IsActive = true
            }
        };
    }

    private static string ToEmailUser(string fullName)
    {
        // "João Pedro Silva" -> "joao.pedro.silva"
        static string stripDiacritics(string s)
        {
            var normalized = s.Normalize(NormalizationForm.FormD);
            var chars = normalized.Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark);
            return new string(chars.ToArray()).Normalize(NormalizationForm.FormC);
        }

        var cleaned = stripDiacritics(fullName)
            .Trim()
            .ToLowerInvariant();

        var parts = cleaned
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        // evita emails muito curtos se vier só 1 nome
        if (parts.Length == 1) return parts[0];

        return string.Join('.', parts);
    }

    private static string PhoneFromIndex(int i)
        => $"(11) 94010-{i:0000}";
}
