# Liotecnica.Integration.RM.Schema.Tables

Pasta para **salvar o retorno do schema** do banco Corporativo RM (CORPORERM_HMG).

Ao rodar o projeto Liotecnica.Integration.RM, são gerados aqui:

- **schema_tabelas.json** – Lista de todas as tabelas do banco (INFORMATION_SCHEMA.TABLES): TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE. Use para descobrir os nomes reais das tabelas (área, departamento, cargo, vaga).
- **schema_colunas.json** – Lista de todas as colunas (INFORMATION_SCHEMA.COLUMNS): TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE. Use para mapear colunas ao [Liotecnica.Integration.RM.Schema](../Liotecnica.Integration.RM.Schema) (RmColumnNames).
- **area.json**, **departamento.json**, **cargo.json**, **vaga.json** – Dados extraídos das tabelas (após configurar os nomes corretos em RmSchema). O **cargo.json** (PCARGO) é usado na integração como **Categoria** no portal (`api/requisito-categorias`).

Analise `schema_tabelas.json` e `schema_colunas.json` para identificar onde estão área, departamento, cargo e vaga no RM; depois ajuste RmSchema no appsettings.

**Tabelas identificadas (menu CADASTROS e pré-cadastro):** veja [TABELAS_RM_IDENTIFICADAS.md](TABELAS_RM_IDENTIFICADAS.md).
