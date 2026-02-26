#!/bin/bash
# CMD: WEB - COMPILA
# Estrutura IGUAL ao QualiOps: produz frontend/dist para S3.
# Render usa s3-landing (HTML estático) em vez de Vite build.
set -e

ROOT="$(System.DefaultWorkingDirectory)"
echo "Root: $ROOT"
ls -la "$ROOT"

TAR_PATH=$(find "$ROOT" -name "deploy-package.tar.gz" -type f 2>/dev/null | head -1)
if [ -z "$TAR_PATH" ]; then
  echo "ERRO: deploy-package.tar.gz não encontrado em $ROOT"
  exit 1
fi

DROP_DIR=$(dirname "$TAR_PATH")
echo "Drop dir: $DROP_DIR"
cd "$DROP_DIR"
tar -xzf deploy-package.tar.gz

# Localizar s3-landing (mesma lógica de pastas que API/AI)
if [ -d "Voltage.RenderRH/s3-landing" ]; then
  LANDING_DIR="Voltage.RenderRH/s3-landing"
  ROOT_PKG="Voltage.RenderRH"
elif [ -d "s3-landing" ]; then
  LANDING_DIR="s3-landing"
  ROOT_PKG="."
else
  echo "ERRO: pasta s3-landing não encontrada"
  ls -la
  exit 1
fi

# Output em frontend/dist (igual QualiOps) para S3
mkdir -p "$DROP_DIR/frontend/dist"
cp -r "$LANDING_DIR"/* "$DROP_DIR/frontend/dist/"

echo "Build concluído."
echo "Conteúdo frontend/dist:"
ls -la "$DROP_DIR/frontend/dist"
