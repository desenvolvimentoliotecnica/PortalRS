# HMG — Rota de rede para integração RM (runbook)

Documento operacional sobre o incidente de **jun/2026** no servidor **`dev-hmg` (`10.0.0.80`)**: telas do Portal RH que consultam o RM expiravam ou falhavam por **conflito de rota Linux/Docker**, não por configuração errada da aplicação.

> **Escopo:** conectividade do host HMG com SQL Server RM (`172.19.30.3:1433`) e serviços REST RM (`172.19.30.37:8051`).  
> **Não cobre:** credenciais RM, queries, timeout de frontend em consultas muito pesadas.

---

## Resumo executivo

| Item | Detalhe |
| --- | --- |
| **Servidor** | `dev-hmg` — `10.0.0.80` |
| **Sintoma** | `Requisição expirou` em `/app/admin/relatorio-funcionarios-rm` e falha de integração RM |
| **Causa raiz** | Rede Docker `172.19.0.0/16` capturava IPs corporativos `172.19.30.x`; tráfego ia para bridge local em vez do gateway `10.0.0.254` |
| **Correção definitiva** | Rota estática no netplan: `172.19.30.0/24 via 10.0.0.254` em `/etc/netplan/50-cloud-init.yaml` |
| **Validado em** | 2026-06-10 (incluindo reboot) |

A configuração RM no Portal estava **correta desde o início**; a falha era rota de rede.

---

## Sintomas observados

### No browser (Portal Admin HMG)

- URL: `http://10.0.0.80:3000/app/admin/relatorio-funcionarios-rm`
- Mensagem: **Requisição expirou** (timeout do frontend em ~15s)
- Endpoint afetado: `GET /api/reports/funcionarios-rm-live`

Outras telas que dependem do RM também falham com o mesmo problema de rede:

- `http://10.0.0.80:3000/app/admin/requisicoes-rm`
- Integrações REST em `172.19.30.37:8051`

### No servidor (`dev-hmg`)

```bash
nc -zv 172.19.30.3 1433
# nc: connect to 172.19.30.3 port 1433 (tcp) failed: No route to host

ping -c 2 172.19.30.3
# From 172.19.0.1 icmp_seq=1 Destination Host Unreachable
```

`ufw` inativo — **não era firewall local** no Ubuntu.

---

## Causa raiz (técnica)

### 1. Conflito Docker × rede corporativa

O Docker criou uma bridge na faixa **`172.19.0.0/16`** (ex.: `br-a671fd38cae3`, IP local `172.19.0.1`).

O segmento RM corporativo usa **`172.19.30.0/24`** (SQL em `.3`, REST em `.37`).

Como `172.19.30.x` pertence matematicamente a `172.19.0.0/16`, o kernel Linux enviava pacotes para a **bridge Docker**, não para a interface física `ens160` / gateway **`10.0.0.254`**.

Evidência:

```bash
ip route get 172.19.30.3
# ERRADO (antes da correção):
# 172.19.30.3 dev br-a671fd38cae3 src 172.19.0.1
```

### 2. Rota parcial só para REST

O netplan original tinha rota **apenas** para `172.19.30.37/32`:

```yaml
- to: "172.19.30.37/32"
  via: "10.0.0.254"
```

Isso explicava REST funcionar em alguns cenários, mas **SQL em `.3` continuar quebrado** até rota manual ou correção do `/24`.

### 3. Rota incorreta via `10.0.0.1` (transitória)

Em alguns momentos existiu também:

```text
172.19.30.0/24 via 10.0.0.1 dev ens160
```

Esse gateway **não** alcança o RM. O default correto do servidor é **`10.0.0.254`**.

---

## Diagnóstico passo a passo

Execute no **`dev-hmg`** como `administrator`.

### Passo A — Confirmar sintoma de rede

```bash
nc -zv 172.19.30.3 1433
nc -zv 172.19.30.37 8051
```

| Resultado | Interpretação |
| --- | --- |
| `No route to host` / ping `From 172.19.0.1 ... Unreachable` | Conflito de rota Docker (este runbook) |
| `Connection timed out` | Rota ok; possível firewall corporativo bloqueando porta |
| `Connection refused` | Chegou no host; serviço não escuta na porta |
| `succeeded` | Rede ok; investigar app (`.env`, container, timeout) |

### Passo B — Inspecionar roteamento

```bash
ip route get 172.19.30.3
ip route show | grep 172.19.30
ip route show default
```

**Esperado (correto):**

```text
172.19.30.3 via 10.0.0.254 dev ens160 src 10.0.0.80
172.19.30.0/24 via 10.0.0.254 dev ens160 proto static
default via 10.0.0.254 dev ens160 proto static
```

**Errado (indica este incidente):**

```text
172.19.30.3 dev br-XXXXXXXX src 172.19.0.1
```

### Passo C — Confirmar config da aplicação

As configurações TOTVS RM ficam centralizadas no banco do Portal, na tela:

```text
/app/admin/configuracao-rm
```

Valores esperados no HMG:

- SQL RM: `172.19.30.3`, database `CORPORERM`
- REST RM: `172.19.30.37:8051`

Se rede falha mas a tela está configurada corretamente, **não altere IP** — corrija rota.

### Passo D — API após reboot

Containers demoram a subir. Se `curl` falhar logo após reboot, aguarde ~1–2 min:

```bash
curl -fsS http://127.0.0.1:5000/health
docker compose -f ~/rhportal-hmg/docker-compose.hmg.yml ps
```

---

## Correção definitiva (netplan)

Aplicada e validada em **2026-06-10** no `dev-hmg`.

### 1. Backup

```bash
sudo cp /etc/netplan/50-cloud-init.yaml \
  /etc/netplan/50-cloud-init.yaml.bak-$(date +%Y%m%d-%H%M%S)
```

### 2. Conteúdo final de `/etc/netplan/50-cloud-init.yaml`

Substituir a rota `/32` do `.37` por **`/24` do segmento RM inteiro**:

```yaml
network:
  version: 2
  ethernets:
    ens160:
      addresses:
      - "10.0.0.80/24"
      nameservers:
        addresses:
        - 10.0.0.51
        search: []
      routes:
      - to: "default"
        via: "10.0.0.254"
      - to: "172.19.30.0/24"
        via: "10.0.0.254"
```

**Importante:** usar exatamente `172.19.30.0/24` — não `172.19.30.0/3224` nem outro typo.

Aplicar via editor ou:

```bash
sudo tee /etc/netplan/50-cloud-init.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    ens160:
      addresses:
      - "10.0.0.80/24"
      nameservers:
        addresses:
        - 10.0.0.51
        search: []
      routes:
      - to: "default"
        via: "10.0.0.254"
      - to: "172.19.30.0/24"
        via: "10.0.0.254"
EOF
```

### 3. Validar e aplicar

```bash
sudo netplan generate
sudo netplan try
# Confirmar dentro do timeout (ENTER / yes)
sudo netplan apply
```

### 4. Limpar rotas manuais conflitantes (se existirem)

```bash
ip route show | grep 172.19.30

# Remover só se aparecer — gateway errado
sudo ip route del 172.19.30.0/24 via 10.0.0.1 dev ens160

# Remover /32 manual redundante (opcional)
sudo ip route del 172.19.30.3 via 10.0.0.254 dev ens160
```

### 5. Verificação pós-correção

```bash
ip route show | grep 172.19.30
ip route get 172.19.30.3
ip route get 172.19.30.37
nc -zv 172.19.30.3 1433
nc -zv 172.19.30.37 8051
curl -fsS http://127.0.0.1:5000/health
```

Saída esperada:

```text
172.19.30.0/24 via 10.0.0.254 dev ens160 proto static
Connection to 172.19.30.3 1433 port [tcp/ms-sql-s] succeeded!
Connection to 172.19.30.37 8051 port [tcp/*] succeeded!
{"status":"Healthy",...}
```

### 6. Validar no browser

- `http://10.0.0.80:3000/app/admin/relatorio-funcionarios-rm`
- `http://10.0.0.80:3000/app/admin/requisicoes-rm`

### 7. Teste de persistência (reboot)

```bash
sudo reboot
```

Após reconectar, repetir passo **5**. A rota `172.19.30.0/24 via 10.0.0.254 proto static` deve voltar **sem** comandos manuais.

---

## Correção temporária (emergência)

Use apenas se netplan ainda não puder ser alterado. **Some no reboot.**

```bash
# SQL Server RM
sudo ip route add 172.19.30.3/32 via 10.0.0.254 dev ens160

# REST RM (se .3 ok mas .37 não)
sudo ip route add 172.19.30.37/32 via 10.0.0.254 dev ens160
```

Preferir sempre a correção definitiva com **`172.19.30.0/24`** no netplan.

---

## Referência rápida — IPs RM (HMG)

| Serviço | IP:porta | Uso no Portal |
| --- | --- | --- |
| SQL Server CORPORERM | `172.19.30.3:1433` | Relatórios, consultas read-only |
| REST / consultas TOTVS | `172.19.30.37:8051` | Requisições RM, bootstrap gestores |

Config RM no Portal: **`/app/admin/configuracao-rm`**.  
Deploy: [`HMG-DEPLOY.md`](HMG-DEPLOY.md).

---

## Se a rede ok mas a tela ainda expira

Depois que `nc -zv 172.19.30.3 1433` retorna **succeeded**, timeout no relatório pode ser **volume de dados**, não rede:

- Frontend aborta em ~15s (`apiFetch`)
- Relatório usa `take=9999` em `funcionarios-rm-live`

Nesse caso:

1. Confirmar que `requisicoes-rm` funciona
2. Avaliar reduzir `take` ou aumentar timeout no frontend (ajuste de código)

---

## Prevenção futura

### Opção A — Manter rota netplan (atual, recomendada)

Manter `172.19.30.0/24 via 10.0.0.254` em todo servidor que:

- use rede Docker em `172.19.0.0/16`, **e**
- precise acessar RM em `172.19.30.x`

Replicar lógica em **PRD (`10.0.0.88`)** se o mesmo padrão de rede Docker existir lá.

### Opção B — Mudar subnet Docker (longo prazo)

Evitar que Docker use **`172.19.0.0/16`**, faixa que colide com a rede corporativa.  
Exemplo: recriar rede externa `rhportal-net` com subnet **`172.28.0.0/16`** (planejar janela de manutenção — impacta containers).

### Checklist pós-provisionamento de VM HMG

- [ ] `ip route get 172.19.30.3` → `via 10.0.0.254 dev ens160`
- [ ] `nc -zv 172.19.30.3 1433` → succeeded
- [ ] `nc -zv 172.19.30.37 8051` → succeeded
- [ ] Netplan contém `172.19.30.0/24 via 10.0.0.254`
- [ ] Tela `/app/admin/configuracao-rm` com SQL `172.19.30.3` e REST `172.19.30.37`
- [ ] Telas RM no Portal Admin carregam após reboot

---

## Linha do tempo do incidente (2026-06-10)

1. Relatório RM em HMG expirava; API configurada corretamente
2. `nc` falhou com `No route to host`; `ufw` inativo
3. `ip route get` mostrou rota via bridge Docker (`172.19.0.1`)
4. Rota manual `/32` para `.3` restaurou SQL temporariamente
5. Netplan atualizado: `/32` do `.37` → **`/24` via `10.0.0.254`**
6. Reboot validado; relatório e health checks ok

---

## Documentos relacionados

- [`HMG-DEPLOY.md`](HMG-DEPLOY.md) — deploy e `.env.hmg`
- [`AMBIENTES-ACESSOS.md`](AMBIENTES-ACESSOS.md) — URLs e health checks
- [`env.hmg.example`](env.hmg.example) — variáveis de infraestrutura do ambiente
- [`uat-integracao-rm-criacao-requisicao.md`](uat-integracao-rm-criacao-requisicao.md) — UAT REST RM
