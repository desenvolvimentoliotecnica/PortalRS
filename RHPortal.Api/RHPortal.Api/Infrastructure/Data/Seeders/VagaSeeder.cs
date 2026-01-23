using Bogus;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class VagaSeeder
{
    private static readonly Dictionary<string, (string[] Prefixes, string[] Subjects)> TitlePatterns =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["OPS"] = (new[] { "Operador", "Auxiliar", "Lider" }, new[] { "Producao", "Envase", "Embalagem", "Higienizacao" }),
            ["QUA"] = (new[] { "Analista", "Tecnico", "Auditor" }, new[] { "Qualidade", "Laboratorio", "Rastreabilidade", "APPCC" }),
            ["ENG"] = (new[] { "Tecnico", "Analista", "Engenheiro" }, new[] { "Manutencao", "Automacao", "Utilidades", "Processos" }),
            ["SCM"] = (new[] { "Analista", "Comprador", "Supervisor" }, new[] { "PCP", "Logistica", "Estoque", "Transporte" }),
            ["PDI"] = (new[] { "Analista", "Tecnico" }, new[] { "Pesquisa", "Desenvolvimento", "Embalagens", "Sensorial" }),
            ["COM"] = (new[] { "Executivo", "Analista", "Key Account" }, new[] { "Vendas", "Trade Marketing", "Inteligencia de Mercado", "SAC" }),
            ["TEC"] = (new[] { "Analista", "Especialista", "Tecnico" }, new[] { "Suporte", "Sistemas", "Dados", "Seguranca da Informacao" }),
            ["FIN"] = (new[] { "Analista", "Coordenador" }, new[] { "Contas a Pagar", "Contas a Receber", "Tesouraria", "Custos" }),
            ["RH"] = (new[] { "Analista", "Assistente", "Coordenador" }, new[] { "Recrutamento & Selecao", "Treinamento", "Departamento Pessoal", "Comunicacao Interna" }),
            ["ADM"] = (new[] { "Analista", "Assistente", "Comprador" }, new[] { "Facilities", "Compliance", "Documentacao", "Servicos" })
        };

    public static async Task EnsureAsync(AppDbContext db, string tenantId, int targetCount, CancellationToken ct)
    {
        targetCount = Math.Max(0, targetCount);
        if (targetCount == 0)
            return;

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

        var existingCount = await db.Vagas.CountAsync(ct);
        if (existingCount >= targetCount)
            return;

        var existingCodes = await db.Vagas
            .AsNoTracking()
            .Select(v => v.Codigo)
            .ToListAsync(ct);

        var existingSet = existingCodes
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var faker = new Faker("pt_BR")
        {
            Random = new Randomizer(42)
        };

        var managersByArea = managers
            .GroupBy(m => m.AreaId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var cargosByArea = jobPositions
            .GroupBy(j => j.AreaId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var units = unitsByCode.Values.ToList();
        var departments = departmentsByCode.Values.ToList();

        var toCreate = targetCount - existingCount;
        var perArea = toCreate / areas.Count;
        var remainder = toCreate % areas.Count;

        var areaCounters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var toAdd = new List<Vaga>();

        foreach (var area in areas)
        {
            for (var i = 0; i < perArea; i++)
                AddVagaForArea(area);
        }

        for (var i = 0; i < remainder; i++)
            AddVagaForArea(faker.PickRandom(areas));

        if (toAdd.Count > 0)
        {
            db.Vagas.AddRange(toAdd);
            await db.SaveChangesAsync(ct);
        }

        void AddVagaForArea(Area areaEntity)
        {
            var areaCode = NormalizeAreaCode(areaEntity.Code);
            if (string.IsNullOrWhiteSpace(areaCode))
                return;

            var code = GetNextCode(areaCounters, areaCode, existingSet);
            var unit = units[faker.Random.Int(0, units.Count - 1)];
            var depEntity = ResolveDepartment(departmentsByCode, departments, areaCode, faker);

            var managerId =
                (managersByArea.TryGetValue(areaEntity.Id, out var mgrs) && mgrs.Count > 0)
                    ? mgrs[faker.Random.Int(0, mgrs.Count - 1)].Id
                    : managers[faker.Random.Int(0, managers.Count - 1)].Id;

            if (managerId == Guid.Empty)
                throw new InvalidOperationException("Nenhum manager valido encontrado.");

            var cargoId =
                (cargosByArea.TryGetValue(areaEntity.Id, out var cargos) && cargos.Count > 0)
                    ? cargos[faker.Random.Int(0, cargos.Count - 1)].Id
                    : jobPositions[faker.Random.Int(0, jobPositions.Count - 1)].Id;

            if (cargoId == Guid.Empty)
                throw new InvalidOperationException("Nenhum JobPosition valido encontrado.");

            var published = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-faker.Random.Int(3, 35)));
            var closing = published.AddDays(faker.Random.Int(10, 45));

            var senior = MapSenioridade(faker.PickRandom(Enum.GetValues<SeniorityLevel>()));
            var isShiftBased = IsShiftBased(faker, areaCode);
            var isOnSite = IsOnSite(faker, areaCode);

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
            var title = BuildTitle(faker, areaCode);
            var description = BuildDescription(faker, areaEntity);

            var vaga = new Vaga
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = code,
                Titulo = title,

                AreaId = areaEntity.Id,
                DepartmentId = depEntity.Id,

                Status = ParseEnumOrFirst<VagaStatus>("Aberta", "Open", "Ativa", "EmAberto"),
                Senioridade = senior,

                QuantidadeVagas = faker.Random.Int(1, 6),
                TipoContratacao = ParseEnumOrFirst<VagaTipoContratacao>("CLT", "Efetivo", "FullTime"),
                MatchMinimoPercentual = 70 + faker.Random.Int(0, 15),

                DescricaoInterna = description,
                DescricaoPublica = description,

                TagsKeywordsRaw = BuildKeywords(areaCode),
                TagsResponsabilidadesRaw = BuildResponsibilities(areaCode),

                AceitaPcd = true,
                LinguagemInclusiva = true,
                Confidencial = false,
                Urgente = faker.Random.Double() < 0.18,

                Modalidade = isOnSite
                    ? ParseEnumOrFirst<VagaModalidade>("Presencial", "OnSite")
                    : ParseEnumOrFirst<VagaModalidade>("Hibrido", "Hybrid", "Remoto", "Remote"),

                Regime = ParseEnumOrFirst<VagaRegimeJornada>("Integral", "FullTime"),
                CargaSemanalHoras = isShiftBased ? 44 : 40,
                Escala = isShiftBased
                    ? ParseEnumOrFirst<VagaEscalaTrabalho>("6x1", "6X1", "Turno")
                    : ParseEnumOrFirst<VagaEscalaTrabalho>("5x2", "5X2"),

                HoraEntrada = isShiftBased ? new TimeOnly(06, 00) : new TimeOnly(08, 00),
                HoraSaida = isShiftBased ? new TimeOnly(14, 00) : new TimeOnly(17, 00),
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
                DisponibilidadeParaViagens = faker.Random.Double() < 0.10,

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
            existingSet.Add(code);
        }
    }

    private static string NormalizeAreaCode(string? areaCode)
        => (areaCode ?? string.Empty).Trim().ToUpperInvariant();

    private static Department ResolveDepartment(
        IReadOnlyDictionary<string, Department> departmentsByCode,
        IReadOnlyList<Department> departments,
        string areaCode,
        Faker faker)
    {
        var depCodeFromArea = MapDepartmentCodeFromAreaCode(areaCode);
        if (!string.IsNullOrWhiteSpace(depCodeFromArea) &&
            departmentsByCode.TryGetValue(depCodeFromArea, out var dep))
        {
            return dep;
        }

        return departments[faker.Random.Int(0, departments.Count - 1)];
    }

    private static string? MapDepartmentCodeFromAreaCode(string? areaCode)
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

    private static string GetNextCode(
        IDictionary<string, int> areaCounters,
        string areaCode,
        HashSet<string> existingSet)
    {
        areaCounters.TryGetValue(areaCode, out var count);
        string code;
        do
        {
            count++;
            code = $"VAG-{areaCode}-{count:000}";
        }
        while (existingSet.Contains(code));

        areaCounters[areaCode] = count;
        return code;
    }

    private static bool IsShiftBased(Faker faker, string areaCode)
        => areaCode is "OPS" or "ENG" or "QUA"
            ? faker.Random.Bool(0.7f)
            : faker.Random.Bool(0.2f);

    private static bool IsOnSite(Faker faker, string areaCode)
        => areaCode is "OPS" or "ENG" or "QUA"
            ? faker.Random.Bool(0.85f)
            : faker.Random.Bool(0.4f);

    private static string BuildTitle(Faker faker, string areaCode)
    {
        if (!TitlePatterns.TryGetValue(areaCode, out var pattern))
        {
            pattern = (new[] { "Analista", "Assistente", "Tecnico" }, new[] { "Operacoes", "Processos", "Administrativo" });
        }

        var prefix = faker.PickRandom(pattern.Prefixes);
        var subject = faker.PickRandom(pattern.Subjects);
        var separator = prefix.Contains("Key Account", StringComparison.OrdinalIgnoreCase) ? " - " : " de ";
        return $"{prefix}{separator}{subject}";
    }

    private static string BuildDescription(Faker faker, Area area)
        => $"Atuar na area de {area.Name}. {faker.Lorem.Sentence(8)} {faker.Lorem.Sentence(8)}";

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
                ("Conciliacoes bancarias", (VagaPeso)3, false, 1, null, null, null, new[] { "Conciliacao", "Extrato" })
            },
            _ => new()
            {
                ("Comunicacao", (VagaPeso)3, true, null, null, null, null, new[] { "Comunicacao", "Boa comunicacao" }),
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
        "OPS" => "BPF;5S;Seguranca;OEE;Setup;Linha de producao;Rastreabilidade",
        "QUA" => "BPF;APPCC;HACCP;Auditoria;Nao conformidade;Rastreabilidade;Microbiologia",
        "ENG" => "Manutencao;PCM;MTBF;MTTR;Automacao;CLP;Utilidades",
        "SCM" => "PCP;FEFO;FIFO;Inventario;Expedicao;Transporte;WMS",
        "PDI" => "Formulacao;Estabilidade;Escalonamento;Embalagens;Sensorial;Inovacao",
        "COM" => "Key Account;Pricing;Trade;Sell-in;Sell-out;Campanhas",
        "TEC" => "BI;Integracoes;ERP;Dados;KPIs;Governanca",
        "RH" => "R&S;Treinamento;DP;Turnos;Onboarding",
        "FIN" => "Custos;Controladoria;Fiscal;Tesouraria;Conciliacao",
        _ => "Administrativo;Rotinas;Organizacao;Compliance"
    };

    private static string BuildResponsibilities(string areaCode) => areaCode switch
    {
        "OPS" => "Operar processos;Registrar producao;Seguir POPs;Garantir 5S;Reportar desvios",
        "QUA" => "Coletar amostras;Registrar analises;Tratar nao conformidades;Apoiar auditorias",
        "ENG" => "Executar manutencao;Prevenir falhas;Registrar OS;Apoiar paradas programadas",
        "SCM" => "Planejar/abastecer;Controlar estoque;Garantir FEFO;Apoiar expedicao",
        _ => "Apoiar rotina da area;Garantir organizacao;Cumprir prazos;Comunicar riscos"
    };
}
