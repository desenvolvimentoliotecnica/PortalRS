# 🧪 Guia de Testes - Sistema Híbrido de Matching

## ✅ Pré-requisitos (CONCLUÍDOS!)
- [x] pgvector instalado no PostgreSQL 18
- [x] Migration executada no banco `dev_render`
- [x] Serviços rodando: API .NET, Python RHPortal.Ai, Frontend

---

## 📋 Roteiro de Testes

### **Teste 1: Verificar Infraestrutura**

#### 1.1 Verificar que pgvector está funcionando
```sql
-- Rodar no PostgreSQL (dev_render)
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Deve retornar 1 linha

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Vagas' 
  AND column_name IN ('embedding', 'embedding_generated_at_utc');
-- Deve retornar 2 linhas
```

#### 1.2 Verificar que o Python está respondendo
```bash
curl http://localhost:8000/docs
# Deve abrir o Swagger do RHPortal.Ai
```

---

### **Teste 2: Criar uma Vaga (Gera Embedding Automaticamente)**

#### 2.1 Via Interface Web
1. Abra o portal: http://localhost:5051
2. Faça login como admin/owner
3. Vá em **Vagas** → **Nova Vaga**
4. Preencha os campos básicos:
   - Título: "Desenvolvedor Full Stack Sênior"
   - Área: Escolha qualquer
   - Descrição: "Profissional com experiência em .NET, React e PostgreSQL"
   - Modalidade: Remoto
   - Status: Aberta
5. **Salve a vaga**

#### 2.2 Verificar que o embedding foi gerado
```sql
-- Aguarde ~5 segundos após criar a vaga, depois rode:
SELECT 
    "Id",
    "Titulo",
    embedding IS NOT NULL as tem_embedding,
    embedding_generated_at_utc,
    array_length(embedding::float[], 1) as dimensoes
FROM "Vagas"
WHERE "Titulo" LIKE '%Full Stack%'
ORDER BY "CreatedAtUtc" DESC
LIMIT 1;

-- Resultado esperado:
-- tem_embedding = true
-- dimensoes = 1536
```

#### 2.3 Ver logs do Python
No terminal do Python (`RHPortal.Ai`), você deve ver:
```
INFO: POST /embeddings/vaga/{id} - 200 OK
```

---

### **Teste 3: Criar um Candidato (Gera Embedding Automaticamente)**

#### 3.1 Via Interface Web (Portal Público)
1. Abra: http://localhost:5051/candidatura-publica/{vaga-id}
   (Copie o ID da vaga criada no Teste 2)
2. Preencha o formulário:
   - Nome: "João Silva"
   - Email: "joao@example.com"
   - Telefone: "11999999999"
   - Resumo: "Desenvolvedor com 5 anos de experiência em .NET Core e React"
   - Upload de currículo (PDF opcional)
3. **Envie a candidatura**

#### 3.2 Verificar que o embedding foi gerado
```sql
-- Aguarde ~5 segundos, depois rode:
SELECT 
    "Id",
    "Nome",
    "Email",
    embedding IS NOT NULL as tem_embedding,
    embedding_generated_at_utc,
    array_length(embedding::float[], 1) as dimensoes
FROM "Candidatos"
WHERE "Nome" = 'João Silva'
ORDER BY "CreatedAtUtc" DESC
LIMIT 1;

-- Resultado esperado:
-- tem_embedding = true
-- dimensoes = 1536
```

---

### **Teste 4: Matching Híbrido (O GRANDE TESTE! 🎯)**

#### 4.1 Via Interface Web
1. Volte para a vaga criada no Teste 2
2. Clique em **"Ver Candidatos" ou "Matching"**
3. **IMPORTANTE**: Certifique-se de que o toggle **"Usar IA"** está ATIVADO
4. Aguarde o carregamento (pode demorar ~10-30 segundos na primeira vez)

#### 4.2 O que deve acontecer:
- Sistema detecta que a vaga **NÃO** tem filtros específicos (`MatchingFiltrosRaw` vazio)
- Usa **busca vetorial pura** (pgvector) - SUPER RÁPIDO (~50ms)
- Retorna candidatos ordenados por similaridade (0-100)

#### 4.3 Via API (curl/Postman)
```bash
# Substitua {vaga-id} pelo ID da vaga criada
curl -X GET "http://localhost:5000/api/vagas/{vaga-id}/matching-candidates?useAi=true&minScore=0&take=10" \
  -H "Authorization: Bearer {seu-token}" \
  -H "Content-Type: application/json"
```

**Resposta esperada:**
```json
[
  {
    "candidatoId": "...",
    "nome": "João Silva",
    "email": "joao@example.com",
    "similaridade": 85,  // Score 0-100 baseado na similaridade vetorial
    "matchedByAi": true,
    "calculatedAtUtc": "2026-02-11T14:24:00Z"
  }
]
```

---

### **Teste 5: Matching com Filtros (LLM Preciso)**

#### 5.1 Editar a vaga para adicionar filtros
1. Edite a vaga criada no Teste 2
2. Vá até a seção **"Matching por IA"**
3. Adicione filtros específicos, exemplo:
```json
{
  "experiencia_minima_anos": 3,
  "tecnologias_obrigatorias": ["C#", ".NET Core"],
  "nivel_ingles": "intermediário"
}
```
4. **Salve**

#### 5.2 Rodar matching novamente
- Mesma interface do Teste 4.1
- Agora o sistema vai usar **LLM** (mais lento ~10-30s, mas mais preciso)
- Candidatos serão avaliados pelos critérios específicos

---

### **Teste 6: Performance e Logs**

#### 6.1 Verificar tempo de resposta

**Sem filtros (pgvector):**
```bash
time curl -X GET "http://localhost:5000/api/vagas/{vaga-id}/matching-candidates?useAi=true" \
  -H "Authorization: Bearer {token}"
```
**Esperado**: < 1 segundo para até 100 candidatos

**Com filtros (LLM):**
```bash
time curl -X GET "http://localhost:5000/api/vagas/{vaga-id}/matching-candidates?useAi=true" \
  -H "Authorization: Bearer {token}"
```
**Esperado**: 10-30 segundos (dependendo de quantos candidatos)

#### 6.2 Logs para monitorar

**Terminal Python (`RHPortal.Ai`):**
```
INFO: POST /match-hybrid - Vaga TEM filtros, usando LLM
INFO: POST /match-vector - Busca vetorial em 50ms
```

**Terminal .NET:**
```
[Information] RHPortal.Ai /match-hybrid returned 200
[Warning] Falha ao gerar embedding para vaga {id}  // Se der erro
```

---

### **Teste 7: Testar Endpoints Python Diretos**

#### 7.1 Gerar embedding manualmente
```bash
# Gerar embedding de uma vaga existente
curl -X POST "http://localhost:8000/embeddings/vaga/{vaga-id}?tenant_id=dev" \
  -H "Content-Type: application/json"

# Resposta esperada:
# {"success": true, "entity_id": "...", "message": "Embedding gerado e salvo com sucesso"}
```

#### 7.2 Busca vetorial pura
```bash
curl -X POST "http://localhost:8000/match-vector" \
  -H "Content-Type: application/json" \
  -d '{
    "vaga_id": "{vaga-id}",
    "tenant_id": "dev",
    "limit": 10
  }'
```

#### 7.3 Calcular similaridade entre vaga e candidato
```bash
curl -X POST "http://localhost:8000/similarity" \
  -H "Content-Type: application/json" \
  -d '{
    "vaga_id": "{vaga-id}",
    "candidato_id": "{candidato-id}",
    "tenant_id": "dev"
  }'

# Resposta:
# {"vaga_id": "...", "candidato_id": "...", "similaridade": 85}
```

---

## 🐛 Problemas Comuns e Soluções

### Erro: "Embedding não foi gerado"
**Causa**: RHPortal.Ai não conseguiu se conectar ao banco ou OpenAI

**Solução**:
```bash
# Verifique as variáveis de ambiente no Python
cd RHPortal.Ai
cat .env

# Deve ter:
DATABASE_URL=postgresql://postgres:admin@localhost:5432/dev_render
OPENAI_API_KEY=sk-proj-...
```

### Erro: "No matching distribution found for pgvector"
**Causa**: Python não instalou a lib pgvector

**Solução**:
```bash
cd RHPortal.Ai
pip install pgvector
```

### Matching retorna lista vazia
**Causa**: Nenhum candidato tem embedding gerado ainda

**Solução**:
```sql
-- Verificar quantos candidatos têm embedding
SELECT COUNT(*) FROM "Candidatos" WHERE embedding IS NOT NULL;

-- Se retornar 0, force a geração:
-- Crie um novo candidato via portal público
```

---

## 📊 Verificação Final: Tudo Funcionando?

Execute este checklist:

```sql
-- 1. Extensão pgvector OK?
SELECT extname FROM pg_extension WHERE extname = 'vector';
-- ✅ Deve retornar 1 linha

-- 2. Quantas vagas têm embedding?
SELECT COUNT(*) FROM "Vagas" WHERE embedding IS NOT NULL;
-- ✅ Deve ser > 0

-- 3. Quantos candidatos têm embedding?
SELECT COUNT(*) FROM "Candidatos" WHERE embedding IS NOT NULL;
-- ✅ Deve ser > 0

-- 4. Índices criados?
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE indexname LIKE '%embedding%';
-- ✅ Deve retornar 4 linhas
```

---

## 🎯 Resumo: Sistema 100% Funcional Quando...

1. ✅ Criar vaga → embedding gerado automaticamente
2. ✅ Criar candidato → embedding gerado automaticamente
3. ✅ Matching com `useAi=true`:
   - Vaga **sem** filtros → busca vetorial (rápida)
   - Vaga **com** filtros → LLM (precisa)
4. ✅ Performance < 10s para 100 candidatos

---

## 🚀 Próximos Passos (Opcional)

1. **Gerar embeddings em massa** para vagas/candidatos existentes
2. **Ajustar pesos** do matching híbrido no Python
3. **Monitorar custos** da OpenAI API
4. **Otimizar índices** ivfflat quando tiver mais dados (>1000 registros)

---

**Pronto para testar!** 🎉
Comece pelo **Teste 2** (criar vaga) e depois **Teste 3** (criar candidato).
