using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class JobPositionSeeder
{
    public static async Task EnsureAsync(AppDbContext db, CancellationToken ct)
    {
        var areaIdByCode = await db.Areas
            .AsNoTracking()
            .ToDictionaryAsync(a => a.Code, a => a.Id, ct);

        Guid GetAreaId(string areaCode)
        {
            if (!areaIdByCode.TryGetValue(areaCode, out var id))
                throw new InvalidOperationException($"Area '{areaCode}' nao foi encontrada no seed.");
            return id;
        }

        var existingCodes = await db.JobPositions
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync(ct);

        var existingCodesSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        static string MakeCode(string areaCode, int seq) => $"CAR-{areaCode}-{seq:000}";

        var cargos = new (string AreaCode, string Name, SeniorityLevel Seniority, string Type, string Description)[]
        {
            ("OPS","Operador de Producao (Linha)", SeniorityLevel.Junior, "Operacional", "Operacao de linha de envase/embalagem e rotina 5S."),
            ("OPS","Operador de Maquina de Envase", SeniorityLevel.Pleno, "Operacional", "Setup, ajuste e operacao de maquinas de envase."),
            ("OPS","Lider de Turno (Producao)", SeniorityLevel.Coordenacao, "Lideranca", "Gestao do turno, metas, seguranca e qualidade na producao."),
            ("OPS","Supervisor de Producao", SeniorityLevel.Gerencia, "Gestao", "Acompanha indicadores (OEE, perdas, paradas) e produtividade."),
            ("OPS","Tecnico de Processos (Chao de fabrica)", SeniorityLevel.Pleno, "Tecnico", "Padronizacao de processos e melhoria continua (Kaizen)."),
            ("OPS","Analista de PCP (Operacoes)", SeniorityLevel.Pleno, "Administrativo", "Planejamento e controle de producao, sequenciamento e apontamentos."),
            ("OPS","Encarregado de Embalagem", SeniorityLevel.Coordenacao, "Lideranca", "Coordena equipe de embalagem e controle de consumo."),
            ("OPS","Operador de Caldeira", SeniorityLevel.Senior, "Operacional", "Operacao e rotinas de seguranca em caldeiras/utilidades."),
            ("OPS","Operador de Camara Fria", SeniorityLevel.Junior, "Operacional", "Controle de armazenagem refrigerada e FIFO/FEFO."),
            ("OPS","Analista de Eficiencia (OEE)", SeniorityLevel.Especialista, "Especialista", "Analise de perdas, paradas e planos de acao."),

            ("QUA","Assistente de Qualidade", SeniorityLevel.Junior, "Administrativo", "Registros, tratativas de nao conformidade e suporte a qualidade."),
            ("QUA","Tecnico de Controle de Qualidade", SeniorityLevel.Pleno, "Tecnico", "Inspecoes em processo, coleta e analises basicas."),
            ("QUA","Analista de Qualidade", SeniorityLevel.Senior, "Especialista", "Garantia da qualidade, indicadores e auditorias internas."),
            ("QUA","Especialista em BPF/APPCC", SeniorityLevel.Especialista, "Especialista", "Implantacao e manutencao de BPF/APPCC."),
            ("QUA","Coordenador de Qualidade", SeniorityLevel.Coordenacao, "Gestao", "Coordena rotina de qualidade e seguranca de alimentos."),
            ("QUA","Analista de Rastreabilidade", SeniorityLevel.Pleno, "Administrativo", "Controle de lotes, rastreabilidade e simulado de recall."),
            ("QUA","Auditor Interno de Qualidade", SeniorityLevel.Senior, "Especialista", "Auditorias internas e suporte a certificacoes."),
            ("QUA","Analista de Laboratorio (Microbiologia)", SeniorityLevel.Pleno, "Tecnico", "Analises microbiologicas e liberacao de produto."),
            ("QUA","Analista de Laboratorio (Fisico-Quimico)", SeniorityLevel.Pleno, "Tecnico", "Analises fisico-quimicas e controle de especificacoes."),
            ("QUA","Gerente de Qualidade & Seguranca de Alimentos", SeniorityLevel.Diretoria, "Gestao", "Estrategia de qualidade, compliance e governanca."),

            ("ENG","Tecnico de Manutencao (Mecanica)", SeniorityLevel.Pleno, "Tecnico", "Manutencao preventiva/corretiva em equipamentos industriais."),
            ("ENG","Tecnico de Manutencao (Eletrica)", SeniorityLevel.Pleno, "Tecnico", "Manutencao eletrica, paineis e comandos."),
            ("ENG","Analista de Manutencao (PCM)", SeniorityLevel.Senior, "Administrativo", "Planejamento, ordens de servico, MTBF/MTTR."),
            ("ENG","Engenheiro de Manutencao", SeniorityLevel.Gerencia, "Gestao", "Gestao de manutencao, confiabilidade e orcamento."),
            ("ENG","Engenheiro de Processos", SeniorityLevel.Senior, "Especialista", "Otimizacao de processos, perdas e produtividade."),
            ("ENG","Tecnico de Automacao", SeniorityLevel.Senior, "Tecnico", "CLPs, IHMs e instrumentacao industrial."),
            ("ENG","Coordenador de Engenharia", SeniorityLevel.Coordenacao, "Gestao", "Coordena projetos, melhorias e capex."),
            ("ENG","Analista de Utilidades", SeniorityLevel.Pleno, "Tecnico", "Gestao de utilidades: vapor, ar comprimido, agua gelada."),
            ("ENG","Especialista em Confiabilidade", SeniorityLevel.Especialista, "Especialista", "RCM, analise de falhas e planos de confiabilidade."),
            ("ENG","Supervisor de Manutencao", SeniorityLevel.Gerencia, "Gestao", "Coordena equipe, paradas programadas e indicadores."),

            ("SCM","Analista de Logistica", SeniorityLevel.Pleno, "Administrativo", "Recebimento, armazenagem, expedicao e transporte."),
            ("SCM","Comprador (Materia-prima)", SeniorityLevel.Pleno, "Administrativo", "Compras de insumos e negociacoes com fornecedores."),
            ("SCM","Comprador Senior", SeniorityLevel.Senior, "Administrativo", "Estrategia de compras, contratos e reducao de custos."),
            ("SCM","Planejador de Demanda", SeniorityLevel.Senior, "Especialista", "Previsao de demanda e S&OP."),
            ("SCM","Analista de Estoques", SeniorityLevel.Pleno, "Administrativo", "Acuracidade, inventario e giro de estoque."),
            ("SCM","Supervisor de Expedicao", SeniorityLevel.Coordenacao, "Lideranca", "Coordena expedicao, carregamento e SLA."),
            ("SCM","Coordenador de Supply Chain", SeniorityLevel.Gerencia, "Gestao", "Integra compras, PCP e logistica."),
            ("SCM","Analista de Transporte", SeniorityLevel.Pleno, "Administrativo", "Roteirizacao, frete e performance de transportadoras."),
            ("SCM","Analista de Armazem", SeniorityLevel.Junior, "Operacional", "Rotinas de armazem, conferencia e enderecamento."),
            ("SCM","Gerente de Supply Chain", SeniorityLevel.Diretoria, "Gestao", "Estrategia e governanca de supply chain."),

            ("PDI","Tecnico de P&D", SeniorityLevel.Pleno, "Tecnico", "Testes piloto, preparo de amostras e documentacao."),
            ("PDI","Analista de P&D (Produtos)", SeniorityLevel.Senior, "Especialista", "Desenvolvimento de produtos, formulacao e testes."),
            ("PDI","Especialista em Formulacao", SeniorityLevel.Especialista, "Especialista", "Formulacoes, estabilidade e reducao de custo."),
            ("PDI","Coordenador de P&D", SeniorityLevel.Coordenacao, "Gestao", "Coordena portfolio e pipelines de inovacao."),
            ("PDI","Gerente de P&D", SeniorityLevel.Gerencia, "Gestao", "Estrategia de inovacao e governanca de projetos."),

            ("COM","Executivo de Vendas (Key Account)", SeniorityLevel.Senior, "Comercial", "Gestao de contas, negociacoes e crescimento de receita."),
            ("COM","Analista de Trade Marketing", SeniorityLevel.Pleno, "Marketing", "Acoes em PDV, campanhas e materiais."),
            ("COM","Coordenador Comercial", SeniorityLevel.Coordenacao, "Gestao", "Coordena time comercial e metas."),
            ("COM","Gerente Comercial", SeniorityLevel.Gerencia, "Gestao", "Estrategia comercial, pricing e expansao."),
            ("COM","Analista de Marketing", SeniorityLevel.Junior, "Marketing", "Suporte a campanhas e comunicacao."),

            ("ADM","Assistente Administrativo (Planta)", SeniorityLevel.Junior, "Administrativo", "Rotinas administrativas da planta e apoio as areas."),
            ("FIN","Analista Financeiro", SeniorityLevel.Pleno, "Financeiro", "Fluxo de caixa, contas a pagar/receber e conciliacoes."),
            ("RH","Analista de RH (Generalista)", SeniorityLevel.Pleno, "RH", "Recrutamento, treinamento e apoio a liderancas."),
            ("TEC","Analista de Dados (BI)", SeniorityLevel.Senior, "Tecnologia", "Dashboards (KPI), qualidade de dados e governanca."),
            ("TEC","Desenvolvedor de Sistemas (ERP/Integracoes)", SeniorityLevel.Pleno, "Tecnologia", "APIs, integracoes e suporte ao ERP industrial.")
        };

        var seq = 1;
        foreach (var c in cargos)
        {
            var code = MakeCode(c.AreaCode, seq);

            if (!existingCodesSet.Contains(code))
            {
                db.JobPositions.Add(new JobPosition
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    Name = c.Name,
                    AreaId = GetAreaId(c.AreaCode),
                    Status = CargoStatus.Active,
                    Seniority = c.Seniority,
                    Type = c.Type,
                    Description = c.Description
                });

                existingCodesSet.Add(code);
            }

            seq++;
        }

        await db.SaveChangesAsync(ct);
    }
}
