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

        // ? Áreas ativas
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

            // ? sorteia Area
            var areaEntity = areas[rng.Next(areas.Count)];
            var areaId = areaEntity.Id;
            var areaCode = (areaEntity.Code ?? "").Trim().ToUpperInvariant();

            // ? resolve Department (DB) pelo code do seed; fallback por Area.Code; fallback aleatório
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

            // ? escolhe Manager pelo AreaId sorteado (fallback: qualquer)
            var managerId =
                (managersByArea.TryGetValue(areaId, out var mgrs) && mgrs.Count > 0)
                    ? mgrs[rng.Next(mgrs.Count)].Id
                    : managers[rng.Next(managers.Count)].Id;

            if (managerId == Guid.Empty)
                throw new InvalidOperationException("Nenhum manager válido encontrado.");

            // ? escolhe JobPosition pelo AreaId sorteado (fallback: qualquer)
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

                // ? FKs (DB)
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

            // ? seed de requisitos (exemplo)
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
                ("Redes básicas", (VagaPeso)3, false, 1, null, null, null, new[] { "TCP/IP", "LAN", "WAN" })
            },
            "FIN" => new()
            {
                ("Excel intermediário/avançado", (VagaPeso)4, true, 2, null, null, null, new[] { "Excel avancado", "Planilhas" }),
                ("Contas a receber", (VagaPeso)4, true, 2, null, null, null, new[] { "CR", "Recebiveis" }),
                ("Conciliação bancária", (VagaPeso)3, false, 1, null, null, null, new[] { "Conciliacao", "Extrato" })
            },
            _ => new()
            {
                ("Comunicação", (VagaPeso)3, true, null, null, null, null, new[] { "Comunicacao", "Boa comunicacao" }),
                ("Trabalho em equipe", (VagaPeso)3, false, null, null, null, null, new[] { "Teamwork", "Colaboracao" })
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

    private static TEnum ParseEnumOrFirst<TEnum>(params string[] names) where TEnum : struct, Enum
    {
        foreach (var n in names)
            if (!string.IsNullOrWhiteSpace(n) && Enum.TryParse<TEnum>(n, true, out var v))
                return v;

        return Enum.GetValues<TEnum>()[0];
    }

    private static bool IsEnumName<TEnum>(TEnum value, params string[] names) where TEnum : struct, Enum
    {
        var s = value.ToString();
        return names.Any(n => string.Equals(s, n, StringComparison.OrdinalIgnoreCase));
    }

    private static VagaSenioridade? MapSenioridade(SeniorityLevel seniority)
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

    private static string BuildKeywords(string areaCode) => areaCode switch
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

    private static string BuildResponsibilities(string areaCode) => areaCode switch
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
            new("VAG-OPS-001","OPS-001","UNI-EMB","Operador de Produção - Preparação & Mistura", SeniorityLevel.Junior,
                "Execução de receitas, dosagem, mistura e registros conforme POPs/BPF. Atenção a rastreabilidade por lote.",
                true, true),
            new("VAG-OPS-002","OPS-002","UNI-EMB","Operador de Processo Térmico - Cozimento/Pasteurização", SeniorityLevel.Pleno,
                "Operação de processos térmicos, controle de tempo/temperatura, registros de CCP e liberação de linha.",
                true, true),
            new("VAG-OPS-003","OPS-003","UNI-EMB","Operador de Máquina de Envase", SeniorityLevel.Pleno,
                "Setup, ajuste e operação de envase. Controle de perdas, rendimento, integridade de selagem e codificação.",
                true, true),
            new("VAG-OPS-004","OPS-004","UNI-EMB","Encarregado de Embalagem & Rotulagem", SeniorityLevel.Coordenacao,
                "Coordenação da equipe de embalagem, controle de consumo, conferência de rótulos, validade e padrões de qualidade.",
                true, true),
            new("VAG-OPS-005","OPS-005","UNI-EMB","Auxiliar de Higienização - CIP/COP", SeniorityLevel.Junior,
                "Rotinas CIP/COP, preparação de químicos, verificação de eficácia e liberação sanitária de equipamentos/linhas.",
                true, true),
            new("VAG-QUA-001","QUA-001","UNI-EMB","Analista de Laboratório (Físico-Químico)", SeniorityLevel.Pleno,
                "Análises físico-químicas (pH, Brix, densidade), controle de especificações e suporte a investigação de desvios.",
                false, true),
            new("VAG-QUA-002","QUA-002","UNI-EMB","Analista de Laboratório (Microbiologia)", SeniorityLevel.Pleno,
                "Análises microbiológicas, monitoramento ambiental, água/superfícies e apoio em validações de higiene.",
                false, true),
            new("VAG-QUA-003","QUA-003","UNI-EMB","Auditor Interno - BPF & Sistema da Qualidade", SeniorityLevel.Senior,
                "Auditorias internas, planos de ação, gestão de não conformidades e fortalecimento do sistema de qualidade.",
                false, true),
            new("VAG-QUA-004","QUA-004","UNI-EMB","Especialista em APPCC/HACCP", SeniorityLevel.Especialista,
                "Gestão de APPCC/HACCP, riscos, CCPs, revisão de POPs e governança de segurança de alimentos.",
                false, true),
            new("VAG-QUA-005","QUA-005","UNI-SPC","Analista de Assuntos Regulatórios (ANVISA/MAPA)", SeniorityLevel.Senior,
                "Regularização, rotulagem legal, interface com órgãos reguladores e suporte a claims e composição.",
                false, false),
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
                "CLPs, IHMs, instrumentação, parametrização e suporte a estabilidade de processo / coleta de dados.",
                true, true),
            new("VAG-ENG-005","ENG-005","UNI-EMB","Engenheiro de Processos & Melhoria Contínua", SeniorityLevel.Senior,
                "OEE, perdas, Kaizen, padronização, otimização de setups e suporte ao aumento de capacidade produtiva.",
                false, true),
            new("VAG-PDI-001","PDI-001","UNI-EMB","Analista de P&D (Produtos)", SeniorityLevel.Senior,
                "Desenvolvimento/reformulação, testes de estabilidade, escalonamento e documentação técnica de produto.",
                false, true),
            new("VAG-PDI-002","PDI-002","UNI-EMB","Técnico de P&D - Cozinha Piloto", SeniorityLevel.Pleno,
                "Execução de testes piloto, preparo de amostras, controles e registros conforme padrões de qualidade.",
                false, true),
            new("VAG-PDI-003","PDI-003","UNI-EMB","Analista de Desenvolvimento de Embalagens", SeniorityLevel.Pleno,
                "Especificação de materiais, testes de barreira/selagem, compatibilidade com envase e otimização de custos.",
                false, true),
            new("VAG-PDI-004","PDI-004","UNI-EMB","Analista de Pesquisa Sensorial", SeniorityLevel.Pleno,
                "Planejamento e execução de testes sensoriais, análise de aceitação e suporte a decisão de portfolio.",
                false, true),
            new("VAG-PDI-005","PDI-005","UNI-SPC","Analista de Gestão de Portfolio", SeniorityLevel.Pleno,
                "Pipeline de inovação, priorização de projetos e alinhamento com comercial/marketing para lançamentos.",
                false, false),
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
            new("VAG-COM-001","COM-001","UNI-SPC","Executivo de Vendas - Atacado/Distribuidores", SeniorityLevel.Senior,
                "Gestão de distribuidores, políticas comerciais, mix, campanhas e acompanhamento de sell-in/sell-out.",
                false, false),
            new("VAG-COM-002","COM-002","UNI-SPC","Key Account - Grandes Redes", SeniorityLevel.Senior,
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
            new("VAG-TEC-001","TEC-001","UNI-SPC","Analista de Suporte - Service Desk", SeniorityLevel.Junior,
                "Atendimento N1/N2, gestão de chamados, inventário e suporte a usuários administrativos e fábrica.",
                false, false),
            new("VAG-TEC-002","TEC-002","UNI-EMB","Analista de Sistemas Industriais (MES/SCADA)", SeniorityLevel.Senior,
                "Sustentação de sistemas industriais, integrações com coleta de dados e suporte a automação/rastreabilidade.",
                true, true),
            new("VAG-TEC-003","TEC-003","UNI-SPC","Analista de ERP & Integrações", SeniorityLevel.Pleno,
                "Sustentação de ERP, cadastros mestres, integrações e apoio a processos de compras/finanças/produção.",
                false, false),
            new("VAG-TEC-004","TEC-004","UNI-SPC","Analista de Dados (BI) - KPIs Industriais", SeniorityLevel.Senior,
                "Dashboards, qualidade de dados e indicadores (OEE, perdas, produtividade) para tomada de decisão.",
                false, false),
            new("VAG-TEC-005","TEC-005","UNI-SPC","Analista de Segurança da Informação", SeniorityLevel.Pleno,
                "Políticas de segurança, acessos, vulnerabilidades e governança LGPD com visão corporativa.",
                false, false),
            new("VAG-OPS-006","OPS-003","UNI-EMB","Líder de Turno - Produção", SeniorityLevel.Coordenacao,
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
                true, true)
        };
    }
}
