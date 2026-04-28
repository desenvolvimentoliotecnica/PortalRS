#Requires -Version 5.1
<#
.SYNOPSIS
  Constrói as imagens Docker da API e do Portal Vagas (React) e exporta um .tar
  para copiar ao servidor SEM git: no host, usar `docker load` e recriar os contentores.

.PARAMETER RepoRoot
  Raiz do repositório (pasta que contém RHPortal.Api e LioTecnica.PortalVagas.React).

.PARAMETER ApiPublicUrl
  URL da API como o navegador a vê no HMG (Vite build-time). Ex.: http://10.0.0.80:5000

.PARAMETER ImageSuffix
  Sufixo das tags (deve coincidir com o que o servidor usa). Padrão: devops-lucas

.PARAMETER OutputTar
  Caminho do ficheiro .tar gerado por `docker save`.

.PARAMETER SkipBuild
  Apenas empacota imagens já existentes localmente com as mesmas tags.

.NOTAS
  No servidor, após `docker load -i ficheiro.tar`, é preciso recriar os contentores
  para usar a nova imagem: `docker compose ... up -d --force-recreate` ou parar/remover
  e subir de novo com o mesmo docker run / compose que já usam.
#>
param(
  [string] $RepoRoot = "",
  [string] $ApiPublicUrl = "http://10.0.0.80:5000",
  [string] $ImageSuffix = "devops-lucas",
  [string] $OutputTar = "",
  [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$apiTag = "rhportal-api-${ImageSuffix}:local"
$portalTag = "rhportal-portal-vagas-${ImageSuffix}:local"

if (-not $OutputTar) {
  $OutputTar = Join-Path $env:TEMP "rhportal-hmg-$ImageSuffix-images.tar"
}

Write-Host "RepoRoot: $RepoRoot"
Write-Host "Imagens: $apiTag , $portalTag"
Write-Host "VITE_API_BASE_URL (build portal): $ApiPublicUrl"
Write-Host "Tar de saída: $OutputTar"
Write-Host ""

$portalPath = Join-Path $RepoRoot "LioTecnica.PortalVagas.React"
if (-not (Test-Path (Join-Path $portalPath "Dockerfile"))) {
  throw "Dockerfile do Portal Vagas não encontrado em: $portalPath"
}

if (-not $SkipBuild) {
  Write-Host "==> Build API..."
  & docker build -f (Join-Path $RepoRoot "RHPortal.Api\Dockerfile") -t $apiTag $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw "Falha no build da API." }

  Write-Host "==> Build Portal Vagas (React)..."
  $buildArgs = @(
    "build",
    "-f", (Join-Path $portalPath "Dockerfile"),
    "--build-arg", "VITE_API_BASE_URL=$ApiPublicUrl",
    "--build-arg", "VITE_DEFAULT_TENANT=liotecnica",
    "-t", $portalTag,
    $portalPath
  )
  & docker @buildArgs
  if ($LASTEXITCODE -ne 0) { throw "Falha no build do Portal Vagas." }
} else {
  Write-Host "SkipBuild: a assumir que as imagens $apiTag e $portalTag já existem localmente."
}

Write-Host "==> docker save -> $OutputTar"
& docker save -o $OutputTar $apiTag $portalTag
if ($LASTEXITCODE -ne 0) { throw "Falha no docker save." }

$size = (Get-Item $OutputTar).Length / 1MB
Write-Host ""
Write-Host "Feito. Tamanho aproximado: $([math]::Round($size, 2)) MB"
Write-Host ""
Write-Host "Próximo passo no servidor (SSH):"
Write-Host "  docker load -i rhportal-hmg-$ImageSuffix-images.tar"
Write-Host "  # Depois recrie api + portal vagas (compose ou docker run) para usar a nova imagem."
Write-Host ""
Write-Host "Copiar o tar para o servidor (exemplo com pscp PuTTY):"
Write-Host "  pscp -pw SUA_SENHA `"$OutputTar`" administrator@10.0.0.80:/home/administrator/"
