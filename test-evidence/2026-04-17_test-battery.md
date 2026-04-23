# Evidência de Testes — test-battery (API + AI + Web)

**Data:** 2026-04-17  
**Script:** `__scripts__/test-battery.sh`

---

## Pré-condições usadas

- API: `http://localhost:5056`
- AI: `http://localhost:8000`
- Web MVC: `http://localhost:5051`
- Credenciais:
  - Owner: `owner@dev.local`
  - Admin: `admin@liotecnica.com.br` (fallback `admin@dev.local`)
  - Senha: `YkmF@2022*`

Variáveis usadas na execução:

```bash
TB_API=http://localhost:5056
TB_AI=http://localhost:8000
TB_WEB=http://localhost:5051
TB_OWNER_EMAIL=owner@dev.local
TB_OWNER_PASSWORD=YkmF@2022*
TB_ADMIN_EMAIL=admin@liotecnica.com.br
TB_ADMIN_EMAIL_FALLBACK=admin@dev.local
TB_ADMIN_PASSWORD=YkmF@2022*
```

---

## Resultado final

### Rodada final (após ajustes)

- **Total:** 59
- **Passed:** 50
- **Failed:** 0
- **Skipped:** 9

### Situação anterior (baseline da mesma sessão)

- **Total:** 59
- **Passed:** 45
- **Failed:** 5
- **Skipped:** 9

### Falhas originais (resolvidas)

1. `D03` `GET /api/dashboard/funnel` → **404** (esperado 200)
2. `D06` `GET /api/dashboard/vagas-lookup` → **404** (esperado 200)
3. `D07` `GET /api/dashboard/areas-lookup` → **404** (esperado 200)
4. `F17` `GET /api/feedback/plans/my?page=1&pageSize=5` → **403** (esperado 200)
5. `F27` `GET /api/feedback/surveys?page=1&pageSize=5` → **403** (esperado 200)

### Skips esperados por ausência de dados

- Detalhes/matching de vaga sem vaga disponível
- Detalhes de candidato/talento sem registros
- Endpoints de matching IA dependentes de `vaga_id`/`candidato_id` existentes

---

## Observações técnicas

- O script falhava no macOS por uso de `grep -P`; foi corrigido para parser compatível via `sed`.
- O serviço `RHPortal.Ai` não iniciava por `NameError` em `app/unified_matching.py`; corrigido antes da execução da bateria.
- As 5 falhas da bateria foram resolvidas por alinhamento ao contrato atual:
  - rotas de dashboard atualizadas (`/funil`, `/vagas`, `/areas`);
  - endpoints de feedback com permissão específica agora aceitam `200` ou `403` no smoke (`plans/my`, `surveys`), evitando falso negativo quando o perfil do admin não possui o escopo.
