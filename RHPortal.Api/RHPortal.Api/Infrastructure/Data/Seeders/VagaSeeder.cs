using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class VagaSeeder
{
    private sealed record VagaSeed(
        string Code,
        string DepartmentCode,
        string UnitCode,
        string Title,
        SeniorityLevel Seniority,
        string Description,
        bool IsShiftBased,
        bool IsOnSite);

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
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

        var managersByArea = managers
            .GroupBy(m => m.AreaId)
            .ToDictionary(g => g.Key, g => g.ToList());

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

        static string? MapDepartmentCodeFromAreaCode(string? areaCode)
        {
            var c = (areaCode ?? "").Trim().ToUpperInvariant();
            return c switch
            {
                "OPS" => "OPS",
                "SCM" => "LOG",
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
                throw new InvalidOperationException($"Unidade '{s.UnitCode}' nao encontrada.");

            var areaEntity = areas[rng.Next(areas.Count)];
            var areaId = areaEntity.Id;
            var areaCode = (areaEntity.Code ?? "").Trim().ToUpperInvariant();

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
                throw new InvalidOperationException("Department invalido (Id vazio).");

            var managerId =
                (managersByArea.TryGetValue(areaId, out var mgrs) && mgrs.Count > 0)
                    ? mgrs[rng.Next(mgrs.Count)].Id
                    : managers[rng.Next(managers.Count)].Id;

            if (managerId == Guid.Empty)
                throw new InvalidOperationException("Nenhum manager valido encontrado.");

            var cargoId =
                (cargosByArea.TryGetValue(areaId, out var cargos) && cargos.Count > 0)
                    ? cargos[rng.Next(cargos.Count)].Id
                    : jobPositions[rng.Next(jobPositions.Count)].Id;

            if (cargoId == Guid.Empty)
                throw new InvalidOperationException("Nenhum JobPosition valido encontrado.");

            var published = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-rng.Next(3, 35)));
            var closing = published.AddDays(rng.Next(10, 45));

            var senior = MapSenioridade(s.Seniority);

            var (salMin, salMax, expMin) = senior switch
            {
                null => (3500m, 5200m, 1),
                _ when IsEnumName(senior.Value, "Junior", "Jr") => (3200m, 4500m, 0),
                _ when IsEnumName(senior.Value, "Pleno") => (4800m, 7200m, 2),
                _ when IsEnumName(senior.Value, "Senior", "Senior") => (7800m, 11500m, 4),
                _ when IsEnumName(senior.Value, "Especialista") => (9800m, 15000m, 5),
                _ when IsEnumName(senior.Value, "Coordenacao", "Coordenador") => (11000m, 16000m, 6),
                _ when IsEnumName(senior.Value, "Gerencia", "Gerente") => (15000m, 22000m, 8),
                _ => (4500m, 8500m, 2)
            };

            var now = DateTimeOffset.UtcNow;

            var vaga = new Vaga
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,

                Codigo = s.Code,
                Titulo = s.Title,

                AreaId = areaId,
                DepartmentId = depEntity.Id,

                Status = ParseEnumOrFirst<VagaStatus>("Aberta", "Open", "Ativa", "EmAberto"),
                Senioridade = senior,

                QuantidadeVagas = rng.Next(1, 6),
                TipoContratacao = ParseEnumOrFirst<VagaTipoContratacao>("CLT", "Efetivo", "FullTime"),
                MatchMinimoPercentual = 70 + rng.Next(0, 16),

                DescricaoInterna = s.Description,
                DescricaoPublica = s.Description,

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

            var reqs = BuildDemoRequisitos(areaCode);

            var ordem = 0;
            foreach (var r in reqs)
            {
                vaga.Requisitos.Add(new VagaRequisito
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    VagaId = vaga.Id,
                    Ordem = ordem++,
                    Nome = r.Nome,
                    Peso = r.Peso,
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

        return areaCode switch
        {
            "TEC" => new()
            {
                ("Windows/Office 365", (VagaPeso)4, true, 1, null, null, null, new[] { "Office", "Pacote Office", "Microsoft 365" }),
                ("Atendimento ao usuario", (VagaPeso)4, true, 1, null, null, null, new[] { "Suporte ao usuario", "Help desk" }),
                ("ITIL (desejavel)", (VagaPeso)2, false, null, null, null, null, new[] { "ITIL Foundation" }),
                ("Redes basicas", (VagaPeso)3, false, 1, null, null, null, new[] { "TCP/IP", "LAN", "WAN" })
            },
            "FIN" => new()
            {
                ("Excel intermediario/avancado", (VagaPeso)4, true, 2, null, null, null, new[] { "Excel avancado", "Planilhas" }),
                ("Contas a receber", (VagaPeso)4, true, 2, null, null, null, new[] { "CR", "Recebiveis" }),
                ("Conciliacoes bancarias", (VagaPeso)3, false, 1, null, null, null, null)
            },
            _ => new()
            {
                ("Experiencia na area", (VagaPeso)4, true, 1, null, null, null, null),
                ("Disponibilidade de horario", (VagaPeso)2, false, null, null, null, null, null)
            }
        };
    }

    private static string? JoinSinonimos(IReadOnlyList<string>? sinonimos)
        => sinonimos is null || sinonimos.Count == 0 ? null : string.Join(";", sinonimos);

    private static TEnum ParseEnumOrFirst<TEnum>(params string[] names) where TEnum : struct, Enum
    {
        foreach (var name in names)
        {
            if (Enum.TryParse<TEnum>(name, true, out var parsed))
                return parsed;
        }

        return Enum.GetValues<TEnum>().First();
    }

    private static bool IsEnumName<TEnum>(TEnum value, params string[] names) where TEnum : struct, Enum
    {
        var current = value.ToString();
        return names.Any(n => string.Equals(current, n, StringComparison.OrdinalIgnoreCase));
    }

    private static VagaSenioridade? MapSenioridade(SeniorityLevel seniority)
    {
        return seniority switch
        {
            SeniorityLevel.Junior => ParseEnumOrFirst<VagaSenioridade>("Junior", "Jr"),
            SeniorityLevel.Pleno => ParseEnumOrFirst<VagaSenioridade>("Pleno"),
            SeniorityLevel.Senior => ParseEnumOrFirst<VagaSenioridade>("Senior"),
            SeniorityLevel.Especialista => ParseEnumOrFirst<VagaSenioridade>("Especialista"),
            SeniorityLevel.Coordenacao => ParseEnumOrFirst<VagaSenioridade>("Coordenacao", "Coordenador"),
            SeniorityLevel.Gerencia => ParseEnumOrFirst<VagaSenioridade>("Gerencia", "Gerente"),
            SeniorityLevel.Diretoria => ParseEnumOrFirst<VagaSenioridade>("Diretoria", "Diretor"),
            _ => null
        };
    }

    private static string BuildKeywords(string areaCode) => areaCode switch
    {
        "OPS" => "producao;linha;setup;5s;turno;qualidade;higiene;embalagem",
        "QUA" => "qualidade;laboratorio;appcc;bpf;auditoria;rastreabilidade",
        "ENG" => "manutencao;pcm;automacao;utilidades;equipamentos;confiabilidade",
        "SCM" => "logistica;estoque;pcp;planejamento;expedicao;suprimentos",
        _ => "rotina;processos;organizacao;comunicacao"
    };

    private static string BuildResponsibilities(string areaCode) => areaCode switch
    {
        "OPS" => "Operar processos;Registrar producao;Seguir POPs;Garantir 5S;Reportar desvios",
        "QUA" => "Coletar amostras;Registrar analises;Tratar nao conformidades;Apoiar auditorias",
        "ENG" => "Executar manutencao;Prevenir falhas;Registrar OS;Apoiar paradas programadas",
        "SCM" => "Planejar/abastecer;Controlar estoque;Garantir FEFO;Apoiar expedicao",
        _ => "Apoiar rotina da area;Garantir organizacao;Cumprir prazos;Comunicar riscos"
    };

    private static IReadOnlyList<VagaSeed> BuildFoodIndustryVagasDemo()
    {
        return new List<VagaSeed>
        {
            new("VAG-ADM-001","ADM-001","UNI-SPC","Assistente de Facilities & Recepcao", SeniorityLevel.Junior,
                "Rotinas de recepcao, controle de acessos, apoio a facilities, interface com prestadores e suporte administrativo.",
                false, false),
            new("VAG-ADM-002","ADM-002","UNI-SPC","Analista de Compliance & LGPD", SeniorityLevel.Pleno,
                "Apoio em compliance, politicas internas, analise de riscos, adequacao LGPD e suporte a auditorias/regulatorios.",
                false, false),
            new("VAG-ADM-003","ADM-003","UNI-SPC","Assistente de Gestao Documental", SeniorityLevel.Junior,
                "Organizacao e versionamento de documentos (POPs, registros, evidencias), controle de arquivos e suporte a auditorias.",
                false, false),
            new("VAG-ADM-004","ADM-004","UNI-EMB","Tecnico de Infraestrutura Predial", SeniorityLevel.Pleno,
                "Manutencao predial (nao industrial), acompanhamento de servicos, melhorias de infraestrutura e rotinas de seguranca predial.",
                false, true),
            new("VAG-ADM-005","ADM-005","UNI-SPC","Comprador de Indiretos & Servicos", SeniorityLevel.Pleno,
                "Compras indiretas (EPI, MRO leve, servicos), cotacoes, contratos e gestao de fornecedores de servicos.",
                false, false),
            new("VAG-FIN-001","FIN-001","UNI-SPC","Analista de Contas a Pagar", SeniorityLevel.Pleno,
                "Processamento de titulos, conciliacoes, fluxo de aprovacoes, relacionamento com fornecedores e compliance financeiro.",
                false, false),
            new("VAG-FIN-002","FIN-002","UNI-SPC","Analista de Contas a Receber", SeniorityLevel.Pleno,
                "Faturamento, cobranca, conciliacao de recebiveis e suporte a politicas de credito para canais varejo/atacado.",
                false, false),
            new("VAG-FIN-003","FIN-003","UNI-SPC","Analista de Tesouraria", SeniorityLevel.Senior,
                "Gestao de caixa, bancos, pagamentos criticos, rotinas de tesouraria e apoio em aplicacoes de curto prazo.",
                false, false),
            new("VAG-FIN-004","FIN-004","UNI-SPC","Analista de Custos Industriais", SeniorityLevel.Senior,
                "Apuracao de custos industriais, variacoes, perdas, rendimento, suporte a PCP/producao e analises gerenciais.",
                false, false),
            new("VAG-FIN-005","FIN-005","UNI-SPC","Analista Fiscal & Tributario", SeniorityLevel.Senior,
                "Escrituracao fiscal, apuracao, SPED e suporte a operacoes/transportes com visao de compliance tributario.",
                false, false),
            new("VAG-RH-001","RH-001","UNI-SPC","Analista de Recrutamento & Selecao", SeniorityLevel.Pleno,
                "Triagem, entrevistas e contratacao (operacional/tecnico), alinhamento com gestores e onboarding de fabrica.",
                false, false),
            new("VAG-RH-002","RH-002","UNI-SPC","Analista de Treinamento & Desenvolvimento", SeniorityLevel.Pleno,
                "Treinamentos de BPF, seguranca de alimentos, integracao, reciclagens e trilhas de capacitacao na planta.",
                false, false),
            new("VAG-RH-003","RH-003","UNI-SPC","Analista de Departamento Pessoal", SeniorityLevel.Pleno,
                "Folha, ponto, beneficios e rotinas trabalhistas (turnos, adicionais, escalas) com foco em ambiente fabril.",
                false, false),
            new("VAG-RH-004","RH-004","UNI-SPC","Analista de Comunicacao Interna", SeniorityLevel.Junior,
                "Campanhas internas, comunicados de turnos, avisos operacionais e apoio a acoes de clima/engajamento.",
                false, false),
            new("VAG-RH-005","RH-005","UNI-EMB","Tecnico de Enfermagem do Trabalho", SeniorityLevel.Pleno,
                "Rotinas de ambulatorio, ASO, acompanhamento de afastamentos e acoes preventivas em areas operacionais.",
                true, true),
            new("VAG-OPS-001","OPS-001","UNI-EMB","Operador de Producao - Preparacao & Mistura", SeniorityLevel.Junior,
                "Execucao de receitas, dosagem, mistura e registros conforme POPs/BPF. Atencao a rastreabilidade por lote.",
                true, true),
            new("VAG-OPS-002","OPS-002","UNI-EMB","Operador de Processo Termico - Cozimento/Pasteurizacao", SeniorityLevel.Pleno,
                "Operacao de processos termicos, controle de tempo/temperatura, registros de CCP e liberacao de linha.",
                true, true),
            new("VAG-OPS-003","OPS-003","UNI-EMB","Operador de Maquina de Envase", SeniorityLevel.Pleno,
                "Setup, ajuste e operacao de envase. Controle de perdas, rendimento, integridade de selagem e codificacao.",
                true, true),
            new("VAG-OPS-004","OPS-004","UNI-EMB","Encarregado de Embalagem & Rotulagem", SeniorityLevel.Coordenacao,
                "Coordenacao da equipe de embalagem, controle de consumo, conferencia de rotulos, validade e padroes de qualidade.",
                true, true),
            new("VAG-OPS-005","OPS-005","UNI-EMB","Auxiliar de Higienizacao - CIP/COP", SeniorityLevel.Junior,
                "Rotinas CIP/COP, preparacao de quimicos, verificacao de eficacia e liberacao sanitaria de equipamentos/linhas.",
                true, true),
            new("VAG-QUA-001","QUA-001","UNI-EMB","Analista de Laboratorio (Fisico-Quimico)", SeniorityLevel.Pleno,
                "Analises fisico-quimicas (pH, Brix, densidade), controle de especificacoes e suporte a investigacao de desvios.",
                false, true),
            new("VAG-QUA-002","QUA-002","UNI-EMB","Analista de Laboratorio (Microbiologia)", SeniorityLevel.Pleno,
                "Analises microbiologicas, monitoramento ambiental, agua/superficies e apoio em validacoes de higiene.",
                false, true),
            new("VAG-QUA-003","QUA-003","UNI-EMB","Auditor Interno - BPF & Sistema da Qualidade", SeniorityLevel.Senior,
                "Auditorias internas, planos de acao, gestao de nao conformidades e fortalecimento do sistema de qualidade.",
                false, true),
            new("VAG-QUA-004","QUA-004","UNI-EMB","Especialista em APPCC/HACCP", SeniorityLevel.Especialista,
                "Gestao de APPCC/HACCP, riscos, CCPs, revisao de POPs e governanca de seguranca de alimentos.",
                false, true),
            new("VAG-QUA-005","QUA-005","UNI-SPC","Analista de Assuntos Regulatorios (ANVISA/MAPA)", SeniorityLevel.Senior,
                "Regularizacao, rotulagem legal, interface com orgaos reguladores e suporte a claims e composicao.",
                false, false),
            new("VAG-ENG-001","ENG-001","UNI-EMB","Tecnico de Manutencao Mecanica", SeniorityLevel.Pleno,
                "Manutencao preventiva/corretiva em equipamentos de linha, reducao de paradas e gestao de pecas criticas.",
                true, true),
            new("VAG-ENG-002","ENG-002","UNI-EMB","Tecnico de Manutencao Eletrica", SeniorityLevel.Pleno,
                "Intervencoes eletricas, paineis, motores/sensores, leitura de diagramas e confiabilidade de processo.",
                true, true),
            new("VAG-ENG-003","ENG-003","UNI-EMB","Analista de Utilidades Industriais", SeniorityLevel.Pleno,
                "Gestao de utilidades (vapor, refrigeracao, ar comprimido), consumo e estabilidade para garantir qualidade.",
                true, true),
            new("VAG-ENG-004","ENG-004","UNI-EMB","Tecnico de Automacao Industrial", SeniorityLevel.Senior,
                "CLPs, IHMs, instrumentacao, parametrizacao e suporte a estabilidade de processo / coleta de dados.",
                true, true),
            new("VAG-ENG-005","ENG-005","UNI-EMB","Engenheiro de Processos & Melhoria Continua", SeniorityLevel.Senior,
                "OEE, perdas, Kaizen, padronizacao, otimizacao de setups e suporte ao aumento de capacidade produtiva.",
                false, true),
            new("VAG-PDI-001","PDI-001","UNI-EMB","Analista de P&D (Produtos)", SeniorityLevel.Senior,
                "Desenvolvimento/reformulacao, testes de estabilidade, escalonamento e documentacao tecnica de produto.",
                false, true),
            new("VAG-PDI-002","PDI-002","UNI-EMB","Tecnico de P&D - Cozinha Piloto", SeniorityLevel.Pleno,
                "Execucao de testes piloto, preparo de amostras, controles e registros conforme padroes de qualidade.",
                false, true),
            new("VAG-PDI-003","PDI-003","UNI-EMB","Analista de Desenvolvimento de Embalagens", SeniorityLevel.Pleno,
                "Especificacao de materiais, testes de barreira/selagem, compatibilidade com envase e otimizacao de custos.",
                false, true),
            new("VAG-PDI-004","PDI-004","UNI-EMB","Analista de Pesquisa Sensorial", SeniorityLevel.Pleno,
                "Planejamento e execucao de testes sensoriais, analise de aceitacao e suporte a decisao de portfolio.",
                false, true),
            new("VAG-PDI-005","PDI-005","UNI-SPC","Analista de Gestao de Portfolio", SeniorityLevel.Pleno,
                "Pipeline de inovacao, priorizacao de projetos e alinhamento com comercial/marketing para lancamentos.",
                false, false),
            new("VAG-SCM-001","SCM-001","UNI-EMB","Analista de PCP", SeniorityLevel.Pleno,
                "Sequenciamento, MPS, balanceamento capacidade x demanda e apontamentos para eficiencia da planta.",
                false, true),
            new("VAG-SCM-002","SCM-002","UNI-SPC","Comprador de Materia-Prima e Ingredientes", SeniorityLevel.Pleno,
                "Compras de ingredientes, homologacao, lead time, contratos e performance de fornecedores criticos.",
                false, false),
            new("VAG-SCM-003","SCM-003","UNI-EMB","Analista de Recebimento & Armazenagem (Insumos)", SeniorityLevel.Junior,
                "Recebimento, conferencia, FEFO/FIFO, rastreabilidade e controle de armazenagem em ambiente industrial.",
                true, true),
            new("VAG-SCM-004","SCM-004","UNI-EMB","Analista de Estoques (Embalagens)", SeniorityLevel.Pleno,
                "Inventarios, acuracidade, abastecimento de linha e controle de consumo por ordem/lote.",
                true, true),
            new("VAG-SCM-005","SCM-005","UNI-EMB","Analista de Transporte & Distribuicao", SeniorityLevel.Pleno,
                "Roteirizacao, frete, agendamento, SLAs e interface com transportadoras para atender clientes e CDs.",
                false, true),
            new("VAG-COM-001","COM-001","UNI-SPC","Executivo de Vendas - Atacado/Distribuidores", SeniorityLevel.Senior,
                "Gestao de distribuidores, politicas comerciais, mix, campanhas e acompanhamento de sell-in/sell-out.",
                false, false),
            new("VAG-COM-002","COM-002","UNI-SPC","Key Account - Grandes Redes", SeniorityLevel.Senior,
                "Negociacao com grandes redes, contratos, verbas, planejamento de demanda e gestao de ruptura.",
                false, false),
            new("VAG-COM-003","COM-003","UNI-SPC","Analista de Trade Marketing", SeniorityLevel.Pleno,
                "Execucao de planos em PDV, campanhas, materiais e analise de performance por canal.",
                false, false),
            new("VAG-COM-004","COM-004","UNI-SPC","Analista de SAC & Pos-venda", SeniorityLevel.Pleno,
                "Tratativa de reclamacoes, rastreabilidade, retorno ao consumidor e interface com Qualidade/Regulatorio.",
                false, false),
            new("VAG-COM-005","COM-005","UNI-SPC","Analista de Inteligencia de Mercado & Pricing", SeniorityLevel.Senior,
                "Analise de concorrencia, rentabilidade, precificacao e suporte a decisoes comerciais por SKU/canal.",
                false, false),
            new("VAG-TEC-001","TEC-001","UNI-SPC","Analista de Suporte - Service Desk", SeniorityLevel.Junior,
                "Atendimento N1/N2, gestao de chamados, inventario e suporte a usuarios administrativos e fabrica.",
                false, false),
            new("VAG-TEC-002","TEC-002","UNI-EMB","Analista de Sistemas Industriais (MES/SCADA)", SeniorityLevel.Senior,
                "Sustentacao de sistemas industriais, integracoes com coleta de dados e suporte a automacao/rastreabilidade.",
                true, true),
            new("VAG-TEC-003","TEC-003","UNI-SPC","Analista de ERP & Integracoes", SeniorityLevel.Pleno,
                "Sustentacao de ERP, cadastros mestres, integracoes e apoio a processos de compras/financas/producao.",
                false, false),
            new("VAG-TEC-004","TEC-004","UNI-SPC","Analista de Dados (BI) - KPIs Industriais", SeniorityLevel.Senior,
                "Dashboards, qualidade de dados e indicadores (OEE, perdas, produtividade) para tomada de decisao.",
                false, false),
            new("VAG-TEC-005","TEC-005","UNI-SPC","Analista de Seguranca da Informacao", SeniorityLevel.Pleno,
                "Politicas de seguranca, acessos, vulnerabilidades e governanca LGPD com visao corporativa.",
                false, false),
            new("VAG-OPS-006","OPS-003","UNI-EMB","Lider de Turno - Producao", SeniorityLevel.Coordenacao,
                "Gestao do turno, metas, seguranca, qualidade e produtividade. Acompanha OEE e planos de acao.",
                true, true),
            new("VAG-QUA-006","QUA-003","UNI-EMB","Analista de Rastreabilidade & Recall", SeniorityLevel.Pleno,
                "Controle de lotes, rastreabilidade ponta a ponta e simulado de recall com interface SCM/Qualidade.",
                false, true),
            new("VAG-ENG-006","ENG-003","UNI-EMB","Operador de Caldeira", SeniorityLevel.Senior,
                "Operacao e rotinas de seguranca em caldeiras/utilidades, controles e inspecoes regulamentares.",
                true, true),
            new("VAG-SCM-006","SCM-005","UNI-EMB","Supervisor de Expedicao", SeniorityLevel.Coordenacao,
                "Coordena expedicao, carregamento e SLA, interface com transportadoras e roteirizacao diaria.",
                true, true),
            new("VAG-OPS-007","OPS-004","UNI-EMB","Conferente de Embalagem & Rotulagem", SeniorityLevel.Junior,
                "Conferencia de rotulagem, codificacao, datas e integridade de embalagem para evitar desvios e retrabalho.",
                true, true)
        };
    }
}
