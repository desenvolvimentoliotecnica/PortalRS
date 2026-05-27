from __future__ import annotations

import os
import queue
import shutil
import subprocess
import threading
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from tkinter import END, BOTH, LEFT, RIGHT, X, Y, Button, Frame, Label, Listbox, Tk, messagebox
from tkinter.scrolledtext import ScrolledText


APP_DIR = Path(__file__).resolve().parents[1]
TESTS_DIR = APP_DIR / "tests" / "e2e"
REPORTS_DIR = APP_DIR / "tests" / "uat-automatizados"


@dataclass(frozen=True)
class TestSpec:
    name: str
    path: Path

    @property
    def relative_path(self) -> str:
        return self.path.relative_to(APP_DIR).as_posix()


class UatRunnerApp:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("Portal RH - Runner de UAT automatizado")
        self.root.geometry("1100x720")
        self.root.minsize(900, 560)

        self.tests: list[TestSpec] = []
        self.proc: subprocess.Popen[str] | None = None
        self.log_queue: queue.Queue[str] = queue.Queue()

        self._build_ui()
        self.refresh_tests()
        self._pump_logs()

    def _build_ui(self) -> None:
        top = Frame(self.root, padx=12, pady=10)
        top.pack(fill=X)

        Label(top, text="Testes disponíveis", font=("Segoe UI", 12, "bold")).pack(side=LEFT)
        Button(top, text="Atualizar lista", command=self.refresh_tests).pack(side=RIGHT, padx=(6, 0))
        Button(top, text="Abrir último relatório", command=self.open_latest_report).pack(side=RIGHT, padx=(6, 0))

        body = Frame(self.root, padx=12)
        body.pack(fill=BOTH, expand=True)

        left = Frame(body)
        left.pack(side=LEFT, fill=Y)

        self.listbox = Listbox(left, width=56, height=25, font=("Consolas", 10))
        self.listbox.pack(fill=Y, expand=False)

        actions = Frame(left, pady=10)
        actions.pack(fill=X)

        self.run_button = Button(actions, text="Rodar UAT com vídeo", command=self.run_selected_uat)
        self.run_button.pack(fill=X, pady=(0, 6))

        self.run_headed_button = Button(actions, text="Rodar headed sem vídeo", command=self.run_selected_headed)
        self.run_headed_button.pack(fill=X, pady=(0, 6))

        self.stop_button = Button(actions, text="Parar execução", command=self.stop_process, state="disabled")
        self.stop_button.pack(fill=X)

        right = Frame(body, padx=12)
        right.pack(side=RIGHT, fill=BOTH, expand=True)

        Label(right, text="Log da execução", font=("Segoe UI", 12, "bold")).pack(anchor="w")
        self.log = ScrolledText(right, font=("Consolas", 9), wrap="word")
        self.log.pack(fill=BOTH, expand=True, pady=(8, 0))

        footer = Frame(self.root, padx=12, pady=8)
        footer.pack(fill=X)
        self.status = Label(footer, text=f"Projeto: {APP_DIR}", anchor="w")
        self.status.pack(fill=X)

    def refresh_tests(self) -> None:
        self.tests = [
            TestSpec(path.stem.replace(".spec", ""), path)
            for path in sorted(TESTS_DIR.glob("*.spec.ts"), key=lambda p: p.stat().st_ctime, reverse=True)
        ]

        self.listbox.delete(0, END)
        for spec in self.tests:
            self.listbox.insert(END, spec.relative_path)

        self.status.config(text=f"{len(self.tests)} teste(s) encontrados em {TESTS_DIR}")

    def selected_test(self) -> TestSpec | None:
        selected = self.listbox.curselection()
        if not selected:
            messagebox.showwarning("Selecione um teste", "Escolha um teste na lista antes de rodar.")
            return None
        return self.tests[selected[0]]

    def run_selected_uat(self) -> None:
        spec = self.selected_test()
        if spec is None:
            return
        self._run(spec, uat_video=True)

    def run_selected_headed(self) -> None:
        spec = self.selected_test()
        if spec is None:
            return
        self._run(spec, uat_video=False)

    def _run(self, spec: TestSpec, *, uat_video: bool) -> None:
        if self.proc and self.proc.poll() is None:
            messagebox.showinfo("Execução em andamento", "Pare o teste atual antes de iniciar outro.")
            return

        pnpm = shutil.which("pnpm.cmd") or shutil.which("pnpm")
        if not pnpm:
            messagebox.showerror("pnpm não encontrado", "Não encontrei pnpm no PATH.")
            return

        missing = self._missing_env_vars(spec)
        if missing:
            messagebox.showwarning(
                "Variáveis ausentes",
                "Algumas variáveis de ambiente não foram encontradas nesta sessão:\n\n"
                + "\n".join(missing)
                + "\n\nSe você já criou com setx, reabra o terminal/Cursor ou rode a ferramenta por uma sessão nova.",
            )

        env = os.environ.copy()
        if uat_video:
            env["PLAYWRIGHT_UAT_VIDEO"] = "1"

        command = [pnpm, "exec", "playwright", "test", spec.relative_path, "--headed"]

        self.log.delete("1.0", END)
        self._write_log(f"> {' '.join(command)}\n")
        self._write_log(f"> cwd: {APP_DIR}\n")
        if uat_video:
            self._write_log("> modo UAT: vídeo + relatório HTML habilitados\n")
        self._write_log("\n")

        self._set_running(True)
        self.proc = subprocess.Popen(
            command,
            cwd=APP_DIR,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )

        threading.Thread(target=self._read_process_output, daemon=True).start()
        threading.Thread(target=self._wait_process, daemon=True).start()

    def _missing_env_vars(self, spec: TestSpec) -> list[str]:
        required = ["PORTALRH_E2E_BASE_URL"]
        text = spec.path.read_text(encoding="utf-8", errors="ignore")
        if "PORTALRH_E2E_COORDENADOR_USER" in text:
            required.extend(["PORTALRH_E2E_COORDENADOR_USER", "PORTALRH_E2E_COORDENADOR_PASSWORD"])
        if "PORTALRH_E2E_GESTOR_USER" in text:
            required.extend(["PORTALRH_E2E_GESTOR_USER", "PORTALRH_E2E_GESTOR_PASSWORD"])
        if "PORTALRH_E2E_RH_ESPECIALISTA_USER" in text:
            required.extend(["PORTALRH_E2E_RH_ESPECIALISTA_USER", "PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD"])
        if "PORTALRH_E2E_RH_ANALISTA_USER" in text:
            required.extend(["PORTALRH_E2E_RH_ANALISTA_USER", "PORTALRH_E2E_RH_ANALISTA_PASSWORD"])
        uses_rh_fallback = "const rhEmail =" in text and "PORTALRH_E2E_OWNER_USER" in text
        if uses_rh_fallback:
            has_any_rh = any(
                os.environ.get(user_var) and os.environ.get(password_var)
                for user_var, password_var in [
                    ("PORTALRH_E2E_RH_ANALISTA_USER", "PORTALRH_E2E_RH_ANALISTA_PASSWORD"),
                    ("PORTALRH_E2E_RH_ESPECIALISTA_USER", "PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD"),
                    ("PORTALRH_E2E_OWNER_USER", "PORTALRH_E2E_OWNER_PASSWORD"),
                ]
            )
            if not has_any_rh:
                required.append("PORTALRH_E2E_RH_ANALISTA_* ou PORTALRH_E2E_RH_ESPECIALISTA_* ou PORTALRH_E2E_OWNER_*")
        else:
            if "PORTALRH_E2E_RH_ESPECIALISTA_USER" in text:
                required.extend(["PORTALRH_E2E_RH_ESPECIALISTA_USER", "PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD"])
            if "PORTALRH_E2E_RH_ANALISTA_USER" in text:
                required.extend(["PORTALRH_E2E_RH_ANALISTA_USER", "PORTALRH_E2E_RH_ANALISTA_PASSWORD"])
            if "PORTALRH_E2E_OWNER_USER" in text:
                required.extend(["PORTALRH_E2E_OWNER_USER", "PORTALRH_E2E_OWNER_PASSWORD"])
        if "PORTALRH_E2E_CANDIDATO_USER" in text:
            required.extend([
                "PORTALRH_E2E_PORTAL_VAGAS_URL",
                "PORTALRH_E2E_CANDIDATO_USER",
                "PORTALRH_E2E_CANDIDATO_PASSWORD",
            ])

        return [name for name in dict.fromkeys(required) if not os.environ.get(name)]

    def _read_process_output(self) -> None:
        if not self.proc or not self.proc.stdout:
            return
        for line in self.proc.stdout:
            self.log_queue.put(line)

    def _wait_process(self) -> None:
        if not self.proc:
            return
        code = self.proc.wait()
        self.log_queue.put(f"\n> Processo finalizado com código {code}\n")
        latest = self.latest_report()
        if latest:
            self.log_queue.put(f"> Último relatório: {latest}\n")
        self.root.after(0, lambda: self._set_running(False))

    def _pump_logs(self) -> None:
        while True:
            try:
                line = self.log_queue.get_nowait()
            except queue.Empty:
                break
            self._write_log(line)
        self.root.after(120, self._pump_logs)

    def _write_log(self, text: str) -> None:
        self.log.insert(END, text)
        self.log.see(END)

    def _set_running(self, running: bool) -> None:
        self.run_button.config(state="disabled" if running else "normal")
        self.run_headed_button.config(state="disabled" if running else "normal")
        self.stop_button.config(state="normal" if running else "disabled")
        self.status.config(text="Executando..." if running else f"{len(self.tests)} teste(s) disponíveis")

    def stop_process(self) -> None:
        if not self.proc or self.proc.poll() is not None:
            return
        if not messagebox.askyesno("Parar teste", "Deseja interromper a execução atual?"):
            return
        self.proc.terminate()
        self._write_log("\n> Encerramento solicitado pelo usuário.\n")

    def latest_report(self) -> Path | None:
        if not REPORTS_DIR.exists():
            return None
        indexes = sorted(REPORTS_DIR.glob("*/index.html"), key=lambda p: p.stat().st_mtime, reverse=True)
        return indexes[0] if indexes else None

    def open_latest_report(self) -> None:
        latest = self.latest_report()
        if not latest:
            messagebox.showinfo("Nenhum relatório", "Nenhum relatório UAT foi encontrado ainda.")
            return
        webbrowser.open(latest.as_uri())

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    UatRunnerApp().run()
