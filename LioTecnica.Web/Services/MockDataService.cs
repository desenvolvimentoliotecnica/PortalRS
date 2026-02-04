using LioTecnica.Web.ViewModels.Seed;

namespace LioTecnica.Web.Services;

public static class MockDataService
{
    private const string VagaMarketingId = "3839eb62-b69a-4db6-8ae4-6276a98416af";
    private const string VagaQualidadeId = "dd12c352-f00e-4c75-8cb5-f69e7cbeefab";
    private const string VagaBiId = "522e4436-bae2-475b-9dd4-d12836a6b416";

    private const string CandMarianaId = "27bed6b7-21af-4a01-8f48-bbd21ff7f1f8";
    private const string CandCarlosId = "707b5868-23db-497f-9d80-c21dbea61f8d";
    private const string CandAnaId = "a8631d35-98bc-4402-9ec2-8f3397bdc862";
    private const string CandBrunoId = "e6375c65-3b1b-42c8-85d7-a87e6f070223";
    private const string CandDanielaId = "ddddb8d5-7756-4e04-ab5a-f06375ad3773";
    private const string CandRafaelId = "2dfb1f64-0f3e-4f5c-8fb6-1f2d9c0dbf1a";
    private const string CandPatriciaId = "9e4a5d7e-2b4a-4a2b-9e02-8f9a4e2b7c15";
    private const string CandCamilaId = "c0d6f2a5-77f8-4bf4-9f6f-6a8e7f6c5e11";
    private const string CandTiagoId = "b1c9a1d4-6c28-4a0a-9ac1-3d7a1f3b8a22";
    private const string CandSofiaId = "6f6aa1d1-1f4b-4c7c-9a7b-4b3c1f2d5e33";
    private const string CandLucasId = "8a0c5e6b-2f4e-4e6f-8b2e-1a3f5c7d9e44";

    private const string InboxMarianaId = "ea04cfa6-0179-4126-892f-262a47956f44";
    private const string InboxAnaId = "7e1f58ff-7e74-48c2-8a1c-2a8ba7fef998";
    private const string InboxCarlosId = "e0eb1617-c887-4e91-a023-c1ecadacc886";

    private const string RoleAdminId = "7691a81a-46d1-48d0-a8ba-c105017114cc";
    private const string RoleRecruiterId = "c3d6b72b-fd52-4ef1-97ac-de865c00ba1a";
    private const string RoleManagerId = "b2af23dd-fe6c-4ef5-9a04-2d1510ad85d8";

    private const string UserFernandaId = "4d560cd6-f2d0-4548-8c1e-bb723eb01c87";
    private const string UserMarcosId = "0c68b5a5-7970-4702-8c19-9dc8538635c4";
    private const string UserAnaId = "2c6cc7fb-6911-4a1e-a390-265bac2cf564";

    public static SeedBundle BuildSeedBundle()
    {
        var now = DateTimeOffset.UtcNow;

        var vagas = new List<VagaSeed>
        {
            new()
            {
                Id = VagaMarketingId,
                Codigo = "MKT-JR-001",
                Titulo = "Analista de Marketing Jr",
                Area = "Marketing",
                Modalidade = "Hibrido",
                Status = "aberta",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Junior",
                Threshold = 70,
                Descricao = "Apoiar campanhas, CRM e analises. Perfil analitico e mao na massa.",
                CreatedAt = Iso(now.AddDays(-4)),
                UpdatedAt = Iso(now.AddHours(-6)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 30, Formacao = 15, Localidade = 15 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "6e789fe0-1fea-499a-bbfc-9ca35b4fe35d", Categoria = "Ferramenta/Tecnologia", Termo = "Power BI", Peso = 9, Obrigatorio = true, Sinonimos = new []{ "pbi", "powerbi" }, Obs = "Dashboards e KPIs" },
                    new() { Id = "2d9f7b80-e9ca-42b0-a9a7-7ffdac48e91c", Categoria = "Competencia", Termo = "Google Analytics", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "ga4", "analytics" }, Obs = "" },
                    new() { Id = "e8b38885-9004-42e0-8e44-12a506022691", Categoria = "Experiencia", Termo = "Campanhas de performance", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "midia paga", "ads" }, Obs = "Meta/Google Ads" },
                    new() { Id = "670a9de7-c7f6-4c82-8f59-41a5e6f1919b", Categoria = "Competencia", Termo = "Excel", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "planilhas" }, Obs = "" }
                }
            },
            new()
            {
                Id = VagaQualidadeId,
                Codigo = "QLD-PL-003",
                Titulo = "Supervisor de Qualidade",
                Area = "Qualidade",
                Modalidade = "Presencial",
                Status = "pausada",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Gestao",
                Threshold = 75,
                Descricao = "Gestao da qualidade, auditorias e controle de processos.",
                CreatedAt = Iso(now.AddDays(-12)),
                UpdatedAt = Iso(now.AddDays(-2)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 40, Formacao = 20, Localidade = 5 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "85a41917-fcb4-4f6b-b656-f5baceaa00e8", Categoria = "Certificacao", Termo = "BPF", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "boas praticas de fabricacao" }, Obs = "" },
                    new() { Id = "fdfbfae3-8002-4b29-abe2-94a7e9f9c27f", Categoria = "Experiencia", Termo = "Auditoria interna", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "auditorias" }, Obs = "" },
                    new() { Id = "73e48a43-c3ef-4452-a353-8210948f46ec", Categoria = "Formacao", Termo = "Engenharia de Alimentos", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "alimentos" }, Obs = "" }
                }
            },
            new()
            {
                Id = VagaBiId,
                Codigo = "TI-PL-010",
                Titulo = "Analista de Dados (BI)",
                Area = "TI",
                Modalidade = "Remoto",
                Status = "aberta",
                Cidade = "",
                Uf = "",
                Senioridade = "Pleno",
                Threshold = 80,
                Descricao = "Modelagem e criacao de dashboards. Integracoes e rotinas de dados.",
                CreatedAt = Iso(now.AddDays(-2)),
                UpdatedAt = Iso(now.AddDays(-1)),
                Weights = new PesoSeed { Competencia = 45, Experiencia = 35, Formacao = 10, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "8127c7f8-1a18-48ba-941d-5618dbaa421d", Categoria = "Ferramenta/Tecnologia", Termo = "SQL", Peso = 10, Obrigatorio = true, Sinonimos = new []{ "postgres", "t-sql" }, Obs = "" },
                    new() { Id = "eb7e6573-3e6e-4d8b-b80a-37da574f84a2", Categoria = "Ferramenta/Tecnologia", Termo = "ETL", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "pipelines" }, Obs = "" },
                    new() { Id = "de7ca2d9-e6d4-4a46-b03e-6a8e4ffac2c3", Categoria = "Competencia", Termo = "Modelagem dimensional", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "star schema" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-prd-001",
                Codigo = "PRD-OP-001",
                Titulo = "Tecnico de Producao",
                Area = "Producao",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Junior",
                Threshold = 70,
                Descricao = "Operar linha de producao, cumprir boas praticas e metas.",
                CreatedAt = Iso(now.AddDays(-10)),
                UpdatedAt = Iso(now.AddDays(-1)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 35, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-prd-001-1", Categoria = "Experiencia", Termo = "Linha de producao", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "chao de fabrica" }, Obs = "" },
                    new() { Id = "req-prd-001-2", Categoria = "Certificacao", Termo = "BPF", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "boas praticas de fabricacao" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-prd-002",
                Codigo = "PRD-SP-002",
                Titulo = "Supervisor de Producao",
                Area = "Producao",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Itapecerica da Serra",
                Uf = "SP",
                Senioridade = "Gestao",
                Threshold = 75,
                Descricao = "Liderar equipes, acompanhar indicadores e cumprir metas diarias.",
                CreatedAt = Iso(now.AddDays(-14)),
                UpdatedAt = Iso(now.AddDays(-3)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 40, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-prd-002-1", Categoria = "Gestao", Termo = "Gestao de equipe", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "lideranca" }, Obs = "" },
                    new() { Id = "req-prd-002-2", Categoria = "Competencia", Termo = "Indicadores de producao", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "kpis" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-qld-004",
                Codigo = "QLD-PL-004",
                Titulo = "Analista de Qualidade Pleno",
                Area = "Qualidade",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 78,
                Descricao = "Inspecoes, controles e auditorias de processo.",
                CreatedAt = Iso(now.AddDays(-7)),
                UpdatedAt = Iso(now.AddDays(-2)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 35, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-qld-004-1", Categoria = "Experiencia", Termo = "Controle de qualidade", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "inspecao" }, Obs = "" },
                    new() { Id = "req-qld-004-2", Categoria = "Certificacao", Termo = "HACCP", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "haccp" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-qld-005",
                Codigo = "QLD-CD-005",
                Titulo = "Coordenador de Qualidade",
                Area = "Qualidade",
                Modalidade = "Hibrido",
                Status = "pausada",
                Cidade = "Osasco",
                Uf = "SP",
                Senioridade = "Gestao",
                Threshold = 80,
                Descricao = "Coordenar rotinas de auditoria e planos de acao.",
                CreatedAt = Iso(now.AddDays(-20)),
                UpdatedAt = Iso(now.AddDays(-6)),
                Weights = new PesoSeed { Competencia = 30, Experiencia = 45, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-qld-005-1", Categoria = "Experiencia", Termo = "Auditoria interna", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "auditorias" }, Obs = "" },
                    new() { Id = "req-qld-005-2", Categoria = "Certificacao", Termo = "ISO 22000", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "iso 22000" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-lab-006",
                Codigo = "LAB-JR-006",
                Titulo = "Tecnico de Laboratorio",
                Area = "Pesquisa e Desenvolvimento",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Junior",
                Threshold = 70,
                Descricao = "Realizar analises fisico-quimicas e apoiar testes.",
                CreatedAt = Iso(now.AddDays(-9)),
                UpdatedAt = Iso(now.AddDays(-2)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 30, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-lab-006-1", Categoria = "Experiencia", Termo = "Analises fisico-quimicas", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "laboratorio" }, Obs = "" },
                    new() { Id = "req-lab-006-2", Categoria = "Competencia", Termo = "Boas praticas laboratoriais", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "bpl" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-pd-007",
                Codigo = "PD-SR-007",
                Titulo = "Engenheiro de Alimentos",
                Area = "Pesquisa e Desenvolvimento",
                Modalidade = "Hibrido",
                Status = "aberta",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Senior",
                Threshold = 82,
                Descricao = "Desenvolvimento de novos produtos e melhorias de processo.",
                CreatedAt = Iso(now.AddDays(-16)),
                UpdatedAt = Iso(now.AddDays(-4)),
                Weights = new PesoSeed { Competencia = 30, Experiencia = 45, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-pd-007-1", Categoria = "Experiencia", Termo = "Desenvolvimento de produto", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "p&d" }, Obs = "" },
                    new() { Id = "req-pd-007-2", Categoria = "Experiencia", Termo = "Processos termicos", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "pasteurizacao" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-pcp-008",
                Codigo = "PCP-PL-008",
                Titulo = "Analista de PCP",
                Area = "Operacoes",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Cotia",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 76,
                Descricao = "Planejar capacidade, sequenciamento e atendimento de demanda.",
                CreatedAt = Iso(now.AddDays(-11)),
                UpdatedAt = Iso(now.AddDays(-2)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 35, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-pcp-008-1", Categoria = "Experiencia", Termo = "Planejamento de producao", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "pcp" }, Obs = "" },
                    new() { Id = "req-pcp-008-2", Categoria = "Ferramenta/Tecnologia", Termo = "MRP", Peso = 7, Obrigatorio = false, Sinonimos = new []{ "erp" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-cmp-009",
                Codigo = "CMP-PL-009",
                Titulo = "Comprador de Materias-Primas",
                Area = "Compras",
                Modalidade = "Hibrido",
                Status = "aberta",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 74,
                Descricao = "Negociar insumos e garantir fornecimento estrategico.",
                CreatedAt = Iso(now.AddDays(-18)),
                UpdatedAt = Iso(now.AddDays(-5)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 40, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-cmp-009-1", Categoria = "Competencia", Termo = "Negociacao", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "compras" }, Obs = "" },
                    new() { Id = "req-cmp-009-2", Categoria = "Experiencia", Termo = "Compras industriais", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "suprimentos" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-log-011",
                Codigo = "LOG-PL-011",
                Titulo = "Analista de Suprimentos",
                Area = "Logistica",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Taboao da Serra",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 72,
                Descricao = "Controle de estoque, lead time e abastecimento.",
                CreatedAt = Iso(now.AddDays(-13)),
                UpdatedAt = Iso(now.AddDays(-3)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 30, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-log-011-1", Categoria = "Experiencia", Termo = "Gestao de estoque", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "inventario" }, Obs = "" },
                    new() { Id = "req-log-011-2", Categoria = "Competencia", Termo = "Lead time", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "prazo" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-log-012",
                Codigo = "LOG-SP-012",
                Titulo = "Supervisor de Logistica",
                Area = "Logistica",
                Modalidade = "Presencial",
                Status = "pausada",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Gestao",
                Threshold = 78,
                Descricao = "Supervisionar expedicao, roteiros e indicadores.",
                CreatedAt = Iso(now.AddDays(-21)),
                UpdatedAt = Iso(now.AddDays(-8)),
                Weights = new PesoSeed { Competencia = 30, Experiencia = 45, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-log-012-1", Categoria = "Experiencia", Termo = "Roteirizacao", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "roteiro" }, Obs = "" },
                    new() { Id = "req-log-012-2", Categoria = "Competencia", Termo = "Indicadores logistica", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "kpis" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-mnt-013",
                Codigo = "MNT-JR-013",
                Titulo = "Tecnico de Manutencao",
                Area = "Manutencao",
                Modalidade = "Presencial",
                Status = "aberta",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Junior",
                Threshold = 70,
                Descricao = "Manutencao preventiva e corretiva em linha.",
                CreatedAt = Iso(now.AddDays(-9)),
                UpdatedAt = Iso(now.AddDays(-1)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 35, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-mnt-013-1", Categoria = "Experiencia", Termo = "Manutencao preventiva", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "preventiva" }, Obs = "" },
                    new() { Id = "req-mnt-013-2", Categoria = "Ferramenta/Tecnologia", Termo = "CLP", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "automacao" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-mnt-014",
                Codigo = "MNT-EL-014",
                Titulo = "Eletricista Industrial",
                Area = "Manutencao",
                Modalidade = "Presencial",
                Status = "fechada",
                Cidade = "Osasco",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 75,
                Descricao = "Manutencao eletrica de maquinas e paines.",
                CreatedAt = Iso(now.AddDays(-28)),
                UpdatedAt = Iso(now.AddDays(-12)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 40, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-mnt-014-1", Categoria = "Experiencia", Termo = "Eletrica industrial", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "painel" }, Obs = "" },
                    new() { Id = "req-mnt-014-2", Categoria = "Certificacao", Termo = "NR10", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "nr-10" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-fin-015",
                Codigo = "FIN-PL-015",
                Titulo = "Analista Financeiro",
                Area = "Financeiro",
                Modalidade = "Hibrido",
                Status = "fechada",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 70,
                Descricao = "Fluxo de caixa, relatorios e conciliacoes.",
                CreatedAt = Iso(now.AddDays(-25)),
                UpdatedAt = Iso(now.AddDays(-10)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 30, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-fin-015-1", Categoria = "Experiencia", Termo = "Fluxo de caixa", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "cash flow" }, Obs = "" },
                    new() { Id = "req-fin-015-2", Categoria = "Competencia", Termo = "Conciliacao", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "conciliar" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-rh-016",
                Codigo = "RH-PL-016",
                Titulo = "Analista de RH",
                Area = "RH",
                Modalidade = "Hibrido",
                Status = "aberta",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 72,
                Descricao = "Recrutamento, indicadores e suporte a gestores.",
                CreatedAt = Iso(now.AddDays(-6)),
                UpdatedAt = Iso(now.AddDays(-1)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 30, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-rh-016-1", Categoria = "Experiencia", Termo = "Recrutamento e selecao", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "r&s" }, Obs = "" },
                    new() { Id = "req-rh-016-2", Categoria = "Competencia", Termo = "Indicadores de RH", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "kpis" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-ti-017",
                Codigo = "TI-SR-017",
                Titulo = "Analista de TI",
                Area = "TI",
                Modalidade = "Hibrido",
                Status = "pausada",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Senior",
                Threshold = 78,
                Descricao = "Suporte a usuarios, infraestrutura e melhorias.",
                CreatedAt = Iso(now.AddDays(-17)),
                UpdatedAt = Iso(now.AddDays(-7)),
                Weights = new PesoSeed { Competencia = 35, Experiencia = 40, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-ti-017-1", Categoria = "Experiencia", Termo = "Suporte a usuarios", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "help desk" }, Obs = "" },
                    new() { Id = "req-ti-017-2", Categoria = "Competencia", Termo = "Infraestrutura", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "redes" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-com-018",
                Codigo = "COM-PL-018",
                Titulo = "Representante Comercial",
                Area = "Comercial",
                Modalidade = "Remoto",
                Status = "fechada",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Senioridade = "Pleno",
                Threshold = 70,
                Descricao = "Prospeccao e relacionamento com clientes B2B.",
                CreatedAt = Iso(now.AddDays(-22)),
                UpdatedAt = Iso(now.AddDays(-9)),
                Weights = new PesoSeed { Competencia = 45, Experiencia = 30, Formacao = 15, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-com-018-1", Categoria = "Experiencia", Termo = "Vendas B2B", Peso = 8, Obrigatorio = true, Sinonimos = new []{ "comercial" }, Obs = "" },
                    new() { Id = "req-com-018-2", Categoria = "Competencia", Termo = "Carteira de clientes", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "relacionamento" }, Obs = "" }
                }
            },
            new()
            {
                Id = "vaga-qld-019",
                Codigo = "QLD-JR-019",
                Titulo = "Assistente de Controle de Qualidade",
                Area = "Qualidade",
                Modalidade = "Presencial",
                Status = "fechada",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Senioridade = "Junior",
                Threshold = 68,
                Descricao = "Apoiar inspecoes e registros de processo.",
                CreatedAt = Iso(now.AddDays(-19)),
                UpdatedAt = Iso(now.AddDays(-11)),
                Weights = new PesoSeed { Competencia = 40, Experiencia = 30, Formacao = 20, Localidade = 10 },
                Requisitos = new List<RequisitoSeed>
                {
                    new() { Id = "req-qld-019-1", Categoria = "Experiencia", Termo = "Inspecao de linha", Peso = 7, Obrigatorio = true, Sinonimos = new []{ "inspecao" }, Obs = "" },
                    new() { Id = "req-qld-019-2", Categoria = "Competencia", Termo = "Registro de nao conformidade", Peso = 6, Obrigatorio = false, Sinonimos = new []{ "nao conformidade" }, Obs = "" }
                }
            }
        };

        var departamentos = new List<DepartamentoSeed>
        {
            new()
            {
                Id = "dept-001",
                Codigo = "DEP-PRD",
                Nome = "Producao",
                Area = "Producao",
                Gestor = "Marcos Silva",
                Email = "producao@@liotecnica.com.br",
                Telefone = "(11) 90000-1001",
                CentroCusto = "CC-1001",
                Local = "Embu das Artes - SP",
                Headcount = 120,
                Status = "ativo",
                Descricao = "Operacao de linhas, turnos e metas diarias.",
                CreatedAt = Iso(now.AddDays(-120)),
                UpdatedAt = Iso(now.AddDays(-10))
            },
            new()
            {
                Id = "dept-002",
                Codigo = "DEP-QLD",
                Nome = "Qualidade",
                Area = "Qualidade",
                Gestor = "Patricia Menezes",
                Email = "qualidade@@liotecnica.com.br",
                Telefone = "(11) 90000-1002",
                CentroCusto = "CC-1002",
                Local = "Embu das Artes - SP",
                Headcount = 38,
                Status = "ativo",
                Descricao = "Controles, auditorias e sistema de qualidade.",
                CreatedAt = Iso(now.AddDays(-140)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "dept-003",
                Codigo = "DEP-PD",
                Nome = "Pesquisa e Desenvolvimento",
                Area = "Pesquisa e Desenvolvimento",
                Gestor = "Luciana Prado",
                Email = "pesquisa@@liotecnica.com.br",
                Telefone = "(11) 90000-1003",
                CentroCusto = "CC-1003",
                Local = "Sao Paulo - SP",
                Headcount = 22,
                Status = "ativo",
                Descricao = "Novos produtos, testes e melhorias de processo.",
                CreatedAt = Iso(now.AddDays(-110)),
                UpdatedAt = Iso(now.AddDays(-9))
            },
            new()
            {
                Id = "dept-004",
                Codigo = "DEP-OPE",
                Nome = "Operacoes",
                Area = "Operacoes",
                Gestor = "Renato Dias",
                Email = "operacoes@@liotecnica.com.br",
                Telefone = "(11) 90000-1004",
                CentroCusto = "CC-1004",
                Local = "Embu das Artes - SP",
                Headcount = 64,
                Status = "ativo",
                Descricao = "PCP, melhoria continua e suporte a producao.",
                CreatedAt = Iso(now.AddDays(-98)),
                UpdatedAt = Iso(now.AddDays(-14))
            },
            new()
            {
                Id = "dept-005",
                Codigo = "DEP-CMP",
                Nome = "Compras",
                Area = "Compras",
                Gestor = "Bianca Souza",
                Email = "compras@@liotecnica.com.br",
                Telefone = "(11) 90000-1005",
                CentroCusto = "CC-1005",
                Local = "Sao Paulo - SP",
                Headcount = 18,
                Status = "ativo",
                Descricao = "Negociacoes e abastecimento de insumos.",
                CreatedAt = Iso(now.AddDays(-90)),
                UpdatedAt = Iso(now.AddDays(-8))
            },
            new()
            {
                Id = "dept-006",
                Codigo = "DEP-LOG",
                Nome = "Logistica",
                Area = "Logistica",
                Gestor = "Carlos Nunes",
                Email = "logistica@@liotecnica.com.br",
                Telefone = "(11) 90000-1006",
                CentroCusto = "CC-1006",
                Local = "Taboao da Serra - SP",
                Headcount = 52,
                Status = "ativo",
                Descricao = "Estoque, expedicao e roteirizacao.",
                CreatedAt = Iso(now.AddDays(-102)),
                UpdatedAt = Iso(now.AddDays(-6))
            },
            new()
            {
                Id = "dept-007",
                Codigo = "DEP-MNT",
                Nome = "Manutencao",
                Area = "Manutencao",
                Gestor = "Andre Lima",
                Email = "manutencao@@liotecnica.com.br",
                Telefone = "(11) 90000-1007",
                CentroCusto = "CC-1007",
                Local = "Embu das Artes - SP",
                Headcount = 28,
                Status = "ativo",
                Descricao = "Manutencao preventiva e corretiva.",
                CreatedAt = Iso(now.AddDays(-105)),
                UpdatedAt = Iso(now.AddDays(-11))
            },
            new()
            {
                Id = "dept-008",
                Codigo = "DEP-FIN",
                Nome = "Financeiro",
                Area = "Financeiro",
                Gestor = "Fernanda Moreira",
                Email = "financeiro@@liotecnica.com.br",
                Telefone = "(11) 90000-1008",
                CentroCusto = "CC-1008",
                Local = "Sao Paulo - SP",
                Headcount = 16,
                Status = "ativo",
                Descricao = "Fluxo de caixa, contas e relatorios.",
                CreatedAt = Iso(now.AddDays(-130)),
                UpdatedAt = Iso(now.AddDays(-20))
            },
            new()
            {
                Id = "dept-009",
                Codigo = "DEP-RH",
                Nome = "RH",
                Area = "RH",
                Gestor = "Juliana Costa",
                Email = "rh@@liotecnica.com.br",
                Telefone = "(11) 90000-1009",
                CentroCusto = "CC-1009",
                Local = "Sao Paulo - SP",
                Headcount = 12,
                Status = "ativo",
                Descricao = "Recrutamento, treinamento e clima.",
                CreatedAt = Iso(now.AddDays(-150)),
                UpdatedAt = Iso(now.AddDays(-4))
            },
            new()
            {
                Id = "dept-010",
                Codigo = "DEP-COM",
                Nome = "Comercial",
                Area = "Comercial",
                Gestor = "Rodrigo Alves",
                Email = "comercial@@liotecnica.com.br",
                Telefone = "(11) 90000-1010",
                CentroCusto = "CC-1010",
                Local = "Sao Paulo - SP",
                Headcount = 26,
                Status = "ativo",
                Descricao = "Prospeccao, carteira e relacionamento.",
                CreatedAt = Iso(now.AddDays(-135)),
                UpdatedAt = Iso(now.AddDays(-15))
            },
            new()
            {
                Id = "dept-011",
                Codigo = "DEP-MKT",
                Nome = "Marketing",
                Area = "Marketing",
                Gestor = "Camila Rocha",
                Email = "marketing@@liotecnica.com.br",
                Telefone = "(11) 90000-1011",
                CentroCusto = "CC-1011",
                Local = "Sao Paulo - SP",
                Headcount = 14,
                Status = "ativo",
                Descricao = "Marca, campanhas e comunicacao.",
                CreatedAt = Iso(now.AddDays(-125)),
                UpdatedAt = Iso(now.AddDays(-7))
            },
            new()
            {
                Id = "dept-012",
                Codigo = "DEP-TI",
                Nome = "TI",
                Area = "TI",
                Gestor = "Eduardo Reis",
                Email = "ti@@liotecnica.com.br",
                Telefone = "(11) 90000-1012",
                CentroCusto = "CC-1012",
                Local = "Sao Paulo - SP",
                Headcount = 19,
                Status = "ativo",
                Descricao = "Infra, suporte e projetos digitais.",
                CreatedAt = Iso(now.AddDays(-115)),
                UpdatedAt = Iso(now.AddDays(-5))
            },
            new()
            {
                Id = "dept-013",
                Codigo = "DEP-SST",
                Nome = "Seguranca do Trabalho",
                Area = "Seguranca do Trabalho",
                Gestor = "Tatiana Gomes",
                Email = "seguranca@@liotecnica.com.br",
                Telefone = "(11) 90000-1013",
                CentroCusto = "CC-1013",
                Local = "Embu das Artes - SP",
                Headcount = 9,
                Status = "ativo",
                Descricao = "Treinamentos, NR e prevencao.",
                CreatedAt = Iso(now.AddDays(-95)),
                UpdatedAt = Iso(now.AddDays(-22))
            },
            new()
            {
                Id = "dept-014",
                Codigo = "DEP-ENG",
                Nome = "Engenharia de Processos",
                Area = "Engenharia de Processos",
                Gestor = "Diego Carvalho",
                Email = "engenharia@@liotecnica.com.br",
                Telefone = "(11) 90000-1014",
                CentroCusto = "CC-1014",
                Local = "Embu das Artes - SP",
                Headcount = 11,
                Status = "ativo",
                Descricao = "Melhorias, layout e eficiencia.",
                CreatedAt = Iso(now.AddDays(-108)),
                UpdatedAt = Iso(now.AddDays(-18))
            },
            new()
            {
                Id = "dept-015",
                Codigo = "DEP-PCI",
                Nome = "Planejamento Industrial",
                Area = "Planejamento Industrial",
                Gestor = "Bruno Martins",
                Email = "planejamento@@liotecnica.com.br",
                Telefone = "(11) 90000-1015",
                CentroCusto = "CC-1015",
                Local = "Cotia - SP",
                Headcount = 10,
                Status = "inativo",
                Descricao = "Revisao de capacidade e sequenciamento.",
                CreatedAt = Iso(now.AddDays(-160)),
                UpdatedAt = Iso(now.AddDays(-60))
            },
            new()
            {
                Id = "dept-016",
                Codigo = "DEP-SUP",
                Nome = "Supply Chain",
                Area = "Supply Chain",
                Gestor = "Carla Mendes",
                Email = "supplychain@@liotecnica.com.br",
                Telefone = "(11) 90000-1016",
                CentroCusto = "CC-1016",
                Local = "Sao Paulo - SP",
                Headcount = 17,
                Status = "ativo",
                Descricao = "Integracao compras, estoque e distribuicao.",
                CreatedAt = Iso(now.AddDays(-145)),
                UpdatedAt = Iso(now.AddDays(-19))
            },
            new()
            {
                Id = "dept-017",
                Codigo = "DEP-GQ",
                Nome = "Garantia da Qualidade",
                Area = "Garantia da Qualidade",
                Gestor = "Silvia Araujo",
                Email = "garantia@@liotecnica.com.br",
                Telefone = "(11) 90000-1017",
                CentroCusto = "CC-1017",
                Local = "Embu das Artes - SP",
                Headcount = 8,
                Status = "ativo",
                Descricao = "Sistema de qualidade e conformidade.",
                CreatedAt = Iso(now.AddDays(-132)),
                UpdatedAt = Iso(now.AddDays(-17))
            },
            new()
            {
                Id = "dept-018",
                Codigo = "DEP-FAC",
                Nome = "Facilities",
                Area = "Facilities",
                Gestor = "Roberto Dias",
                Email = "facilities@@liotecnica.com.br",
                Telefone = "(11) 90000-1018",
                CentroCusto = "CC-1018",
                Local = "Embu das Artes - SP",
                Headcount = 6,
                Status = "inativo",
                Descricao = "Servicos gerais e manutencao predial.",
                CreatedAt = Iso(now.AddDays(-170)),
                UpdatedAt = Iso(now.AddDays(-80))
            },
            new()
            {
                Id = "dept-019",
                Codigo = "DEP-CAC",
                Nome = "Atendimento ao Cliente",
                Area = "Atendimento ao Cliente",
                Gestor = "Mariana Lopes",
                Email = "atendimento@@liotecnica.com.br",
                Telefone = "(11) 90000-1019",
                CentroCusto = "CC-1019",
                Local = "Sao Paulo - SP",
                Headcount = 15,
                Status = "inativo",
                Descricao = "Suporte e relacionamento com clientes.",
                CreatedAt = Iso(now.AddDays(-155)),
                UpdatedAt = Iso(now.AddDays(-70))
            },
            new()
            {
                Id = "dept-020",
                Codigo = "DEP-SUS",
                Nome = "Sustentabilidade",
                Area = "Sustentabilidade",
                Gestor = "Paulo Henrique",
                Email = "sustentabilidade@@liotecnica.com.br",
                Telefone = "(11) 90000-1020",
                CentroCusto = "CC-1020",
                Local = "Sao Paulo - SP",
                Headcount = 5,
                Status = "inativo",
                Descricao = "ESG, residuos e eficiencia energetica.",
                CreatedAt = Iso(now.AddDays(-175)),
                UpdatedAt = Iso(now.AddDays(-90))
            }
        };

        var gestores = new List<GestorSeed>
        {
            new()
            {
                Id = "gst-001",
                Nome = "Marcos Silva",
                Cargo = "Gerente de Producao",
                Area = "Producao",
                Email = "marcos.silva@@liotecnica.com.br",
                Telefone = "(11) 91111-1001",
                Unidade = "Embu das Artes - SP",
                Headcount = 120,
                Status = "ativo",
                Observacao = "Gestao de turnos e metas diarias.",
                CreatedAt = Iso(now.AddDays(-200)),
                UpdatedAt = Iso(now.AddDays(-10))
            },
            new()
            {
                Id = "gst-002",
                Nome = "Patricia Menezes",
                Cargo = "Gerente de Qualidade",
                Area = "Qualidade",
                Email = "patricia.menezes@@liotecnica.com.br",
                Telefone = "(11) 91111-1002",
                Unidade = "Embu das Artes - SP",
                Headcount = 38,
                Status = "ativo",
                Observacao = "Auditorias, certificacoes e sistema de qualidade.",
                CreatedAt = Iso(now.AddDays(-180)),
                UpdatedAt = Iso(now.AddDays(-8))
            },
            new()
            {
                Id = "gst-003",
                Nome = "Luciana Prado",
                Cargo = "Head de P&D",
                Area = "Pesquisa e Desenvolvimento",
                Email = "luciana.prado@@liotecnica.com.br",
                Telefone = "(11) 91111-1003",
                Unidade = "Sao Paulo - SP",
                Headcount = 22,
                Status = "ativo",
                Observacao = "Novos produtos e inovacao.",
                CreatedAt = Iso(now.AddDays(-170)),
                UpdatedAt = Iso(now.AddDays(-11))
            },
            new()
            {
                Id = "gst-004",
                Nome = "Renato Dias",
                Cargo = "Coordenador de Operacoes",
                Area = "Operacoes",
                Email = "renato.dias@@liotecnica.com.br",
                Telefone = "(11) 91111-1004",
                Unidade = "Embu das Artes - SP",
                Headcount = 64,
                Status = "ativo",
                Observacao = "PCP e melhoria continua.",
                CreatedAt = Iso(now.AddDays(-160)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "gst-005",
                Nome = "Bianca Souza",
                Cargo = "Gerente de Compras",
                Area = "Compras",
                Email = "bianca.souza@@liotecnica.com.br",
                Telefone = "(11) 91111-1005",
                Unidade = "Sao Paulo - SP",
                Headcount = 18,
                Status = "ativo",
                Observacao = "Insumos estrategicos e contratos.",
                CreatedAt = Iso(now.AddDays(-155)),
                UpdatedAt = Iso(now.AddDays(-7))
            },
            new()
            {
                Id = "gst-006",
                Nome = "Carlos Nunes",
                Cargo = "Supervisor de Logistica",
                Area = "Logistica",
                Email = "carlos.nunes@@liotecnica.com.br",
                Telefone = "(11) 91111-1006",
                Unidade = "Taboao da Serra - SP",
                Headcount = 52,
                Status = "ativo",
                Observacao = "Estoque e expedicao.",
                CreatedAt = Iso(now.AddDays(-150)),
                UpdatedAt = Iso(now.AddDays(-6))
            },
            new()
            {
                Id = "gst-007",
                Nome = "Andre Lima",
                Cargo = "Supervisor de Manutencao",
                Area = "Manutencao",
                Email = "andre.lima@@liotecnica.com.br",
                Telefone = "(11) 91111-1007",
                Unidade = "Embu das Artes - SP",
                Headcount = 28,
                Status = "ativo",
                Observacao = "Preventiva e corretiva.",
                CreatedAt = Iso(now.AddDays(-148)),
                UpdatedAt = Iso(now.AddDays(-9))
            },
            new()
            {
                Id = "gst-008",
                Nome = "Fernanda Moreira",
                Cargo = "Gerente Financeira",
                Area = "Financeiro",
                Email = "fernanda.moreira@@liotecnica.com.br",
                Telefone = "(11) 91111-1008",
                Unidade = "Sao Paulo - SP",
                Headcount = 16,
                Status = "ativo",
                Observacao = "Fluxo de caixa e controles.",
                CreatedAt = Iso(now.AddDays(-165)),
                UpdatedAt = Iso(now.AddDays(-14))
            },
            new()
            {
                Id = "gst-009",
                Nome = "Juliana Costa",
                Cargo = "Coordenadora de RH",
                Area = "RH",
                Email = "juliana.costa@@liotecnica.com.br",
                Telefone = "(11) 91111-1009",
                Unidade = "Sao Paulo - SP",
                Headcount = 12,
                Status = "ativo",
                Observacao = "Recrutamento e desenvolvimento.",
                CreatedAt = Iso(now.AddDays(-140)),
                UpdatedAt = Iso(now.AddDays(-5))
            },
            new()
            {
                Id = "gst-010",
                Nome = "Rodrigo Alves",
                Cargo = "Gerente Comercial",
                Area = "Comercial",
                Email = "rodrigo.alves@@liotecnica.com.br",
                Telefone = "(11) 91111-1010",
                Unidade = "Sao Paulo - SP",
                Headcount = 26,
                Status = "ativo",
                Observacao = "Contas chave e metas comerciais.",
                CreatedAt = Iso(now.AddDays(-142)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "gst-011",
                Nome = "Camila Rocha",
                Cargo = "Gerente de Marketing",
                Area = "Marketing",
                Email = "camila.rocha@@liotecnica.com.br",
                Telefone = "(11) 91111-1011",
                Unidade = "Sao Paulo - SP",
                Headcount = 14,
                Status = "ativo",
                Observacao = "Campanhas e comunicacao institucional.",
                CreatedAt = Iso(now.AddDays(-138)),
                UpdatedAt = Iso(now.AddDays(-9))
            },
            new()
            {
                Id = "gst-012",
                Nome = "Eduardo Reis",
                Cargo = "Coordenador de TI",
                Area = "TI",
                Email = "eduardo.reis@@liotecnica.com.br",
                Telefone = "(11) 91111-1012",
                Unidade = "Sao Paulo - SP",
                Headcount = 19,
                Status = "ativo",
                Observacao = "Infraestrutura e suporte.",
                CreatedAt = Iso(now.AddDays(-145)),
                UpdatedAt = Iso(now.AddDays(-6))
            },
            new()
            {
                Id = "gst-013",
                Nome = "Tatiana Gomes",
                Cargo = "Coordenadora de SST",
                Area = "Seguranca do Trabalho",
                Email = "tatiana.gomes@@liotecnica.com.br",
                Telefone = "(11) 91111-1013",
                Unidade = "Embu das Artes - SP",
                Headcount = 9,
                Status = "ativo",
                Observacao = "Treinamentos e conformidade NR.",
                CreatedAt = Iso(now.AddDays(-150)),
                UpdatedAt = Iso(now.AddDays(-18))
            },
            new()
            {
                Id = "gst-014",
                Nome = "Diego Carvalho",
                Cargo = "Gerente de Engenharia",
                Area = "Engenharia de Processos",
                Email = "diego.carvalho@@liotecnica.com.br",
                Telefone = "(11) 91111-1014",
                Unidade = "Embu das Artes - SP",
                Headcount = 11,
                Status = "ativo",
                Observacao = "Melhoria continua e layout.",
                CreatedAt = Iso(now.AddDays(-152)),
                UpdatedAt = Iso(now.AddDays(-15))
            },
            new()
            {
                Id = "gst-015",
                Nome = "Bruno Martins",
                Cargo = "Coordenador de Planejamento",
                Area = "Planejamento Industrial",
                Email = "bruno.martins@@liotecnica.com.br",
                Telefone = "(11) 91111-1015",
                Unidade = "Cotia - SP",
                Headcount = 10,
                Status = "inativo",
                Observacao = "Sequenciamento e capacidade.",
                CreatedAt = Iso(now.AddDays(-160)),
                UpdatedAt = Iso(now.AddDays(-60))
            },
            new()
            {
                Id = "gst-016",
                Nome = "Carla Mendes",
                Cargo = "Gerente de Supply Chain",
                Area = "Supply Chain",
                Email = "carla.mendes@@liotecnica.com.br",
                Telefone = "(11) 91111-1016",
                Unidade = "Sao Paulo - SP",
                Headcount = 17,
                Status = "ativo",
                Observacao = "Compras, estoque e distribuicao.",
                CreatedAt = Iso(now.AddDays(-149)),
                UpdatedAt = Iso(now.AddDays(-19))
            },
            new()
            {
                Id = "gst-017",
                Nome = "Silvia Araujo",
                Cargo = "Gerente de Garantia",
                Area = "Garantia da Qualidade",
                Email = "silvia.araujo@@liotecnica.com.br",
                Telefone = "(11) 91111-1017",
                Unidade = "Embu das Artes - SP",
                Headcount = 8,
                Status = "ativo",
                Observacao = "Sistema de qualidade.",
                CreatedAt = Iso(now.AddDays(-155)),
                UpdatedAt = Iso(now.AddDays(-17))
            },
            new()
            {
                Id = "gst-018",
                Nome = "Roberto Dias",
                Cargo = "Supervisor de Facilities",
                Area = "Facilities",
                Email = "roberto.dias@@liotecnica.com.br",
                Telefone = "(11) 91111-1018",
                Unidade = "Embu das Artes - SP",
                Headcount = 6,
                Status = "inativo",
                Observacao = "Servicos gerais e manutencao predial.",
                CreatedAt = Iso(now.AddDays(-170)),
                UpdatedAt = Iso(now.AddDays(-80))
            },
            new()
            {
                Id = "gst-019",
                Nome = "Mariana Lopes",
                Cargo = "Coordenadora de Atendimento",
                Area = "Atendimento ao Cliente",
                Email = "mariana.lopes@@liotecnica.com.br",
                Telefone = "(11) 91111-1019",
                Unidade = "Sao Paulo - SP",
                Headcount = 15,
                Status = "inativo",
                Observacao = "SLA e relacionamento.",
                CreatedAt = Iso(now.AddDays(-165)),
                UpdatedAt = Iso(now.AddDays(-70))
            },
            new()
            {
                Id = "gst-020",
                Nome = "Paulo Henrique",
                Cargo = "Coordenador de Sustentabilidade",
                Area = "Sustentabilidade",
                Email = "paulo.henrique@@liotecnica.com.br",
                Telefone = "(11) 91111-1020",
                Unidade = "Sao Paulo - SP",
                Headcount = 5,
                Status = "inativo",
                Observacao = "ESG e eficiencia energetica.",
                CreatedAt = Iso(now.AddDays(-175)),
                UpdatedAt = Iso(now.AddDays(-90))
            }
        };

        var unidades = new List<UnidadeSeed>
        {
            new()
            {
                Id = "uni-001",
                Codigo = "UNI-EMB",
                Nome = "Embu das Artes - SP",
                Status = "ativo",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Endereco = "Rod. BR-116, Km 275",
                Bairro = "Jardim Vista Alegre",
                Cep = "06803-000",
                Telefone = "(11) 4001-1001",
                Email = "embu@@liotecnica.com.br",
                Responsavel = "Carla Tavares",
                Tipo = "Industria / Matriz",
                Headcount = 420,
                Observacao = "Linha principal de producao e P&D.",
                CreatedAt = Iso(now.AddDays(-520)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "uni-002",
                Codigo = "UNI-SPC",
                Nome = "Sao Paulo - SP",
                Status = "ativo",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Endereco = "Av. Paulista, 1200",
                Bairro = "Bela Vista",
                Cep = "01310-100",
                Telefone = "(11) 4001-1002",
                Email = "sp@@liotecnica.com.br",
                Responsavel = "Marcos Azevedo",
                Tipo = "Escritorio / Administrativo",
                Headcount = 180,
                Observacao = "RH, financeiro, comercial e diretoria.",
                CreatedAt = Iso(now.AddDays(-500)),
                UpdatedAt = Iso(now.AddDays(-20))
            },
            new()
            {
                Id = "uni-003",
                Codigo = "UNI-COT",
                Nome = "Cotia - SP",
                Status = "ativo",
                Cidade = "Cotia",
                Uf = "SP",
                Endereco = "Rua do Comercio, 210",
                Bairro = "Jardim da Gloria",
                Cep = "06704-050",
                Telefone = "(11) 4001-1003",
                Email = "cotia@@liotecnica.com.br",
                Responsavel = "Renata Nunes",
                Tipo = "Centro de Distribuicao",
                Headcount = 95,
                Observacao = "Operacoes logistica e expedicao.",
                CreatedAt = Iso(now.AddDays(-480)),
                UpdatedAt = Iso(now.AddDays(-18))
            },
            new()
            {
                Id = "uni-004",
                Codigo = "UNI-TAB",
                Nome = "Taboao da Serra - SP",
                Status = "ativo",
                Cidade = "Taboao da Serra",
                Uf = "SP",
                Endereco = "Av. Aprigio Bezerra, 4550",
                Bairro = "Parque Industrial",
                Cep = "06760-000",
                Telefone = "(11) 4001-1004",
                Email = "taboao@@liotecnica.com.br",
                Responsavel = "Diego Nogueira",
                Tipo = "Planta de Processamento",
                Headcount = 260,
                Observacao = "Foco em processados e embalagens.",
                CreatedAt = Iso(now.AddDays(-470)),
                UpdatedAt = Iso(now.AddDays(-15))
            },
            new()
            {
                Id = "uni-005",
                Codigo = "UNI-OSA",
                Nome = "Osasco - SP",
                Status = "ativo",
                Cidade = "Osasco",
                Uf = "SP",
                Endereco = "Rua Industrial, 88",
                Bairro = "Rochdale",
                Cep = "06223-000",
                Telefone = "(11) 4001-1005",
                Email = "osasco@@liotecnica.com.br",
                Responsavel = "Patricia Mendes",
                Tipo = "Qualidade e Laboratorio",
                Headcount = 120,
                Observacao = "Laboratorio de qualidade e auditorias.",
                CreatedAt = Iso(now.AddDays(-465)),
                UpdatedAt = Iso(now.AddDays(-14))
            },
            new()
            {
                Id = "uni-006",
                Codigo = "UNI-CAM",
                Nome = "Campinas - SP",
                Status = "ativo",
                Cidade = "Campinas",
                Uf = "SP",
                Endereco = "Av. Carlos Gomes, 900",
                Bairro = "Cambui",
                Cep = "13025-000",
                Telefone = "(19) 4001-1006",
                Email = "campinas@@liotecnica.com.br",
                Responsavel = "Ana Ribeiro",
                Tipo = "P&D Regional",
                Headcount = 75,
                Observacao = "Desenvolvimento de novos sabores.",
                CreatedAt = Iso(now.AddDays(-450)),
                UpdatedAt = Iso(now.AddDays(-22))
            },
            new()
            {
                Id = "uni-007",
                Codigo = "UNI-JDI",
                Nome = "Jundiai - SP",
                Status = "ativo",
                Cidade = "Jundiai",
                Uf = "SP",
                Endereco = "Rod. Anhanguera, Km 64",
                Bairro = "Distrito Industrial",
                Cep = "13214-000",
                Telefone = "(11) 4001-1007",
                Email = "jundiai@@liotecnica.com.br",
                Responsavel = "Lucas Freitas",
                Tipo = "Armazenagem Fria",
                Headcount = 60,
                Observacao = "Camera fria e expedição refrigerada.",
                CreatedAt = Iso(now.AddDays(-440)),
                UpdatedAt = Iso(now.AddDays(-30))
            },
            new()
            {
                Id = "uni-008",
                Codigo = "UNI-SOR",
                Nome = "Sorocaba - SP",
                Status = "ativo",
                Cidade = "Sorocaba",
                Uf = "SP",
                Endereco = "Av. Itavuvu, 5100",
                Bairro = "Industrial",
                Cep = "18078-000",
                Telefone = "(15) 4001-1008",
                Email = "sorocaba@@liotecnica.com.br",
                Responsavel = "Fernanda Lima",
                Tipo = "Planta Secos",
                Headcount = 140,
                Observacao = "Produtos secos e embalagens flexiveis.",
                CreatedAt = Iso(now.AddDays(-430)),
                UpdatedAt = Iso(now.AddDays(-28))
            },
            new()
            {
                Id = "uni-009",
                Codigo = "UNI-SNT",
                Nome = "Santos - SP",
                Status = "inativo",
                Cidade = "Santos",
                Uf = "SP",
                Endereco = "Rua do Porto, 220",
                Bairro = "Macuco",
                Cep = "11015-000",
                Telefone = "(13) 4001-1009",
                Email = "santos@@liotecnica.com.br",
                Responsavel = "Rafael Santos",
                Tipo = "Operacao Portuaria",
                Headcount = 40,
                Observacao = "Unidade desativada para reestruturacao.",
                CreatedAt = Iso(now.AddDays(-420)),
                UpdatedAt = Iso(now.AddDays(-120))
            },
            new()
            {
                Id = "uni-010",
                Codigo = "UNI-RBP",
                Nome = "Ribeirao Preto - SP",
                Status = "ativo",
                Cidade = "Ribeirao Preto",
                Uf = "SP",
                Endereco = "Av. Presidente Vargas, 3200",
                Bairro = "Jardim Sumare",
                Cep = "14025-700",
                Telefone = "(16) 4001-1010",
                Email = "ribeirao@@liotecnica.com.br",
                Responsavel = "Camila Rocha",
                Tipo = "Agro Supply",
                Headcount = 85,
                Observacao = "Suprimentos e relacao com fornecedores.",
                CreatedAt = Iso(now.AddDays(-410)),
                UpdatedAt = Iso(now.AddDays(-35))
            },
            new()
            {
                Id = "uni-011",
                Codigo = "UNI-BAU",
                Nome = "Bauru - SP",
                Status = "ativo",
                Cidade = "Bauru",
                Uf = "SP",
                Endereco = "Rua Luiz Boi, 90",
                Bairro = "Distrito Industrial",
                Cep = "17034-000",
                Telefone = "(14) 4001-1011",
                Email = "bauru@@liotecnica.com.br",
                Responsavel = "Tiago Almeida",
                Tipo = "Logistica Regional",
                Headcount = 55,
                Observacao = "Distribuicao interior paulista.",
                CreatedAt = Iso(now.AddDays(-405)),
                UpdatedAt = Iso(now.AddDays(-40))
            },
            new()
            {
                Id = "uni-012",
                Codigo = "UNI-PIR",
                Nome = "Piracicaba - SP",
                Status = "ativo",
                Cidade = "Piracicaba",
                Uf = "SP",
                Endereco = "Av. Independencia, 2500",
                Bairro = "Centro",
                Cep = "13400-000",
                Telefone = "(19) 4001-1012",
                Email = "piracicaba@@liotecnica.com.br",
                Responsavel = "Bruno Teixeira",
                Tipo = "Planta Bebidas",
                Headcount = 110,
                Observacao = "Linha de bebidas e envase.",
                CreatedAt = Iso(now.AddDays(-398)),
                UpdatedAt = Iso(now.AddDays(-42))
            }
        };

        var seniorGerencia = "gerente";
        var seniorCoordenacao = "coordenador";
        var seniorPleno = "pleno";

        var cargos = new List<CargoSeed>
        {
            new()
            {
                Id = "car-001",
                Codigo = "CAR-PRD-GER",
                Nome = "Gerente de Producao",
                Area = "Producao",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Responsavel por performance e turnos.",
                CreatedAt = Iso(now.AddDays(-300)),
                UpdatedAt = Iso(now.AddDays(-18))
            },
            new()
            {
                Id = "car-002",
                Codigo = "CAR-QLD-GER",
                Nome = "Gerente de Qualidade",
                Area = "Qualidade",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Auditorias, certificacoes e compliance.",
                CreatedAt = Iso(now.AddDays(-290)),
                UpdatedAt = Iso(now.AddDays(-16))
            },
            new()
            {
                Id = "car-003",
                Codigo = "CAR-PD-HEAD",
                Nome = "Head de P&D",
                Area = "Pesquisa e Desenvolvimento",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Inovacao e novos produtos.",
                CreatedAt = Iso(now.AddDays(-285)),
                UpdatedAt = Iso(now.AddDays(-22))
            },
            new()
            {
                Id = "car-004",
                Codigo = "CAR-OPE-COO",
                Nome = "Coordenador de Operacoes",
                Area = "Operacoes",
                Senioridade = seniorCoordenacao,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "PCP, indicadores e eficiencia.",
                CreatedAt = Iso(now.AddDays(-280)),
                UpdatedAt = Iso(now.AddDays(-15))
            },
            new()
            {
                Id = "car-005",
                Codigo = "CAR-CMP-GER",
                Nome = "Gerente de Compras",
                Area = "Compras",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Negociacao estrategica de insumos.",
                CreatedAt = Iso(now.AddDays(-275)),
                UpdatedAt = Iso(now.AddDays(-17))
            },
            new()
            {
                Id = "car-006",
                Codigo = "CAR-LOG-SUP",
                Nome = "Supervisor de Logistica",
                Area = "Logistica",
                Senioridade = seniorPleno,
                Tipo = "Operacional",
                Status = "ativo",
                Descricao = "Expedicao, transporte e roteiros.",
                CreatedAt = Iso(now.AddDays(-270)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "car-007",
                Codigo = "CAR-MNT-SUP",
                Nome = "Supervisor de Manutencao",
                Area = "Manutencao",
                Senioridade = seniorPleno,
                Tipo = "Operacional",
                Status = "ativo",
                Descricao = "Preventiva, corretiva e confiabilidade.",
                CreatedAt = Iso(now.AddDays(-268)),
                UpdatedAt = Iso(now.AddDays(-20))
            },
            new()
            {
                Id = "car-008",
                Codigo = "CAR-FIN-GER",
                Nome = "Gerente Financeira",
                Area = "Financeiro",
                Senioridade = seniorGerencia,
                Tipo = "Administrativo",
                Status = "ativo",
                Descricao = "Fluxo de caixa e controles.",
                CreatedAt = Iso(now.AddDays(-265)),
                UpdatedAt = Iso(now.AddDays(-14))
            },
            new()
            {
                Id = "car-009",
                Codigo = "CAR-RH-COO",
                Nome = "Coordenadora de RH",
                Area = "RH",
                Senioridade = seniorCoordenacao,
                Tipo = "Administrativo",
                Status = "ativo",
                Descricao = "Recrutamento, clima e treinamento.",
                CreatedAt = Iso(now.AddDays(-262)),
                UpdatedAt = Iso(now.AddDays(-19))
            },
            new()
            {
                Id = "car-010",
                Codigo = "CAR-COM-GER",
                Nome = "Gerente Comercial",
                Area = "Comercial",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Metas, pipeline e relacionamento.",
                CreatedAt = Iso(now.AddDays(-260)),
                UpdatedAt = Iso(now.AddDays(-13))
            },
            new()
            {
                Id = "car-011",
                Codigo = "CAR-MKT-GER",
                Nome = "Gerente de Marketing",
                Area = "Marketing",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Campanhas, marca e performance.",
                CreatedAt = Iso(now.AddDays(-258)),
                UpdatedAt = Iso(now.AddDays(-11))
            },
            new()
            {
                Id = "car-012",
                Codigo = "CAR-TI-COO",
                Nome = "Coordenador de TI",
                Area = "TI",
                Senioridade = seniorCoordenacao,
                Tipo = "Tecnologia",
                Status = "ativo",
                Descricao = "Infra e suporte critico.",
                CreatedAt = Iso(now.AddDays(-256)),
                UpdatedAt = Iso(now.AddDays(-9))
            },
            new()
            {
                Id = "car-013",
                Codigo = "CAR-SST-COO",
                Nome = "Coordenadora de SST",
                Area = "Seguranca do Trabalho",
                Senioridade = seniorCoordenacao,
                Tipo = "Compliance",
                Status = "ativo",
                Descricao = "Treinamentos, NR e auditorias.",
                CreatedAt = Iso(now.AddDays(-254)),
                UpdatedAt = Iso(now.AddDays(-18))
            },
            new()
            {
                Id = "car-014",
                Codigo = "CAR-ENG-GER",
                Nome = "Gerente de Engenharia",
                Area = "Engenharia de Processos",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Projetos e melhoria continua.",
                CreatedAt = Iso(now.AddDays(-252)),
                UpdatedAt = Iso(now.AddDays(-15))
            },
            new()
            {
                Id = "car-015",
                Codigo = "CAR-PCI-COO",
                Nome = "Coordenador de Planejamento",
                Area = "Planejamento Industrial",
                Senioridade = seniorCoordenacao,
                Tipo = "Operacional",
                Status = "inativo",
                Descricao = "Sequenciamento e capacidade.",
                CreatedAt = Iso(now.AddDays(-250)),
                UpdatedAt = Iso(now.AddDays(-60))
            },
            new()
            {
                Id = "car-016",
                Codigo = "CAR-SUP-GER",
                Nome = "Gerente de Supply Chain",
                Area = "Supply Chain",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Compras, estoque e distribuicao.",
                CreatedAt = Iso(now.AddDays(-248)),
                UpdatedAt = Iso(now.AddDays(-19))
            },
            new()
            {
                Id = "car-017",
                Codigo = "CAR-GQ-GER",
                Nome = "Gerente de Garantia",
                Area = "Garantia da Qualidade",
                Senioridade = seniorGerencia,
                Tipo = "Lideranca",
                Status = "ativo",
                Descricao = "Sistema de qualidade e auditorias.",
                CreatedAt = Iso(now.AddDays(-246)),
                UpdatedAt = Iso(now.AddDays(-17))
            },
            new()
            {
                Id = "car-018",
                Codigo = "CAR-FAC-SUP",
                Nome = "Supervisor de Facilities",
                Area = "Facilities",
                Senioridade = seniorPleno,
                Tipo = "Operacional",
                Status = "inativo",
                Descricao = "Servicos gerais e manutencao predial.",
                CreatedAt = Iso(now.AddDays(-244)),
                UpdatedAt = Iso(now.AddDays(-80))
            },
            new()
            {
                Id = "car-019",
                Codigo = "CAR-CAC-COO",
                Nome = "Coordenadora de Atendimento",
                Area = "Atendimento ao Cliente",
                Senioridade = seniorCoordenacao,
                Tipo = "Administrativo",
                Status = "inativo",
                Descricao = "SLA e relacionamento com clientes.",
                CreatedAt = Iso(now.AddDays(-242)),
                UpdatedAt = Iso(now.AddDays(-70))
            },
            new()
            {
                Id = "car-020",
                Codigo = "CAR-SUS-COO",
                Nome = "Coordenador de Sustentabilidade",
                Area = "Sustentabilidade",
                Senioridade = seniorCoordenacao,
                Tipo = "ESG",
                Status = "inativo",
                Descricao = "Projetos ESG e eficiencia energetica.",
                CreatedAt = Iso(now.AddDays(-240)),
                UpdatedAt = Iso(now.AddDays(-90))
            }
        };

        var areas = new List<AreaSeed>
        {
            new()
            {
                Id = "area-001",
                Codigo = "AREA-PRD",
                Nome = "Producao",
                Status = "ativo",
                Descricao = "Operacao de linhas e metas diarias.",
                CreatedAt = Iso(now.AddDays(-220)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "area-002",
                Codigo = "AREA-QLD",
                Nome = "Qualidade",
                Status = "ativo",
                Descricao = "Auditorias, controles e conformidade.",
                CreatedAt = Iso(now.AddDays(-215)),
                UpdatedAt = Iso(now.AddDays(-14))
            },
            new()
            {
                Id = "area-003",
                Codigo = "AREA-PD",
                Nome = "Pesquisa e Desenvolvimento",
                Status = "ativo",
                Descricao = "Novos produtos e melhoria continua.",
                CreatedAt = Iso(now.AddDays(-210)),
                UpdatedAt = Iso(now.AddDays(-16))
            },
            new()
            {
                Id = "area-004",
                Codigo = "AREA-OPE",
                Nome = "Operacoes",
                Status = "ativo",
                Descricao = "PCP, performance e suporte a producao.",
                CreatedAt = Iso(now.AddDays(-205)),
                UpdatedAt = Iso(now.AddDays(-20))
            },
            new()
            {
                Id = "area-005",
                Codigo = "AREA-CMP",
                Nome = "Compras",
                Status = "ativo",
                Descricao = "Negociacoes e fornecimento de insumos.",
                CreatedAt = Iso(now.AddDays(-200)),
                UpdatedAt = Iso(now.AddDays(-18))
            },
            new()
            {
                Id = "area-006",
                Codigo = "AREA-LOG",
                Nome = "Logistica",
                Status = "ativo",
                Descricao = "Estoque, expedicao e roteiros.",
                CreatedAt = Iso(now.AddDays(-198)),
                UpdatedAt = Iso(now.AddDays(-15))
            },
            new()
            {
                Id = "area-007",
                Codigo = "AREA-MNT",
                Nome = "Manutencao",
                Status = "ativo",
                Descricao = "Preventiva, corretiva e confiabilidade.",
                CreatedAt = Iso(now.AddDays(-195)),
                UpdatedAt = Iso(now.AddDays(-13))
            },
            new()
            {
                Id = "area-008",
                Codigo = "AREA-FIN",
                Nome = "Financeiro",
                Status = "ativo",
                Descricao = "Fluxo de caixa e controles.",
                CreatedAt = Iso(now.AddDays(-192)),
                UpdatedAt = Iso(now.AddDays(-19))
            },
            new()
            {
                Id = "area-009",
                Codigo = "AREA-RH",
                Nome = "RH",
                Status = "ativo",
                Descricao = "Recrutamento, treinamento e clima.",
                CreatedAt = Iso(now.AddDays(-190)),
                UpdatedAt = Iso(now.AddDays(-10))
            },
            new()
            {
                Id = "area-010",
                Codigo = "AREA-COM",
                Nome = "Comercial",
                Status = "ativo",
                Descricao = "Relacao com clientes e metas de vendas.",
                CreatedAt = Iso(now.AddDays(-185)),
                UpdatedAt = Iso(now.AddDays(-17))
            },
            new()
            {
                Id = "area-011",
                Codigo = "AREA-MKT",
                Nome = "Marketing",
                Status = "ativo",
                Descricao = "Marca, campanhas e comunicacao.",
                CreatedAt = Iso(now.AddDays(-182)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "area-012",
                Codigo = "AREA-TI",
                Nome = "TI",
                Status = "ativo",
                Descricao = "Infraestrutura, suporte e dados.",
                CreatedAt = Iso(now.AddDays(-180)),
                UpdatedAt = Iso(now.AddDays(-11))
            },
            new()
            {
                Id = "area-013",
                Codigo = "AREA-SST",
                Nome = "Seguranca do Trabalho",
                Status = "ativo",
                Descricao = "Treinamentos, NR e prevencao.",
                CreatedAt = Iso(now.AddDays(-178)),
                UpdatedAt = Iso(now.AddDays(-21))
            },
            new()
            {
                Id = "area-014",
                Codigo = "AREA-ENG",
                Nome = "Engenharia de Processos",
                Status = "ativo",
                Descricao = "Melhoria continua e eficiencia.",
                CreatedAt = Iso(now.AddDays(-175)),
                UpdatedAt = Iso(now.AddDays(-22))
            },
            new()
            {
                Id = "area-015",
                Codigo = "AREA-PCI",
                Nome = "Planejamento Industrial",
                Status = "inativo",
                Descricao = "Capacidade e sequenciamento.",
                CreatedAt = Iso(now.AddDays(-170)),
                UpdatedAt = Iso(now.AddDays(-60))
            },
            new()
            {
                Id = "area-016",
                Codigo = "AREA-SUP",
                Nome = "Supply Chain",
                Status = "ativo",
                Descricao = "Integracao compras, estoque e distribuicao.",
                CreatedAt = Iso(now.AddDays(-168)),
                UpdatedAt = Iso(now.AddDays(-19))
            },
            new()
            {
                Id = "area-017",
                Codigo = "AREA-GQ",
                Nome = "Garantia da Qualidade",
                Status = "ativo",
                Descricao = "Sistema de qualidade e auditorias.",
                CreatedAt = Iso(now.AddDays(-165)),
                UpdatedAt = Iso(now.AddDays(-17))
            },
            new()
            {
                Id = "area-018",
                Codigo = "AREA-FAC",
                Nome = "Facilities",
                Status = "inativo",
                Descricao = "Servicos gerais e manutencao predial.",
                CreatedAt = Iso(now.AddDays(-160)),
                UpdatedAt = Iso(now.AddDays(-70))
            },
            new()
            {
                Id = "area-019",
                Codigo = "AREA-CAC",
                Nome = "Atendimento ao Cliente",
                Status = "inativo",
                Descricao = "Suporte e relacionamento com clientes.",
                CreatedAt = Iso(now.AddDays(-155)),
                UpdatedAt = Iso(now.AddDays(-65))
            },
            new()
            {
                Id = "area-020",
                Codigo = "AREA-SUS",
                Nome = "Sustentabilidade",
                Status = "inativo",
                Descricao = "ESG, residuos e eficiencia energetica.",
                CreatedAt = Iso(now.AddDays(-150)),
                UpdatedAt = Iso(now.AddDays(-75))
            }
        };

        var requisitoCategorias = new List<RequisitoCategoriaSeed>
        {
            new()
            {
                Id = "cat-001",
                Codigo = "CAT-COMP",
                Nome = "Competencia",
                Status = "ativo",
                Descricao = "Competencias comportamentais e tecnicas.",
                CreatedAt = Iso(now.AddDays(-200)),
                UpdatedAt = Iso(now.AddDays(-12))
            },
            new()
            {
                Id = "cat-002",
                Codigo = "CAT-EXP",
                Nome = "Experiencia",
                Status = "ativo",
                Descricao = "Vivencias anteriores no cargo/area.",
                CreatedAt = Iso(now.AddDays(-198)),
                UpdatedAt = Iso(now.AddDays(-11))
            },
            new()
            {
                Id = "cat-003",
                Codigo = "CAT-FORM",
                Nome = "Formacao",
                Status = "ativo",
                Descricao = "Formacao academica e cursos.",
                CreatedAt = Iso(now.AddDays(-195)),
                UpdatedAt = Iso(now.AddDays(-10))
            },
            new()
            {
                Id = "cat-004",
                Codigo = "CAT-FERR",
                Nome = "Ferramenta/Tecnologia",
                Status = "ativo",
                Descricao = "Ferramentas, sistemas e tecnologias.",
                CreatedAt = Iso(now.AddDays(-193)),
                UpdatedAt = Iso(now.AddDays(-9))
            },
            new()
            {
                Id = "cat-005",
                Codigo = "CAT-CERT",
                Nome = "Certificacao",
                Status = "ativo",
                Descricao = "Certificacoes tecnicas e reguladoras.",
                CreatedAt = Iso(now.AddDays(-190)),
                UpdatedAt = Iso(now.AddDays(-8))
            },
            new()
            {
                Id = "cat-006",
                Codigo = "CAT-GEST",
                Nome = "Gestao",
                Status = "ativo",
                Descricao = "Lideranca e gestao de equipes.",
                CreatedAt = Iso(now.AddDays(-188)),
                UpdatedAt = Iso(now.AddDays(-7))
            },
            new()
            {
                Id = "cat-007",
                Codigo = "CAT-IDI",
                Nome = "Idioma",
                Status = "inativo",
                Descricao = "Idiomas e fluencia exigida.",
                CreatedAt = Iso(now.AddDays(-186)),
                UpdatedAt = Iso(now.AddDays(-6))
            },
            new()
            {
                Id = "cat-008",
                Codigo = "CAT-LOC",
                Nome = "Localidade",
                Status = "inativo",
                Descricao = "Preferencias ou restricoes de local.",
                CreatedAt = Iso(now.AddDays(-184)),
                UpdatedAt = Iso(now.AddDays(-5))
            },
            new()
            {
                Id = "cat-009",
                Codigo = "CAT-OUT",
                Nome = "Outros",
                Status = "inativo",
                Descricao = "Requisitos adicionais e especificos.",
                CreatedAt = Iso(now.AddDays(-182)),
                UpdatedAt = Iso(now.AddDays(-4))
            }
        };

        var fonteEmail = "email";
        var fontePasta = "pasta";
        var fonteLinkedIn = "linkedin";
        var fonteIndicacao = "indicacao";

        var statusNovo = "novo";
        var statusTriagem = "triagem";
        var statusPendente = "pendente";
        var statusAprovado = "aprovado";
        var statusReprovado = "reprovado";

        var candidatos = new List<CandidatoSeed>
        {
            new()
            {
                Id = CandMarianaId,
                Nome = "Mariana Souza",
                Email = "mariana.souza@@email.com",
                Fone = "(11) 98888-7777",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Fonte = fonteEmail,
                Status = statusTriagem,
                VagaId = VagaMarketingId,
                Obs = "Boa comunicacao. Experiencia com marketing digital.",
                CvText = "Experiencia com campanhas de performance, excel avancado, dashboards e power bi.",
                CreatedAt = Iso(now.AddDays(-2)),
                UpdatedAt = Iso(now.AddHours(-4)),
                LastMatch = null
            },
            new()
            {
                Id = CandCarlosId,
                Nome = "Carlos Henrique",
                Email = "carlos.h@@email.com",
                Fone = "(11) 97777-1111",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Fonte = fonteLinkedIn,
                Status = statusPendente,
                VagaId = VagaMarketingId,
                Obs = "",
                CvText = "Atuacao como analista. Excel avancado. Nocoes de BI.",
                CreatedAt = Iso(now.AddDays(-1)),
                UpdatedAt = Iso(now.AddDays(-1)),
                LastMatch = null
            },
            new()
            {
                Id = CandAnaId,
                Nome = "Ana Paula Ribeiro",
                Email = "ana.ribeiro@@email.com",
                Fone = "(11) 96666-2222",
                Cidade = "Osasco",
                Uf = "SP",
                Fonte = fonteIndicacao,
                Status = statusAprovado,
                VagaId = VagaMarketingId,
                Obs = "Perfil excelente. Forte em BI.",
                CvText = "PowerBI, SQL, modelagem dimensional e analytics.",
                CreatedAt = Iso(now.AddDays(-6)),
                UpdatedAt = Iso(now.AddDays(-2)),
                LastMatch = null
            },
            new()
            {
                Id = CandBrunoId,
                Nome = "Bruno Teixeira",
                Email = "bruno.t@@email.com",
                Fone = "(11) 95555-1212",
                Cidade = "Taboao da Serra",
                Uf = "SP",
                Fonte = fonteEmail,
                Status = statusReprovado,
                VagaId = VagaMarketingId,
                Obs = "Sem requisito obrigatorio.",
                CvText = "Experiencia generalista em apoio administrativo.",
                CreatedAt = Iso(now.AddDays(-5)),
                UpdatedAt = Iso(now.AddDays(-3)),
                LastMatch = null
            },
            new()
            {
                Id = CandDanielaId,
                Nome = "Daniela Alves",
                Email = "daniela.alves@@email.com",
                Fone = "(11) 94444-3030",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Fonte = fontePasta,
                Status = statusNovo,
                VagaId = VagaBiId,
                Obs = "",
                CvText = "Power BI, SQL e reporting.",
                CreatedAt = Iso(now.AddDays(-3)),
                UpdatedAt = Iso(now.AddDays(-3)),
                LastMatch = null
            },
            new()
            {
                Id = CandRafaelId,
                Nome = "Rafael Santos",
                Email = "rafael.santos@@email.com",
                Fone = "(11) 93333-4040",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Fonte = fonteEmail,
                Status = statusTriagem,
                VagaId = VagaQualidadeId,
                Obs = "Experiencia com auditorias internas.",
                CvText = "BPF, auditoria interna e controle de qualidade em processos.",
                CreatedAt = Iso(now.AddDays(-8)),
                UpdatedAt = Iso(now.AddDays(-2)),
                LastMatch = null
            },
            new()
            {
                Id = CandPatriciaId,
                Nome = "Patricia Mendes",
                Email = "patricia.mendes@@email.com",
                Fone = "(11) 92222-5555",
                Cidade = "Taboao da Serra",
                Uf = "SP",
                Fonte = fonteLinkedIn,
                Status = statusAprovado,
                VagaId = VagaQualidadeId,
                Obs = "Certificacoes e experiencia em qualidade.",
                CvText = "BPF, auditorias, engenharia de alimentos e processos.",
                CreatedAt = Iso(now.AddDays(-9)),
                UpdatedAt = Iso(now.AddDays(-1)),
                LastMatch = null
            },
            new()
            {
                Id = CandCamilaId,
                Nome = "Camila Rocha",
                Email = "camila.rocha@@email.com",
                Fone = "(11) 98888-3322",
                Cidade = "Osasco",
                Uf = "SP",
                Fonte = fonteIndicacao,
                Status = statusTriagem,
                VagaId = VagaMarketingId,
                Obs = "Boa aderencia em marketing digital.",
                CvText = "Campanhas, analytics e excel. Nocoes de power bi.",
                CreatedAt = Iso(now.AddDays(-7)),
                UpdatedAt = Iso(now.AddDays(-3)),
                LastMatch = null
            },
            new()
            {
                Id = CandTiagoId,
                Nome = "Tiago Almeida",
                Email = "tiago.almeida@@email.com",
                Fone = "(11) 97777-4433",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Fonte = fontePasta,
                Status = statusPendente,
                VagaId = VagaBiId,
                Obs = "",
                CvText = "SQL, ETL e modelagem. Experiencia com dados.",
                CreatedAt = Iso(now.AddDays(-4)),
                UpdatedAt = Iso(now.AddDays(-2)),
                LastMatch = null
            },
            new()
            {
                Id = CandSofiaId,
                Nome = "Sofia Lima",
                Email = "sofia.lima@@email.com",
                Fone = "(11) 96666-7788",
                Cidade = "Sao Paulo",
                Uf = "SP",
                Fonte = fonteEmail,
                Status = statusNovo,
                VagaId = VagaBiId,
                Obs = "",
                CvText = "Dashboards, BI e relatorios.",
                CreatedAt = Iso(now.AddDays(-1)),
                UpdatedAt = Iso(now.AddDays(-1)),
                LastMatch = null
            },
            new()
            {
                Id = CandLucasId,
                Nome = "Lucas Freitas",
                Email = "lucas.freitas@@email.com",
                Fone = "(11) 95555-8899",
                Cidade = "Embu das Artes",
                Uf = "SP",
                Fonte = fonteLinkedIn,
                Status = statusAprovado,
                VagaId = VagaMarketingId,
                Obs = "Experiencia em campanhas e analise de dados.",
                CvText = "GA4, campanhas de performance e excel.",
                CreatedAt = Iso(now.AddDays(-10)),
                UpdatedAt = Iso(now.AddDays(-5)),
                LastMatch = null
            }
        };

        var inbox = new List<InboxSeed>
        {
            new()
            {
                Id = InboxMarianaId,
                Origem = "email",
                Status = "novo",
                RecebidoEm = Iso(now.AddMinutes(-30)),
                Remetente = "mariana.souza@@email.com",
                Assunto = "Curriculo - Analista de Dados",
                Destinatario = "rh@@liotecnica.com.br",
                VagaId = VagaBiId,
                Anexos = new List<InboxAnexoSeed>
                {
                    new() { Nome = "Mariana_Souza_CV.pdf", Tipo = "pdf", TamanhoKB = 284, Hash = "demo-1" }
                },
                Processamento = new InboxProcessamentoSeed { Pct = 0, Etapa = "Aguardando", Log = Array.Empty<string>(), Tentativas = 0, UltimoErro = null },
                PreviewText = "Experiencia com excel avancado, dashboards e power bi..."
            },
            new()
            {
                Id = InboxAnaId,
                Origem = "pasta",
                Status = "processando",
                RecebidoEm = Iso(now.AddMinutes(-12)),
                Remetente = "watcher@@server",
                Assunto = "Novo arquivo em pasta monitorada",
                Destinatario = "FS: \\\\RH\\Curriculos\\Entrada",
                VagaId = VagaBiId,
                Anexos = new List<InboxAnexoSeed>
                {
                    new() { Nome = "Ana_Ribeiro.docx", Tipo = "docx", TamanhoKB = 512, Hash = "demo-2" }
                },
                Processamento = new InboxProcessamentoSeed
                {
                    Pct = 55,
                    Etapa = "Extraindo texto",
                    Log = new[] { "Arquivo detectado", "Upload ok", "Extraindo texto..." },
                    Tentativas = 1,
                    UltimoErro = null
                },
                PreviewText = "PowerBI, SQL, modelagem dimensional e analytics..."
            },
            new()
            {
                Id = InboxCarlosId,
                Origem = "email",
                Status = "falha",
                RecebidoEm = Iso(now.AddMinutes(-90)),
                Remetente = "carlos.h@@email.com",
                Assunto = "CV atualizado (PDF protegido)",
                Destinatario = "rh@@liotecnica.com.br",
                VagaId = VagaBiId,
                Anexos = new List<InboxAnexoSeed>
                {
                    new() { Nome = "CarlosH_CV.pdf", Tipo = "pdf", TamanhoKB = 190, Hash = "demo-3" }
                },
                Processamento = new InboxProcessamentoSeed
                {
                    Pct = 100,
                    Etapa = "Falha",
                    Log = new[] { "Anexo encontrado", "Tentativa de leitura", "PDF com senha" },
                    Tentativas = 2,
                    UltimoErro = "PDF protegido por senha"
                },
                PreviewText = ""
            }
        };

        var roles = BuildRoles(now);
        var users = BuildUsers(now);

        var dashboardRows = new List<DashboardRowSeed>
        {
            new() { Vaga = "Analista de Marketing Jr", Cand = "Camila R.", Origem = "Email", Match = 92, Etapa = "Triagem" },
            new() { Vaga = "Engenheiro de Processos", Cand = "Rafael S.", Origem = "Pasta", Match = 88, Etapa = "Em analise" },
            new() { Vaga = "Supervisor de Qualidade", Cand = "Patricia M.", Origem = "Email", Match = 84, Etapa = "Entrevista" },
            new() { Vaga = "Assistente de RH", Cand = "Daniel A.", Origem = "Pasta", Match = 81, Etapa = "Triagem" },
            new() { Vaga = "Engenheiro de Processos", Cand = "Bruno T.", Origem = "Email", Match = 78, Etapa = "Recebido" }
        };

        var dashboardSeries = new[] { 8, 12, 10, 14, 18, 20, 16, 22, 25, 19, 21, 28, 24, 30 };

        var reports = new List<ReportSeed>
        {
            new() { Id = "r1", Icon = "bar-chart", Title = "Entrada por Origem", Desc = "Quantidade de itens recebidos por Email/Pasta/Upload no periodo.", Scope = "entrada" },
            new() { Id = "r2", Icon = "exclamation-triangle", Title = "Falhas de Processamento", Desc = "Principais causas de falha (PDF protegido, parser, arquivo vazio).", Scope = "entrada" },
            new() { Id = "r3", Icon = "people", Title = "Pipeline RH (Status do Candidato)", Desc = "Distribuicao por status: triagem, matching, aprovado, reprovado.", Scope = "candidatos" },
            new() { Id = "r4", Icon = "briefcase", Title = "Funil por Vaga", Desc = "Candidatos por vaga: recebidos -> triados -> match >= threshold.", Scope = "vagas" },
            new() { Id = "r5", Icon = "stars", Title = "Ranking de Matching", Desc = "Top candidatos por percentual de match (demo).", Scope = "matching" }
        };

        return new SeedBundle
        {
            Vagas = vagas,
            SelectedVagaId = VagaMarketingId,
            Candidatos = candidatos,
            SelectedCandidatoId = CandMarianaId,
            Inbox = inbox,
            SelectedInboxId = InboxMarianaId,
            Roles = roles,
            Users = users,
            DashboardRows = dashboardRows,
            DashboardSeries = dashboardSeries,
            Reports = reports,
            Departamentos = departamentos,
            Gestores = gestores,
            Areas = areas,
            RequisitoCategorias = requisitoCategorias,
            Unidades = unidades,
            Cargos = cargos
        };
    }

    private static IReadOnlyList<RoleSeed> BuildRoles(DateTimeOffset now)
    {
        var adminPerms = BuildPermissions(true);
        var recruiterPerms = BuildPermissions(false);

        SetPermissions(recruiterPerms, new[] { "vagas", "candidatos", "triagem", "matching", "entrada" }, view: true, create: true, edit: true, export: true);
        SetPermissions(recruiterPerms, new[] { "relatorios" }, view: true, export: true);
        SetPermissions(recruiterPerms, new[] { "dashboard" }, view: true);

        var managerPerms = BuildPermissions(false);
        SetPermissions(managerPerms, new[] { "dashboard", "relatorios", "vagas", "candidatos", "matching" }, view: true, export: true);
        SetPermissions(managerPerms, new[] { "triagem" }, view: true, edit: true);

        return new List<RoleSeed>
        {
            new()
            {
                Id = RoleAdminId,
                Name = "Admin RH",
                Desc = "Acesso total (admin).",
                Perms = adminPerms,
                BuiltIn = true,
                CreatedAt = Iso(now.AddDays(-30)),
                UpdatedAt = Iso(now.AddDays(-7))
            },
            new()
            {
                Id = RoleRecruiterId,
                Name = "Recrutador",
                Desc = "Opera vagas, triagem e matching.",
                Perms = recruiterPerms,
                BuiltIn = false,
                CreatedAt = Iso(now.AddDays(-20)),
                UpdatedAt = Iso(now.AddDays(-5))
            },
            new()
            {
                Id = RoleManagerId,
                Name = "Gestor",
                Desc = "Acompanha funil e aprovacoes.",
                Perms = managerPerms,
                BuiltIn = false,
                CreatedAt = Iso(now.AddDays(-18)),
                UpdatedAt = Iso(now.AddDays(-3))
            }
        };
    }

    private static IReadOnlyList<UserSeed> BuildUsers(DateTimeOffset now)
    {
        return new List<UserSeed>
        {
            new()
            {
                Id = UserFernandaId,
                Name = "Fernanda Lima",
                Email = "fernanda.lima@@liotecnica.com.br",
                Dept = "RH",
                Status = "active",
                RoleIds = new[] { RoleAdminId },
                MfaEnabled = true,
                CreatedAt = Iso(now.AddDays(-22)),
                UpdatedAt = Iso(now.AddDays(-2)),
                LastLoginAt = Iso(now.AddDays(-1))
            },
            new()
            {
                Id = UserMarcosId,
                Name = "Marcos Azevedo",
                Email = "marcos.azevedo@@liotecnica.com.br",
                Dept = "RH",
                Status = "active",
                RoleIds = new[] { RoleRecruiterId },
                MfaEnabled = false,
                CreatedAt = Iso(now.AddDays(-19)),
                UpdatedAt = Iso(now.AddDays(-4)),
                LastLoginAt = Iso(now.AddDays(-3))
            },
            new()
            {
                Id = UserAnaId,
                Name = "Ana Ribeiro",
                Email = "ana.ribeiro@@liotecnica.com.br",
                Dept = "Gestao",
                Status = "invited",
                RoleIds = new[] { RoleManagerId },
                MfaEnabled = false,
                CreatedAt = Iso(now.AddDays(-15)),
                UpdatedAt = Iso(now.AddDays(-6)),
                LastLoginAt = null
            }
        };
    }

    private static Dictionary<string, PermissionSeed> BuildPermissions(bool adminAll)
    {
        var modules = new[] { "dashboard", "vagas", "candidatos", "triagem", "matching", "entrada", "relatorios", "config", "usuarios" };
        var perms = new Dictionary<string, PermissionSeed>();

        foreach (var key in modules)
        {
            perms[key] = adminAll
                ? new PermissionSeed { View = true, Create = true, Edit = true, Delete = true, Export = true, Admin = true }
                : new PermissionSeed();
        }

        return perms;
    }

    private static void SetPermissions(Dictionary<string, PermissionSeed> perms, IEnumerable<string> modules, bool view = false, bool create = false, bool edit = false, bool delete = false, bool export = false, bool admin = false)
    {
        foreach (var module in modules)
        {
            perms[module] = new PermissionSeed
            {
                View = view,
                Create = create,
                Edit = edit,
                Delete = delete,
                Export = export,
                Admin = admin
            };
        }
    }

    private static string Iso(DateTimeOffset value) => value.ToString("o");
}
