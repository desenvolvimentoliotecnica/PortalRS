@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo  Prototipo Mobile Talent RH
echo  --------------------------
echo  Pasta: %CD%
echo  URL:   %URL%
echo.
echo  Pressione Ctrl+C para encerrar o servidor.
echo.

timeout /t 1 /nobreak >nul
start "" "%URL%"

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Usando Python http.server na porta %PORT%...
  python -m http.server %PORT%
  goto :eof
)

where node >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Usando npx serve na porta %PORT%...
  npx --yes serve -l %PORT% .
  goto :eof
)

echo ERRO: Instale Python ou Node.js para servir os arquivos.
echo Modulos ES nao funcionam abrindo index.html direto no navegador.
pause
exit /b 1
