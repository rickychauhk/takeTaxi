#!/usr/bin/env bash
set -euo pipefail

# Toggle deploy maintenance at nginx (run on EC2 with sudo).
# Flag file: /var/www/taxima-maintenance/enabled

APP_DIR="${APP_DIR:-/home/ec2-user/apps/taxima-uat}"
ACTION="${1:?Usage: install|on|off}"

MAINT_DIR="/var/www/taxima-maintenance"
FLAG="${MAINT_DIR}/enabled"
HTML_SRC="${APP_DIR}/deploy/maintenance/maintenance.html"

install_html() {
  sudo mkdir -p "$MAINT_DIR"
  if [[ ! -f "$HTML_SRC" ]]; then
    echo "Missing ${HTML_SRC}" >&2
    exit 1
  fi
  sudo cp "$HTML_SRC" "${MAINT_DIR}/maintenance.html"
}

reload_nginx() {
  sudo nginx -t
  sudo systemctl reload nginx
}

case "$ACTION" in
  install)
    install_html
    ;;
  on)
    install_html
    sudo touch "$FLAG"
    reload_nginx
    echo "Maintenance ON"
    ;;
  off)
    sudo rm -f "$FLAG"
    reload_nginx
    echo "Maintenance OFF"
    ;;
  *)
    echo "Usage: $0 install|on|off" >&2
    exit 1
    ;;
esac
