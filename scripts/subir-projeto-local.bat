@echo off
setlocal

set "REPO_DIR=D:\Projetos\PortalRS"
set "API_DIR=%REPO_DIR%\RHPortal.Api\RHPortal.Api"
set "FRONT_DIR=%REPO_DIR%\LioTecnica.Web.Next"
set "PORTAL_VAGAS_DIR=%REPO_DIR%\LioTecnica.PortalVagas.React"

echo ========================================
echo  Subindo RH Portal local
echo ========================================
echo.

if not exist "%API_DIR%\RHPortal.Api.csproj" (
    echo [ERRO] Projeto da API nao encontrado:
    echo %API_DIR%\RHPortal.Api.csproj
    pause
    exit /b 1
)

if not exist "%FRONT_DIR%\package.json" (
    echo [ERRO] Projeto frontend nao encontrado:
    echo %FRONT_DIR%\package.json
    pause
    exit /b 1
)

if not exist "%PORTAL_VAGAS_DIR%\package.json" (
    echo [ERRO] Projeto Portal de Vagas nao encontrado:
    echo %PORTAL_VAGAS_DIR%\package.json
    pause
    exit /b 1
)

where dotnet >nul 2>nul
if errorlevel 1 (
    echo [ERRO] dotnet nao encontrado no PATH.
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] pnpm nao encontrado no PATH.
    pause
    exit /b 1
)

echo [1/3] Abrindo API em http://localhost:5056 ...
start "RHPortal API" /D "%API_DIR%" cmd /k "title RHPortal API && set ASPNETCORE_ENVIRONMENT=Development&& dotnet run --project RHPortal.Api.csproj --launch-profile http"

echo [2/3] Abrindo Portal Admin em http://localhost:3000 ...
start "RHPortal Frontend" /D "%FRONT_DIR%" cmd /k "title RHPortal Frontend && pnpm dev"

echo [3/3] Abrindo Portal de Vagas em http://localhost:3050 ...
start "RHPortal Portal Vagas" /D "%PORTAL_VAGAS_DIR%" cmd /k "title RHPortal Portal Vagas && pnpm dev"

echo.
echo Pronto. Aguarde as tres janelas terminarem de iniciar.
echo Portal Admin:    http://localhost:3000
echo Portal de Vagas: http://localhost:3050
echo API:             http://localhost:5056
echo.
echo Para derrubar tudo, execute:
echo %REPO_DIR%\scripts\derrubar-projeto-local.bat
echo.
timeout /t 5 /nobreak >nul

endlocal
