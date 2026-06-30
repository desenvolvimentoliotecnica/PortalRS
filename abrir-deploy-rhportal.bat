@echo off
setlocal

set "REPO_DIR=D:\Projetos\PortalRS"
set "PYTHON_EXE=C:\Users\leonardo.mendes\AppData\Local\Programs\Python\Python311\python.exe"
set "SCRIPT=%REPO_DIR%\__scripts__\deploy\gui\deploy_gui.py"

if not exist "%REPO_DIR%" (
    echo [ERRO] Diretorio do repositorio nao encontrado:
    echo %REPO_DIR%
    pause
    exit /b 1
)

if not exist "%SCRIPT%" (
    echo [ERRO] Script de deploy nao encontrado:
    echo %SCRIPT%
    pause
    exit /b 1
)

cd /d "%REPO_DIR%"

if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" "%SCRIPT%"
) else (
    echo [AVISO] Python esperado nao encontrado:
    echo %PYTHON_EXE%
    echo.
    echo Tentando executar com "python" do PATH...
    python "%SCRIPT%"
)

if errorlevel 1 (
    echo.
    echo [ERRO] O script terminou com falha.
    pause
)

endlocal
