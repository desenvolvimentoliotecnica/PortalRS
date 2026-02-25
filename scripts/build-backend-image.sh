#!/bin/bash
# Build da imagem do backend (RHPortal.Api) para ECR - projeto Render.
# Baseado em Voltage.QualiOps.Integration/scripts/build-backend-image.sh.
# Deve rodar na raiz do workspace onde está deploy-package.tar.gz (ex.: Agent da Release).
set -euo pipefail

ROOT="${SYSTEM_DEFAULTWORKINGDIRECTORY:-$(System.DefaultWorkingDirectory)}"
echo "Root: $ROOT"
ls -la "$ROOT"

TAR_PATH=$(find "$ROOT" -name "deploy-package.tar.gz" -type f 2>/dev/null | head -1)
if [ -z "$TAR_PATH" ]; then
  echo "ERRO: deploy-package.tar.gz nao encontrado em $ROOT"
  exit 1
fi

DROP_DIR=$(dirname "$TAR_PATH")
echo "Drop dir: $DROP_DIR"
cd "$DROP_DIR"
tar -xzf deploy-package.tar.gz

# Tag: variável do pipeline ou latest
IMAGE_TAG="${BUILD_BUILDID:-latest}"
IMAGE_NAME="render-api:${IMAGE_TAG}"

# Contexto: Voltage.RenderRH (pacote) ou raiz
if [ -d "Voltage.RenderRH/RHPortal.Api" ]; then
  BUILD_CONTEXT="Voltage.RenderRH"
  DOCKERFILE="Voltage.RenderRH/RHPortal.Api/Dockerfile"
elif [ -d "RHPortal.Api" ]; then
  BUILD_CONTEXT="."
  DOCKERFILE="RHPortal.Api/Dockerfile"
else
  echo "ERRO: RHPortal.Api nao encontrado em $DROP_DIR"
  ls -la
  exit 1
fi

echo "Build context: $BUILD_CONTEXT"
echo "Dockerfile: $DOCKERFILE"
docker build -f "$DOCKERFILE" -t "$IMAGE_NAME" "$BUILD_CONTEXT"

echo "Imagem local criada: $IMAGE_NAME"
echo "##vso[task.setvariable variable=IMAGE_TAG]$IMAGE_TAG"
echo "##vso[task.setvariable variable=LOCAL_IMAGE_NAME]$IMAGE_NAME"
