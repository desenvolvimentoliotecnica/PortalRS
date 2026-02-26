#!/bin/bash
# Pull Servidor - script para task "AWS Shell Script" na Release (só ECR, sem S3).
# Corrige: ##vso[task.error] -> task.logissue type=error; leitura confiável do Status do SSM.
set -e
REGION="us-east-1"
INSTANCE_ID="i-0eeaeace5464919cc"
IMAGE_TAG="${IMAGE_TAG:-$(Build.BuildId)}"

REMOTE_SCRIPT=$(cat << REMOTE_EOF
set -e
export IMAGE_TAG="${IMAGE_TAG}"
APP_DIR="/home/ubuntu/render"
REGION="us-east-1"

cd "\$APP_DIR" || exit 1

grep -q '^IMAGE_TAG=' "\$APP_DIR/.env.qa" 2>/dev/null && \\
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=\${IMAGE_TAG}/" "\$APP_DIR/.env.qa" || \\
  echo "IMAGE_TAG=\${IMAGE_TAG}" >> "\$APP_DIR/.env.qa"

aws ecr get-login-password --region "\$REGION" | sudo docker login --username AWS --password-stdin 745729872512.dkr.ecr.us-east-1.amazonaws.com

sudo docker compose --env-file "\$APP_DIR/.env.qa" -f "\$APP_DIR/docker-compose.qa.yml" pull
sudo docker compose --env-file "\$APP_DIR/.env.qa" -f "\$APP_DIR/docker-compose.qa.yml" up -d

sudo chown -R ubuntu:ubuntu "\$APP_DIR"
REMOTE_EOF
)

B64=$(echo -n "$REMOTE_SCRIPT" | base64 -w 0)
PARAMS="{\"commands\":[\"echo $B64 | base64 -d | bash\"]}"

COMMAND_ID=$(aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --instance-ids "$INSTANCE_ID" \
  --parameters "$PARAMS" \
  --region "$REGION" \
  --timeout-seconds 900 \
  --query 'Command.CommandId' \
  --output text)

echo "Command ID: $COMMAND_ID - waiting for execution on EC2..."
aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" || true

# Status em chamada separada para não misturar com output grande
STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Status' \
  --output text)

echo "=== stdout (EC2) ==="
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' \
  --output text
echo "=== stderr (EC2) ==="
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardErrorContent' \
  --output text

if [ "$STATUS" != "Success" ]; then
  echo "##vso[task.logissue type=error]SSM command failed on EC2. Status: $STATUS"
  exit 1
fi
echo "Pull Servidor completed on EC2."
