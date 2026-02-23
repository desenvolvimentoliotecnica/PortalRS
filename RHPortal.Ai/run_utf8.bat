@echo off
REM Forca UTF-8 no processo para evitar UnicodeDecodeError no psycopg2 quando a senha do banco tem caracteres como c-cedilha.
set PYTHONUTF8=1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 %*
