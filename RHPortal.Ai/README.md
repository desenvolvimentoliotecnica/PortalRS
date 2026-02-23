# RHPortal.Ai

Serviço de **matching por IA** usando **LangChain** e **busca vetorial**: compara requisitos da vaga e filtros de matching com o perfil dos candidatos e retorna a lista ordenada por similaridade (0 a 100).

## Fluxo

1. A API recebe `vaga_id` (e opcionalmente `tenant_id`).
2. Consulta o **PostgreSQL** (tabelas `Vagas`, `VagaRequisitos`, `Candidatos`, `CandidatoCompetencias`) e monta:
   - **Perfil da vaga**: título + `MatchingFiltrosRaw` + requisitos (nome e sinônimos).
   - **Perfil de cada candidato**: nome, CV (texto), resumo profissional, competências, cidade/UF.
3. Usa **LangChain** com **OpenAI Embeddings** para gerar vetores dos perfis.
4. **ChromaDB** (em memória) indexa os candidatos e faz **busca por similaridade** com o perfil da vaga.
5. Converte o score de similaridade em **0–100** e retorna a lista ordenada.

## Pré-requisitos

- Python 3.11+
- PostgreSQL com os dados do RHPortal (banco do tenant).
- Chave da API OpenAI (embeddings).

## Instalação

```bash
cd Voltage.RenderRH/RHPortal.Ai
python -m venv .venv
# Ativar o venv (não use "cd activate"):
# Windows CMD:
.venv\Scripts\activate.bat
# Windows PowerShell ou Git Bash:
source .venv/Scripts/activate
# Linux/Mac:
source .venv/bin/activate
pip install -r requirements.txt
# Copiar .env (Windows: copy .env.example .env)
cp .env.example .env
# Edite .env: DATABASE_URL e OPENAI_API_KEY
```

## Configuração (.env)

| Variável           | Descrição |
|--------------------|-----------|
| `DATABASE_URL`     | URL do PostgreSQL do tenant (ex.: `postgresql://user:pass@localhost:5432/dev_render`) |
| `OPENAI_API_KEY`   | Chave da OpenAI (para embeddings) |
| `TENANT_ID`        | (Opcional) Tenant para filtrar vagas/candidatos |
| `EMBEDDING_MODEL`  | (Opcional) Modelo de embeddings (padrão: `text-embedding-3-small`) |
| `MATCH_TOP_K`      | (Opcional) Máximo de candidatos no ranking (padrão: 100) |

## Executar

Host e porta vêm do **Liotecnica.Integration.RM/appsettings.Development.json** (seção `AiService`) ou do `.env` (`HOST`, `PORT`). Padrão: `0.0.0.0:8000`.

```bash
# Opção 1: via uvicorn (usa host/porta do config)
python -m app.main

# Opção 2: via uvicorn na linha de comando
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `GET http://localhost:8000/health`
- Matching: `POST http://localhost:8000/match` com body JSON:

```json
{
  "vaga_id": "uuid-da-vaga",
  "tenant_id": "dev",
  "limit": 50
}
```

Resposta:

```json
{
  "vaga_id": "...",
  "vaga_titulo": "Desenvolvedor .NET",
  "total_candidatos": 50,
  "matching": [
    { "candidato_id": "...", "nome": "Fulano", "email": "fulano@email.com", "similaridade": 87 },
    ...
  ]
}
```

## Integração com o RHPortal (.NET)

O frontend ou a API .NET pode chamar este serviço passando o `vaga_id` e o `tenant_id`, e exibir na tela de Matching os candidatos retornados com o campo `similaridade` (0–100).

## Tabelas utilizadas

- **Vagas**: `Id`, `TenantId`, `Titulo`, `MatchingFiltrosRaw`
- **VagaRequisitos**: `VagaId`, `Nome`, `SinonimosRaw`, `Obrigatorio`
- **Candidatos**: `Id`, `TenantId`, `Nome`, `Email`, `CvText`, `ResumoProfissional`, `Cidade`, `Uf`
- **CandidatoCompetencias**: `CandidatoId`, `Nome`, `Tipo`, `Nivel`

Se o banco usar nomes de tabelas/colunas em minúsculas, ajuste as queries em `app/db.py`.
