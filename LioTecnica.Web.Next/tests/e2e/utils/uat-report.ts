import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

type UatStep = {
  title: string;
  status: "passed" | "failed";
  screenshot: string;
  error?: string;
};

type UatStepOptions = {
  waitAfterMs?: number;
  fullPage?: boolean;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "uat";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export class UatReport {
  private readonly title: string;
  private readonly startedAt = new Date();
  private readonly dir: string;
  private readonly screenshotsDir: string;
  private readonly videosDir: string;
  private readonly steps: UatStep[] = [];
  private videoPath: string | null = null;

  private constructor(title: string, testInfo: TestInfo) {
    this.title = title;
    const runSlug = `${timestampForPath()}-${slugify(testInfo.title)}`;
    this.dir = path.join(process.cwd(), "tests", "uat-automatizados", runSlug);
    this.screenshotsDir = path.join(this.dir, "screenshots");
    this.videosDir = path.join(this.dir, "videos");
  }

  static async create(title: string, testInfo: TestInfo) {
    const report = new UatReport(title, testInfo);
    await mkdir(report.screenshotsDir, { recursive: true });
    await mkdir(report.videosDir, { recursive: true });
    return report;
  }

  async installVisualCursor(page: Page) {
    const installCursor = () => {
      const cursorId = "uat-playwright-cursor";
      const rippleId = "uat-playwright-cursor-ripple";

      if (!document.getElementById("uat-playwright-cursor-style")) {
        const style = document.createElement("style");
        style.id = "uat-playwright-cursor-style";
        style.textContent = `
          #${cursorId} {
            position: fixed;
            z-index: 2147483647;
            left: 0;
            top: 0;
            width: 22px;
            height: 22px;
            border: 3px solid #ff2d55;
            border-radius: 999px;
            background: rgba(255, 45, 85, .18);
            box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 8px 18px rgba(0,0,0,.25);
            pointer-events: none;
            transform: translate(-50%, -50%);
            transition: width .12s ease, height .12s ease, background .12s ease;
          }
          #${cursorId}.clicking {
            width: 34px;
            height: 34px;
            background: rgba(255, 45, 85, .35);
          }
          #${rippleId} {
            position: fixed;
            z-index: 2147483646;
            left: -100px;
            top: -100px;
            width: 48px;
            height: 48px;
            border: 3px solid rgba(255, 45, 85, .45);
            border-radius: 999px;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(.5);
            opacity: 0;
          }
          #${rippleId}.show {
            animation: uat-cursor-ripple .45s ease-out;
          }
          @keyframes uat-cursor-ripple {
            from { opacity: .95; transform: translate(-50%, -50%) scale(.35); }
            to { opacity: 0; transform: translate(-50%, -50%) scale(1.45); }
          }
        `;
        document.head.appendChild(style);
      }

      const cursor = document.getElementById(cursorId) ?? document.createElement("div");
      cursor.id = cursorId;
      if (!cursor.parentElement) document.documentElement.appendChild(cursor);

      const ripple = document.getElementById(rippleId) ?? document.createElement("div");
      ripple.id = rippleId;
      if (!ripple.parentElement) document.documentElement.appendChild(ripple);

      const moveTo = (x: number, y: number) => {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      };

      window.addEventListener("mousemove", (event) => moveTo(event.clientX, event.clientY), true);
      window.addEventListener("mousedown", (event) => {
        moveTo(event.clientX, event.clientY);
        cursor.classList.add("clicking");
        ripple.style.left = `${event.clientX}px`;
        ripple.style.top = `${event.clientY}px`;
        ripple.classList.remove("show");
        void ripple.offsetWidth;
        ripple.classList.add("show");
      }, true);
      window.addEventListener("mouseup", () => cursor.classList.remove("clicking"), true);

      moveTo(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
    };

    await page.addInitScript(installCursor);
    await page.evaluate(installCursor).catch(() => undefined);
  }

  async step(page: Page, title: string, action: () => Promise<void>, options: UatStepOptions = {}) {
    const stepNumber = this.steps.length + 1;
    const screenshotName = `${String(stepNumber).padStart(2, "0")}-${slugify(title)}.png`;
    const screenshotPath = path.join(this.screenshotsDir, screenshotName);
    const relativeScreenshotPath = `screenshots/${screenshotName}`;
    const waitAfterMs = options.waitAfterMs ?? 900;
    const fullPage = options.fullPage ?? false;

    try {
      await action();
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      if (waitAfterMs > 0) await page.waitForTimeout(waitAfterMs);
      await page.screenshot({ path: screenshotPath, fullPage });
      this.steps.push({ title, status: "passed", screenshot: relativeScreenshotPath });
    } catch (error) {
      if (waitAfterMs > 0) await page.waitForTimeout(waitAfterMs).catch(() => undefined);
      await page.screenshot({ path: screenshotPath, fullPage }).catch(() => undefined);
      this.steps.push({
        title,
        status: "failed",
        screenshot: relativeScreenshotPath,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.writeHtml();
      throw error;
    }
  }

  async attachVideo(page: Page) {
    const video = page.video();
    if (!video) return;

    const fileName = `${slugify(this.title)}.webm`;
    const destPath = path.join(this.videosDir, fileName);
    const savePromise = video.saveAs(destPath);
    await page.close().catch(() => undefined);
    await savePromise;
    this.videoPath = `videos/${fileName}`;
  }

  async writeHtml() {
    const endedAt = new Date();
    const failed = this.steps.some((step) => step.status === "failed");

    const stepsHtml = this.steps.map((step, index) => `
      <section class="step ${step.status}">
        <div class="step-header">
          <span class="badge">${index + 1}</span>
          <div>
            <h2>${escapeHtml(step.title)}</h2>
            <p>Status: <strong>${step.status === "passed" ? "Passou" : "Falhou"}</strong></p>
          </div>
        </div>
        ${step.error ? `<pre class="error">${escapeHtml(step.error)}</pre>` : ""}
        <a href="${escapeHtml(step.screenshot)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(step.screenshot)}" alt="${escapeHtml(step.title)}" />
        </a>
      </section>
    `).join("\n");

    const videoHtml = this.videoPath ? `
      <section class="video-card">
        <h2>Vídeo da execução</h2>
        <p>Gravação completa do teste Playwright, útil para acompanhar transições entre as etapas documentadas.</p>
        <video controls preload="metadata" src="${escapeHtml(this.videoPath)}"></video>
      </section>
    ` : "";

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(this.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Segoe UI, Arial, sans-serif; }
    body { margin: 0; background: #f6f7fb; color: #172033; }
    header { padding: 32px; background: linear-gradient(135deg, #0f4c81, #1f7bb6); color: white; }
    header h1 { margin: 0 0 8px; font-size: 28px; }
    header p { margin: 4px 0; opacity: .9; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card, .step { background: white; border: 1px solid #dde3ee; border-radius: 16px; box-shadow: 0 10px 25px rgba(15, 76, 129, .08); }
    .card { padding: 16px; }
    .card strong { display: block; font-size: 22px; margin-top: 6px; }
    .step { padding: 18px; margin-bottom: 18px; }
    .video-card { background: white; border: 1px solid #dde3ee; border-radius: 16px; box-shadow: 0 10px 25px rgba(15, 76, 129, .08); padding: 18px; margin-bottom: 18px; }
    .video-card h2 { margin: 0 0 6px; font-size: 20px; }
    .video-card p { margin: 0 0 14px; color: #5d697b; }
    video { display: block; width: 100%; max-height: 720px; border-radius: 12px; border: 1px solid #d8dfeb; background: #111827; }
    .step-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
    .step h2 { margin: 0; font-size: 18px; }
    .step p { margin: 4px 0 0; color: #5d697b; }
    .badge { width: 34px; height: 34px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: white; background: #0f4c81; flex: 0 0 auto; }
    .failed .badge { background: #b42318; }
    .failed { border-color: #f2b8b5; }
    img { display: block; width: 100%; border-radius: 12px; border: 1px solid #d8dfeb; }
    .error { white-space: pre-wrap; background: #fff1f0; border: 1px solid #ffd0cc; color: #8f1d18; border-radius: 10px; padding: 12px; overflow: auto; }
    @media (max-width: 760px) { .summary { grid-template-columns: 1fr; } header, main { padding: 18px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(this.title)}</h1>
    <p>Relatório UAT automatizado gerado pelo Playwright.</p>
    <p>Início: ${escapeHtml(this.startedAt.toLocaleString("pt-BR"))} · Fim: ${escapeHtml(endedAt.toLocaleString("pt-BR"))}</p>
  </header>
  <main>
    <div class="summary">
      <div class="card">Resultado<strong>${failed ? "Falhou" : "Passou"}</strong></div>
      <div class="card">Etapas<strong>${this.steps.length}</strong></div>
      <div class="card">Screenshots<strong>${this.steps.length}</strong></div>
    </div>
    ${videoHtml}
    ${stepsHtml}
  </main>
</body>
</html>`;

    await writeFile(path.join(this.dir, "index.html"), html, "utf8");
  }
}
