#!/usr/bin/env bash
# 在 EC2 上對 MySQL 執行單一 init SQL（可重複跑，duplicate column 會略過）
set -euo pipefail
APP_DIR="${1:?APP_DIR}"
COMPOSE_FILE="${2:?compose file}"
ENV_FILE="${3:?env file}"
SQL_FILE="${4:?sql file}"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SQL_BASENAME="$(basename "$SQL_FILE")"
scp -i "${SSH_KEY:?}" "$REPO_DIR/database/init/$SQL_BASENAME" "ec2-user@${EC2_HOST:?}:$APP_DIR/$SQL_BASENAME"
ssh -i "${SSH_KEY}" "ec2-user@${EC2_HOST}" "cd '$APP_DIR' && set -a && . ./$ENV_FILE && set +a && docker-compose -f $COMPOSE_FILE exec -T mysql mysql --default-character-set=utf8mb4 -u\"\$MYSQL_USER\" -p\"\$MYSQL_PASSWORD\" \"\$MYSQL_DATABASE\" < '$SQL_BASENAME' 2>&1 || true"
