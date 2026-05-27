@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py -3 tools\uat_runner.py
  exit /b %ERRORLEVEL%
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  python tools\uat_runner.py
  exit /b %ERRORLEVEL%
)

echo Python nao encontrado no PATH.
echo Instale Python 3 ou adicione Python ao PATH.
pause
exit /b 1
