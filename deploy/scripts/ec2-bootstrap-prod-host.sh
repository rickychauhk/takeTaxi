#!/usr/bin/env bash
# Run ON PROD EC2 (Amazon Linux 2023): Docker, Nginx, Certbot
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  sudo dnf install -y docker
  sudo systemctl enable --now docker
  sudo usermod -aG docker ec2-user || true
fi

if ! command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_VER=v2.24.7
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

if ! command -v nginx >/dev/null 2>&1; then
  sudo dnf install -y nginx certbot python3-certbot-nginx
fi

sudo mkdir -p /var/www/certbot
sudo systemctl enable nginx
sudo systemctl start nginx || true
echo "Bootstrap OK: docker=$(docker --version 2>/dev/null || echo missing)"
