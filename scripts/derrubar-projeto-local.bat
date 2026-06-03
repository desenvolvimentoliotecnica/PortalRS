@echo off
setlocal

echo ========================================
echo  Derrubando RH Portal local
echo ========================================
echo.

echo Encerrando janelas abertas pelo script de subida...
taskkill /F /T /FI "WINDOWTITLE eq RHPortal API*" /IM cmd.exe >nul 2>nul
taskkill /F /T /FI "WINDOWTITLE eq RHPortal Frontend*" /IM cmd.exe >nul 2>nul
taskkill /F /T /FI "WINDOWTITLE eq RHPortal Portal Vagas*" /IM cmd.exe >nul 2>nul

echo Liberando portas locais do projeto, se ainda estiverem ocupadas...
for %%P in (3000 3050 5056 7073) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
        echo Encerrando processo na porta %%P, PID %%A...
        taskkill /F /T /PID %%A >nul 2>nul
    )
)

echo.
echo Finalizado.
echo.
timeout /t 3 /nobreak >nul

endlocal
