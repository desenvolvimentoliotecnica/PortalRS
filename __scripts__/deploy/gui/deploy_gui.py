from __future__ import annotations

import json
import os
import queue
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

try:
    import paramiko
except ImportError:  # pragma: no cover - shown in GUI at runtime
    paramiko = None

import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText


APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / "deploy_gui_config.json"
LOG_DIR = APP_DIR / "logs"
BRANCH = "main"
IMAGE_PREFIX = "ghcr.io/munizlmachado-jpg/rh"
CONTAINERS = [
    "rhportal-api",
    "rhportal-web-next",
    "rhportal-portal-vagas",
    "rhportal-ai",
]
SERVICE_TO_CONTAINER = {
    "api": "rhportal-api",
    "web-next": "rhportal-web-next",
    "portal-vagas": "rhportal-portal-vagas",
    "ai": "rhportal-ai",
}
SERVICE_LABELS = {
    "api": "API",
    "web-next": "Portal Admin (Web Next)",
    "portal-vagas": "Portal de Vagas",
    "ai": "RHPortal.Ai",
}
ALL_SERVICES = list(SERVICE_TO_CONTAINER)


DEFAULT_CONFIG = {
    "host": "10.0.0.80",
    "user": "administrator",
    "repo_path": str(Path.cwd()),
    "remote_deploy_dir": "/home/administrator/rh-deploys",
    "api_url": "http://10.0.0.80:5000",
    "admin_url": "http://10.0.0.80:3000",
    "tenant": "liotecnica",
}


class DeployError(RuntimeError):
    def __init__(self, message: str, suggestion: str | None = None, exit_code: int | None = None):
        super().__init__(message)
        self.suggestion = suggestion
        self.exit_code = exit_code


@dataclass
class DeployConfig:
    host: str
    user: str
    password: str
    repo_path: Path
    remote_deploy_dir: str
    api_url: str
    admin_url: str
    tenant: str

    @property
    def api_base(self) -> str:
        return self.api_url.rstrip("/")

    @property
    def admin_base(self) -> str:
        return self.admin_url.rstrip("/")


class EventLog:
    def __init__(self, emit: Callable[[str, str], None]):
        self.emit = emit

    def info(self, text: str) -> None:
        self.emit("INFO", text)

    def ok(self, text: str) -> None:
        self.emit("OK", text)

    def warn(self, text: str) -> None:
        self.emit("WARN", text)

    def error(self, text: str) -> None:
        self.emit("ERROR", text)


class SshSession:
    def __init__(self, cfg: DeployConfig, log: EventLog):
        if paramiko is None:
            raise DeployError(
                "Dependencia paramiko nao instalada.",
                "Execute: python -m pip install -r __scripts__/deploy/gui/requirements.txt",
            )
        self.cfg = cfg
        self.log = log
        self.client: Any = None
        self.sftp: Any = None

    def __enter__(self) -> "SshSession":
        self.log.info(f"Conectando via SSH em {self.cfg.user}@{self.cfg.host}...")
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=self.cfg.host,
                username=self.cfg.user,
                password=self.cfg.password,
                look_for_keys=False,
                allow_agent=False,
                timeout=20,
                banner_timeout=20,
                auth_timeout=20,
            )
        except Exception as exc:  # noqa: BLE001
            raise DeployError(
                f"Falha na conexao SSH: {exc}",
                "Confira host, usuario, senha, rede/VPN e se o SSH esta ativo no servidor.",
            ) from exc
        self.client = client
        self.sftp = client.open_sftp()
        self.log.ok("SSH conectado.")
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if self.sftp:
            self.sftp.close()
        if self.client:
            self.client.close()

    def run(self, command: str, label: str, env: dict[str, str] | None = None, check: bool = True) -> tuple[int, str]:
        if not self.client:
            raise DeployError("Sessao SSH nao inicializada.")
        env_prefix = ""
        if env:
            env_prefix = " ".join(f"{k}={shlex.quote(v)}" for k, v in env.items()) + " "
        full_command = f"{env_prefix}bash -lc {shlex.quote(command)}"
        self.log.info(f"$ remoto: {label}")
        stdin, stdout, stderr = self.client.exec_command(full_command, get_pty=False)
        stdin.close()
        channel = stdout.channel
        output: list[str] = []
        while not channel.exit_status_ready():
            self._drain(stdout, output)
            self._drain(stderr, output)
            time.sleep(0.1)
        self._drain(stdout, output)
        self._drain(stderr, output)
        exit_code = channel.recv_exit_status()
        text = "".join(output)
        if check and exit_code != 0:
            raise DeployError(
                f"Comando remoto falhou na etapa '{label}'.",
                "Leia as ultimas linhas do log acima; corrija o erro no servidor e tente novamente.",
                exit_code=exit_code,
            )
        if exit_code == 0:
            self.log.ok(f"Etapa remota concluida: {label}")
        return exit_code, text

    def _drain(self, stream: Any, output: list[str]) -> None:
        while stream.channel.recv_ready() if stream is not None else False:
            chunk = stream.channel.recv(4096).decode("utf-8", errors="replace")
            output.append(chunk)
            for line in chunk.splitlines():
                self.log.info(line)
        while stream.channel.recv_stderr_ready() if stream is not None else False:
            chunk = stream.channel.recv_stderr(4096).decode("utf-8", errors="replace")
            output.append(chunk)
            for line in chunk.splitlines():
                self.log.info(line)

    def mkdir_p(self, remote_path: str) -> None:
        parts = [p for p in remote_path.split("/") if p]
        path = ""
        for part in parts:
            path += "/" + part
            try:
                self.sftp.stat(path)
            except OSError:
                self.sftp.mkdir(path)

    def upload(self, local_path: Path, remote_path: str, progress: Callable[[int, int], None]) -> None:
        self.mkdir_p(str(Path(remote_path).parent).replace("\\", "/"))
        total = local_path.stat().st_size
        last_report = {"value": 0.0}

        def callback(sent: int, _total: int) -> None:
            progress(sent, total)
            percent = (sent / total) * 100 if total else 100
            if percent - last_report["value"] >= 5 or sent == total:
                last_report["value"] = percent
                self.log.info(f"Upload: {percent:5.1f}% ({sent / 1024 / 1024:.1f}/{total / 1024 / 1024:.1f} MB)")

        self.log.info(f"Enviando snapshot para {remote_path}...")
        self.sftp.put(str(local_path), remote_path, callback=callback)
        self.log.ok("Upload concluido.")


class DeployRunner:
    def __init__(
        self,
        cfg: DeployConfig,
        log: EventLog,
        set_progress: Callable[[int, str], None],
        ask_yes_no: Callable[[str, str], bool],
        deploy_mode: str = "smart",
    ):
        self.cfg = cfg
        self.log = log
        self.set_progress = set_progress
        self.ask_yes_no = ask_yes_no
        self.deploy_mode = deploy_mode
        self.sha = ""
        self.archive_path: Path | None = None
        self.changed_files: list[str] = []
        self.services_to_build: list[str] = list(ALL_SERVICES)

    def deploy(self) -> None:
        started = time.monotonic()
        try:
            self.set_progress(3, "Preflight local")
            self._local_preflight()
            self.set_progress(15, "Gerando snapshot")
            self._create_archive()
            with SshSession(self.cfg, self.log) as ssh:
                self.set_progress(25, "Preflight remoto")
                self._remote_preflight(ssh)
                self.set_progress(30, "Planejando build")
                self._remote_plan_build(ssh)
                self.set_progress(35, "Upload do snapshot")
                self._upload_and_extract(ssh)
                self.set_progress(50, "Build remoto")
                self._remote_build(ssh)
                self.set_progress(82, "Subindo stack")
                self._remote_up(ssh)
                self.set_progress(95, "Validacao")
                self._remote_validate(ssh)
            elapsed = time.monotonic() - started
            self.set_progress(100, "Deploy concluido")
            self.log.ok(f"Deploy concluido. SHA publicado: {self.sha}. Duracao: {elapsed / 60:.1f} min.")
        except DeployError as exc:
            self.set_progress(0, "Falha no deploy")
            self.log.error(str(exc))
            if exc.exit_code is not None:
                self.log.error(f"Codigo de saida: {exc.exit_code}")
            if exc.suggestion:
                self.log.error(f"Sugestao: {exc.suggestion}")
            raise
        except Exception as exc:  # noqa: BLE001
            self.set_progress(0, "Falha inesperada")
            self.log.error(f"Falha inesperada: {exc}")
            self.log.error(traceback.format_exc())
            raise
        finally:
            if self.archive_path and self.archive_path.exists():
                try:
                    self.archive_path.unlink()
                except OSError:
                    pass

    def rollback(self) -> None:
        started = time.monotonic()
        try:
            with SshSession(self.cfg, self.log) as ssh:
                self.set_progress(20, "Lendo estado anterior")
                self._remote_rollback(ssh)
                self.set_progress(90, "Validando rollback")
                self._remote_validate(ssh)
            elapsed = time.monotonic() - started
            self.set_progress(100, "Rollback concluido")
            self.log.ok(f"Rollback concluido. Duracao: {elapsed / 60:.1f} min.")
        except Exception:
            self.set_progress(0, "Falha no rollback")
            raise

    def _run_local(self, args: list[str], cwd: Path, label: str, check: bool = True) -> tuple[int, str]:
        self.log.info("$ local: " + " ".join(shlex.quote(a) for a in args))
        try:
            proc = subprocess.Popen(
                args,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
        except FileNotFoundError as exc:
            raise DeployError(
                f"Comando local nao encontrado: {args[0]}",
                "Instale o Git para Windows e confirme que ele esta no PATH.",
            ) from exc
        output: list[str] = []
        assert proc.stdout is not None
        for line in proc.stdout:
            output.append(line)
            self.log.info(line.rstrip("\n"))
        code = proc.wait()
        text = "".join(output)
        if check and code != 0:
            raise DeployError(
                f"Comando local falhou na etapa '{label}'.",
                "Confira se o repositorio local esta correto e se voce tem acesso ao GitHub.",
                exit_code=code,
            )
        if code == 0:
            self.log.ok(f"Etapa local concluida: {label}")
        return code, text

    def _local_preflight(self) -> None:
        repo = self.cfg.repo_path
        if not repo.exists() or not (repo / ".git").exists():
            raise DeployError("Repo local invalido.", "Informe a pasta raiz do repo RH.")
        if shutil.which("git") is None:
            raise DeployError("Git nao encontrado no PATH.", "Instale Git for Windows ou ajuste o PATH.")
        self._run_local(["git", "remote", "get-url", "origin"], repo, "validar remote")
        self._run_local(
            ["git", "fetch", "origin", f"refs/heads/{BRANCH}:refs/remotes/origin/{BRANCH}"],
            repo,
            "fetch main",
        )
        _, sha = self._run_local(["git", "rev-parse", f"origin/{BRANCH}"], repo, "obter SHA")
        self.sha = sha.strip()
        _, commit = self._run_local(
            ["git", "show", "-s", "--format=%h %ci %s", f"origin/{BRANCH}"],
            repo,
            "dados do commit",
        )
        self.log.ok(f"Main atual: {commit.strip()}")

    def _create_archive(self) -> None:
        if not self.sha:
            raise DeployError("SHA da main nao foi calculado.")
        target = Path(tempfile.gettempdir()) / f"rh-main-{self.sha[:12]}.tar.gz"
        if target.exists():
            target.unlink()
        self._run_local(
            ["git", "archive", "--format=tar.gz", "-o", str(target), f"origin/{BRANCH}"],
            self.cfg.repo_path,
            "gerar snapshot",
        )
        size_mb = target.stat().st_size / 1024 / 1024
        self.archive_path = target
        self.log.ok(f"Snapshot gerado: {target} ({size_mb:.1f} MB)")

    def _remote_preflight(self, ssh: SshSession) -> None:
        script = r"""
set -euo pipefail
echo "Host: $(hostname)"
echo "Usuario: $(whoami)"
command -v docker
docker --version
docker compose version
command -v tar
command -v python3
df -h /home /var/lib/docker 2>/dev/null || df -h /
if docker network inspect rhportal-net >/dev/null 2>&1; then
  echo "OK: rede rhportal-net existe"
else
  echo "WARN: rede rhportal-net nao existe; sera criada no deploy"
fi
if [[ -f "$HOME/.env.hmg" ]]; then
  echo "OK: $HOME/.env.hmg encontrado"
else
  echo "ERROR: $HOME/.env.hmg nao encontrado"
  exit 12
fi
missing_ai=0
for key in DATABASE_URL OPENAI_API_KEY; do
  if grep -qE "^${key}=" "$HOME/.env.hmg"; then
    echo "OK: ${key}=<set>"
  else
    echo "WARN: ${key} ausente no .env.hmg"
    missing_ai=1
  fi
done
if [[ "$missing_ai" == "1" ]]; then
  echo "__AI_ENV_MISSING__"
fi
"""
        _, output = ssh.run(script, "preflight remoto")
        if "__AI_ENV_MISSING__" in output:
            self.log.warn("RHPortal.Ai pode ficar unhealthy: DATABASE_URL ou OPENAI_API_KEY ausentes.")
            proceed = self.ask_yes_no(
                "Variaveis do RHPortal.Ai ausentes",
                "DATABASE_URL ou OPENAI_API_KEY nao foram encontradas em ~/.env.hmg.\n\n"
                "A API e os portais podem subir, mas o health agregado deve ficar 503 por causa do AI.\n\n"
                "Deseja continuar mesmo assim?",
            )
            if not proceed:
                raise DeployError("Deploy cancelado pelo usuario.", "Configure o ~/.env.hmg ou confirme o alerta.")

    def _service_plan_from_files(self, files: list[str]) -> tuple[list[str], str]:
        if self.deploy_mode == "full":
            return list(ALL_SERVICES), "modo completo selecionado"
        if not files:
            return list(ALL_SERVICES), "sem SHA anterior ou sem lista de mudancas confiavel"

        build: set[str] = set()
        full_reasons: list[str] = []
        for path in files:
            p = path.replace("\\", "/")
            if p.startswith(("RHPortal.Api/", "Liotecnica.Integration.RM/", "Liotecnica.Integration.RM.Schema/")):
                build.add("api")
            elif p.startswith("LioTecnica.Web.Next/"):
                build.add("web-next")
            elif p.startswith("LioTecnica.PortalVagas.React/"):
                build.add("portal-vagas")
            elif p.startswith("RHPortal.Ai/"):
                build.add("ai")
            elif p in {
                "docker-compose.hmg.yml",
                ".dockerignore",
                "global.json",
                "LioTecnica.sln",
            } or p.endswith("Dockerfile") or p.endswith(".dockerignore"):
                full_reasons.append(p)
            elif p.startswith((".github/", "__scripts__/deploy/", "docs/", ".planning/")):
                continue
            else:
                full_reasons.append(p)

        if full_reasons:
            return list(ALL_SERVICES), "mudancas compartilhadas/de infraestrutura: " + ", ".join(full_reasons[:5])
        if not build:
            return [], "nenhuma mudanca de runtime detectada"
        ordered = [svc for svc in ALL_SERVICES if svc in build]
        return ordered, "mudancas por caminho"

    def _remote_plan_build(self, ssh: SshSession) -> None:
        state_path = f"{self.cfg.remote_deploy_dir.rstrip('/')}/deploy-state.json"
        script = f"""
set -euo pipefail
STATE_PATH={shlex.quote(state_path)}
if [[ -f "$STATE_PATH" ]]; then
  python3 - <<'PY'
import json, os
with open(os.environ["STATE_PATH"], "r", encoding="utf-8") as fh:
    state = json.load(fh)
print(state.get("target_sha") or "")
PY
else
  true
fi
"""
        _, output = ssh.run(script, "ler ultimo SHA publicado", check=False)
        previous_sha = output.strip().splitlines()[-1].strip() if output.strip() else ""
        if previous_sha:
            self.log.info(f"Ultimo SHA registrado no servidor: {previous_sha}")
            code, diff_output = self._run_local(
                ["git", "diff", "--name-only", f"{previous_sha}..origin/{BRANCH}"],
                self.cfg.repo_path,
                "diff desde ultimo deploy",
                check=False,
            )
            if code == 0:
                self.changed_files = [line.strip() for line in diff_output.splitlines() if line.strip()]
            else:
                self.log.warn("Nao foi possivel calcular diff local; usando build completo.")
                self.changed_files = []
        else:
            self.log.warn("Nenhum deploy-state.json anterior encontrado; usando build completo.")
            self.changed_files = []

        self.services_to_build, reason = self._service_plan_from_files(self.changed_files)
        if self.changed_files:
            self.log.info("Arquivos alterados desde ultimo deploy:")
            for path in self.changed_files[:80]:
                self.log.info(f"  - {path}")
            if len(self.changed_files) > 80:
                self.log.info(f"  ... +{len(self.changed_files) - 80} arquivos")
        if self.services_to_build:
            labels = ", ".join(SERVICE_LABELS[s] for s in self.services_to_build)
            self.log.ok(f"Servicos que serao buildados: {labels} ({reason}).")
        else:
            self.log.ok(f"Nenhum servico precisa rebuild ({reason}). Vou apenas retaguear/subir a stack se necessario.")

    def _upload_and_extract(self, ssh: SshSession) -> None:
        if not self.archive_path:
            raise DeployError("Snapshot local nao encontrado.")
        remote_dir = f"{self.cfg.remote_deploy_dir.rstrip('/')}/{self.sha}"
        remote_archive = f"{remote_dir}/source.tar.gz"
        current_src = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-src"
        ssh.upload(self.archive_path, remote_archive, lambda sent, total: self.set_progress(35, "Upload do snapshot"))
        script = f"""
set -euo pipefail
REMOTE_DIR={shlex.quote(remote_dir)}
CURRENT_SRC={shlex.quote(current_src)}
rm -rf "$REMOTE_DIR/src"
mkdir -p "$REMOTE_DIR/src"
tar -xzf "$REMOTE_DIR/source.tar.gz" -C "$REMOTE_DIR/src"
test -f "$REMOTE_DIR/src/docker-compose.hmg.yml"
rm -rf "$CURRENT_SRC"
mkdir -p "$CURRENT_SRC"
tar -xzf "$REMOTE_DIR/source.tar.gz" -C "$CURRENT_SRC"
test -f "$CURRENT_SRC/docker-compose.hmg.yml"
mkdir -p {shlex.quote(self.cfg.remote_deploy_dir.rstrip('/') + '/current-compose')}
cp "$CURRENT_SRC/docker-compose.hmg.yml" {shlex.quote(self.cfg.remote_deploy_dir.rstrip('/') + '/current-compose/docker-compose.hmg.yml')}
echo "Snapshot extraido em $CURRENT_SRC"
"""
        ssh.run(script, "extrair snapshot")

    def _remote_build(self, ssh: SshSession) -> None:
        src = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-src"
        services = " ".join(self.services_to_build)
        script = f"""
set -euo pipefail
cd {shlex.quote(src)}
TAG={shlex.quote(self.sha)}
PREFIX={shlex.quote(IMAGE_PREFIX)}
SERVICES={shlex.quote(services)}
echo "Servicos selecionados para build: ${{SERVICES:-nenhum}}"
for svc in $SERVICES; do
  case "$svc" in
    api)
      echo "==> Build API $TAG"
      docker build -f RHPortal.Api/Dockerfile -t "$PREFIX/rhportal-api:$TAG" .
      ;;
    web-next)
      echo "==> Build Web Next $TAG"
      docker build -f LioTecnica.Web.Next/Dockerfile \\
        --build-arg NEXT_PUBLIC_API_BASE={shlex.quote(self.cfg.api_base)} \\
        --build-arg NEXT_PUBLIC_PORTAL_ORIGIN={shlex.quote(self.cfg.admin_base)} \\
        -t "$PREFIX/rhportal-web-next:$TAG" .
      ;;
    portal-vagas)
      echo "==> Build Portal Vagas $TAG"
      docker build -f LioTecnica.PortalVagas.React/Dockerfile \\
        --build-arg VITE_API_BASE_URL={shlex.quote(self.cfg.api_base)} \\
        --build-arg VITE_DEFAULT_TENANT={shlex.quote(self.cfg.tenant)} \\
        -t "$PREFIX/rhportal-portal-vagas:$TAG" LioTecnica.PortalVagas.React
      ;;
    ai)
      echo "==> Build AI $TAG"
      docker build -f RHPortal.Ai/Dockerfile -t "$PREFIX/rhportal-ai:$TAG" .
      ;;
    *)
      echo "Servico desconhecido: $svc" >&2
      exit 44
      ;;
  esac
done
echo "==> Garantindo tag $TAG para servicos reaproveitados"
for cname in {' '.join(CONTAINERS)}; do
  target="$PREFIX/$cname:$TAG"
  if docker image inspect "$target" >/dev/null 2>&1; then
    echo "OK: $target existe"
    continue
  fi
  current="$(docker inspect "$cname" --format '{{{{.Config.Image}}}}' 2>/dev/null || true)"
  if [[ -n "$current" ]] && docker image inspect "$current" >/dev/null 2>&1; then
    echo "Retagueando $current -> $target"
    docker tag "$current" "$target"
  else
    echo "Nao ha imagem atual para reaproveitar em $cname; faca deploy completo." >&2
    exit 45
  fi
done
echo "==> Imagens criadas"
docker images "$PREFIX/*" --format 'table {{{{.Repository}}}}\\t{{{{.Tag}}}}\\t{{{{.CreatedSince}}}}\\t{{{{.Size}}}}' | grep "$TAG" || true
"""
        ssh.run(script, "build das imagens Docker")

    def _remote_up(self, ssh: SshSession) -> None:
        src = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-src"
        state_path = f"{self.cfg.remote_deploy_dir.rstrip('/')}/deploy-state.json"
        script = f"""
set -euo pipefail
TAG={shlex.quote(self.sha)}
PREFIX={shlex.quote(IMAGE_PREFIX)}
DEPLOY_ROOT={shlex.quote(self.cfg.remote_deploy_dir.rstrip('/'))}
STATE_PATH={shlex.quote(state_path)}
SRC={shlex.quote(src)}
export TAG PREFIX DEPLOY_ROOT STATE_PATH SRC
mkdir -p "$DEPLOY_ROOT"
python3 - <<'PY'
import json, os, subprocess, time
containers = {json.dumps(CONTAINERS)}
state_path = os.environ["STATE_PATH"]
current = {{}}
for name in containers:
    try:
        image = subprocess.check_output(["docker", "inspect", name, "--format", "{{{{.Config.Image}}}}"], text=True).strip()
    except Exception:
        image = None
    current[name] = image
data = {{
    "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "target_sha": os.environ["TAG"],
    "previous_images": current,
    "compose_path": os.path.join(os.environ["DEPLOY_ROOT"], "current-compose", "docker-compose.hmg.yml"),
}}
with open(state_path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
print(f"Estado anterior salvo em {{state_path}}")
PY
docker network inspect rhportal-net >/dev/null 2>&1 || docker network create rhportal-net
cd "$SRC"
export HMG_REGISTRY_PREFIX="$PREFIX"
export HMG_IMAGE_TAG="$TAG"
export HMG_ENV_FILE="$HOME/.env.hmg"
docker compose -f docker-compose.hmg.yml down --remove-orphans 2>/dev/null || true
for cname in {' '.join(CONTAINERS)}; do
  docker rm -f "$cname" >/dev/null 2>&1 || true
done
docker compose -f docker-compose.hmg.yml up -d --remove-orphans
docker compose -f docker-compose.hmg.yml ps
"""
        ssh.run(script, "subir stack HMG")

    def _remote_validate(self, ssh: SshSession) -> None:
        script = r"""
set -euo pipefail
echo "==> Containers"
docker ps --filter name=rhportal --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
echo "==> Imagens efetivas"
for c in rhportal-api rhportal-web-next rhportal-portal-vagas rhportal-ai; do
  printf "%s " "$c"
  docker inspect "$c" --format '{{.Config.Image}}'
done
retry_url() {
  name="$1"
  url="$2"
  for attempt in $(seq 1 30); do
    code=$(curl -fsS -o /dev/null -w '%{http_code}' "$url" 2>/tmp/rhportal-curl-error || true)
    if [[ "$code" == "200" ]]; then
      echo "${name}:200"
      return 0
    fi
    echo "${name}:aguardando (${attempt}/30, code=${code:-FAIL})"
    sleep 5
  done
  echo "${name}:FAIL"
  cat /tmp/rhportal-curl-error 2>/dev/null || true
  return 1
}
echo "==> Endpoints obrigatorios"
retry_url api-swagger http://127.0.0.1:5000/swagger/index.html
retry_url web-health http://127.0.0.1:3000/health
retry_url web-app http://127.0.0.1:3000/app/login
retry_url portal-vagas http://127.0.0.1:3050/
echo "==> Health agregado da API"
health_body=$(mktemp)
health_code=$(curl -sS -o "$health_body" -w '%{http_code}' http://127.0.0.1:5000/health || true)
echo "api-health:${health_code}"
cat "$health_body"
echo
if [[ "$health_code" == "503" ]] && grep -qi "rhportal_ai" "$health_body"; then
  echo "WARN: API health 503 por causa do RHPortal.Ai"
elif [[ "$health_code" != "200" ]]; then
  exit 23
fi
"""
        ssh.run(script, "validacao pos-deploy")

    def _remote_rollback(self, ssh: SshSession) -> None:
        state_path = f"{self.cfg.remote_deploy_dir.rstrip('/')}/deploy-state.json"
        script = f"""
set -euo pipefail
STATE_PATH={shlex.quote(state_path)}
PREFIX={shlex.quote(IMAGE_PREFIX)}
export STATE_PATH PREFIX
python3 - <<'PY'
import json, os, re, subprocess, sys
state_path = os.environ["STATE_PATH"]
prefix = os.environ["PREFIX"]
containers = {json.dumps(CONTAINERS)}
with open(state_path, "r", encoding="utf-8") as fh:
    state = json.load(fh)
images = state.get("previous_images") or {{}}
tags = set()
for container in containers:
    image = images.get(container)
    if not image:
        print(f"Imagem anterior ausente para {{container}}", file=sys.stderr)
        sys.exit(11)
    expected = f"{prefix}/" + container + ":"
    if not image.startswith(expected):
        print(f"Imagem anterior inesperada para {{container}}: {{image}}", file=sys.stderr)
        sys.exit(12)
    tags.add(image.rsplit(":", 1)[1])
    subprocess.check_call(["docker", "image", "inspect", image], stdout=subprocess.DEVNULL)
if len(tags) != 1:
    print(f"Rollback exige todos os servicos no mesmo SHA/tag. Tags encontradas: {{sorted(tags)}}", file=sys.stderr)
    sys.exit(13)
tag = tags.pop()
with open(os.path.join(os.path.dirname(state_path), "rollback-tag.txt"), "w", encoding="utf-8") as fh:
    fh.write(tag)
print(tag)
PY
ROLLBACK_TAG=$(cat {shlex.quote(self.cfg.remote_deploy_dir.rstrip('/') + '/rollback-tag.txt')})
COMPOSE_FILE={shlex.quote(self.cfg.remote_deploy_dir.rstrip('/') + '/current-compose/docker-compose.hmg.yml')}
test -f "$COMPOSE_FILE"
export HMG_REGISTRY_PREFIX="$PREFIX"
export HMG_IMAGE_TAG="$ROLLBACK_TAG"
export HMG_ENV_FILE="$HOME/.env.hmg"
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
for cname in {' '.join(CONTAINERS)}; do
  docker rm -f "$cname" >/dev/null 2>&1 || true
done
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps
echo "Rollback aplicado para tag $ROLLBACK_TAG"
"""
        ssh.run(script, "rollback para imagens anteriores")


class DeployGui(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("RHPortal HMG Deploy")
        self.geometry("1180x780")
        self.minsize(980, 640)
        self.queue: queue.Queue[tuple[Any, ...]] = queue.Queue()
        self.worker: threading.Thread | None = None
        self.current_sha = ""
        self.mode_var = tk.StringVar(value="smart")
        self.config_data = self._load_config()
        self._build_ui()
        self.after(100, self._process_queue)

    def _load_config(self) -> dict[str, str]:
        data = dict(DEFAULT_CONFIG)
        if CONFIG_PATH.exists():
            try:
                with CONFIG_PATH.open("r", encoding="utf-8") as fh:
                    data.update(json.load(fh))
            except Exception:  # noqa: BLE001
                pass
        return data

    def _save_config(self) -> None:
        data = {
            "host": self.host_var.get().strip(),
            "user": self.user_var.get().strip(),
            "repo_path": self.repo_var.get().strip(),
            "remote_deploy_dir": self.remote_dir_var.get().strip(),
            "api_url": self.api_var.get().strip(),
            "admin_url": self.admin_var.get().strip(),
            "tenant": self.tenant_var.get().strip(),
        }
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with CONFIG_PATH.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        self._log("OK", f"Configuracao salva em {CONFIG_PATH}")

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=10)
        root.pack(fill=tk.BOTH, expand=True)

        form = ttk.LabelFrame(root, text="Configuracao")
        form.pack(fill=tk.X)
        for i in range(8):
            form.columnconfigure(i, weight=1 if i in (1, 3, 5, 7) else 0)

        self.host_var = tk.StringVar(value=self.config_data["host"])
        self.user_var = tk.StringVar(value=self.config_data["user"])
        self.password_var = tk.StringVar()
        self.repo_var = tk.StringVar(value=self.config_data["repo_path"])
        self.remote_dir_var = tk.StringVar(value=self.config_data["remote_deploy_dir"])
        self.api_var = tk.StringVar(value=self.config_data["api_url"])
        self.admin_var = tk.StringVar(value=self.config_data["admin_url"])
        self.tenant_var = tk.StringVar(value=self.config_data["tenant"])

        self._entry(form, "Host", self.host_var, 0, 0)
        self._entry(form, "Usuario", self.user_var, 0, 2)
        self._entry(form, "Senha", self.password_var, 0, 4, show="*")
        ttk.Button(form, text="Salvar config", command=self._save_config).grid(row=0, column=6, padx=6, pady=4, sticky="ew")

        self._entry(form, "Repo local", self.repo_var, 1, 0, colspan=5)
        ttk.Button(form, text="Procurar", command=self._browse_repo).grid(row=1, column=6, padx=6, pady=4, sticky="ew")
        ttk.Label(form, text="Branch: main").grid(row=1, column=7, padx=6, pady=4, sticky="w")

        self._entry(form, "Dir remoto", self.remote_dir_var, 2, 0, colspan=3)
        self._entry(form, "API URL", self.api_var, 2, 4, colspan=1)
        self._entry(form, "Admin URL", self.admin_var, 3, 0, colspan=3)
        self._entry(form, "Tenant", self.tenant_var, 3, 4, colspan=1)

        actions = ttk.Frame(root)
        actions.pack(fill=tk.X, pady=(10, 6))
        self.deploy_btn = ttk.Button(actions, text="Deploy main", command=self._start_deploy)
        self.deploy_btn.pack(side=tk.LEFT, padx=(0, 6))
        ttk.Radiobutton(actions, text="Inteligente", variable=self.mode_var, value="smart").pack(side=tk.LEFT, padx=6)
        ttk.Radiobutton(actions, text="Completo", variable=self.mode_var, value="full").pack(side=tk.LEFT, padx=6)
        self.rollback_btn = ttk.Button(actions, text="Rollback", command=self._start_rollback)
        self.rollback_btn.pack(side=tk.LEFT, padx=6)
        ttk.Button(actions, text="Copiar logs", command=self._copy_logs).pack(side=tk.LEFT, padx=6)
        ttk.Button(actions, text="Salvar logs", command=self._save_logs).pack(side=tk.LEFT, padx=6)
        ttk.Button(actions, text="Limpar logs", command=self._clear_logs).pack(side=tk.LEFT, padx=6)

        self.status_var = tk.StringVar(value="Pronto")
        self.progress = ttk.Progressbar(actions, orient=tk.HORIZONTAL, mode="determinate", maximum=100)
        self.progress.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(12, 0))
        ttk.Label(actions, textvariable=self.status_var).pack(side=tk.RIGHT, padx=(12, 0))

        log_frame = ttk.LabelFrame(root, text="Log")
        log_frame.pack(fill=tk.BOTH, expand=True)
        self.log_text = ScrolledText(log_frame, wrap=tk.WORD, font=("Consolas", 10), bg="#101418", fg="#d9e2ec")
        self.log_text.pack(fill=tk.BOTH, expand=True)
        self.log_text.tag_configure("INFO", foreground="#d9e2ec")
        self.log_text.tag_configure("OK", foreground="#7ddc83")
        self.log_text.tag_configure("WARN", foreground="#ffd166")
        self.log_text.tag_configure("ERROR", foreground="#ff6b6b")
        self._log("INFO", "Ferramenta pronta. Informe a senha do servidor e clique em Deploy main.")

    def _entry(
        self,
        parent: ttk.Frame,
        label: str,
        var: tk.StringVar,
        row: int,
        col: int,
        colspan: int = 1,
        show: str | None = None,
    ) -> None:
        ttk.Label(parent, text=label).grid(row=row, column=col, padx=6, pady=4, sticky="w")
        ttk.Entry(parent, textvariable=var, show=show).grid(
            row=row,
            column=col + 1,
            columnspan=colspan,
            padx=6,
            pady=4,
            sticky="ew",
        )

    def _browse_repo(self) -> None:
        path = filedialog.askdirectory(title="Selecione a raiz do repositorio RH")
        if path:
            self.repo_var.set(path)

    def _config_from_ui(self) -> DeployConfig:
        password = self.password_var.get()
        if not password:
            raise DeployError("Senha nao informada.", "Digite a senha SSH do servidor na GUI.")
        return DeployConfig(
            host=self.host_var.get().strip(),
            user=self.user_var.get().strip(),
            password=password,
            repo_path=Path(self.repo_var.get().strip()),
            remote_deploy_dir=self.remote_dir_var.get().strip().rstrip("/"),
            api_url=self.api_var.get().strip(),
            admin_url=self.admin_var.get().strip(),
            tenant=self.tenant_var.get().strip(),
        )

    def _start_deploy(self) -> None:
        self._start_worker("deploy")

    def _start_rollback(self) -> None:
        if not messagebox.askyesno("Confirmar rollback", "Deseja voltar para o ultimo SHA anterior salvo no servidor?"):
            return
        self._start_worker("rollback")

    def _start_worker(self, action: str) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showwarning("Operacao em andamento", "Aguarde a operacao atual terminar.")
            return
        try:
            cfg = self._config_from_ui()
        except DeployError as exc:
            messagebox.showerror("Configuracao invalida", f"{exc}\n\n{exc.suggestion or ''}")
            return
        self.deploy_btn.configure(state=tk.DISABLED)
        self.rollback_btn.configure(state=tk.DISABLED)
        self.progress.configure(value=0)
        self.status_var.set("Iniciando...")
        logger = EventLog(lambda level, text: self.queue.put(("log", level, text)))
        runner = DeployRunner(
            cfg,
            logger,
            lambda value, text: self.queue.put(("progress", value, text)),
            self._ask_yes_no_threadsafe,
            deploy_mode=self.mode_var.get(),
        )
        target = runner.deploy if action == "deploy" else runner.rollback
        self.worker = threading.Thread(target=self._worker_wrapper, args=(target,), daemon=True)
        self.worker.start()

    def _worker_wrapper(self, target: Callable[[], None]) -> None:
        try:
            target()
            self.queue.put(("done",))
        except Exception:
            self.queue.put(("failed",))

    def _ask_yes_no_threadsafe(self, title: str, message: str) -> bool:
        event = threading.Event()
        payload: dict[str, bool] = {"answer": False}
        self.queue.put(("confirm", title, message, event, payload))
        event.wait()
        return payload["answer"]

    def _process_queue(self) -> None:
        try:
            while True:
                event = self.queue.get_nowait()
                kind = event[0]
                if kind == "log":
                    self._log(event[1], event[2])
                elif kind == "progress":
                    self.progress.configure(value=event[1])
                    self.status_var.set(event[2])
                elif kind == "confirm":
                    _, title, message, done, payload = event
                    payload["answer"] = messagebox.askyesno(title, message)
                    done.set()
                elif kind == "done":
                    self.deploy_btn.configure(state=tk.NORMAL)
                    self.rollback_btn.configure(state=tk.NORMAL)
                elif kind == "failed":
                    self.deploy_btn.configure(state=tk.NORMAL)
                    self.rollback_btn.configure(state=tk.NORMAL)
                    messagebox.showerror("Operacao falhou", "A operacao falhou. Veja o log para detalhes.")
        except queue.Empty:
            pass
        self.after(100, self._process_queue)

    def _log(self, level: str, text: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        line = f"[{timestamp}] [{level}] {text}\n"
        self.log_text.insert(tk.END, line, level)
        self.log_text.see(tk.END)
        if "SHA publicado:" in text:
            self.current_sha = text.split("SHA publicado:", 1)[1].split(".", 1)[0].strip()

    def _copy_logs(self) -> None:
        self.clipboard_clear()
        self.clipboard_append(self.log_text.get("1.0", tk.END))
        self._log("OK", "Logs copiados para a area de transferencia.")

    def _save_logs(self) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        suffix = self.current_sha[:12] if self.current_sha else "sem-sha"
        default = LOG_DIR / f"hmg-deploy-{datetime.now():%Y%m%d-%H%M%S}-{suffix}.log"
        path = filedialog.asksaveasfilename(
            title="Salvar logs",
            initialdir=str(LOG_DIR),
            initialfile=default.name,
            defaultextension=".log",
            filetypes=[("Log files", "*.log"), ("Text files", "*.txt"), ("All files", "*.*")],
        )
        if path:
            Path(path).write_text(self.log_text.get("1.0", tk.END), encoding="utf-8")
            self._log("OK", f"Logs salvos em {path}")

    def _clear_logs(self) -> None:
        self.log_text.delete("1.0", tk.END)
        self._log("INFO", "Logs limpos.")


def main() -> int:
    app = DeployGui()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
