#!/bin/sh
# ============================================================
# setup-dev.sh — Voltage RenderRH
# Execute uma vez ao clonar o repositório.
# No Windows use: setup-dev.ps1 (chamado automaticamente pelo dev.ps1)
# ============================================================

# Git hooks
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit 2>/dev/null || true
echo "✅ Git hooks configurados (.githooks/)"

# dotnet-ef
if ! dotnet ef --version > /dev/null 2>&1; then
  echo "📦 Instalando dotnet-ef..."
  dotnet tool install --global dotnet-ef
else
  echo "✅ dotnet-ef já instalado ($(dotnet ef --version 2>/dev/null | head -1))"
fi

echo "✅ Setup completo!"
