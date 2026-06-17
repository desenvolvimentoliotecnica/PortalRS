@echo off
setlocal
cd /d "%~dp0..\LiotecnicaHub\LiotecnicaHub.Web"

echo Liotecnica Hub — dev local (SQLite, sem Docker)
echo.
echo Abrindo http://localhost:3010 ...
echo.

dotnet run --launch-profile http

endlocal
