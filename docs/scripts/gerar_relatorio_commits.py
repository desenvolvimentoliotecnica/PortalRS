#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera docs/relatorio-atividades-ultimos-15-dias.html a partir do git log."""

from __future__ import annotations

import html
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = REPO_ROOT / "docs" / "relatorio-atividades-ultimos-15-dias.html"

WORK_START = time(8, 0)
WORK_END = time(18, 0)
SINCE_DAYS = 15


def run_git_log() -> list[tuple[str, datetime, str]]:
    cmd = [
        "git",
        "-C",
        str(REPO_ROOT),
        "log",
        f"--since={SINCE_DAYS} days ago",
        "--date=iso-strict",
        "--pretty=format:%H|%ai|%s",
        "--reverse",
    ]
    raw = subprocess.check_output(cmd, text=True, encoding="utf-8", errors="replace")
    rows: list[tuple[str, datetime, str]] = []
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 2)
        if len(parts) < 3:
            continue
        h, ai, subject = parts[0], parts[1], parts[2]
        # %ai: horário local do autor (ex.: 2026-04-28 17:18:44 -0300)
        dt = datetime.strptime(ai[:19], "%Y-%m-%d %H:%M:%S")
        rows.append((h[:8], dt, subject.strip()))
    return rows


def is_weekday(d: date) -> bool:
    return d.weekday() < 5


def work_seconds_between(t0: datetime, t1: datetime) -> float:
    """Overlap of [t0, t1] with Mon–Fri 08:00–18:00 (same calendar interpretation as t0 local)."""
    if t1 <= t0:
        return 0.0
    total = 0.0
    d = t0.date()
    end_date = t1.date()
    while d <= end_date:
        if is_weekday(d):
            day_start = datetime.combine(d, WORK_START)
            day_end = datetime.combine(d, WORK_END)
            seg_a = max(t0, day_start)
            seg_b = min(t1, day_end)
            if seg_b > seg_a:
                total += (seg_b - seg_a).total_seconds()
        d += timedelta(days=1)
    return total


def format_duration(seconds: float) -> str:
    if seconds <= 0:
        return "—"
    m = int(round(seconds / 60))
    if m < 1:
        return "< 1 min"
    h, mm = divmod(m, 60)
    if h == 0:
        return f"{mm} min"
    if mm == 0:
        return f"{h} h"
    return f"{h} h {mm} min"


def interpret_subject(subject: str) -> str:
    """Expande o subject em uma frase mais clara para gestão (PT-BR)."""
    s = subject.strip()
    low = s.lower()

    def prefix_map() -> str | None:
        patterns: list[tuple[str, str]] = [
            (r"^fix\(rm\)", "Correção na integração RM:"),
            (r"^feat\(rm\)", "Integração RM — nova funcionalidade:"),
            (r"^feat\(rm-sync\)", "Sincronização RM —"),
            (r"^fix\(rm-sync\)", "Ajuste na sincronização RM:"),
            (r"^feat\(deploy\)", "Deploy / homologação —"),
            (r"^fix\(deploy\)", "Correção no fluxo de deploy:"),
            (r"^feat\(api\)", "API —"),
            (r"^fix\(api\)", "Correção na API:"),
            (r"^feat\(web\)", "Portal web —"),
            (r"^fix\(web\)", "Correção no portal web:"),
            (r"^feat\(next\)", "Frontend Next —"),
            (r"^fix\(next\)", "Ajuste no Next.js:"),
            (r"^feat\(admin\)", "Área administrativa —"),
            (r"^fix\(admin\)", "Correção na administração:"),
            (r"^feat\(owner\)", "Console Owner —"),
            (r"^fix\(owner\)", "Ajuste no Owner:"),
            (r"^feat\(vagas\)", "Módulo de vagas —"),
            (r"^fix\(vagas\)", "Correção em vagas:"),
            (r"^feat\(solicit", "Solicitações de vaga —"),
            (r"^fix\(solicit", "Ajuste em solicitações de vaga:"),
            (r"^feat\(aprov", "Aprovações —"),
            (r"^fix\(aprov", "Correção em aprovações:"),
            (r"^feat\(funcionarios\)", "Colaboradores —"),
            (r"^fix\(funcionarios\)", "Ajuste em colaboradores:"),
            (r"^feat\(gestao\)", "Gestão —"),
            (r"^feat\(me\)", "Perfil / dados do usuário —"),
            (r"^feat\(email\)", "E-mail / notificações —"),
            (r"^feat\(sync\)", "Sincronização de dados —"),
            (r"^feat\(dashboard\)", "Dashboard —"),
            (r"^fix\(dashboard\)", "Ajuste no dashboard:"),
            (r"^feat\(identity\)", "Identidade / autenticação —"),
            (r"^fix\(identity\)", "Correção em identidade:"),
            (r"^docs", "Documentação do projeto —"),
            (r"^chore\(", "Manutenção / organização —"),
            (r"^ci:", "Integração contínua —"),
            (r"^refactor:", "Refatoração —"),
            (r"^feat:", "Nova entrega —"),
            (r"^fix:", "Correção —"),
        ]
        for pat, label in patterns:
            if re.match(pat, low):
                rest = re.sub(r"^[^:]*:\s*", "", s, count=1)
                return f"{label} {rest}".strip()
        return None

    mapped = prefix_map()
    if mapped:
        return mapped
    if low.startswith("fix "):
        return f"Correção: {s[4:].strip()}"
    if low.startswith("add "):
        return f"Inclusão de funcionalidade: {s[4:].strip()}"
    if low.startswith("harden "):
        return f"Endurecimento / robustez: {s[7:].strip()}"
    if low.startswith("use "):
        return f"Ajuste de uso / integração: {s[4:].strip()}"
    return s


def main() -> int:
    commits = run_git_log()
    if not commits:
        print("Nenhum commit no período.", file=sys.stderr)
        return 1

    # duração = tempo até o próximo commit dentro da janela útil
    durations: list[float] = []
    for i in range(len(commits)):
        if i + 1 < len(commits):
            sec = work_seconds_between(commits[i][1], commits[i + 1][1])
            durations.append(sec)
        else:
            durations.append(-1.0)

    by_day: dict[date, list[tuple[int, str, datetime, str, str, float]]] = defaultdict(list)
    for idx, (h, dt, subj) in enumerate(commits):
        dur = durations[idx]
        by_day[dt.date()].append(
            (idx + 1, h, dt, subj, interpret_subject(subj), dur)
        )

    gen_at = datetime.now().strftime("%d/%m/%Y %H:%M")
    total_commits = len(commits)
    total_estimated = sum(d for d in durations if d >= 0)

    parts: list[str] = []
    parts.append("<!DOCTYPE html>")
    parts.append('<html lang="pt-BR">')
    parts.append("<head>")
    parts.append('<meta charset="utf-8">')
    parts.append(
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
    )
    parts.append("<title>Relatório de atividades (Git — últimos 15 dias)</title>")
    parts.append(
        """
<style>
  :root {
    --bg: #f4f6f9;
    --card: #fff;
    --text: #1a1d23;
    --muted: #5c6570;
    --accent: #1e5a96;
    --accent-soft: #e8f1fb;
    --border: #e2e8f0;
    --chip: #edf2f7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
  }
  .wrap { width: 80%; max-width: 100%; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  header {
    background: linear-gradient(135deg, #1e5a96 0%, #2d7ab8 100%);
    color: #fff;
    padding: 1.75rem 1.25rem 2rem;
    border-radius: 12px;
    margin-bottom: 1.75rem;
    box-shadow: 0 8px 24px rgba(30, 90, 150, 0.25);
  }
  header h1 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 700; }
  header p { margin: 0; opacity: 0.92; font-size: 0.95rem; }
  .meta {
    display: flex; flex-wrap: wrap; gap: 1rem;
    margin-top: 1rem; font-size: 0.875rem;
  }
  .meta span {
    background: rgba(255,255,255,0.15);
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
  }
  .day {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 1.25rem;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .day-head {
    background: var(--accent-soft);
    padding: 0.85rem 1.1rem;
    font-weight: 700;
    color: var(--accent);
    border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;
  }
  .day-head small { font-weight: 500; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 0.65rem 0.85rem; text-align: left; vertical-align: top; }
  th {
    background: #f8fafc;
    color: var(--muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--border);
  }
  tr:not(:last-child) td { border-bottom: 1px solid var(--border); }
  .time { white-space: nowrap; color: var(--muted); font-variant-numeric: tabular-nums; width: 1%; }
  .dur { white-space: nowrap; font-weight: 600; color: var(--accent); width: 1%; }
  .hash { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--muted); }
  .desc { color: var(--text); }
  .sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }
  footer {
    margin-top: 2rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
    font-size: 0.875rem;
    color: var(--muted);
  }
  footer.update-guide h2 {
    margin: 0 0 0.75rem;
    font-size: 1.05rem;
    color: var(--text);
    font-weight: 700;
  }
  footer.update-guide ol {
    margin: 0 0 1rem;
    padding-left: 1.25rem;
  }
  footer.update-guide li { margin: 0.4rem 0; }
  footer.update-guide .cmd {
    display: block;
    background: #1a1d23;
    color: #e2e8f0;
    padding: 0.65rem 0.85rem;
    border-radius: 8px;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    margin: 0.5rem 0 1rem;
    overflow-x: auto;
  }
  footer.update-guide .note {
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
  .legend {
    background: var(--chip);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .legend strong { color: var(--text); }
</style>
"""
    )
    parts.append("</head>")
    parts.append("<body>")
    parts.append('<div class="wrap">')
    parts.append("<header>")
    parts.append("<h1>Relatório de atividades no repositório</h1>")
    parts.append(
        f"<p>Consolidação automática dos commits dos últimos <strong>{SINCE_DAYS} dias</strong>, "
        "com estimativa de tempo dedicado entre um commit e o seguinte.</p>"
    )
    parts.append('<div class="meta">')
    parts.append(f"<span>Total de commits: <strong>{total_commits}</strong></span>")
    parts.append(
        f"<span>Tempo estimado (janela útil): <strong>{format_duration(total_estimated)}</strong></span>"
    )
    parts.append(f"<span>Gerado em: {html.escape(gen_at)}</span>")
    parts.append("</div></header>")

    parts.append('<div class="legend">')
    parts.append(
        "<strong>Como o tempo é calculado:</strong> para cada commit, mede-se o intervalo até o "
        "<em>próximo</em> commit, contando apenas horas em <strong>dias úteis (segunda a sexta)</strong> "
        "e entre <strong>08:00 e 18:00</strong> (jornada de referência). O último commit do período não tem "
        "sucessor: exibimos \"—\". Valores são indicativos para acompanhamento de ritmo, não controle de ponto."
    )
    parts.append("</div>")

    weekday_names = [
        "Segunda",
        "Terça",
        "Quarta",
        "Quinta",
        "Sexta",
        "Sábado",
        "Domingo",
    ]

    for d in sorted(by_day.keys(), reverse=True):
        items = by_day[d]
        day_commits = len(items)
        day_secs = sum(x[5] for x in items if x[5] >= 0)
        wname = weekday_names[d.weekday()]
        parts.append('<section class="day">')
        parts.append('<div class="day-head">')
        parts.append(
            f"<span>{wname}, {d.strftime('%d/%m/%Y')}</span>"
            f"<small>{day_commits} commit(s) · ~{format_duration(day_secs)} na janela 08–18h</small>"
        )
        parts.append("</div>")
        parts.append("<table>")
        parts.append(
            "<thead><tr>"
            "<th>#</th><th>Horário</th><th>Estimativa</th>"
            "<th>Atividade (interpretação)</th><th>Commit</th>"
            "</tr></thead><tbody>"
        )
        for num, h, dt, subj, interp, dur_sec in items:
            tstr = dt.strftime("%H:%M")
            dur_str = format_duration(dur_sec) if dur_sec >= 0 else "—"
            parts.append("<tr>")
            parts.append(f'<td class="time">{num}</td>')
            parts.append(f'<td class="time">{html.escape(tstr)}</td>')
            parts.append(f'<td class="dur">{html.escape(dur_str)}</td>')
            parts.append("<td>")
            parts.append(f'<div class="desc">{html.escape(interp)}</div>')
            parts.append(
                f'<div class="sub">Original: {html.escape(subj)}</div>'
            )
            parts.append("</td>")
            parts.append(f'<td class="hash">{html.escape(h)}</td>')
            parts.append("</tr>")
        parts.append("</tbody></table></section>")

    parts.append('<footer class="update-guide">')
    parts.append("<h2>Como atualizar este relatório após novos commits</h2>")
    parts.append("<ol>")
    parts.append(
        "<li>Abra o terminal na <strong>raiz do repositório</strong> (pasta onde está o <code>.git</code>).</li>"
    )
    parts.append(
        "<li>Garanta que a branch local contém os commits que deseja incluir "
        "(ex.: <code>git pull</code> se necessário).</li>"
    )
    parts.append("<li>Execute o gerador (Python 3 e Git no PATH):</li>")
    parts.append("</ol>")
    parts.append('<pre class="cmd">python docs/scripts/gerar_relatorio_commits.py</pre>')
    parts.append("<ol start=\"4\">")
    parts.append(
        "<li>O arquivo <code>docs/relatorio-atividades-ultimos-15-dias.html</code> será "
        "<strong>sobrescrito</strong> com o histórico dos últimos "
        f"{SINCE_DAYS} dias relativos à data de execução.</li>"
    )
    parts.append(
        "<li>Abra o HTML no navegador para revisar ou envie ao gestor como anexo.</li>"
    )
    parts.append("</ol>")
    parts.append(
        '<p class="note">Fonte dos dados: <code>git log</code> neste repositório. '
        "O período de dias e a janela de horário estão definidos no script "
        "<code>docs/scripts/gerar_relatorio_commits.py</code>.</p>"
    )
    parts.append("</footer>")
    parts.append("</div></body></html>")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("\n".join(parts), encoding="utf-8")
    print(f"Escrito: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
