#!/usr/bin/env bash
# 將 PROD（app.hktaketaxi.online）程式、DB、uploads 同步至 UAT（taxima.hkcodai.space）
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROD_SSH_KEY="${PROD_SSH_KEY:-/Users/wingchau/taxi-ma/hktaketaxi.pem}"
PROD_HOST="${PROD_HOST:-3.104.225.159}"
UAT_SSH_KEY="${UAT_SSH_KEY:-/Users/wingchau/Documents/AWS KEY/ai-sales-bot-key.pem}"
UAT_HOST="${UAT_HOST:-52.63.249.152}"
UAT_APP="${UAT_APP_DIR:-/home/ec2-user/apps/taxima-uat}"
PROD_APP="${PROD_APP_DIR:-/home/ec2-user/apps/taxima-prod}"

RSYNC_SSH_PROD="ssh -i \"${PROD_SSH_KEY}\" -o IdentitiesOnly=yes"
RSYNC_SSH_UAT="ssh -i \"${UAT_SSH_KEY}\" -o IdentitiesOnly=yes"

echo "==> 1/5 Sync PROD codebase → UAT (keep .env.uat)"
rsync -avz --delete \
  -e "$RSYNC_SSH_PROD" \
  --exclude node_modules --exclude .git --exclude dist \
  --exclude 'apps/passenger/ios/Pods' --exclude 'apps/passenger/ios/build' \
  --exclude 'apps/passenger/android' --exclude 'apps/passenger/.expo' \
  --exclude 'apps/driver/ios/Pods' --exclude 'apps/driver/ios/build' \
  --exclude 'apps/driver/android' --exclude 'apps/driver/.expo' \
  --exclude '.env.prod' --exclude '.env.uat' --exclude '*.pem' \
  "ec2-user@${PROD_HOST}:${PROD_APP}/" "/tmp/taxima-prod-sync/"

rsync -avz --delete \
  -e "$RSYNC_SSH_UAT" \
  --exclude '.env.uat' \
  "/tmp/taxima-prod-sync/" "ec2-user@${UAT_HOST}:${UAT_APP}/"

scp -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes \
  "${REPO_DIR}/docker-compose.uat.yml" "ec2-user@${UAT_HOST}:${UAT_APP}/docker-compose.uat.yml"

echo "==> 2/5 Merge PROD .env secrets → UAT .env.uat"
bash "${REPO_DIR}/deploy/scripts/sync-prod-env-to-uat.sh"

echo "==> 3/5 MySQL: PROD dump → UAT restore"
DUMP="/tmp/taxima-prod-for-uat.sql"
ssh -i "$PROD_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${PROD_HOST}" 'bash -s' <<'PROD_DUMP' >"$DUMP"
set -euo pipefail
set -a
source /home/ec2-user/apps/taxima-prod/.env.prod
set +a
docker exec taxima-prod-mysql-1 mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --no-tablespaces "$MYSQL_DATABASE" 2>/dev/null
PROD_DUMP

wc -c "$DUMP"
ssh -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${UAT_HOST}" 'bash -s' <<'UAT_RESTORE'
set -euo pipefail
set -a
source /home/ec2-user/apps/taxima-uat/.env.uat
set +a
docker exec -i taxima-uat-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "SET FOREIGN_KEY_CHECKS=0; DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; SET FOREIGN_KEY_CHECKS=1;"
UAT_RESTORE

scp -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "$DUMP" "ec2-user@${UAT_HOST}:/tmp/taxima-prod-for-uat.sql"
ssh -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${UAT_HOST}" 'bash -s' <<'UAT_IMPORT'
set -euo pipefail
set -a
source /home/ec2-user/apps/taxima-uat/.env.uat
set +a
docker exec -i taxima-uat-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < /tmp/taxima-prod-for-uat.sql
rm -f /tmp/taxima-prod-for-uat.sql
UAT_IMPORT

echo "==> 4/5 Uploads volume: PROD → UAT"
ssh -i "$PROD_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${PROD_HOST}" \
  'docker run --rm -v taxima-prod_taxima_prod_uploads:/data:ro alpine tar -cC /data .' \
  | ssh -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${UAT_HOST}" \
  'docker run --rm -i -v taxima-uat_taxima_uat_uploads:/data alpine sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xC /data"'

echo "==> 5/5 Docker rebuild on UAT (sequential)"
ssh -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${UAT_HOST}" "cd ${UAT_APP} && \
  docker-compose -f docker-compose.uat.yml --env-file .env.uat build api && \
  docker-compose -f docker-compose.uat.yml --env-file .env.uat build crm && \
  docker-compose -f docker-compose.uat.yml --env-file .env.uat up -d"

echo "==> Done. UAT: https://taxima.hkcodai.space/api/v1/health"
