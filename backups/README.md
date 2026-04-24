# Backups do banco de dados

Dumps dos 3 bancos do ambiente de desenvolvimento, em formato **custom**
(compactado, permite restore seletivo por tabela).

## Arquivos

| Arquivo | Tamanho | O que contém |
|---|---|---|
| `dev_render.dump` | ~1.3 MB | Banco default (usado quando tenant não está em tenants específicos) |
| `dev_render_master.dump` | ~19 KB | Master DB — metadados de tenants e owner (`MasterDbContext`) |
| `dev_render_liotecnica.dump` | ~5.7 MB | Tenant LIOTECNICA — dados operacionais (vagas, candidatos, IA embeddings, DNALIO, etc) |

## Restore

### Opção 1 — restore completo (recria banco do zero)

```bash
# 1. Dropa e recria o banco
PGPASSWORD='@FelipeL89*' dropdb   -h localhost -U postgres dev_render_liotecnica
PGPASSWORD='@FelipeL89*' createdb -h localhost -U postgres dev_render_liotecnica

# 2. Restaura
PGPASSWORD='@FelipeL89*' /Library/PostgreSQL/18/bin/pg_restore \
    -h localhost -U postgres \
    -d dev_render_liotecnica \
    --no-owner --no-acl \
    backups/dev_render_liotecnica.dump
```

### Opção 2 — restore seletivo (só 1 tabela)

```bash
# Lista o conteúdo do dump
pg_restore --list backups/dev_render_liotecnica.dump | grep -i "Vagas\b"

# Restaura só a tabela Vagas
pg_restore -h localhost -U postgres -d dev_render_liotecnica \
    -t Vagas backups/dev_render_liotecnica.dump
```

## Versionamento

Os dumps **ficam versionados no git** a pedido do usuário (ambiente de dev,
nada de produção aqui). Diffs de dump binário são opacos — se quiser ver o que
mudou entre 2 versões, use:

```bash
pg_restore --list backups/dev_render_liotecnica.dump > /tmp/atual.lst
git show HEAD~1:backups/dev_render_liotecnica.dump | pg_restore --list > /tmp/antigo.lst
diff /tmp/antigo.lst /tmp/atual.lst
```

## Regenerar os backups

```bash
for db in dev_render dev_render_master dev_render_liotecnica; do
  PGPASSWORD='@FelipeL89*' /Library/PostgreSQL/18/bin/pg_dump \
    -h localhost -U postgres \
    -Fc -Z 9 \
    -f "backups/${db}.dump" "$db"
done
```

Ou use o script `scripts/backup-dev-dbs.sh` (se existir).

## Senhas e credenciais

O banco tem dados de desenvolvimento — **não** dados reais de produção.
Senhas hardcoded no `appsettings.Development.json` (também versionado neste
commit) são apenas para ambiente local.

**⚠️ Estes dumps NÃO devem ir para produção como estão.** Em produção o pipeline
de provisionamento de tenant cria bancos novos e aplica migrations — nunca
restore destes dumps.
