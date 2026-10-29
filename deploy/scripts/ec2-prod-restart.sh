#!/usr/bin/env bash
# 主機 reboot 後或 502 時：只重啟 compose，不 rebuild
set -euo pipefail
APP_DIR="${APP_DIR:-/home/ec2-user/apps/taxima-prod}"
ssh -i "${SSH_KEY:?Set SSH_KEY}" ec2-user@"${EC2_HOST:?Set EC2_HOST}" \
  "cd ${APP_DIR} && docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d && sudo systemctl reload nginx"
