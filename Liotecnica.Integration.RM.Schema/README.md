# Liotecnica.Integration.RM.Schema

Pacote de **rastreio** das tabelas e colunas do banco **Corporativo RM** (CORPORERM_HMG) usadas no processo de integração com o Portal RH.

## Objetivo

Centralizar em um único lugar:

- **Onde** estão as tabelas de **Área**, **Departamento**, **Cargo** e **Vaga** no RM
- **Quais colunas** cada tabela possui (para mapeamento com o Portal)
- Opção de **configurar** nomes diferentes via `appsettings` (RmSchema)

Assim, qualquer alteração no esquema do RM ou inclusão de novas entidades no processo fica rastreável neste pacote.

## Uso

- **Constantes**: `RmTableNames.Area`, `RmTableNames.Departamento`, `RmTableNames.Cargo`, `RmTableNames.Vaga`
- **Colunas**: `RmColumnNames.Area.Id`, `RmColumnNames.Area.ParentId`, etc.
- **Configurável**: bind de `RmSchemaOptions` na seção `RmSchema` para sobrescrever nomes de tabelas/schema.

## Ajuste ao esquema real

Quando o esquema real do banco CORPORERM_HMG for conhecido, atualize:

1. `RmTableNames.cs` – nomes reais das tabelas (e, se quiser, use `RmSchemaOptions` para configurar)
2. `RmColumnNames.cs` – nomes reais das colunas de cada tabela

Isso mantém o processo de integração alinhado ao RM em um único lugar.
