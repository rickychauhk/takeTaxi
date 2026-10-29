#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export COMPOSE_FILE=docker-compose.uat.yml
export ENV_FILE=.env.uat

docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-parallel api
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-parallel crm
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
