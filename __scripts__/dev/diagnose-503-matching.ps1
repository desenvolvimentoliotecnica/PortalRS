# Diagnostica o 503 do endpoint GET /api/vagas/{id}/matching-candidates
# Uso: .\diagnose-503-matching.ps1 -ApiBaseUrl "https://localhost:7XXX" -TenantId "liotecnica" -VagaId "GUID_DA_VAGA"
# Ou com defaults: .\diagnose-503-matching.ps1
param(
    [string] $ApiBaseUrl = "https://localhost:7001",
    [string] $TenantId = "liotecnica",
    [string] $VagaId = "00000000-0000-0000-0000-000000000001"
)

$uri = "$($ApiBaseUrl.TrimEnd('/'))/api/vagas/$VagaId/matching-candidates?minScore=0&take=40"
Write-Host "GET $uri" -ForegroundColor Cyan
Write-Host "X-Tenant-Id: $TenantId" -ForegroundColor Gray

try {
    $headers = @{
        "X-Tenant-Id" = $TenantId
        "Accept"      = "application/json"
    }
    $resp = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing -TimeoutSec 15 -SkipCertificateCheck
    Write-Host "Status: $($resp.StatusCode)" -ForegroundColor Green
    Write-Host $resp.Content
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host "Status: $status" -ForegroundColor Red
    Write-Host "Body: $body"
    if ($body -match "não configurado") {
        Write-Host "`n>>> CAUSA: RhAi:BaseUrl nao configurado ou API nao reiniciada apos config. Configure appsettings RhAi:BaseUrl (ex: http://localhost:8000) e reinicie a API." -ForegroundColor Yellow
    } elseif ($body -match "indisponível") {
        Write-Host "`n>>> CAUSA: RHPortal.Ai indisponivel (nao esta rodando em 8000, timeout ou erro no servico Python). Suba o RHPortal.Ai e confira DATABASE_URL e OPENAI_API_KEY." -ForegroundColor Yellow
    }
}
