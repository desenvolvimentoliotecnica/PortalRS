# Instala pgvector no PostgreSQL 18 (Windows).
# Execute como Administrador: clique direito em install-pgvector.ps1 > Executar com PowerShell
# Ou em um PowerShell elevado: Set-ExecutionPolicy Bypass -Scope Process -Force; .\install-pgvector.ps1

$ErrorActionPreference = "Stop"
$PGROOT = "C:\Program Files\PostgreSQL\18"
$SCRIPT_DIR = $PSScriptRoot

if (-not (Test-Path "$PGROOT\bin\pg_config.exe")) {
    Write-Host "PostgreSQL 18 nao encontrado em: $PGROOT" -ForegroundColor Red
    Write-Host "Ajuste a variavel PGROOT neste script se o PostgreSQL estiver em outro caminho." -ForegroundColor Yellow
    exit 1
}

Write-Host "Instalando pgvector em $PGROOT ..." -ForegroundColor Cyan
Copy-Item -Path "$SCRIPT_DIR\lib\vector.dll" -Destination "$PGROOT\lib\" -Force
Copy-Item -Path "$SCRIPT_DIR\share\extension\vector*" -Destination "$PGROOT\share\extension\" -Force
Write-Host "pgvector instalado. Reinicie o servico PostgreSQL se estiver rodando (opcional)." -ForegroundColor Green
Write-Host "Depois execute a migration AddEmbeddingSupport.sql no banco dev_render." -ForegroundColor Yellow
