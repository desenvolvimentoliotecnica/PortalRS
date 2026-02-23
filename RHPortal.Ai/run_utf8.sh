#!/usr/bin/env bash
# Força UTF-8 no processo para evitar UnicodeDecodeError no psycopg2 quando a senha do banco tem caracteres como ç.
export PYTHONUTF8=1
exec python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 "$@"
