# ============================================================
# setup-dev.ps1 - Voltage RenderRH
# Chamado automaticamente pelos scripts de subida da aplicacao.
# Pode tambem ser executado manualmente uma vez ao clonar.
# ============================================================

$Root = Resolve-Path "$PSScriptRoot" | Select-Object -ExpandProperty Path

# 1. Git hooks
$hooksPath = git -C $Root config core.hooksPath 2>$null
if ($hooksPath -ne ".githooks") {
    git -C $Root config core.hooksPath .githooks
    Write-Host "OK Git hooks configurados (.githooks/)" -ForegroundColor Green
} else {
    Write-Host "OK Git hooks ja configurados" -ForegroundColor DarkGray
}

# 2. dotnet-ef
$efInstalled = dotnet ef --version 2>$null
if ($LASTEXITCODE -ne 0 -or -not $efInstalled) {
    Write-Host "Instalando dotnet-ef global..." -ForegroundColor Yellow
    dotnet tool install --global dotnet-ef
} else {
    Write-Host "OK dotnet-ef ja instalado ($($efInstalled | Select-Object -First 1))" -ForegroundColor DarkGray
}
