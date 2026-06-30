@echo off
setlocal

set "PLANNER_DIR=%~dp0tools\planner-tasks"
set "PYTHON_EXE=C:\Users\leonardo.mendes\AppData\Local\Programs\Python\Python311\python.exe"
set "PORT=8877"

if not exist "%PLANNER_DIR%\index.html" (
    echo [ERRO] Export Planner nao encontrado:
    echo %PLANNER_DIR%
    pause
    exit /b 1
)

if not exist "%PLANNER_DIR%\serve.py" (
    echo [ERRO] serve.py nao encontrado em:
    echo %PLANNER_DIR%
    pause
    exit /b 1
)

cd /d "%PLANNER_DIR%"

echo ========================================
echo  Export Planner - Portal RH
echo ========================================
echo.
echo Abrindo em http://localhost:%PORT%/index.html
echo Pressione Ctrl+C para encerrar o servidor.
echo.

if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" serve.py %PORT%
) else (
    echo [AVISO] Python esperado nao encontrado:
    echo %PYTHON_EXE%
    echo.
    echo Tentando executar com "python" do PATH...
    python serve.py %PORT%
)

if errorlevel 1 (
    echo.
    echo [ERRO] O servidor terminou com falha.
    pause
)

endlocal
