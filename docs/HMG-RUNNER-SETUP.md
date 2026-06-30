# Self-hosted runner em `10.0.0.80` (já preparado)

No servidor HMG (**Ubuntu 24.04**, utilizador `administrator`) o pacote oficial do GitHub Actions Runner já está em:

```text
~/actions-runner
```

As dependências base foram instaladas com `./bin/installdependencies.sh`.

## O que falta (obrigatório — precisa de token)

Só um **administrador do repositório** `desenvolvimentoliotecnica/PortalRS` pode gerar o **registration token** (válido poucos minutos).

### 1. Gerar token na UI GitHub

1. Abre **https://github.com/desenvolvimentoliotecnica/PortalRS/settings/actions/runners**
2. **New self-hosted runner** → escolhe **Linux** → copia o **token** que aparece no passo `config.sh`.

### 2. No servidor (SSH como `administrator`)

Substitui `COLOCA_TOKEN_AQUI` pelo token copiado:

```bash
cd ~/actions-runner
./config.sh --url https://github.com/desenvolvimentoliotecnica/PortalRS \
  --token COLOCA_TOKEN_AQUI \
  --labels hmg-deploy \
  --unattended \
  --replace
```

O label **`hmg-deploy`** é o que o workflow [`.github/workflows/deploy-hmg.yml`](../.github/workflows/deploy-hmg.yml) usa em `runs-on: [self-hosted, hmg-deploy]`.

### 3. Instalar como serviço (recomendado)

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

Para ver logs: `sudo journalctl -u actions.runner.* -f` (o nome exacto do unit aparece após `svc.sh install`).

### 4. Alternativa: só correr em primeiro plano (teste)

```bash
cd ~/actions-runner
./run.sh
```

(Ctrl+C para parar; não recomendado para produção.)

---

## Se não tens permissão de admin no repo

Pedir a um owner do repositório que:

- te dê **Admin**, ou  
- execute os comandos acima, ou  
- crie um **fine-grained PAT** com permissão **Administration** no repo `RH` só para gerar o token de registo (avançado).

---

## Estado verificado em instalação assistida

- Runner extraído em `/home/administrator/actions-runner`
- `config.sh` ainda **não** foi executado com sucesso (`Not configured yet` antes do registo)

Depois do registo deve existir o ficheiro `~/actions-runner/.runner` e o runner deve aparecer em **Settings → Actions → Runners** como **Idle**.
