#!/usr/bin/env python3
"""
Importação em massa de Descrições de Cargo (DOCX / template DNALIO) para o Portal RH.

GUI Tkinter — escolha ambiente (DEV / HML / PRD), pasta raiz (inclui subpastas),
login na API e feedback em tempo real.

Requisitos: Python 3.10+ (stdlib apenas).

Uso:
    python scripts/import_descricao_cargo_gui.py

Login: usa /api/auth/auto-login (igual ao Portal web). Usuários Owner (ex.: owner@dev.local)
precisam informar o tenant alvo (ex.: liotecnica); o script faz switch-tenant automaticamente.

Config opcional (não versionar): scripts/import_descricao_cargo.local.json
    {
      "email": "admin@dev.local",
      "tenant_id": "liotecnica",
      "last_folder": "C:\\\\Users\\\\...\\\\Descrição de Cargos"
    }
"""

from __future__ import annotations

import json
import queue
import threading
import tkinter as tk
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_CONFIG = SCRIPT_DIR / "import_descricao_cargo.local.json"

BATCH_SIZE = 50
REQUEST_TIMEOUT_SEC = 300

ENV_PRESETS = {
    "DEV": "http://10.0.0.79:5000",
    "HML": "http://10.0.0.80:5000",
    "PRD": "http://10.0.0.88:5000",
}


@dataclass(frozen=True)
class ImportItemResult:
    file_name: str
    success: bool
    title: str | None
    descricao_cargo_id: str | None
    warnings: list[str]


@dataclass(frozen=True)
class ImportBatchResult:
    total: int
    success_count: int
    failure_count: int
    items: list[ImportItemResult]


def load_local_config() -> dict:
    if not LOCAL_CONFIG.exists():
        return {}
    try:
        return json.loads(LOCAL_CONFIG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_local_config(data: dict) -> None:
    try:
        LOCAL_CONFIG.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def normalize_api_base(url: str) -> str:
    return url.strip().rstrip("/")


def discover_docx_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() != ".docx":
            continue
        if path.name.startswith("~$"):
            continue
        files.append(path)
    return files


def build_multipart_body(file_paths: list[Path]) -> tuple[bytes, str]:
    boundary = "----PortalRHImportBoundary7MA4YWxkTrZu0gW"
    body = BytesIO()
    for file_path in file_paths:
        content = file_path.read_bytes()
        body.write(f"--{boundary}\r\n".encode("ascii"))
        body.write(
            (
                f'Content-Disposition: form-data; name="files"; '
                f'filename="{file_path.name}"\r\n'
            ).encode("utf-8")
        )
        body.write(
            b"Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n"
        )
        body.write(content)
        body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode("ascii"))
    return body.getvalue(), boundary


def api_auto_login(api_base: str, email: str, password: str) -> tuple[str, str]:
    """Login sem tenant (igual ao Portal web). Retorna (token, tenantId)."""
    payload = json.dumps({"email": email.strip(), "password": password}).encode("utf-8")
    req = Request(
        f"{api_base}/api/auth/auto-login",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("accessToken") or data.get("AccessToken")
    tenant_id = data.get("tenantId") or data.get("TenantId") or ""
    if not token:
        raise RuntimeError("Auto-login OK, mas a API não retornou accessToken.")
    return str(token), str(tenant_id)


def api_switch_tenant(api_base: str, token: str, source_tenant: str, target_tenant: str) -> str:
    payload = json.dumps({"tenantId": target_tenant.strip()}).encode("utf-8")
    req = Request(
        f"{api_base}/api/me/switch-tenant",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": source_tenant.strip(),
        },
        method="POST",
    )
    with urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    new_token = data.get("accessToken") or data.get("AccessToken")
    if not new_token:
        raise RuntimeError("Switch tenant OK, mas a API não retornou accessToken.")
    return str(new_token)


def api_login(api_base: str, tenant_id: str, email: str, password: str) -> str:
    target_tenant = tenant_id.strip()
    email_norm = email.strip()
    password_val = password

    # Portal web usa auto-login (Owner primeiro, depois tenants). /api/auth/login
    # só autentica usuário do tenant informado — owner@dev.local não existe lá.
    try:
        token, resolved_tenant = api_auto_login(api_base, email_norm, password_val)
        resolved_lower = resolved_tenant.lower()
        target_lower = target_tenant.lower()

        if resolved_lower == "owner" and target_lower and target_lower != "owner":
            token = api_switch_tenant(api_base, token, "owner", target_tenant)
        elif resolved_lower and target_lower and resolved_lower != target_lower and resolved_lower != "owner":
            # Usuário encontrado em outro tenant; tenta login direto no tenant alvo.
            token = _api_login_tenant(api_base, target_tenant, email_norm, password_val)
        return token
    except HTTPError as exc:
        if exc.code not in (401, 403):
            raise
    except URLError:
        raise

    return _api_login_tenant(api_base, target_tenant, email_norm, password_val)


def _api_login_tenant(api_base: str, tenant_id: str, email: str, password: str) -> str:
    payload = json.dumps({"email": email.strip(), "password": password}).encode("utf-8")
    req = Request(
        f"{api_base}/api/auth/login",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Tenant-Id": tenant_id.strip(),
        },
        method="POST",
    )
    with urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("accessToken") or data.get("AccessToken")
    if not token:
        raise RuntimeError("Login OK, mas a API não retornou accessToken.")
    return str(token)


def api_import_batch(
    api_base: str,
    tenant_id: str,
    token: str,
    file_paths: list[Path],
    overwrite: bool,
) -> ImportBatchResult:
    body, boundary = build_multipart_body(file_paths)
    query = "true" if overwrite else "false"
    req = Request(
        f"{api_base}/api/descricoes-cargo/import-docx?overwriteIfExists={query}",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "X-Tenant-Id": tenant_id.strip(),
        },
        method="POST",
    )
    with urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    items_raw = data.get("itens") or data.get("Itens") or []
    items: list[ImportItemResult] = []
    for raw in items_raw:
        warnings = raw.get("warnings") or raw.get("Warnings") or []
        items.append(
            ImportItemResult(
                file_name=str(raw.get("fileName") or raw.get("FileName") or "(sem nome)"),
                success=bool(raw.get("sucesso") if "sucesso" in raw else raw.get("Sucesso")),
                title=raw.get("title") or raw.get("Title"),
                descricao_cargo_id=str(raw.get("descricaoCargoId") or raw.get("DescricaoCargoId") or "")
                or None,
                warnings=[str(w) for w in warnings],
            )
        )

    return ImportBatchResult(
        total=int(data.get("total") or data.get("Total") or len(items)),
        success_count=int(data.get("sucesso") or data.get("Sucesso") or 0),
        failure_count=int(data.get("falha") or data.get("Falha") or 0),
        items=items,
    )


def chunked(items: list[Path], size: int) -> list[list[Path]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


class ImportWorker:
    def __init__(
        self,
        *,
        api_base: str,
        tenant_id: str,
        token: str,
        root_folder: Path,
        overwrite: bool,
        log: Callable[[str], None],
        progress: Callable[[int, int], None],
        done: Callable[[int, int, int], None],
        error: Callable[[str], None],
        cancel_event: threading.Event,
    ) -> None:
        self.api_base = api_base
        self.tenant_id = tenant_id
        self.token = token
        self.root_folder = root_folder
        self.overwrite = overwrite
        self.log = log
        self.progress = progress
        self.done = done
        self.error = error
        self.cancel_event = cancel_event

    def run(self) -> None:
        try:
            files = discover_docx_files(self.root_folder)
            if not files:
                self.error("Nenhum arquivo .docx encontrado (arquivos ~$ são ignorados).")
                return

            total_files = len(files)
            self.log(f"Pasta: {self.root_folder}")
            self.log(f"Arquivos .docx válidos: {total_files}")
            self.log(f"Ambiente API: {self.api_base} | Tenant: {self.tenant_id}")
            self.log(f"Sobrescrever existentes: {'sim' if self.overwrite else 'não'}")
            self.log("-" * 72)

            batches = chunked(files, BATCH_SIZE)
            processed = 0
            total_ok = 0
            total_fail = 0

            for batch_index, batch in enumerate(batches, start=1):
                if self.cancel_event.is_set():
                    self.log("Importação cancelada pelo usuário.")
                    break

                self.log(
                    f"Lote {batch_index}/{len(batches)} — enviando {len(batch)} arquivo(s)..."
                )
                try:
                    result = api_import_batch(
                        self.api_base,
                        self.tenant_id,
                        self.token,
                        batch,
                        self.overwrite,
                    )
                except HTTPError as exc:
                    detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
                    self.error(f"HTTP {exc.code} no lote {batch_index}: {detail[:500]}")
                    return
                except URLError as exc:
                    self.error(f"Erro de rede no lote {batch_index}: {exc.reason}")
                    return

                for item in result.items:
                    status = "OK" if item.success else "FALHA"
                    line = f"[{status}] {item.file_name}"
                    if item.title:
                        line += f" → {item.title}"
                    self.log(line)
                    for warning in item.warnings:
                        self.log(f"    • {warning}")

                processed += len(batch)
                total_ok += result.success_count
                total_fail += result.failure_count
                self.progress(processed, total_files)
                self.log(
                    f"Lote {batch_index} concluído: {result.success_count} ok, "
                    f"{result.failure_count} falha(s)."
                )
                self.log("-" * 72)

            if not self.cancel_event.is_set():
                self.log(f"Finalizado: {total_ok} importado(s), {total_fail} falha(s).")
            self.done(total_ok, total_fail, processed)
        except Exception as exc:  # noqa: BLE001 — surface to GUI
            self.error(str(exc))


class ImportDescricaoCargoApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Portal RH — Importação Descrições de Cargo (DOCX)")
        self.geometry("980x720")
        self.minsize(860, 620)

        self.local_config = load_local_config()
        self.log_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self.cancel_event = threading.Event()
        self.worker_thread: threading.Thread | None = None
        self.access_token: str | None = None

        self._build_ui()
        self._load_defaults()
        self.after(120, self._drain_log_queue)

    def _build_ui(self) -> None:
        pad = {"padx": 10, "pady": 6}
        root_frame = ttk.Frame(self, padding=10)
        root_frame.pack(fill=tk.BOTH, expand=True)

        env_frame = ttk.LabelFrame(root_frame, text="Ambiente")
        env_frame.pack(fill=tk.X, **pad)

        ttk.Label(env_frame, text="Base:").grid(row=0, column=0, sticky=tk.W, padx=8, pady=6)
        self.env_var = tk.StringVar(value="DEV")
        env_combo = ttk.Combobox(
            env_frame,
            textvariable=self.env_var,
            values=list(ENV_PRESETS.keys()),
            state="readonly",
            width=8,
        )
        env_combo.grid(row=0, column=1, sticky=tk.W, pady=6)
        env_combo.bind("<<ComboboxSelected>>", self._on_env_changed)

        ttk.Label(env_frame, text="API URL:").grid(row=0, column=2, sticky=tk.W, padx=(16, 0))
        self.api_url_var = tk.StringVar()
        ttk.Entry(env_frame, textvariable=self.api_url_var, width=48).grid(
            row=0, column=3, sticky=tk.EW, padx=8, pady=6
        )
        env_frame.columnconfigure(3, weight=1)

        auth_frame = ttk.LabelFrame(root_frame, text="Autenticação")
        auth_frame.pack(fill=tk.X, **pad)

        ttk.Label(auth_frame, text="Tenant:").grid(row=0, column=0, sticky=tk.W, padx=8, pady=4)
        self.tenant_var = tk.StringVar(value="liotecnica")
        ttk.Entry(auth_frame, textvariable=self.tenant_var, width=18).grid(
            row=0, column=1, sticky=tk.W, pady=4
        )

        ttk.Label(auth_frame, text="E-mail:").grid(row=0, column=2, sticky=tk.W, padx=(16, 0))
        self.email_var = tk.StringVar()
        ttk.Entry(auth_frame, textvariable=self.email_var, width=28).grid(
            row=0, column=3, sticky=tk.EW, padx=8, pady=4
        )

        ttk.Label(auth_frame, text="Senha:").grid(row=1, column=0, sticky=tk.W, padx=8, pady=4)
        self.password_var = tk.StringVar()
        ttk.Entry(auth_frame, textvariable=self.password_var, show="*", width=18).grid(
            row=1, column=1, sticky=tk.W, pady=4
        )

        self.login_status_var = tk.StringVar(value="Não autenticado")
        ttk.Label(auth_frame, textvariable=self.login_status_var).grid(
            row=1, column=2, columnspan=2, sticky=tk.W, padx=(16, 0)
        )

        ttk.Button(auth_frame, text="Entrar", command=self._do_login).grid(
            row=0, column=4, rowspan=2, padx=8, pady=4
        )
        auth_frame.columnconfigure(3, weight=1)

        folder_frame = ttk.LabelFrame(root_frame, text="Origem dos DOCX")
        folder_frame.pack(fill=tk.X, **pad)

        self.folder_var = tk.StringVar()
        ttk.Entry(folder_frame, textvariable=self.folder_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=8, pady=8
        )
        ttk.Button(folder_frame, text="Escolher pasta…", command=self._pick_folder).pack(
            side=tk.LEFT, padx=8, pady=8
        )

        opts_frame = ttk.Frame(root_frame)
        opts_frame.pack(fill=tk.X, **pad)
        self.overwrite_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            opts_frame,
            text="Sobrescrever se o Code já existir (overwriteIfExists)",
            variable=self.overwrite_var,
        ).pack(side=tk.LEFT)

        actions = ttk.Frame(root_frame)
        actions.pack(fill=tk.X, **pad)
        self.start_btn = ttk.Button(actions, text="Iniciar importação", command=self._start_import)
        self.start_btn.pack(side=tk.LEFT)
        self.cancel_btn = ttk.Button(
            actions, text="Cancelar", command=self._cancel_import, state=tk.DISABLED
        )
        self.cancel_btn.pack(side=tk.LEFT, padx=8)
        self.scan_btn = ttk.Button(actions, text="Pré-scan", command=self._preview_scan)
        self.scan_btn.pack(side=tk.LEFT)

        self.progress_var = tk.DoubleVar(value=0)
        self.progress = ttk.Progressbar(root_frame, variable=self.progress_var, maximum=100)
        self.progress.pack(fill=tk.X, **pad)

        self.summary_var = tk.StringVar(value="Aguardando…")
        ttk.Label(root_frame, textvariable=self.summary_var).pack(anchor=tk.W, padx=12)

        log_frame = ttk.LabelFrame(root_frame, text="Log (tempo real)")
        log_frame.pack(fill=tk.BOTH, expand=True, **pad)
        self.log_text = tk.Text(log_frame, wrap=tk.WORD, height=22, state=tk.DISABLED)
        scroll = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def _load_defaults(self) -> None:
        env = self.local_config.get("environment", "DEV")
        if env in ENV_PRESETS:
            self.env_var.set(env)
        self.api_url_var.set(self.local_config.get("api_url") or ENV_PRESETS.get(env, ENV_PRESETS["DEV"]))
        self.tenant_var.set(self.local_config.get("tenant_id", "liotecnica"))
        self.email_var.set(self.local_config.get("email", ""))
        self.folder_var.set(self.local_config.get("last_folder", ""))

    def _on_env_changed(self, _event: object | None = None) -> None:
        env = self.env_var.get()
        if env in ENV_PRESETS:
            self.api_url_var.set(ENV_PRESETS[env])

    def _append_log(self, message: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _drain_log_queue(self) -> None:
        while True:
            try:
                kind, payload = self.log_queue.get_nowait()
            except queue.Empty:
                break
            if kind == "log":
                self._append_log(str(payload))
            elif kind == "progress":
                done, total = payload  # type: ignore[misc]
                pct = 0 if total == 0 else (done / total) * 100
                self.progress_var.set(pct)
                self.summary_var.set(f"Progresso: {done}/{total} arquivo(s)")
            elif kind == "done":
                ok, fail, processed = payload  # type: ignore[misc]
                self.summary_var.set(
                    f"Concluído — processados: {processed} | sucesso: {ok} | falha: {fail}"
                )
                self._set_running(False)
            elif kind == "error":
                self._append_log(f"ERRO: {payload}")
                self.summary_var.set("Erro durante a importação.")
                self._set_running(False)
                messagebox.showerror("Importação", str(payload))
        self.after(120, self._drain_log_queue)

    def _set_running(self, running: bool) -> None:
        state = tk.DISABLED if running else tk.NORMAL
        self.start_btn.configure(state=state)
        self.cancel_btn.configure(state=tk.NORMAL if running else tk.DISABLED)

    def _pick_folder(self) -> None:
        initial = self.folder_var.get().strip() or str(Path.home())
        chosen = filedialog.askdirectory(title="Pasta com descrições de cargo (.docx)", initialdir=initial)
        if chosen:
            self.folder_var.set(chosen)

    def _preview_scan(self) -> None:
        folder = self.folder_var.get().strip()
        if not folder:
            messagebox.showwarning("Pré-scan", "Selecione uma pasta.")
            return
        root = Path(folder)
        if not root.is_dir():
            messagebox.showerror("Pré-scan", "Pasta inválida.")
            return
        files = discover_docx_files(root)
        self._append_log(f"Pré-scan: {len(files)} arquivo(s) .docx em {root}")
        for sample in files[:15]:
            self._append_log(f"  • {sample.relative_to(root)}")
        if len(files) > 15:
            self._append_log(f"  … e mais {len(files) - 15} arquivo(s).")
        self.summary_var.set(f"Pré-scan: {len(files)} arquivo(s) encontrado(s).")

    def _do_login(self) -> None:
        api_base = normalize_api_base(self.api_url_var.get())
        tenant = self.tenant_var.get().strip()
        email = self.email_var.get().strip()
        password = self.password_var.get()
        if not api_base or not tenant or not email or not password:
            messagebox.showwarning("Login", "Preencha API URL, tenant, e-mail e senha.")
            return
        try:
            token = api_login(api_base, tenant, email, password)
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
            messagebox.showerror("Login", f"Falha HTTP {exc.code}:\n{detail[:400]}")
            self.login_status_var.set("Falha no login")
            return
        except URLError as exc:
            messagebox.showerror("Login", f"Erro de rede: {exc.reason}")
            self.login_status_var.set("Falha no login")
            return
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Login", str(exc))
            self.login_status_var.set("Falha no login")
            return

        self.access_token = token
        self.login_status_var.set(f"Autenticado ({email}) — tenant {tenant}")
        save_local_config(
            {
                "environment": self.env_var.get(),
                "api_url": api_base,
                "tenant_id": tenant,
                "email": email,
                "last_folder": self.folder_var.get().strip(),
            }
        )
        self._append_log(f"Login OK — tenant {tenant} em {api_base}")

    def _start_import(self) -> None:
        if self.worker_thread and self.worker_thread.is_alive():
            return

        api_base = normalize_api_base(self.api_url_var.get())
        tenant = self.tenant_var.get().strip()
        folder = self.folder_var.get().strip()
        email = self.email_var.get().strip()
        password = self.password_var.get()

        if not folder:
            messagebox.showwarning("Importação", "Selecione a pasta raiz dos DOCX.")
            return
        root = Path(folder)
        if not root.is_dir():
            messagebox.showerror("Importação", "Pasta inválida.")
            return

        if not self.access_token:
            if not email or not password:
                messagebox.showwarning("Importação", "Faça login ou informe e-mail e senha.")
                return
            try:
                self.access_token = api_login(api_base, tenant, email, password)
                self.login_status_var.set(f"Autenticado ({email})")
            except Exception as exc:  # noqa: BLE001
                messagebox.showerror("Importação", f"Login falhou: {exc}")
                return

        save_local_config(
            {
                "environment": self.env_var.get(),
                "api_url": api_base,
                "tenant_id": tenant,
                "email": email,
                "last_folder": folder,
            }
        )

        self.cancel_event.clear()
        self.progress_var.set(0)
        self.summary_var.set("Importação em andamento…")
        self._set_running(True)
        self._append_log("=" * 72)
        self._append_log("Iniciando importação em massa…")

        worker = ImportWorker(
            api_base=api_base,
            tenant_id=tenant,
            token=self.access_token,
            root_folder=root,
            overwrite=self.overwrite_var.get(),
            log=lambda msg: self.log_queue.put(("log", msg)),
            progress=lambda done, total: self.log_queue.put(("progress", (done, total))),
            done=lambda ok, fail, processed: self.log_queue.put(("done", (ok, fail, processed))),
            error=lambda msg: self.log_queue.put(("error", msg)),
            cancel_event=self.cancel_event,
        )
        self.worker_thread = threading.Thread(target=worker.run, daemon=True)
        self.worker_thread.start()

    def _cancel_import(self) -> None:
        self.cancel_event.set()
        self._append_log("Cancelamento solicitado…")


def main() -> None:
    app = ImportDescricaoCargoApp()
    app.mainloop()


if __name__ == "__main__":
    main()
