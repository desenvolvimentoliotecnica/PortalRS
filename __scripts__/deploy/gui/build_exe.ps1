#Requires -Version 5.1
param(
  [string] $Python = "python",
  [string] $Name = "RHPortalHmgDeploy"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

& $Python -m pip install -r requirements.txt
& $Python -m PyInstaller `
  --noconfirm `
  --onefile `
  --windowed `
  --name $Name `
  deploy_gui.py

Write-Host ""
Write-Host "Executavel gerado em: $ScriptDir\dist\$Name.exe"
