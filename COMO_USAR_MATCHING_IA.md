# Como usar o Matching por IA — passo a passo

Guia prático para o RH fazer o matching de candidatos × vaga usando o novo stack
de IA (Ollama + Qwen 2.5 + bge-m3 + pgvector). Escrito em PT-BR para leitura
direta, sem jargão técnico desnecessário.

> Pré-requisito: seed completo rodado. Veja `scripts/seed-rs-completo.sh`.

---

## 🎯 TL;DR — Fluxo rápido (5 passos)

```
1. Cadastrar Descrição de Cargo (DNALIO) ─→ base de comparação
2. Criar Vaga vinculada à Descrição + calibrar pesos (Competência/Localidade/etc)
3. Candidatos aplicam (pelo portal) OU RH cadastra manualmente
4. Reindexar embeddings UMA VEZ (ou quando texto mudar)
5. Abrir kanban da vaga → clicar no badge "Match X%" → ver breakdown explicável
```

**Os 3 passos que mais geram dúvida estão detalhados abaixo.**

---

## 1. Cadastrar a Descrição de Cargo (DNALIO)

O matching compara o CV do candidato contra a **Descrição de Cargo**, não contra
a vaga diretamente. A descrição é o template reutilizável (podem existir várias
vagas apontando para a mesma descrição).

Você pode cadastrar de 3 formas:

### 1.A — Importar .docx (mais rápido se já tem o template DNALIO)
- Ir em **Recrutamento → Descrições de Cargo → Importar .docx**
- Arrastar o arquivo Word (mesmo padrão DNALIO que vocês já usam)
- O parser extrai automaticamente: Atividades Específicas/Comuns, Vivências,
  Competências DNALIO/Liderança/Funcionais/Técnicas, Requisitos Obrigatórios,
  Formação, Experiência, Revisão, Gestor

### 1.B — Gerar por IA (mais rápido se não tem o Word pronto)
- Ir em **Recrutamento → Descrições de Cargo → Nova → Gerar com IA**
- Preencher só: Título + Área + Contexto breve
  (ex.: *"Analista Financeiro Pleno, SAP, contas a pagar, multinacional"*)
- Clicar **Gerar Template** → ~20-30 segundos
- Template completo DNALIO retorna populado; você edita o que quiser antes de salvar

### 1.C — Manual
- Ir em **Nova Descrição de Cargo**
- Preencher seção por seção (tab navegável: Identificação / Sumário / Atividades /
  Competências / Requisitos)

### ✅ Como saber se ficou bom
Após salvar, confira na tela de edição:
- **36+ itens** no total (somando todas as 8 categorias)
- Todas as 5 Competências DNALIO presentes (Prioridade ao Cliente, Alta
  Performance, Foco em Resultados, Responsabilidade Social, Senso de Justiça)
- Pelo menos 3 Requisitos Obrigatórios

---

## 2. Criar Vaga com pesos calibrados

### 2.1 Preencher dados básicos (aba "Identificação")
- Título, Código, Centro de Custo, Senioridade, Modalidade (Presencial/Híbrido/Remoto)
- **Importante**: vincular a Descrição de Cargo do passo 1

### 2.2 Calibrar os pesos do Matching (aba "Pesos do Matching")
Você tem **7 sliders** que devem somar **100**. Como distribuir:

| Critério | Quando aumentar | Quando diminuir |
|---|---|---|
| **Competência** | Vaga técnica — bater as atividades específicas do cargo é crítico | Vaga junior ou trainee — novato não tem histórico |
| **Experiência** | Senioridade Pleno/Senior | Estágios, aprendizes, primeiro emprego |
| **Formação** | Exige diploma específico (Engenharia, Medicina, Contábeis) | Operacional, administrativo básico |
| **Localidade** | Presencial e logística importa (ex.: operador de produção 1º turno 6h) | Remoto ou híbrido flexível |
| **Idioma** | Vaga internacional, comercial exterior | Vaga puramente interna |
| **Conhecimento Técnico** | Ferramentas específicas (SAP, AutoCAD, Kubernetes) | Cargo com pouca ferramenta especializada |
| **Vivência Específica** | Nicho (ex.: experiência em frigorífico, hospitalar) | Cargo generalista |

**Regra prática**: a soma tem que fechar em **100** (o indicador pinta verde/vermelho).
Se estiver vermelho, reajuste.

### 2.3 Raio máximo de distância
Campo **"Distância máxima (km)"** — candidatos mais longe zeram o critério Localidade.
Default: 50 km. Para vagas de produção com turnos, coloque **15-25 km**. Para
remoto, pode colocar 500+ km (irrelevante).

### 2.4 Match mínimo para passar
Campo **"% mínimo de match"** — threshold de "passa/não passa".
- **30** para processos amplos (triagem inicial)
- **50** para processos seletivos rigorosos (sêniors, especialistas)
- **70** só se tiver muito candidato e quer filtrar agressivo (pode perder bons)

> 💡 **Dica**: começar com 30 e subir conforme volume de candidatos permite.

### 2.5 Mudar para status "Aberta"
Quando salvar com `Status=Aberta`, a vaga passa a aceitar candidaturas.

---

## 3. Fazer o matching acontecer

### 3.A Reindexar embeddings (uma vez por tenant)
O matching híbrido precisa que os textos (descrições + CVs) estejam "traduzidos"
para vetores (embeddings) antes de calcular similaridade. Isso é feito uma vez,
e depois incrementalmente quando alguma coisa muda.

**Como reindexar**:
- Ir em `/app/assistente-ia`
- Na sidebar esquerda, clicar **"Reindexar embeddings"**
- Aguardar ~15-40 segundos (depende do volume)
- Toast mostra quantos itens + candidatos foram processados

**Quando reindexar novamente**:
- ✓ Depois de cadastrar/editar Descrição de Cargo
- ✓ Depois de importar CVs em massa
- ✗ **Não precisa** após editar vaga, pesos ou status — embeddings são da DescCargo
  e do CV, não da vaga em si

### 3.B Abrir kanban da vaga
- Ir em **Recrutamento → Kanban de Candidaturas**
- Filtrar por vaga (`VAG-FIN-001`, `VAG-RH-001`, etc)
- Cada candidato aparece como card nas colunas (Aplicada / Triagem / Entrevista /
  Teste / Proposta / Contratado)

### 3.C Ver o score de match
Cada card mostra um **badge colorido** no canto superior-direito com o match:

| Cor | Faixa | Significado |
|---|---|---|
| 🟢 Verde | ≥ 75% | Match excepcional — priorize |
| 🟡 Amarelo | 50-74% | Match bom — avalie |
| 🟠 Laranja | 30-49% | Match razoável — pode entrevistar |
| ⚪ Cinza | < 30% | Match baixo — revisitar só se faltar volume |

### 3.D Ver por que bateu (breakdown explicável)
**Clicar no badge "Match X%"** → abre o dialog `MatchingBreakdownDialog` com:

```
╔═══════════════════════════════════════════════════════════════╗
║  Match de Ana Carolina Silva com a vaga                       ║
║                                                               ║
║  Modo: [ Híbrido (IA) ]  [ Léxico puro ]    ← toggle          ║
║                                                               ║
║  Score final: 58%      ✅ Passa no mínimo                     ║
║  Distância: 3.3 km                                            ║
║                                                               ║
║  🧠 Por que a IA acha que bate:                              ║
║   66%  [AtividadeComum] Atender e responder chamados...       ║
║   64%  [RequisitoObrigatorio] Conhecimento técnico em HW/SW   ║
║   64%  [AtividadeEspecifica] Fornecer suporte técnico...      ║
║                                                               ║
║  Critérios (peso × score = contribuição):                     ║
║   Competência      35 × 28% =  9.8 pts  [████░░░░░]           ║
║   Experiência      15 × 50% =  7.5 pts  [██████░░░]           ║
║   Localidade       15 × 89% = 13.4 pts  [█████████]           ║
║   Conh. Técnico    25 × 64% = 16.0 pts  [██████░░░]           ║
║   Vivência         10 × 20% =  2.0 pts  [██░░░░░░░]           ║
║                                                               ║
║   ✓ Cobertos (2): ManageEngine Help Desk, Active Directory   ║
║   ✗ Faltando (6): relatórios, manutenção preventiva, ...      ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3.E Alternar modos Híbrido / Léxico
Toggle no topo do dialog:

- **Híbrido (IA)** — default, combina 30% léxico + 50% semântico + 20% localidade.
  Pega sinônimos, paráfrases, similaridade conceitual. Bate "help desk ≈ suporte técnico".
- **Léxico puro** — só TF-IDF + stemming + sinônimos explícitos.
  Mais rápido, mas só bate palavras/variantes exatas. Útil quando Ollama está fora.

Se você vir o banner **⚠️ Fallback — Ollama indisponível**, significa que o
servidor de IA caiu, e o sistema automaticamente mostrou o léxico. Nada quebra.

---

## 4. Exemplos reais (do seed atual)

### Vaga: Analista Financeiro Jr (VAG-FIN-001)
Peso calibrado: Competência 30 / Experiência 20 / Formação 10 / Localidade 15 / Idioma 0 / Conh.Téc 20 / Vivência 5

| Candidato | Perfil | Score Híbrido | Decisão RH |
|---|---|---|---|
| **Rafael Souza** | 3 anos SAP, CRC, Excel avançado | **46** ✅ | Entrevistar com prioridade |
| **Amanda Lima** | Recém-formada, estágio com TOTVS | **22** | Considerar como backup |
| **Gabriel Mendes** | Contábil recém-formado, sem ERP | **18** | Passar para banco de talentos |

### Vaga: Analista RH Pleno (VAG-RH-001)
Peso: Competência 30 / Experiência 25 / Formação 10 / Localidade 10 / Conh.Téc 15 / Vivência 10

| Candidato | Perfil | Score | Decisão |
|---|---|---|---|
| **Paula Fernandes** | 5 anos, LGPD, DP, ATS Gupy | **46** ✅ | Avançar para proposta |
| **Luís Almeida** | 2 anos Jr, quer pleno | **25** | Entrevistar só se Paula recusar |
| **Beatriz Santos** | Psicologia, estágio 10m | **17** | Processar mais tarde |

### Vaga: Operador de Produção 1º Turno (VAG-PROD-001)
Peso: Competência 25 / Experiência 20 / Formação 5 / **Localidade 25** / Conh.Téc 15 / Vivência 10
(Localidade alta porque é 1º turno começando 6h — logística crítica)

| Candidato | Perfil | Score | Observação |
|---|---|---|---|
| **José Santana** | 4 anos alimentícia, NR-11/33, Embu | **45** ✅ | Contratado — modelo perfeito |
| **Antônio Pereira** | 2 anos farmacêutica, NR-11, Taboão | **36** ✅ | Cobertura pra 2ª vaga |
| **Carlos Eduardo** | Auxiliar 8 meses, sem NR, Cotia | **27** | Borderline; treinar NR seria viável |

---

## 5. Usar o Chatbot RAG para decisões em lote

O assistente em `/app/assistente-ia` é útil quando você quer **entender o conjunto**
em vez de olhar candidato por candidato. Exemplos de perguntas:

| Pergunta | O que o RAG faz |
|---|---|
| *"Quais candidatos da vaga VAG-FIN-001 têm experiência com SAP?"* | Busca semanticamente nos CVs + retorna lista priorizada |
| *"Resuma o perfil ideal da vaga de Analista Financeiro"* | Lê os 28 itens DNALIO da descrição e sumariza |
| *"O que falta na Ana Silva pra ser considerada ideal?"* | Compara CV dela × DescCargo × retorna gaps priorizados |
| *"Qual faixa salarial justa para Analista RH Pleno em Embu?"* | Usa histórico interno de vagas similares + categoria salarial |

O chat **sempre cita as fontes** com `[Fonte N]` — você pode auditar de onde ele tirou
cada afirmação.

**Importante**: respostas demoram 10-20s num Mac M1/M2 (~3-5s com GPU). É a IA
local rodando — nenhum dado sai do seu host.

---

## 6. Dicas avançadas

### 6.1 Por que mesmo o "PERFEITO" não chega em 80-90%?
Os scores típicos ficam em **40-60** para candidatos excelentes. Razões:
1. Frases de template DNALIO são longas — mesmo stemming + embeddings não casam tudo
2. Requisitos obrigatórios faltando penalizam
3. O algoritmo é conservador (prefere pouco em vez de inflar)

**O que importa é a DIFERENÇA entre candidatos, não o valor absoluto.**
Se Ana=58 e Bruno=42, o ranking está correto mesmo ambos abaixo de 70.

### 6.2 Quando trocar de Híbrido para Léxico?
- **Híbrido**: default, sempre. Melhor resultado.
- **Léxico**: apenas para auditoria ("me mostra exatamente quais tokens bateram") ou
  quando o Ollama está fora do ar (fallback automático).

### 6.3 Performance esperada
| Operação | Tempo aproximado |
|---|---|
| Health check do Ollama | 50 ms |
| Gerar embedding de 1 candidato (bge-m3) | ~200 ms |
| Calcular matching híbrido (candidato já indexado) | ~300 ms |
| Re-indexação completa de 100 itens + 20 candidatos | ~40-60 s |
| Chat RAG 1 resposta (Qwen 2.5 7B, CPU) | 10-20 s |
| Chat RAG 1 resposta (Qwen 2.5 7B, GPU M1/M2) | 2-5 s |

### 6.4 Auditoria — onde ver o que foi indexado
```sql
-- Quantos itens + candidatos estão indexados?
SELECT (SELECT COUNT(*) FROM "DescricaoCargoItemEmbeddings" WHERE "Embedding" IS NOT NULL) AS itens_ok,
       (SELECT COUNT(*) FROM "CandidatoEmbeddings" WHERE "Embedding" IS NOT NULL) AS candidatos_ok;

-- Ver os itens mais similares ao CV de um candidato específico
SELECT LEFT(i."Texto", 80) AS item,
       ROUND((1 - (ie."Embedding" <=> ce."Embedding"))::numeric, 3) AS similaridade
FROM "DescricaoCargoItemEmbeddings" ie
JOIN "DescricaoCargoItens" i ON i."Id" = ie."DescricaoCargoItemId"
JOIN "CandidatoEmbeddings" ce ON ce."CandidatoId" = '<UUID do candidato>'
ORDER BY ie."Embedding" <=> ce."Embedding"
LIMIT 10;
```

---

## 7. Troubleshooting

| Problema | Diagnóstico | Solução |
|---|---|---|
| Todos candidatos com score 0 | Vaga sem Descrição de Cargo vinculada | Editar vaga → aba Identificação → escolher Descrição |
| Badge mostra "🧠 Fallback" | Ollama offline | `ollama serve &` ou verificar `curl http://localhost:11434/api/version` |
| Score não mudou após editar CV | Embeddings desatualizados | Reindexar via `/assistente-ia → Reindexar` |
| Chat "Não sei, verifique o Ollama" | Modelo não carregado | `ollama pull qwen2.5:7b && ollama pull bge-m3` |
| Matching muito lento (>5s) | Cold start do modelo | Primeira chamada sempre é mais lenta; subsequentes são rápidas |
| Candidato perfeito não passa no mínimo | Match mínimo muito alto | Baixar `MatchMinimoPercentual` para 30 na vaga |

---

## 8. Cheat-sheet

```bash
# Reindexar tudo (CLI)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  "http://localhost:5056/api/assistente-ia/embeddings/reindexar?force=true"

# Disparar matching direto (sem UI)
curl -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  "http://localhost:5056/api/vagas/<VAGA_ID>/matching-breakdown-hybrid/<CANDIDATO_ID>"

# Chat RAG
curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  -H "Content-Type: application/json" \
  -d '{"message":"Quais candidatos tem SAP?"}' \
  "http://localhost:5056/api/assistente-ia/chat"

# Gerar DescCargo
curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Analista Contábil Pleno","areaOuDepartamento":"Contabilidade","contextoAdicional":"SPED, ECF, SAP"}' \
  "http://localhost:5056/api/assistente-ia/descricao-cargo/gerar"

# Resumir CV
curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  "http://localhost:5056/api/assistente-ia/cv/resumir/<CANDIDATO_ID>?force=true"

# Sugerir salário
curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  "http://localhost:5056/api/assistente-ia/vagas/sugerir-salario/<VAGA_ID>"
```

Onde `$TOKEN` vem de:
```bash
TOKEN=$(curl -sS -X POST http://localhost:5056/api/auth/login \
  -H "Content-Type: application/json" -H "X-Tenant-Id: liotecnica" \
  -d '{"email":"admin@dev.local","password":"YkmF@2022*"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
```
