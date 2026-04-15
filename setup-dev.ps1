# ============================================================
# setup-dev.ps1 — Voltage RenderRH
# Chamado automaticamente pelos scripts de subida da aplicação.
# Pode também ser executado manualmente uma vez ao clonar.
# ============================================================

$Root = Resolve-Path "$PSScriptRoot" | Select-Object -ExpandProperty Path

# ── 1. Git hooks ──────────────────────────────────────────────
$hooksPath = git -C $Root config core.hooksPath 2>$null
if ($hooksPath -ne ".githooks") {
    git -C $Root config core.hooksPath .githooks
    Write-Host "✅ Git hooks configurados (.githooks/)" -ForegroundColor Green
} else {
    Write-Host "✅ Git hooks já configurados" -ForegroundColor DarkGray
}

# ── 2. dotnet-ef ──────────────────────────────────────────────
$efInstalled = dotnet ef --version 2>$null
if ($LASTEXITCODE -ne 0 -or -not $efInstalled) {
    Write-Host "📦 Instalando dotnet-ef global..." -ForegroundColor Yellow
    dotnet tool install --global dotnet-ef
} else {
    Write-Host "✅ dotnet-ef já instalado ($($efInstalled | Select-Object -First 1))" -ForegroundColor DarkGray
}
