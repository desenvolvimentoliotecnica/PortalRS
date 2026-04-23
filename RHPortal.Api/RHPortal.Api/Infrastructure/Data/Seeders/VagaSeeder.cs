using Bogus;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Localization;
using System.Text.Json;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class VagaSeeder
{
    private const string DefaultPatternKey = "DEFAULT";

    private sealed class VagaRequirementSeedFile
    {
        public Dictionary<string, List<VagaRequirementSeed>> Requirements { get; set; } = new();
    }

    private sealed class VagaRequirementSeed
    {
        public string Nome { get; set; } = string.Empty;
        public int Peso { get; set; }
        public bool Obrigatorio { get; set; }
        public int? AnosMinimos { get; set; }
        public string? Nivel { get; set; }
        public string? Avaliacao { get; set; }
        public string? Obs { get; set; }
        public List<string>? Sinonimos { get; set; }
    }

    private sealed class VagaSeedPatterns
    {
        public Dictionary<string, VagaTitlePattern> TitlePatterns { get; set; } = new();
        public Dictionary<string, string> Keywords { get; set; } = new();
        public Dictionary<string, string> Responsibilities { get; set; } = new();
        public Dictionary<string, string[]> Descriptions { get; set; } = new();
    }

    private sealed class VagaTitlePattern
    {
        public string[] Prefixes { get; set; } = Array.Empty<string>();
        public string[] Subjects { get; set; } = Array.Empty<string>();
    }

    public static async Task EnsureAsync(
        AppDbContext db,
        string tenantId,
        int targetCount,
        string? patternsFile,
        string? requirementsFile,
        int? randomSeed,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        targetCount = Math.Max(0, targetCount);
        if (targetCount == 0)
            return;

        var unitsByCode = await db.Units
            .AsNoTracking()
            .ToDictionaryAsync(x => x.Code, x => x, StringComparer.OrdinalIgnoreCase, ct);

        var funcionarios = await db.Funcionarios.AsNoTracking().ToListAsync(ct);
        var jobPositions = await db.JobPositions.AsNoTracking().ToListAsync(ct);

        // 31.2: CentroCusto absorveu Area+Department; seeder itera sobre centros ativos.
        var centrosCusto = await db.CentrosCusto.AsNoTracking()
            .Where(cc => cc.IsActive)
            .ToListAsync(ct);

        if (centrosCusto.Count == 0)
            throw new InvalidOperationException(localizer["SeedErrors.NoCentrosCusto"]);

        if (unitsByCode.Count == 0)
            throw new InvalidOperationException(localizer["SeedErrors.NoUnits"]);

        if (funcionarios.Count == 0)
            throw new InvalidOperationException(localizer["SeedErrors.NoFuncionarios"]);

        if (jobPositions.Count == 0)
            throw new InvalidOperationException(localizer["SeedErrors.NoJobPositions"]);

        var existingCount = await db.Vagas.CountAsync(ct);
        if (existingCount >= targetCount)
            return;

        var existingCodes = await db.Vagas
            .AsNoTracking()
            .Select(v => v.Codigo)
            .ToListAsync(ct);

        var existingSet = existingCodes
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var seed = randomSeed ?? 42;
        var faker = new Faker("pt_BR")
        {
            Random = new Randomizer(seed)
        };
        var patterns = LoadPatterns(patternsFile, localizer);
        var titlePatterns = NormalizeTitlePatterns(patterns.TitlePatterns);
        var keywords = NormalizeStringMap(patterns.Keywords);
        var responsibilities = NormalizeStringMap(patterns.Responsibilities);
        var descriptions = NormalizeTemplateMap(patterns.Descriptions);
        var requirements = NormalizeRequirements(LoadRequirements(requirementsFile, localizer).Requirements);

        var funcionariosByCentroCusto = funcionarios
            .Where(f => f.CentroCustoId.HasValue)
            .GroupBy(f => f.CentroCustoId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var cargosByCentroCusto = jobPositions
            .Where(j => j.CentroCustoId.HasValue)
            .GroupBy(j => j.CentroCustoId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var units = unitsByCode.Values.ToList();

        var toCreate = targetCount - existingCount;
        var perArea = toCreate / centrosCusto.Count;
        var remainder = toCreate % centrosCusto.Count;

        var areaCounters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var toAdd = new List<Vaga>();

        foreach (var cc in centrosCusto)
        {
            for (var i = 0; i < perArea; i++)
                AddVagaForCentroCusto(cc);
        }

        for (var i = 0; i < remainder; i++)
            AddVagaForCentroCusto(faker.PickRandom(centrosCusto));

        if (toAdd.Count > 0)
        {
            var autoDetectChanges = db.ChangeTracker.AutoDetectChangesEnabled;
            try
            {
                db.ChangeTracker.AutoDetectChangesEnabled = false;
                db.Vagas.AddRange(toAdd);
                db.ChangeTracker.DetectChanges();
                await db.SaveChangesAsync(ct);
            }
            finally
            {
                db.ChangeTracker.AutoDetectChangesEnabled = autoDetectChanges;
            }
        }

        void AddVagaForCentroCusto(CentroCusto ccEntity)
        {
            var areaCode = NormalizeAreaCode(ccEntity.Code);
            if (string.IsNullOrWhiteSpace(areaCode))
                return;

            var code = GetNextCode(areaCounters, areaCode, existingSet);
            var unit = units[faker.Random.Int(0, units.Count - 1)];

            if (!funcionariosByCentroCusto.TryGetValue(ccEntity.Id, out var funcs) || funcs.Count == 0)
            {
                if (funcionarios.Count == 0)
                    throw new InvalidOperationException(localizer["SeedErrors.NoValidFuncionario"]);
            }

            var cargoId =
                (cargosByCentroCusto.TryGetValue(ccEntity.Id, out var cargos) && cargos.Count > 0)
                    ? cargos[faker.Random.Int(0, cargos.Count - 1)].Id
                    : jobPositions[faker.Random.Int(0, jobPositions.Count - 1)].Id;

            if (cargoId == Guid.Empty)
                throw new InvalidOperationException(localizer["SeedErrors.NoValidJobPosition"]);

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
            var title = BuildTitle(faker, areaCode, titlePatterns, localizer);
            var description = BuildDescription(faker, ccEntity, descriptions, localizer);

            var vaga = new Vaga
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = code,
                Titulo = title,

                CentroCustoId = ccEntity.Id,

                Status = ParseEnumOrFirst<VagaStatus>("Aberta", "Open", "Ativa", "EmAberto"),
                Senioridade = senior,

                QuantidadeVagas = faker.Random.Int(1, 6),
                TipoContratacao = ParseEnumOrFirst<VagaTipoContratacao>("CLT", "Efetivo", "FullTime"),
                MatchMinimoPercentual = 70 + faker.Random.Int(0, 15),

                DescricaoInterna = description,
                DescricaoPublica = description,

                TagsKeywordsRaw = BuildKeywords(areaCode, keywords, localizer),
                TagsResponsabilidadesRaw = BuildResponsibilities(areaCode, responsibilities, localizer),

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

            var reqs = BuildRequirements(areaCode, requirements, localizer);
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

    private static string BuildTitle(
        Faker faker,
        string areaCode,
        IReadOnlyDictionary<string, VagaTitlePattern> titlePatterns,
        IStringLocalizer<SeedMessages> localizer)
    {
        var pattern = GetTitlePattern(titlePatterns, areaCode, localizer);
        var prefix = faker.PickRandom(pattern.Prefixes);
        var subject = faker.PickRandom(pattern.Subjects);
        var separator = prefix.Contains("Key Account", StringComparison.OrdinalIgnoreCase) ? " - " : " de ";
        return $"{prefix}{separator}{subject}";
    }

    private static VagaTitlePattern GetTitlePattern(
        IReadOnlyDictionary<string, VagaTitlePattern> titlePatterns,
        string areaCode,
        IStringLocalizer<SeedMessages> localizer)
    {
        if (titlePatterns.TryGetValue(areaCode, out var pattern) &&
            pattern.Prefixes.Length > 0 &&
            pattern.Subjects.Length > 0)
        {
            return pattern;
        }

        if (titlePatterns.TryGetValue(DefaultPatternKey, out var fallback) &&
            fallback.Prefixes.Length > 0 &&
            fallback.Subjects.Length > 0)
        {
            return fallback;
        }

        throw new InvalidOperationException(localizer["SeedErrors.TitlePatternsMissing", areaCode, DefaultPatternKey]);
    }

    private static string BuildDescription(
        Faker faker,
        CentroCusto centroCusto,
        IReadOnlyDictionary<string, string[]> descriptions,
        IStringLocalizer<SeedMessages> localizer)
    {
        var templates = GetPatternValues(descriptions, centroCusto.Code ?? string.Empty, "descriptions", localizer);
        var template = faker.PickRandom(templates);
        return ApplyDescriptionTemplate(faker, template, centroCusto);
    }

    private static VagaSeedPatterns LoadPatterns(string? patternsFile, IStringLocalizer<SeedMessages> localizer)
    {
        if (string.IsNullOrWhiteSpace(patternsFile))
            throw new InvalidOperationException(localizer["SeedErrors.PatternsFileRequired"]);

        var fullPath = Path.IsPathRooted(patternsFile)
            ? patternsFile
            : Path.Combine(AppContext.BaseDirectory, patternsFile);

        if (!File.Exists(fullPath))
            throw new FileNotFoundException(localizer["SeedErrors.PatternsFileNotFound", fullPath]);

        var json = File.ReadAllText(fullPath);
        var patterns = JsonSerializer.Deserialize<VagaSeedPatterns>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (patterns is null)
            throw new InvalidOperationException(localizer["SeedErrors.PatternsFileInvalid"]);

        return patterns;
    }

    private static VagaRequirementSeedFile LoadRequirements(string? requirementsFile, IStringLocalizer<SeedMessages> localizer)
    {
        if (string.IsNullOrWhiteSpace(requirementsFile))
            throw new InvalidOperationException(localizer["SeedErrors.RequirementsFileRequired"]);

        var fullPath = Path.IsPathRooted(requirementsFile)
            ? requirementsFile
            : Path.Combine(AppContext.BaseDirectory, requirementsFile);

        if (!File.Exists(fullPath))
            throw new FileNotFoundException(localizer["SeedErrors.RequirementsFileNotFound", fullPath]);

        var json = File.ReadAllText(fullPath);
        var requirements = JsonSerializer.Deserialize<VagaRequirementSeedFile>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (requirements is null)
            throw new InvalidOperationException(localizer["SeedErrors.RequirementsFileInvalid"]);

        return requirements;
    }

    private static IReadOnlyDictionary<string, VagaTitlePattern> NormalizeTitlePatterns(Dictionary<string, VagaTitlePattern>? source)
    {
        var map = new Dictionary<string, VagaTitlePattern>(StringComparer.OrdinalIgnoreCase);
        if (source is null)
            return map;

        foreach (var kvp in source)
        {
            var key = NormalizePatternKey(kvp.Key);
            if (string.IsNullOrWhiteSpace(key) || kvp.Value is null)
                continue;

            map[key] = kvp.Value;
        }

        return map;
    }

    private static IReadOnlyDictionary<string, string> NormalizeStringMap(Dictionary<string, string>? source)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (source is null)
            return map;

        foreach (var kvp in source)
        {
            var key = NormalizePatternKey(kvp.Key);
            if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(kvp.Value))
                continue;

            map[key] = kvp.Value.Trim();
        }

        return map;
    }

    private static IReadOnlyDictionary<string, string[]> NormalizeTemplateMap(Dictionary<string, string[]>? source)
    {
        var map = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        if (source is null)
            return map;

        foreach (var kvp in source)
        {
            var key = NormalizePatternKey(kvp.Key);
            if (string.IsNullOrWhiteSpace(key) || kvp.Value is null)
                continue;

            var templates = kvp.Value
                .Select(t => (t ?? string.Empty).Trim())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .ToArray();

            if (templates.Length == 0)
                continue;

            map[key] = templates;
        }

        return map;
    }

    private static IReadOnlyDictionary<string, List<VagaRequirementSeed>> NormalizeRequirements(Dictionary<string, List<VagaRequirementSeed>>? source)
    {
        var map = new Dictionary<string, List<VagaRequirementSeed>>(StringComparer.OrdinalIgnoreCase);
        if (source is null)
            return map;

        foreach (var kvp in source)
        {
            var key = NormalizePatternKey(kvp.Key);
            if (string.IsNullOrWhiteSpace(key) || kvp.Value is null)
                continue;

            map[key] = kvp.Value;
        }

        return map;
    }

    private static string NormalizePatternKey(string? key)
        => (key ?? string.Empty).Trim().ToUpperInvariant();

    private static List<(string Nome, VagaPeso Peso, bool Obrigatorio, int? AnosMinimos, VagaRequisitoNivel? Nivel, VagaRequisitoAvaliacao? Avaliacao, string? Obs, IReadOnlyList<string>? Sinonimos)>
        BuildRequirements(
            string areaCode,
            IReadOnlyDictionary<string, List<VagaRequirementSeed>> requirements,
            IStringLocalizer<SeedMessages> localizer)
    {
        areaCode = (areaCode ?? "").Trim().ToUpperInvariant();

        if (!requirements.TryGetValue(areaCode, out var reqs) || reqs.Count == 0)
            throw new InvalidOperationException(localizer["SeedErrors.RequirementsMissingForArea", areaCode]);

        var result = new List<(string Nome, VagaPeso Peso, bool Obrigatorio, int? AnosMinimos, VagaRequisitoNivel? Nivel, VagaRequisitoAvaliacao? Avaliacao, string? Obs, IReadOnlyList<string>? Sinonimos)>(reqs.Count);
        foreach (var req in reqs)
        {
            if (string.IsNullOrWhiteSpace(req.Nome))
                continue;

            result.Add((
                req.Nome.Trim(),
                MapPeso(req.Peso),
                req.Obrigatorio,
                req.AnosMinimos,
                ParseEnumOrNull<VagaRequisitoNivel>(req.Nivel),
                ParseEnumOrNull<VagaRequisitoAvaliacao>(req.Avaliacao),
                req.Obs,
                req.Sinonimos));
        }

        if (result.Count == 0)
            throw new InvalidOperationException(localizer["SeedErrors.RequirementsEmptyForArea", areaCode]);

        return result;
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

    private static VagaPeso MapPeso(int peso)
    {
        var clamped = Math.Clamp(peso, 1, 5);
        return (VagaPeso)clamped;
    }

    private static TEnum? ParseEnumOrNull<TEnum>(string? name) where TEnum : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        return Enum.TryParse<TEnum>(name, true, out var value) ? value : null;
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

    private static string BuildKeywords(
        string areaCode,
        IReadOnlyDictionary<string, string> keywords,
        IStringLocalizer<SeedMessages> localizer)
        => GetPatternValue(keywords, areaCode, "keywords", localizer);

    private static string BuildResponsibilities(
        string areaCode,
        IReadOnlyDictionary<string, string> responsibilities,
        IStringLocalizer<SeedMessages> localizer)
        => GetPatternValue(responsibilities, areaCode, "responsibilities", localizer);

    private static string[] GetPatternValues(
        IReadOnlyDictionary<string, string[]> map,
        string areaCode,
        string name,
        IStringLocalizer<SeedMessages> localizer)
    {
        areaCode = NormalizePatternKey(areaCode);

        if (map.TryGetValue(areaCode, out var values) && values.Length > 0)
            return values;

        if (map.TryGetValue(DefaultPatternKey, out var fallback) && fallback.Length > 0)
            return fallback;

        throw new InvalidOperationException(localizer["SeedErrors.PatternValueMissing", name, areaCode, DefaultPatternKey]);
    }

    private static string GetPatternValue(
        IReadOnlyDictionary<string, string> map,
        string areaCode,
        string name,
        IStringLocalizer<SeedMessages> localizer)
    {
        if (map.TryGetValue(areaCode, out var value) && !string.IsNullOrWhiteSpace(value))
            return value;

        if (map.TryGetValue(DefaultPatternKey, out var fallback) && !string.IsNullOrWhiteSpace(fallback))
            return fallback;

        throw new InvalidOperationException(localizer["SeedErrors.PatternValueMissing", name, areaCode, DefaultPatternKey]);
    }

    private static string ApplyDescriptionTemplate(Faker faker, string template, CentroCusto centroCusto)
    {
        // Description do CC substitui Name (legado de Area): é a descrição apresentada ao usuário.
        var areaName = (centroCusto.Description ?? string.Empty).Trim();
        var areaCode = NormalizeAreaCode(centroCusto.Code);
        var resolvedName = string.IsNullOrWhiteSpace(areaName) ? areaCode : areaName;

        var result = template;
        var replacements = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["{AreaName}"] = resolvedName,
            ["{AreaCode}"] = areaCode,
            ["{Sentence}"] = faker.Lorem.Sentence(8),
            ["{Sentence2}"] = faker.Lorem.Sentence(8),
            ["{Sentence3}"] = faker.Lorem.Sentence(10)
        };

        foreach (var kvp in replacements)
            result = result.Replace(kvp.Key, kvp.Value, StringComparison.OrdinalIgnoreCase);

        return result.Trim();
    }
}
