# Valida COUNT + PAGE da consulta admin requisições RM contra SQL Server CORPORERM.
# Credenciais via variáveis de ambiente (não commitar senha):
#   RM_SQL_SERVER (default 172.19.30.3)
#   RM_SQL_DATABASE (default CORPORERM)
#   RM_SQL_USER (default rm_readonly_voltage)
#   RM_SQL_PASSWORD (obrigatório)
param(
    [string]$DataDe = "",
    [string]$DataAte = "",
    [int]$MonthsBack = 3
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "validate-rm-requisicoes.sql"

if (-not (Test-Path $sqlFile)) {
    throw "Arquivo SQL não encontrado: $sqlFile"
}

$server = if ($env:RM_SQL_SERVER) { $env:RM_SQL_SERVER } else { "172.19.30.3" }
$database = if ($env:RM_SQL_DATABASE) { $env:RM_SQL_DATABASE } else { "CORPORERM" }
$user = if ($env:RM_SQL_USER) { $env:RM_SQL_USER } else { "rm_readonly_voltage" }
$password = $env:RM_SQL_PASSWORD

if ([string]::IsNullOrWhiteSpace($password)) {
    throw "Defina RM_SQL_PASSWORD antes de executar (senha read-only do RM)."
}

if ([string]::IsNullOrWhiteSpace($DataAte)) {
    $DataAte = (Get-Date).ToString("yyyy-MM-dd")
}
if ([string]::IsNullOrWhiteSpace($DataDe)) {
    $DataDe = (Get-Date).AddMonths(-1 * $MonthsBack).ToString("yyyy-MM-dd")
}

Write-Host "Servidor: $server / $database / $user"
Write-Host "Periodo: $DataDe .. $DataAte"
Write-Host "Executando sqlcmd (timeout query 180s)..."

$sw = [System.Diagnostics.Stopwatch]::StartNew()
& sqlcmd `
    -S $server `
    -d $database `
    -U $user `
    -P $password `
    -C `
    -b `
    -l 15 `
    -t 180 `
    -v DataDe="$DataDe" DataAte="$DataAte" `
    -i $sqlFile
$exit = $LASTEXITCODE
$sw.Stop()

if ($exit -ne 0) {
    throw "sqlcmd falhou com exit code $exit"
}

Write-Host ("Concluido em {0:N1}s" -f $sw.Elapsed.TotalSeconds)
