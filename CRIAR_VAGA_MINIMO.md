# 🚨 GUIA EMERGENCIAL - Criar Vaga (Campos Mínimos)

## Campos OBRIGATÓRIOS (apenas estes!)

Para criar uma vaga, você precisa SOMENTE:

1. **Titulo** (string) - Ex: "Desenvolvedor"
2. **AreaId** (GUID) - Precisa de um ID válido de área

## Passo 1: Pegar um AreaId válido

```sql
-- Cole isso no PostgreSQL:
SELECT "Id", "Name" FROM "Areas" LIMIT 5;
```

Copie um dos IDs retornados.

## Passo 2: JSON Mínimo para Criar Vaga

**Via Postman/Insomnia/curl:**

```json
{
  "titulo": "Teste Vaga Simples",
  "areaId": "0e27730c-c5b7-4e0e-9924-1fec74d86d09"
}
```

## Passo 3: Teste Direto na API

### Via curl (copie e cole no terminal):

```bash
# Substitua {AREA_ID} por um ID válido
curl -X POST "http://localhost:5000/api/vagas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "titulo": "Teste Vaga Simples",
    "areaId": "0e27730c-c5b7-4e0e-9924-1fec74d86d09"
  }'
```

### Via Frontend (DEBUG):

**Abra o Console do navegador (F12) e execute:**

```javascript
// 1. Pegue o token do localStorage
const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

// 2. Pegue um areaId (da primeira área disponível)
const areasResponse = await fetch('http://localhost:5000/api/areas', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const areas = await areasResponse.json();
const areaId = areas[0].id;

// 3. Crie a vaga
const response = await fetch('http://localhost:5000/api/vagas', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    titulo: "Teste Vaga Minima",
    areaId: areaId
  })
});

const result = await response.json();
console.log('Vaga criada:', result);
```

## Se AINDA NÃO FUNCIONAR

### Verificar Erro no Backend

**Veja o terminal do .NET (`dotnet watch run`):**

Procure por linhas como:
```
[Error] ...
[Warning] ...
fail: ...
```

### Verificar se o problema é de autenticação

```bash
# Teste sem autenticação (se a API permitir):
curl -X GET "http://localhost:5000/api/areas"
```

Se retornar **401 Unauthorized**, o problema é login/token.

### Verificar se há validação customizada

Cole o erro completo que aparece no console do navegador OU no terminal do backend.

---

## Resumo Ultra-Rápido

**Pelo console do navegador (F12):**

```javascript
const token = localStorage.getItem('authToken');
const areas = await (await fetch('http://localhost:5000/api/areas', {headers: {'Authorization': `Bearer ${token}`}})).json();
const result = await fetch('http://localhost:5000/api/vagas', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
  body: JSON.stringify({ titulo: "Teste", areaId: areas[0].id })
});
console.log(await result.json());
```

**Se funcionar, o problema está no formulário do frontend, não no backend!**
