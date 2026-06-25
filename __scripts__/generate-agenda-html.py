#!/usr/bin/env python3
"""Gera agenda HTML com tarefas (commits) por dia."""
import subprocess
from collections import defaultdict
from datetime import date, timedelta
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "docs" / "Reumos-Diarios"
OUT_FILE = OUT_DIR / "agenda-atividades.html"
GITHUB = "https://github.com/munizlmachado-jpg/RH"

START = date(2026, 5, 22)
END = date(2026, 6, 25)

WEEKDAYS_PT = {
    "Monday": "Segunda-feira",
    "Tuesday": "Terça-feira",
    "Wednesday": "Quarta-feira",
    "Thursday": "Quinta-feira",
    "Friday": "Sexta-feira",
    "Saturday": "Sábado",
    "Sunday": "Domingo",
}

MONTHS_PT = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def fetch_commits() -> list[dict]:
    cmd = [
        "git", "log",
        f"--since={START.isoformat()} 00:00:00",
        f"--until={END.isoformat()} 23:59:59",
        "--format=%H|%ad|%s|%A",
        "--date=iso-strict",
        "--no-merges",
        "--reverse",
    ]
    out = subprocess.check_output(cmd, cwd=REPO, text=True, encoding="utf-8")
    items = []
    for line in out.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 3)
        if len(parts) < 4:
            continue
        hash_full, iso_dt, subject, weekday = parts
        iso = iso_dt[:10]
        d = date.fromisoformat(iso)
        items.append({
            "hash": hash_full,
            "short": hash_full[:8],
            "iso": iso,
            "br": d.strftime("%d/%m/%Y"),
            "weekday": WEEKDAYS_PT.get(weekday, weekday),
            "subject": subject,
        })
    return items


def report_link(d: date) -> str | None:
    name = f"relatorio-atividades-{d.strftime('%d-%m-%Y')}.md"
    path = OUT_DIR / name
    return name if path.exists() else None


def scope_badge(subject: str) -> tuple[str, str]:
    if subject.startswith("feat"):
        return "feat", "Nova funcionalidade"
    if subject.startswith("fix"):
        return "fix", "Correção"
    if subject.startswith("docs"):
        return "docs", "Documentação"
    if subject.startswith("style"):
        return "style", "Visual"
    if subject.startswith("refactor"):
        return "refactor", "Refatoração"
    if subject.startswith("chore"):
        return "chore", "Manutenção"
    if subject.startswith("test"):
        return "test", "Teste"
    return "other", "Outro"


def build_html(by_day: dict[str, list[dict]]) -> str:
    total_tasks = sum(len(v) for v in by_day.values())
    days_with_tasks = sum(1 for v in by_day.values() if v)

    rows = []
    d = START
    while d <= END:
        iso = d.isoformat()
        tasks = by_day.get(iso, [])
        br = d.strftime("%d/%m/%Y")
        weekday = WEEKDAYS_PT.get(d.strftime("%A"), d.strftime("%A"))
        month_label = f"{MONTHS_PT[d.month]} {d.year}"
        rep = report_link(d)

        if tasks:
            task_items = []
            for t in tasks:
                kind, kind_label = scope_badge(t["subject"])
                task_items.append(f"""
                <li class="task task-{kind}">
                  <a class="task-link" href="{GITHUB}/commit/{t['hash']}" target="_blank" rel="noopener" title="Abrir commit no GitHub">
                    <span class="task-title">{escape(t['subject'])}</span>
                    <span class="task-meta">
                      <span class="badge badge-{kind}">{kind_label}</span>
                      <code class="hash">{t['short']}</code>
                    </span>
                  </a>
                </li>""")
            tasks_html = f'<ul class="task-list">{"".join(task_items)}</ul>'
            count_badge = f'<span class="count">{len(tasks)} tarefa{"s" if len(tasks) != 1 else ""}</span>'
        else:
            tasks_html = '<p class="empty-day">Nenhuma entrega registrada neste dia.</p>'
            count_badge = '<span class="count empty">—</span>'

        report_html = ""
        if rep:
            report_html = f'<a class="report-link" href="{rep}">Ver relatório do dia</a>'

        rows.append(f"""
        <article class="day-card" id="dia-{d.strftime('%d-%m-%Y')}">
          <header class="day-header">
            <div class="day-date">
              <span class="day-number">{d.day:02d}</span>
              <div>
                <h2>{weekday}</h2>
                <p class="day-sub">{br} · {month_label}</p>
              </div>
            </div>
            <div class="day-actions">
              {count_badge}
              {report_html}
            </div>
          </header>
          {tasks_html}
        </article>""")
        d += timedelta(days=1)

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agenda de Atividades — Portal RH</title>
  <style>
    :root {{
      --bg: #f4f6f9;
      --card: #ffffff;
      --text: #1a2332;
      --muted: #5c6b7a;
      --border: #e2e8f0;
      --primary: #0c3a64;
      --primary-light: #105291;
      --feat: #059669;
      --fix: #d97706;
      --docs: #6366f1;
      --style: #8b5cf6;
      --refactor: #0891b2;
      --chore: #64748b;
      --test: #0ea5e9;
      --other: #94a3b8;
      --shadow: 0 4px 24px rgba(12, 58, 100, 0.08);
      --content-max: 960px;
      --page-pad: 1.5rem;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: linear-gradient(160deg, #eef2f7 0%, var(--bg) 40%, #e8eef5 100%);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }}
    .container {{
      width: 100%;
      max-width: var(--content-max);
      margin-inline: auto;
      padding-inline: var(--page-pad);
    }}
    .page-header {{
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      color: #fff;
      padding-block: 2rem 2.5rem;
    }}
    .page-header h1 {{ font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }}
    .page-header p {{ margin-top: 0.5rem; opacity: 0.9; font-size: 0.95rem; }}
    .stats {{
      display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1.25rem;
    }}
    .stat {{
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(4px);
      border-radius: 10px;
      padding: 0.65rem 1rem;
      font-size: 0.85rem;
    }}
    .stat strong {{ display: block; font-size: 1.35rem; font-weight: 800; }}
    .toolbar {{
      margin-top: -1.25rem;
      position: relative;
      z-index: 2;
    }}
    .toolbar-inner {{
      background: var(--card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      padding: 0.85rem 1rem;
      display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
      font-size: 0.8rem; color: var(--muted);
    }}
    .legend {{ display: flex; flex-wrap: wrap; gap: 0.5rem; margin-left: auto; }}
    .legend span {{
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.5rem; border-radius: 999px; background: #f1f5f9;
    }}
    .dot {{ width: 8px; height: 8px; border-radius: 50%; }}
    .agenda {{ margin-block: 1.5rem 3rem; }}
    .day-card {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      margin-bottom: 1rem;
      overflow: hidden;
    }}
    .day-header {{
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 1rem; padding: 1rem 1.25rem;
      background: linear-gradient(to right, #f8fafc, #fff);
      border-bottom: 1px solid var(--border);
    }}
    .day-date {{ display: flex; gap: 0.85rem; align-items: center; }}
    .day-number {{
      width: 48px; height: 48px; border-radius: 12px;
      background: var(--primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; font-weight: 800; flex-shrink: 0;
    }}
    .day-header h2 {{ font-size: 1.05rem; font-weight: 700; }}
    .day-sub {{ font-size: 0.8rem; color: var(--muted); margin-top: 0.15rem; }}
    .day-actions {{ display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; }}
    .count {{
      font-size: 0.75rem; font-weight: 600; color: var(--primary);
      background: #e8f0f8; padding: 0.25rem 0.6rem; border-radius: 999px;
    }}
    .count.empty {{ color: var(--muted); background: #f1f5f9; }}
    .report-link {{
      font-size: 0.75rem; color: var(--primary-light); text-decoration: none; font-weight: 600;
    }}
    .report-link:hover {{ text-decoration: underline; }}
    .task-list {{ list-style: none; padding: 0.5rem 0; }}
    .task {{ border-bottom: 1px solid #f1f5f9; }}
    .task:last-child {{ border-bottom: none; }}
    .task-link {{
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      padding: 0.75rem 1.25rem; text-decoration: none; color: inherit;
      transition: background 0.15s;
    }}
    .task-link:hover {{ background: #f8fafc; }}
    .task-link:hover .task-title {{ color: var(--primary); }}
    .task-title {{ font-size: 0.88rem; flex: 1; }}
    .task-meta {{ display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }}
    .badge {{
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
      padding: 0.2rem 0.45rem; border-radius: 6px; color: #fff;
    }}
    .badge-feat {{ background: var(--feat); }}
    .badge-fix {{ background: var(--fix); }}
    .badge-docs {{ background: var(--docs); }}
    .badge-style {{ background: var(--style); }}
    .badge-refactor {{ background: var(--refactor); }}
    .badge-chore {{ background: var(--chore); }}
    .badge-test {{ background: var(--test); }}
    .badge-other {{ background: var(--other); }}
    .hash {{
      font-size: 0.7rem; background: #f1f5f9; padding: 0.15rem 0.4rem;
      border-radius: 4px; color: var(--muted);
    }}
    .empty-day {{
      padding: 1rem 1.25rem; font-size: 0.85rem; color: var(--muted); font-style: italic;
    }}
    .page-footer {{
      text-align: center; padding: 1.5rem; font-size: 0.75rem; color: var(--muted);
    }}
    @media (max-width: 640px) {{
      .task-link {{ flex-direction: column; align-items: flex-start; }}
      .day-header {{ flex-direction: column; }}
      .day-actions {{ align-items: flex-start; }}
    }}
  </style>
</head>
<body>
  <header class="page-header">
    <div class="container">
      <h1>Agenda de Atividades</h1>
      <p>Portal RH · entregas de {START.strftime('%d/%m/%Y')} a {END.strftime('%d/%m/%Y')}</p>
      <div class="stats">
        <div class="stat"><strong>{total_tasks}</strong> tarefas entregues</div>
        <div class="stat"><strong>{days_with_tasks}</strong> dias com entrega</div>
        <div class="stat"><strong>{(END - START).days + 1}</strong> dias no período</div>
      </div>
    </div>
  </header>

  <div class="toolbar container">
    <div class="toolbar-inner">
      <span>Clique em uma tarefa para abrir o commit no GitHub</span>
      <div class="legend">
        <span><i class="dot" style="background:var(--feat)"></i> Funcionalidade</span>
        <span><i class="dot" style="background:var(--fix)"></i> Correção</span>
        <span><i class="dot" style="background:var(--docs)"></i> Docs</span>
        <span><i class="dot" style="background:var(--refactor)"></i> Refatoração</span>
      </div>
    </div>
  </div>

  <main class="agenda container">
    {"".join(rows)}
  </main>

  <footer class="page-footer">
    Gerado a partir do histórico Git · {GITHUB}
  </footer>
</body>
</html>
"""


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    commits = fetch_commits()
    by_day: dict[str, list[dict]] = defaultdict(list)
    for c in commits:
        by_day[c["iso"]].append(c)
    html = build_html(by_day)
    OUT_FILE.write_text(html, encoding="utf-8")
    print(f"Written: {OUT_FILE} ({len(commits)} tasks)")


if __name__ == "__main__":
    main()
