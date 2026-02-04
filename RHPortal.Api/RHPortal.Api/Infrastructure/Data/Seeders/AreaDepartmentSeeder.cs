using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using System.Linq;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class AreaDepartmentSeeder
{
    private sealed record DepartmentSeed(
        string Code,
        string Name,
        string AreaCode,
        int Headcount,
        string ManagerName,
        string BranchOrLocation,
        string Description);

    private sealed record RequisitoCategoriaSeed(
        string Code,
        string Name,
        string Description);

    public static async Task EnsureAsync(AppDbContext db, string emailDomain, CancellationToken ct)
    {
        var areas = new (string Code, string Name)[]
        {
            ("ADM","Administrativo"),
            ("FIN","Financeiro & Controladoria"),
            ("RH","Gente & Gestao"),
            ("OPS","Operacoes Industriais"),
            ("QUA","Qualidade & Seguranca de Alimentos"),
            ("ENG","Engenharia & Manutencao"),
            ("PDI","Pesquisa & Desenvolvimento"),
            ("SCM","Supply Chain"),
            ("COM","Comercial & Marketing"),
            ("TEC","Tecnologia (TI & Dados)")
        };

        await EnsureAreasAsync(db, areas, ct);

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

        await EnsureRequisitoCategoriasAsync(db, requisitoCategorias, ct);

        var areaByCode = await db.Areas
            .AsNoTracking()
            .ToDictionaryAsync(a => a.Code, a => a.Id, ct);

        var seeds = BuildFoodIndustryDepartments();

        var existingDepts = await db.Departments.ToListAsync(ct);
        if (existingDepts.Count == 1 && string.Equals(existingDepts[0].Code, "DEP-001", StringComparison.OrdinalIgnoreCase))
        {
            db.Departments.Remove(existingDepts[0]);
            await db.SaveChangesAsync(ct);
            existingDepts.Clear();
        }

        if (existingDepts.Count == 0)
        {
            await InsertDepartmentsAsync(db, areaByCode, seeds, emailDomain, ct);
        }
        else
        {
            await EnsureDepartmentsAsync(db, areaByCode, seeds, emailDomain, ct);
        }

    }

    private static async Task EnsureAreasAsync(AppDbContext db, IEnumerable<(string Code, string Name)> areas, CancellationToken ct)
    {
        var existingCodes = await db.Areas
            .AsNoTracking()
            .Select(a => a.Code)
            .ToListAsync(ct);

        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var area in areas)
        {
            if (existingSet.Contains(area.Code)) continue;

            db.Areas.Add(new Area
            {
                Id = Guid.NewGuid(),
                Code = area.Code,
                Name = area.Name,
                IsActive = true
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task EnsureRequisitoCategoriasAsync(AppDbContext db, IEnumerable<RequisitoCategoriaSeed> seeds, CancellationToken ct)
    {
        var existingCodes = await db.RequisitoCategorias
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync(ct);

        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var toAdd = seeds
            .Where(s => !existingSet.Contains(s.Code))
            .Select(s => new RequisitoCategoria
            {
                Id = Guid.NewGuid(),
                Code = s.Code,
                Name = s.Name,
                Description = s.Description,
                IsActive = true
            })
            .ToList();

        if (toAdd.Count > 0)
        {
            db.RequisitoCategorias.AddRange(toAdd);
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task InsertDepartmentsAsync(
        AppDbContext db,
        IReadOnlyDictionary<string, Guid> areaByCode,
        IEnumerable<DepartmentSeed> seeds,
        string emailDomain,
        CancellationToken ct)
    {
        foreach (var seed in seeds)
        {
            if (!areaByCode.TryGetValue(seed.AreaCode, out var areaId))
                continue;

            db.Departments.Add(new Department
            {
                Id = Guid.NewGuid(),
                Code = seed.Code,
                Name = seed.Name,
                AreaId = areaId,
                Headcount = seed.Headcount,
                ManagerName = seed.ManagerName,
                ManagerEmail = $"{ToEmailUser(seed.ManagerName)}@{emailDomain}",
                BranchOrLocation = seed.BranchOrLocation,
                Description = seed.Description,
                Status = DepartmentStatus.Active
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task EnsureDepartmentsAsync(
        AppDbContext db,
        IReadOnlyDictionary<string, Guid> areaByCode,
        IEnumerable<DepartmentSeed> seeds,
        string emailDomain,
        CancellationToken ct)
    {
        var existingList = await db.Departments
            .AsNoTracking()
            .ToListAsync(ct);
        var existing = existingList
            .ToDictionary(d => d.Code, d => d, StringComparer.OrdinalIgnoreCase);

        foreach (var seed in seeds)
        {
            if (existing.ContainsKey(seed.Code)) continue;
            if (!areaByCode.TryGetValue(seed.AreaCode, out var areaId))
                continue;

            db.Departments.Add(new Department
            {
                Id = Guid.NewGuid(),
                Code = seed.Code,
                Name = seed.Name,
                AreaId = areaId,
                Headcount = seed.Headcount,
                ManagerName = seed.ManagerName,
                ManagerEmail = $"{ToEmailUser(seed.ManagerName)}@{emailDomain}",
                BranchOrLocation = seed.BranchOrLocation,
                Description = seed.Description,
                Status = DepartmentStatus.Active
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static string ToEmailUser(string fullName)
    {
        static string StripDiacritics(string s)
        {
            var normalized = s.Normalize(System.Text.NormalizationForm.FormD);
            var chars = normalized.Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark);
            return new string(chars.ToArray()).Normalize(System.Text.NormalizationForm.FormC);
        }

        var cleaned = StripDiacritics(fullName)
            .Trim()
            .ToLowerInvariant();

        var parts = cleaned
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 1) return parts[0];

        return string.Join('.', parts);
    }

    private static IReadOnlyList<DepartmentSeed> BuildFoodIndustryDepartments()
    {
        return new List<DepartmentSeed>
        {
            // ================= ADM (5) =================
            new("ADM-001","Administracao Geral","ADM",6,"Anderson Silva","Escritorio - Matriz","Gestao administrativa, contratos, governanca e suporte as areas corporativas."),
            new("ADM-002","Recepcao & Facilities","ADM",8,"Luciana Freitas","Escritorio - Matriz","Gestao de facilities, portaria, limpeza e manutencao predial."),
            new("ADM-003","Compras Indiretas","ADM",5,"Fernanda Lopes","Escritorio - Matriz","Compras de servicos, materiais indiretos e negociacoes com fornecedores."),
            new("ADM-004","Administrativo Planta","ADM",10,"Rogerio Campos","Planta Industrial - Unidade 01","Rotinas administrativas da planta e apoio a operacoes."),
            new("ADM-005","Controladoria Administrativa","ADM",4,"Paula Martins","Escritorio - Matriz","Suporte a budget, contratos e controles administrativos."),

            // ================= FIN (5) =================
            new("FIN-001","Financeiro","FIN",12,"Cristina Souza","Escritorio - Matriz","Contas a pagar/receber, tesouraria e fluxo de caixa."),
            new("FIN-002","Contabilidade","FIN",6,"Ricardo Lima","Escritorio - Matriz","Fechamento contabil, conciliacoes e obrigacoes acessorias."),
            new("FIN-003","Fiscal/Tributario","FIN",5,"Julio Mendes","Escritorio - Matriz","Apuracao de impostos e compliance fiscal."),
            new("FIN-004","Custos Industriais","FIN",7,"Mariana Nunes","Escritorio - Matriz","Apuracao de custos, margens e apoio a decisao."),
            new("FIN-005","Controladoria","FIN",4,"Thiago Alves","Escritorio - Matriz","Relatorios gerenciais, KPIs e governanca financeira."),

            // ================= RH (5) =================
            new("RH-001","Recrutamento & Selecao","RH",6,"Aline Costa","Escritorio - Matriz","Aquisicao de talentos e processos seletivos."),
            new("RH-002","Treinamento & Desenvolvimento","RH",5,"Bruno Santos","Escritorio - Matriz","Capacitacao tecnica e comportamental."),
            new("RH-003","Administracao de Pessoal","RH",8,"Camila Rocha","Escritorio - Matriz","Folha de pagamento, beneficios e rotinas trabalhistas."),
            new("RH-004","Cultura & Engajamento","RH",4,"Diego Oliveira","Escritorio - Matriz","Clima organizacional e comunicacao interna."),
            new("RH-005","Saude & Seguranca","RH",6,"Fernanda Braga","Planta Industrial - Unidade 01","Programas de seguranca, EPI e CIPA."),

            // ================= OPS (10) =================
            new("OPS-001","Linha de Producao 1","OPS",30,"Rafael Pereira","Planta Industrial - Unidade 01","Operacao de linha de envase e embalagem."),
            new("OPS-002","Linha de Producao 2","OPS",28,"Marcos Silva","Planta Industrial - Unidade 01","Operacao de linha de preparo e cozimento."),
            new("OPS-003","PCP - Planejamento e Controle","OPS",6,"Juliana Martins","Planta Industrial - Unidade 01","Sequenciamento e controle de producao."),
            new("OPS-004","Logistica Interna","OPS",12,"Lucas Cardoso","Planta Industrial - Unidade 01","Movimentacao interna e abastecimento de linhas."),
            new("OPS-005","Recebimento de Materia-Prima","OPS",10,"Tiago Lima","Planta Industrial - Unidade 01","Recebimento e conferencia de insumos."),
            new("OPS-006","Expedicao","OPS",14,"Amanda Ribeiro","Planta Industrial - Unidade 01","Separacao e expedicao de pedidos."),
            new("OPS-007","Embalagem Secundaria","OPS",18,"Patricia Souza","Planta Industrial - Unidade 01","Rotinas de embalagem secundaria e etiquetagem."),
            new("OPS-008","Higienizacao","OPS",10,"Paulo Ramos","Planta Industrial - Unidade 01","Limpeza e sanitizacao de equipamentos."),
            new("OPS-009","Armazenagem Refrigerada","OPS",12,"Renata Gomes","Planta Industrial - Unidade 01","Controle de camara fria e estoque."),
            new("OPS-010","Utilidades","OPS",8,"Henrique Dias","Planta Industrial - Unidade 01","Vapor, ar comprimido e agua gelada."),

            // ================= QUA (5) =================
            new("QUA-001","Controle de Qualidade","QUA",10,"Carla Mendes","Planta Industrial - Unidade 01","Inspecoes e controles em processo."),
            new("QUA-002","Laboratorio Microbiologia","QUA",6,"Silvia Costa","Planta Industrial - Unidade 01","Analises microbiologicas de produto."),
            new("QUA-003","Laboratorio Fisico-Quimico","QUA",6,"Fabio Silva","Planta Industrial - Unidade 01","Analises fisico-quimicas e liberacoes."),
            new("QUA-004","Garantia da Qualidade","QUA",8,"Aline Rocha","Planta Industrial - Unidade 01","Auditorias e normas de qualidade."),
            new("QUA-005","Seguranca de Alimentos","QUA",5,"Carlos Lima","Planta Industrial - Unidade 01","BPF, APPCC e rastreabilidade."),

            // ================= ENG (5) =================
            new("ENG-001","Manutencao Mecanica","ENG",14,"Leandro Ferreira","Planta Industrial - Unidade 01","Manutencao preventiva e corretiva em equipamentos."),
            new("ENG-002","Manutencao Eletrica","ENG",12,"Ricardo Mendes","Planta Industrial - Unidade 01","Intervencoes eletricas e automacao."),
            new("ENG-003","Utilidades - Refrigeracao","ENG",10,"Cassio Moreira","Planta Industrial - Unidade 01","Operacao de utilidades e consumo energetico."),
            new("ENG-004","Automacao Industrial","ENG",6,"Tiago Vieira","Planta Industrial - Unidade 01","CLPs, instrumentacao e SCADA."),
            new("ENG-005","Engenharia de Processos","ENG",8,"Priscila Andrade","Planta Industrial - Unidade 01","Melhoria continua e reducao de perdas."),

            // ================= PDI (5) =================
            new("PDI-001","Desenvolvimento de Produtos","PDI",10,"Helena Cardoso","Centro de Inovacao - Unidade 01","Desenvolvimento e reformulacao de produtos."),
            new("PDI-002","Cozinha Piloto","PDI",6,"Rafael Lima","Centro de Inovacao - Unidade 01","Testes piloto e validacao de amostras."),
            new("PDI-003","Desenvolvimento de Embalagens","PDI",5,"Bianca Torres","Centro de Inovacao - Unidade 01","Especificacao e testes de embalagens."),
            new("PDI-004","Sensorial & Pesquisa","PDI",4,"Luciana Prado","Centro de Inovacao - Unidade 01","Testes sensoriais e pesquisa com consumidores."),
            new("PDI-005","Gestao de Portfolio","PDI",3,"Bruno Guimaraes","Escritorio - Matriz","Pipeline de inovacao e priorizacao."),

            // ================= SCM (5) =================
            new("SCM-001","PCP - Planejamento","SCM",6,"Daniela Pacheco","Planta Industrial - Unidade 01","Sequenciamento e balanceamento de demanda."),
            new("SCM-002","Suprimentos","SCM",8,"Felipe Carvalho","Escritorio - Matriz","Compras de materias-primas e contratos."),
            new("SCM-003","Armazem de Insumos","SCM",22,"Michele Pinto","Armazem - Unidade 01","Recebimento e armazenagem de insumos."),
            new("SCM-004","Almoxarifado Embalagens","SCM",12,"Ivan Rocha","Almoxarifado - Unidade 01","Gestao de embalagens e abastecimento."),
            new("SCM-005","Distribuicao & Transporte","SCM",15,"Cristiane Borges","Centro de Distribuicao - CD 01","Roteirizacao e gestao de fretes."),

            // ================= COM (5) =================
            new("COM-001","Vendas - Atacado","COM",8,"Amanda Lima","Escritorio - Sao Paulo","Gestao de distribuidores e canais."),
            new("COM-002","Vendas - Key Accounts","COM",6,"Thiago Monteiro","Escritorio - Sao Paulo","Negociacao com grandes redes."),
            new("COM-003","Trade Marketing","COM",5,"Natalia Faria","Escritorio - Sao Paulo","Planos no ponto de venda."),
            new("COM-004","Atendimento ao Cliente (SAC)","COM",10,"Paula Nascimento","Escritorio - Matriz","Tratativa de reclamacoes."),
            new("COM-005","Inteligencia de Mercado","COM",4,"Vinicius Barros","Escritorio - Sao Paulo","Analise de mercado e precificacao."),

            // ================= TEC (5) =================
            new("TEC-001","Service Desk","TEC",4,"Henrique Costa","Escritorio - Matriz","Suporte N1/N2 e chamados."),
            new("TEC-002","Sistemas Industriais","TEC",3,"Sofia Neves","Planta Industrial - Unidade 01","Sustentacao de sistemas industriais."),
            new("TEC-003","ERP & Aplicacoes","TEC",3,"Lucas Rangel","Escritorio - Matriz","Sustentacao de ERP e integracoes."),
            new("TEC-004","Dados & BI","TEC",3,"Mario Tavares","Escritorio - Matriz","Dashboards e indicadores."),
            new("TEC-005","Seguranca da Informacao","TEC",2,"Hugo Lima","Escritorio - Matriz","Politicas de seguranca e LGPD.")
        };
    }
}
