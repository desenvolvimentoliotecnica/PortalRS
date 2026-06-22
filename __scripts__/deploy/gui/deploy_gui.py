from __future__ import annotations

import json
import os
import posixpath
import queue
import re
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
_DEPLOY_SCRIPTS_DIR = APP_DIR.parent if APP_DIR.name == "gui" else APP_DIR
if str(_DEPLOY_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_DEPLOY_SCRIPTS_DIR))
from deploy_env import ENVIRONMENTS, IMAGE_PREFIX, DeployEnvironment

CONFIG_PATH = APP_DIR / "deploy_gui_config.json"
LOG_DIR = APP_DIR / "logs"
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


def _format_disk_bytes(n: int) -> str:
    """Human-readable size (binary units)."""
    x = float(n)
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if abs(x) < 1024.0 or unit == "TiB":
            return f"{x:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        x /= 1024.0
    return f"{x:.1f} TiB"


def _parse_disk_marker(text: str, marker: str) -> int | None:
    m = re.search(re.escape(marker) + r"=(\d+)", text)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


DEFAULT_CONFIG = {
    "environment_id": "dev",
    "host": "10.0.0.79",
    "user": "administrator",
    "repo_path": str(Path.cwd()),
    "remote_deploy_dir": "/home/administrator/rh-deploys-dev",
    "api_url": "http://10.0.0.79:5000",
    "admin_url": "http://10.0.0.79:3000",
    "portal_vagas_url": "http://10.0.0.79:3050",
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
    portal_vagas_url: str
    tenant: str
    environment_id: str = "dev"

    @property
    def environment(self) -> DeployEnvironment:
        env = ENVIRONMENTS.get(self.environment_id)
        if env is None:
            raise DeployError(
                f"Ambiente desconhecido: {self.environment_id}",
                f"Use um de: {', '.join(ENVIRONMENTS)}",
            )
        return env

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
        self.env = cfg.environment
        self.sha = ""
        self.archive_path: Path | None = None
        self.changed_files: list[str] = []
        self.changed_files_reliable = False
        self.services_to_build: list[str] = list(ALL_SERVICES)

    def deploy(self) -> None:
        started = time.monotonic()
        try:
            self.set_progress(3, "Preflight local")
            self._local_preflight()
            self.set_progress(15, "Gerando snapshot")
            self._create_archive()
            with SshSession(self.cfg, self.log) as ssh:
                self.set_progress(22, "Limpeza de disco no servidor")
                self._remote_disk_cleanup(ssh)
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
        branch = self.env.branch
        self._run_local(
            ["git", "fetch", "origin", f"refs/heads/{branch}:refs/remotes/origin/{branch}"],
            repo,
            f"fetch {branch}",
        )
        _, sha = self._run_local(["git", "rev-parse", f"origin/{branch}"], repo, "obter SHA")
        self.sha = sha.strip()
        _, commit = self._run_local(
            ["git", "show", "-s", "--format=%h %ci %s", f"origin/{branch}"],
            repo,
            "dados do commit",
        )
        self.log.ok(f"{branch} atual: {commit.strip()}")

    def _create_archive(self) -> None:
        if not self.sha:
            raise DeployError(f"SHA da branch {self.env.branch} nao foi calculado.")
        target = Path(tempfile.gettempdir()) / f"rh-{self.env.id}-{self.sha[:12]}.tar.gz"
        if target.exists():
            target.unlink()
        self._run_local(
            ["git", "archive", "--format=tar.gz", "-o", str(target), f"origin/{self.env.branch}"],
            self.cfg.repo_path,
            "gerar snapshot",
        )
        size_mb = target.stat().st_size / 1024 / 1024
        self.archive_path = target
        self.log.ok(f"Snapshot gerado: {target} ({size_mb:.1f} MB)")

    def _remote_disk_cleanup(self, ssh: SshSession) -> None:
        """Free server disk before upload/build (build-cache, old SHA snapshots, Docker builder cache)."""
        root = self.cfg.remote_deploy_dir.rstrip("/")
        script = f"""
set -euo pipefail
export LC_ALL=C
DEPLOY_ROOT={shlex.quote(root)}

avail_bytes() {{
  local v
  v=$(df -B1 / 2>/dev/null | awk 'NR==2 {{print $4}}' || true)
  if [[ -n "$v" && "$v" =~ ^[0-9]+$ ]]; then
    echo "$v"
    return 0
  fi
  df -Pk / 2>/dev/null | awk 'NR==2 {{print $4 * 1024}}'
}}

BEFORE=$(avail_bytes || echo "0")
echo "__RH_DEPLOY_DISK_BEFORE__=${{BEFORE}}__"
df -h / || true
echo ">>> Removendo build-cache em $DEPLOY_ROOT/build-cache"
rm -rf "$DEPLOY_ROOT/build-cache"
echo ">>> Removendo snapshots antigos (pastas com nome SHA git, 40 hex) em $DEPLOY_ROOT"
shopt -s nullglob
for d in "$DEPLOY_ROOT"/*; do
  [[ -d "$d" ]] || continue
  base=$(basename "$d")
  if [[ "$base" =~ ^[0-9a-f]{{40}}$ ]]; then
    echo "  rm -rf $d"
    rm -rf "$d"
  fi
done
if command -v docker >/dev/null 2>&1; then
  echo ">>> docker builder prune -af"
  docker builder prune -af || echo "WARN: docker builder prune retornou erro (continuando)"
  echo ">>> docker image prune -f (imagens pendentes / dangling)"
  docker image prune -f || true
  echo ">>> docker image prune -af (imagens sem container — libera espaco para build)"
  docker image prune -af || true
else
  echo "WARN: docker nao encontrado; pulando prune de builder"
fi
AFTER=$(avail_bytes || echo "0")
echo "__RH_DEPLOY_DISK_AFTER__=${{AFTER}}__"
df -h / || true
"""
        _, output = ssh.run(script, "limpeza de disco remota (pre-deploy)")
        before = _parse_disk_marker(output, "__RH_DEPLOY_DISK_BEFORE__")
        after = _parse_disk_marker(output, "__RH_DEPLOY_DISK_AFTER__")
        if before is not None and after is not None and before >= 0 and after >= 0:
            gained = after - before
            self.log.ok(
                "Disco em / apos limpeza: "
                f"{_format_disk_bytes(after)} livres "
                f"(antes: {_format_disk_bytes(before)}; "
                f"ganho aproximado: {_format_disk_bytes(gained)})."
            )
        elif after is not None and after >= 0:
            self.log.ok(f"Disco em / apos limpeza: {_format_disk_bytes(after)} livres (antes nao medido).")
        else:
            self.log.warn("Nao foi possivel ler espaco livre apos limpeza; veja df -h no log acima.")

    def _remote_preflight(self, ssh: SshSession) -> None:
        env = self.env
        script = f"""
set -euo pipefail
echo "Host: $(hostname)"
echo "Usuario: $(whoami)"
echo "Ambiente: {env.label}"
command -v docker
docker --version
docker compose version
if docker buildx version >/dev/null 2>&1; then
  docker buildx version
  echo "OK: docker buildx disponivel"
else
  echo "WARN: docker buildx indisponivel; cache persistente avancado sera desativado"
fi
command -v tar
command -v python3
df -h /home /var/lib/docker 2>/dev/null || df -h /
if docker network inspect {shlex.quote(env.docker_network)} >/dev/null 2>&1; then
  echo "OK: rede {env.docker_network} existe"
else
  echo "WARN: rede {env.docker_network} nao existe; sera criada no deploy"
fi
ENV_FILE={env.env_file}
if [[ -f "$ENV_FILE" ]]; then
  echo "OK: $ENV_FILE encontrado"
else
  echo "ERROR: $ENV_FILE nao encontrado"
  exit 12
fi
missing_ai=0
for key in DATABASE_URL OPENAI_API_KEY; do
  if grep -qE "^${{key}}=" "$ENV_FILE"; then
    echo "OK: ${{key}}=<set>"
  else
    echo "WARN: ${{key}} ausente no env file"
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
            self.log.warn("Continuando automaticamente; a validacao final destacara o health 503 se ele ocorrer.")

    def _service_plan_from_files(self, files: list[str]) -> tuple[list[str], str]:
        if self.deploy_mode == "full":
            return list(ALL_SERVICES), "modo completo selecionado"
        if not files:
            if self.changed_files_reliable:
                return [], "nenhuma mudanca de runtime detectada"
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
                "docker-compose.portalrh-dev.yml",
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
  export STATE_PATH
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
        self.changed_files_reliable = False
        code, output = ssh.run(script, "ler ultimo SHA publicado", check=False)
        previous_sha = ""
        if code == 0:
            for line in reversed(output.strip().splitlines()):
                value = line.strip()
                if len(value) == 40 and all(char in "0123456789abcdefABCDEF" for char in value):
                    previous_sha = value
                    break
        else:
            self.log.warn("Nao foi possivel ler deploy-state.json anterior; usando build completo.")
        if previous_sha:
            self.log.info(f"Ultimo SHA registrado no servidor: {previous_sha}")
            code, diff_output = self._run_local(
                ["git", "diff", "--name-only", f"{previous_sha}..origin/{self.env.branch}"],
                self.cfg.repo_path,
                "diff desde ultimo deploy",
                check=False,
            )
            if code == 0:
                self.changed_files = [line.strip() for line in diff_output.splitlines() if line.strip()]
                self.changed_files_reliable = True
            else:
                self.log.warn("Nao foi possivel calcular diff local; usando build completo.")
                self.changed_files = []
        else:
            if code == 0:
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
        compose_file = self.env.compose_file
        remote_dir = f"{self.cfg.remote_deploy_dir.rstrip('/')}/{self.sha}"
        remote_archive = f"{remote_dir}/source.tar.gz"
        current_src = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-src"
        compose_dest = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-compose/{compose_file}"
        compose_dest_dir = posixpath.dirname(compose_dest)
        ssh.upload(self.archive_path, remote_archive, lambda sent, total: self.set_progress(35, "Upload do snapshot"))
        script = f"""
set -euo pipefail
REMOTE_DIR={shlex.quote(remote_dir)}
CURRENT_SRC={shlex.quote(current_src)}
COMPOSE_FILE={shlex.quote(compose_file)}
COMPOSE_DEST={shlex.quote(compose_dest)}
COMPOSE_DEST_DIR={shlex.quote(compose_dest_dir)}
rm -rf "$REMOTE_DIR/src"
mkdir -p "$REMOTE_DIR/src"
tar -xzf "$REMOTE_DIR/source.tar.gz" -C "$REMOTE_DIR/src"
test -f "$REMOTE_DIR/src/$COMPOSE_FILE"
rm -rf "$CURRENT_SRC"
mkdir -p "$CURRENT_SRC"
tar -xzf "$REMOTE_DIR/source.tar.gz" -C "$CURRENT_SRC"
test -f "$CURRENT_SRC/$COMPOSE_FILE"
mkdir -p "$COMPOSE_DEST_DIR"
cp "$CURRENT_SRC/$COMPOSE_FILE" "$COMPOSE_DEST"
echo "Snapshot extraido em $CURRENT_SRC"
"""
        ssh.run(script, "extrair snapshot")

    def _remote_build(self, ssh: SshSession) -> None:
        src = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-src"
        services = " ".join(self.services_to_build)
        image_pairs = " ".join(
            f"{repo}:{self.env.container_for_image(repo)}" for repo in self.env.image_repos
        )
        script = f"""
set -euo pipefail
cd {shlex.quote(src)}
TAG={shlex.quote(self.sha)}
PREFIX={shlex.quote(IMAGE_PREFIX)}
DEPLOY_ROOT={shlex.quote(self.cfg.remote_deploy_dir.rstrip('/'))}
SERVICES={shlex.quote(services)}
IMAGE_PAIRS={shlex.quote(image_pairs)}
export DOCKER_BUILDKIT=1
mkdir -p "$DEPLOY_ROOT/build-cache"
build_cached() {{
  svc="$1"
  shift
  cache_dir="$DEPLOY_ROOT/build-cache/$svc"
  mkdir -p "$cache_dir"
  if docker buildx version >/dev/null 2>&1; then
    echo "Cache BuildKit: $cache_dir"
    rm -rf "$cache_dir.new"
    docker buildx build \\
      --progress=plain \\
      --load \\
      --cache-from "type=local,src=$cache_dir" \\
      --cache-to "type=local,dest=$cache_dir.new,mode=min" \\
      "$@"
    rm -rf "$cache_dir.old"
    if [[ -d "$cache_dir.new" ]]; then
      mv "$cache_dir" "$cache_dir.old" 2>/dev/null || true
      mv "$cache_dir.new" "$cache_dir"
      rm -rf "$cache_dir.old"
    fi
  else
    echo "Build sem buildx/cache persistente para $svc"
    docker build "$@"
  fi
}}
echo "Servicos selecionados para build: ${{SERVICES:-nenhum}}"
for svc in $SERVICES; do
  case "$svc" in
    api)
      echo "==> Build API $TAG"
      build_cached api -f RHPortal.Api/Dockerfile -t "$PREFIX/rhportal-api:$TAG" .
      ;;
    web-next)
      echo "==> Build Web Next $TAG"
      build_cached web-next -f LioTecnica.Web.Next/Dockerfile \\
        --build-arg NEXT_PUBLIC_API_BASE={shlex.quote(self.cfg.api_base)} \\
        --build-arg NEXT_PUBLIC_PORTAL_ORIGIN={shlex.quote(self.cfg.admin_base)} \\
        --build-arg NEXT_PUBLIC_PORTAL_VAGAS_URL={shlex.quote(self.cfg.portal_vagas_url)} \\
        --build-arg NEXT_PUBLIC_APP_ENVIRONMENT={shlex.quote(self.env.app_environment)} \\
        --build-arg NEXT_PUBLIC_APP_VERSION={shlex.quote(self.sha[:12])} \\
        -t "$PREFIX/rhportal-web-next:$TAG" .
      ;;
    portal-vagas)
      echo "==> Build Portal Vagas $TAG"
      build_cached portal-vagas -f LioTecnica.PortalVagas.React/Dockerfile \\
        --build-arg VITE_API_BASE_URL= \\
        --build-arg VITE_DEFAULT_TENANT={shlex.quote(self.cfg.tenant)} \\
        -t "$PREFIX/rhportal-portal-vagas:$TAG" LioTecnica.PortalVagas.React
      ;;
    ai)
      echo "==> Build AI $TAG"
      build_cached ai -f RHPortal.Ai/Dockerfile -t "$PREFIX/rhportal-ai:$TAG" .
      ;;
    *)
      echo "Servico desconhecido: $svc" >&2
      exit 44
      ;;
  esac
done
echo "==> Garantindo tag $TAG para servicos reaproveitados"
for pair in $IMAGE_PAIRS; do
  img_repo="${{pair%%:*}}"
  cname="${{pair##*:}}"
  target="$PREFIX/$img_repo:$TAG"
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
docker images "$PREFIX/" --format 'table {{{{.Repository}}}}\\t{{{{.Tag}}}}\\t{{{{.CreatedSince}}}}\\t{{{{.Size}}}}' | grep "$TAG" || true
"""
        ssh.run(script, "build das imagens Docker")

    def _remote_up(self, ssh: SshSession) -> None:
        env = self.env
        src = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-src"
        state_path = f"{self.cfg.remote_deploy_dir.rstrip('/')}/deploy-state.json"
        compose_dest = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-compose/{env.compose_file}"
        containers_json = json.dumps(list(env.containers))
        script = f"""
set -euo pipefail
TAG={shlex.quote(self.sha)}
PREFIX={shlex.quote(IMAGE_PREFIX)}
DEPLOY_ROOT={shlex.quote(self.cfg.remote_deploy_dir.rstrip('/'))}
STATE_PATH={shlex.quote(state_path)}
SRC={shlex.quote(src)}
COMPOSE_FILE={shlex.quote(env.compose_file)}
COMPOSE_DEST={shlex.quote(compose_dest)}
DOCKER_NETWORK_NAME={shlex.quote(env.docker_network)}
DOCKER_NETWORK_SUBNET={shlex.quote(env.docker_network_subnet)}
export TAG PREFIX DEPLOY_ROOT STATE_PATH SRC COMPOSE_FILE COMPOSE_DEST DOCKER_NETWORK_NAME DOCKER_NETWORK_SUBNET
mkdir -p "$DEPLOY_ROOT"
python3 - <<'PY'
import json, os, subprocess, time
containers = {containers_json}
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
    "environment": {json.dumps(env.id)},
    "previous_images": current,
    "compose_path": os.environ["COMPOSE_DEST"],
}}
with open(state_path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
print(f"Estado anterior salvo em {{state_path}}")
PY
PURGE_SCRIPT="$SRC/__scripts__/deploy/docker-deploy-purge.sh"
if [[ -x "$PURGE_SCRIPT" ]]; then
  DEPLOY_PURGE_REGISTRY_PREFIX="$PREFIX" DEPLOY_PURGE_KEEP_TAG="$TAG" DEPLOY_PURGE_PHASE=pre-up bash "$PURGE_SCRIPT"
fi
current_subnet="$(docker network inspect "$DOCKER_NETWORK_NAME" --format '{{{{range .IPAM.Config}}}}{{{{.Subnet}}}}{{{{end}}}}' 2>/dev/null || true)"
if [[ -n "$current_subnet" && "$current_subnet" != "$DOCKER_NETWORK_SUBNET" ]]; then
  echo "Recriando rede $DOCKER_NETWORK_NAME: subnet atual $current_subnet, desejada $DOCKER_NETWORK_SUBNET"
  docker network rm "$DOCKER_NETWORK_NAME" 2>/dev/null || true
  current_subnet=""
fi
if [[ -z "$current_subnet" ]]; then
  docker network create --subnet "$DOCKER_NETWORK_SUBNET" "$DOCKER_NETWORK_NAME"
fi
cd "$SRC"
export {env.registry_prefix_var}="$PREFIX"
export {env.image_tag_var}="$TAG"
export {env.portal_vagas_url_var}={shlex.quote(self.cfg.portal_vagas_url)}
export {env.compose_env_file_var}={env.env_file}
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
for cname in {' '.join(env.containers)}; do
  docker rm -f "$cname" >/dev/null 2>&1 || true
done
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps
if [[ -x "$PURGE_SCRIPT" ]]; then
  DEPLOY_PURGE_REGISTRY_PREFIX="$PREFIX" DEPLOY_PURGE_KEEP_TAG="$TAG" DEPLOY_PURGE_PHASE=post-up bash "$PURGE_SCRIPT"
fi
"""
        ssh.run(script, f"subir stack {env.label}")

    def _remote_validate(self, ssh: SshSession) -> None:
        env = self.env
        container_loop = "\n".join(
            f'  printf "%s " "{c}"\n  docker inspect "{c}" --format \'{{{{.Config.Image}}}}\''
            for c in env.containers
        )
        port = env.health_api_port
        script = f"""
set -euo pipefail
echo "==> Containers"
docker ps --filter name=rhportal --format 'table {{{{.Names}}}}\\t{{{{.Image}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}'
echo "==> Imagens efetivas"
for c in {' '.join(env.containers)}; do
  printf "%s " "$c"
  docker inspect "$c" --format '{{{{.Config.Image}}}}'
  echo
done
retry_url() {{
  name="$1"
  url="$2"
  for attempt in $(seq 1 30); do
    code=$(curl -sS -o /dev/null -w '%{{http_code}}' "$url" 2>/tmp/rhportal-curl-error || true)
    if [[ "$code" == "200" ]]; then
      echo "${{name}}:200"
      return 0
    fi
    echo "${{name}}:aguardando (${{attempt}}/30, code=${{code:-FAIL}})"
    sleep 5
  done
  echo "${{name}}:FAIL"
  cat /tmp/rhportal-curl-error 2>/dev/null || true
  return 1
}}
echo "==> Endpoints obrigatorios"
retry_url api-health http://127.0.0.1:{port}/health
swagger_code=$(curl -sS -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{port}/swagger/index.html 2>/dev/null || true)
echo "api-swagger:${{swagger_code:-FAIL}}"
if [[ "$swagger_code" == "401" ]]; then
  echo "WARN: Swagger retornou 401 (protegido); isso e esperado em Production/DEV com auth."
elif [[ "$swagger_code" != "200" && "$swagger_code" != "401" ]]; then
  echo "WARN: Swagger inesperado (code=${{swagger_code:-FAIL}}); verifique manualmente se necessario."
fi
retry_url web-health http://127.0.0.1:3000/health
retry_url web-app http://127.0.0.1:3000/app/login
retry_url portal-vagas http://127.0.0.1:3050/
echo "==> Health agregado da API"
health_body=$(mktemp)
health_code=$(curl -sS -o "$health_body" -w '%{{http_code}}' http://127.0.0.1:{port}/health || true)
echo "api-health:${{health_code}}"
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
        env = self.env
        state_path = f"{self.cfg.remote_deploy_dir.rstrip('/')}/deploy-state.json"
        container_to_image = {env.container_for_image(r): r for r in env.image_repos}
        compose_dest = f"{self.cfg.remote_deploy_dir.rstrip('/')}/current-compose/{env.compose_file}"
        script = f"""
set -euo pipefail
STATE_PATH={shlex.quote(state_path)}
PREFIX={shlex.quote(IMAGE_PREFIX)}
COMPOSE_FILE={shlex.quote(compose_dest)}
export STATE_PATH PREFIX COMPOSE_FILE
python3 - <<'PY'
import json, os, subprocess, sys
state_path = os.environ["STATE_PATH"]
prefix = os.environ["PREFIX"]
containers = {json.dumps(list(env.containers))}
container_to_image = {json.dumps(container_to_image)}
with open(state_path, "r", encoding="utf-8") as fh:
    state = json.load(fh)
images = state.get("previous_images") or {{}}
tags = set()
for container in containers:
    image = images.get(container)
    if not image:
        print(f"Imagem anterior ausente para {{container}}", file=sys.stderr)
        sys.exit(11)
    image_repo = container_to_image.get(container)
    if not image_repo:
        print(f"Mapeamento de imagem ausente para {{container}}", file=sys.stderr)
        sys.exit(12)
    expected = f"{{prefix}}/{{image_repo}}:"
    if not image.startswith(expected):
        print(f"Imagem anterior inesperada para {{container}}: {{image}}", file=sys.stderr)
        sys.exit(13)
    tags.add(image.rsplit(":", 1)[1])
    subprocess.check_call(["docker", "image", "inspect", image], stdout=subprocess.DEVNULL)
if len(tags) != 1:
    print(f"Rollback exige todos os servicos no mesmo SHA/tag. Tags encontradas: {{sorted(tags)}}", file=sys.stderr)
    sys.exit(14)
tag = tags.pop()
with open(os.path.join(os.path.dirname(state_path), "rollback-tag.txt"), "w", encoding="utf-8") as fh:
    fh.write(tag)
print(tag)
PY
ROLLBACK_TAG=$(cat {shlex.quote(self.cfg.remote_deploy_dir.rstrip('/') + '/rollback-tag.txt')})
test -f "$COMPOSE_FILE"
export {env.registry_prefix_var}="$PREFIX"
export {env.image_tag_var}="$ROLLBACK_TAG"
export {env.portal_vagas_url_var}={shlex.quote(self.cfg.portal_vagas_url)}
export {env.compose_env_file_var}={env.env_file}
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
for cname in {' '.join(env.containers)}; do
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
        self.title("RHPortal Deploy via SSH")
        self.geometry("1180x780")
        self.minsize(980, 640)
        self.queue: queue.Queue[tuple[Any, ...]] = queue.Queue()
        self.worker: threading.Thread | None = None
        self.current_sha = ""
        self.mode_var = tk.StringVar(value="smart")
        self.config_data = self._load_config()
        self._build_ui()
        self.after(100, self._process_queue)

    def _apply_environment_defaults(self, env_id: str) -> None:
        env = ENVIRONMENTS.get(env_id)
        if env is None:
            return
        self.host_var.set(env.default_host)
        self.remote_dir_var.set(env.default_remote_dir)
        self.api_var.set(env.default_api_url)
        self.admin_var.set(env.default_admin_url)
        self.portal_vagas_var.set(env.default_portal_vagas_url)
        self.tenant_var.set(env.default_tenant)
        self.branch_label_var.set(f"Branch: {env.branch}")

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
            "environment_id": self.environment_var.get().split("—", 1)[0].strip(),
            "host": self.host_var.get().strip(),
            "user": self.user_var.get().strip(),
            "repo_path": self.repo_var.get().strip(),
            "remote_deploy_dir": self.remote_dir_var.get().strip(),
            "api_url": self.api_var.get().strip(),
            "admin_url": self.admin_var.get().strip(),
            "portal_vagas_url": self.portal_vagas_var.get().strip(),
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

        self.host_var = tk.StringVar(value=self.config_data.get("host", DEFAULT_CONFIG["host"]))
        self.user_var = tk.StringVar(value=self.config_data.get("user", DEFAULT_CONFIG["user"]))
        self.password_var = tk.StringVar()
        self.repo_var = tk.StringVar(value=self.config_data.get("repo_path", DEFAULT_CONFIG["repo_path"]))
        self.remote_dir_var = tk.StringVar(value=self.config_data.get("remote_deploy_dir", DEFAULT_CONFIG["remote_deploy_dir"]))
        self.api_var = tk.StringVar(value=self.config_data.get("api_url", DEFAULT_CONFIG["api_url"]))
        self.admin_var = tk.StringVar(value=self.config_data.get("admin_url", DEFAULT_CONFIG["admin_url"]))
        self.portal_vagas_var = tk.StringVar(value=self.config_data.get("portal_vagas_url", DEFAULT_CONFIG["portal_vagas_url"]))
        self.tenant_var = tk.StringVar(value=self.config_data.get("tenant", DEFAULT_CONFIG["tenant"]))
        initial_env = self.config_data.get("environment_id", DEFAULT_CONFIG["environment_id"])
        if initial_env not in ENVIRONMENTS:
            initial_env = "dev"
        self.environment_var = tk.StringVar(value=f"{initial_env} — {ENVIRONMENTS[initial_env].label}")
        self.branch_label_var = tk.StringVar(value=f"Branch: {ENVIRONMENTS[initial_env].branch}")

        env_row = ttk.Frame(form)
        env_row.grid(row=0, column=0, columnspan=8, sticky="ew", padx=6, pady=(4, 8))
        ttk.Label(env_row, text="Ambiente").pack(side=tk.LEFT)
        env_combo = ttk.Combobox(
            env_row,
            textvariable=self.environment_var,
            values=[f"{e.id} — {e.label}" for e in ENVIRONMENTS.values()],
            state="readonly",
            width=28,
        )
        env_combo.pack(side=tk.LEFT, padx=(8, 12))
        env_combo.bind("<<ComboboxSelected>>", self._on_environment_changed)
        ttk.Label(env_row, textvariable=self.branch_label_var).pack(side=tk.LEFT)
        ttk.Label(env_row, text="(sem GitHub Actions / GHCR)").pack(side=tk.LEFT, padx=(12, 0))

        self._entry(form, "Host", self.host_var, 1, 0)
        self._entry(form, "Usuario", self.user_var, 1, 2)
        self._entry(form, "Senha", self.password_var, 1, 4, show="*")
        ttk.Button(form, text="Salvar config", command=self._save_config).grid(row=1, column=6, padx=6, pady=4, sticky="ew")

        self._entry(form, "Repo local", self.repo_var, 2, 0, colspan=5)
        ttk.Button(form, text="Procurar", command=self._browse_repo).grid(row=2, column=6, padx=6, pady=4, sticky="ew")

        self._entry(form, "Dir remoto", self.remote_dir_var, 3, 0, colspan=3)
        self._entry(form, "API URL", self.api_var, 3, 4, colspan=1)
        self._entry(form, "Admin URL", self.admin_var, 4, 0, colspan=3)
        self._entry(form, "Portal Vagas URL", self.portal_vagas_var, 4, 4, colspan=1)
        self._entry(form, "Tenant", self.tenant_var, 5, 0, colspan=1)

        actions = ttk.Frame(root)
        actions.pack(fill=tk.X, pady=(10, 6))
        self.deploy_btn = ttk.Button(actions, text="Deploy", command=self._start_deploy)
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
        self._log("INFO", "Ferramenta pronta. Escolha DEV ou HMG, informe a senha SSH e clique em Deploy.")

    def _on_environment_changed(self, _event: object | None = None) -> None:
        raw = self.environment_var.get().split("—", 1)[0].strip()
        self._apply_environment_defaults(raw)
        self.environment_var.set(f"{raw} — {ENVIRONMENTS[raw].label}")

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
        env_id = self.environment_var.get().split("—", 1)[0].strip()
        return DeployConfig(
            host=self.host_var.get().strip(),
            user=self.user_var.get().strip(),
            password=password,
            repo_path=Path(self.repo_var.get().strip()),
            remote_deploy_dir=self.remote_dir_var.get().strip().rstrip("/"),
            api_url=self.api_var.get().strip(),
            admin_url=self.admin_var.get().strip(),
            portal_vagas_url=self.portal_vagas_var.get().strip(),
            tenant=self.tenant_var.get().strip(),
            environment_id=env_id,
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
