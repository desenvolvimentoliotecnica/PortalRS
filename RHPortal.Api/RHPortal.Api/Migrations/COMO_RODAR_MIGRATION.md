# Como Rodar a Migration SQL do pgvector

## ⚠️ IMPORTANTE: Execute ANTES de testar!

Este arquivo SQL precisa ser executado no PostgreSQL para adicionar suporte a pgvector.

## Opção 1: Via pgAdmin ou DBeaver (Recomendado)

1. Abra pgAdmin ou DBeaver
2. Conecte ao banco de dados `rhportal_dev` (ou o nome do seu banco)
3. Abra o arquivo `AddEmbeddingSupport.sql` (localizado em `RHPortal.Api/Migrations/`)
4. Execute o script completo
5. Verifique se executou sem erros

## Opção 2: Via linha de comando (psql)

```bash
# Navegue até a pasta do projeto
cd "C:\Users\davio\Documents\Projetos\Qualiit RenderRH\Voltage.RenderRH\RHPortal.Api"

# Execute o script (ajuste usuário, host e nome do banco conforme necessário)
psql -U postgres -d rhportal_dev -f "RHPortal.Api/Migrations/AddEmbeddingSupport.sql"
```

**Se psql não estiver no PATH**, use o caminho completo:
```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d rhportal_dev -f "RHPortal.Api/Migrations/AddEmbeddingSupport.sql"
```

## Opção 3: Copiar e colar na ferramenta SQL

Abra o arquivo `AddEmbeddingSupport.sql` e copie/cole o conteúdo na sua ferramenta SQL favorita.

## ✅ Como Verificar se Funcionou

Após executar, rode este SQL para confirmar:

```sql
-- 1. Verifica extensão pgvector
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 2. Verifica colunas adicionadas em Vagas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Vagas' 
  AND column_name IN ('Embedding', 'EmbeddingGeneratedAtUtc');

-- 3. Verifica colunas adicionadas em Candidatos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Candidatos' 
  AND column_name IN ('Embedding', 'EmbeddingGeneratedAtUtc');

-- 4. Verifica índices criados
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE '%embedding%';
```

**Resultado esperado**:
- 1 linha na query 1 (extensão instalada)
- 2 linhas na query 2 (colunas em Vagas)
- 2 linhas na query 3 (colunas em Candidatos)
- 4 linhas na query 4 (índices criados)

## ❓ Problemas Comuns

### Erro: "permission denied to create extension"
**Solução**: Você precisa de permissões de superusuário. Execute como `postgres`:
```bash
psql -U postgres -d rhportal_dev -f AddEmbeddingSupport.sql
```

### Erro: "extension vector does not exist"
**Solução**: Instale pgvector no PostgreSQL primeiro:
```bash
# Ubuntu/Debian
sudo apt install postgresql-16-pgvector

# macOS (Homebrew)
brew install pgvector

# Windows
# Baixe o instalador em: https://github.com/pgvector/pgvector/releases
```

### Erro: "relation already exists"
**Solução**: A migration já foi executada antes. Isso é OK, pode ignorar.

## 🚀 Após a Migration

O sistema está pronto! Você pode:
1. Criar uma nova vaga → embedding será gerado automaticamente
2. Cadastrar um candidato → embedding será gerado automaticamente
3. Abrir tela de matching com `useAi=true` → usará matching híbrido

## 📞 Suporte

Se tiver problemas, verifique:
- PostgreSQL versão 12+ (recomendado: 14+)
- pgvector instalado e disponível
- Permissões de superusuário para criar extensão
