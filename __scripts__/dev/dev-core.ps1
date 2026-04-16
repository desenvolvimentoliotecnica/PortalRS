# ============================================================
# dev-core.ps1 - Voltage RenderRH (Windows)
# Sobe: API (porta 5056) + Next.js (porta 3000)
# Uso: powershell -File __scripts__/dev/dev-core.ps1
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\..\.." | Select-Object -ExpandProperty Path

# Setup do ambiente (githooks + dotnet-ef)
& "$Root\setup-dev.ps1"

# Libera portas
foreach ($port in @(5056, 3000, 3001)) {
    $pids = netstat -ano 2>$null | Select-String ":$port\s" | Select-String "LISTENING" |
            ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
    foreach ($p in $pids) {
        if ($p -match '^\d+$') {
            Write-Host ">> Liberando porta $port (PID $p)..." -ForegroundColor DarkGray
            taskkill /PID $p /T /F 2>$null | Out-Null
        }
    }
}

# Inicia API em background
Write-Host ">> Subindo API em background (porta 5056)..." -ForegroundColor Cyan
$env:InboxFolder__RootPath = "$env:TEMP\renderrh-inbox"
if (-not (Test-Path $env:InboxFolder__RootPath)) {
    New-Item -ItemType Directory -Force -Path $env:InboxFolder__RootPath | Out-Null
}
$apiParams = @{
    FilePath         = "dotnet"
    ArgumentList     = "run"
    WorkingDirectory = "$Root\RHPortal.Api\RHPortal.Api"
    PassThru         = $true
    NoNewWindow      = $true
}
$api = Start-Process @apiParams

# Aguarda API ficar pronta
Write-Host ">> Aguardando API em http://localhost:5056/health (max 90s)..." -ForegroundColor DarkGray
$max = 90
$ready = $false
while ($max -gt 0) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5056/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -lt 400) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
    $max -= 2
}
if ($ready) {
    Write-Host ">> API pronta." -ForegroundColor Green
    Start-Process "http://localhost:5056/swagger"
} else {
    Write-Host ">> Aviso: timeout aguardando API. Continuando mesmo assim." -ForegroundColor Yellow
}

# Inicia Next.js em foreground (Ctrl+C encerra tudo)
Write-Host ">> Subindo Next.js em foreground (porta 3000) - Ctrl+C encerra tudo..." -ForegroundColor Cyan
$nextDir = "$Root\LioTecnica.Web.Next"
if (-not (Test-Path "$nextDir\node_modules")) {
    Write-Host ">> Instalando dependencias do Next.js..." -ForegroundColor DarkGray
    Push-Location $nextDir
    pnpm install --silent
    Pop-Location
}

# Abre browser quando Next.js estiver pronto
$browserJob = Start-Job -ScriptBlock {
    param($url)
    $n = 60
    while ($n -gt 0) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -lt 400) { Start-Process $url; break }
        } catch {}
        Start-Sleep -Seconds 2
        $n -= 2
    }
} -ArgumentList "http://localhost:3000/app"

try {
    Set-Location $nextDir
    $env:NODE_OPTIONS = "--max-old-space-size=2048"
    $env:DEV_API_ORIGIN = "http://localhost:5056"
    $env:PORT = "3000"
    pnpm dev
} finally {
    # Ctrl+C chegou - encerra API
    Write-Host ""
    Write-Host ">> Encerrando API..." -ForegroundColor DarkGray
    if ($api -and -not $api.HasExited) {
        taskkill /PID $api.Id /T /F 2>$null | Out-Null
    }
    Stop-Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job $browserJob -ErrorAction SilentlyContinue
}
