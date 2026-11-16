#!/usr/bin/env bash
# Despliegue de KAWSAY en un VPS Ubuntu 22.04/24.04 (probar primero en una VM).
# Uso:  sudo bash deploy/install.sh [--domain midominio.com] [--with-ollama]
set -euo pipefail

DOMINIO="_"; CON_OLLAMA=0
while [ $# -gt 0 ]; do case "$1" in
  --domain) DOMINIO="${2:?falta el dominio}"; shift 2;;
  --with-ollama) CON_OLLAMA=1; shift;;
  *) echo "Opcion desconocida: $1"; exit 1;; esac; done
[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo"; exit 1; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST=/opt/kawsay/app
export DEBIAN_FRONTEND=noninteractive

echo "[1/7] Paquetes base"
apt-get update -y
apt-get install -y nginx python3 curl ca-certificates gnupg openssl rsync

echo "[2/7] Node.js 24"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "[3/7] Usuario y codigo en $DEST"
id kawsay >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/kawsay --shell /usr/sbin/nologin kawsay
mkdir -p "$DEST"
rsync -a --delete --exclude node_modules --exclude .git --exclude dist --exclude .api-dist \
  --exclude .demo-data --exclude llm-service/runtime "$SRC"/ "$DEST"/
chown -R kawsay:kawsay /opt/kawsay

echo "[4/7] Dependencias y compilacion (unos minutos)"
runuser -u kawsay -- bash -c "cd $DEST/data-kit && npm ci --cache /opt/kawsay/.npm && npm run build && npm run build:api"

echo "[5/7] Ollama (IA local)"
if [ "$CON_OLLAMA" -eq 1 ]; then
  command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
  systemctl enable --now ollama
  ollama pull qwen3:4b
else
  echo "Omitido (--with-ollama para instalarlo). Sin Ollama el Monitor IA usa el reporte de respaldo."
fi

echo "[6/7] Servicios systemd"
install -m 644 "$DEST/deploy/systemd/kawsay-monitor.service" /etc/systemd/system/
install -m 644 "$DEST/deploy/systemd/kawsay-demo.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kawsay-monitor kawsay-demo
systemctl restart kawsay-monitor kawsay-demo

echo "[7/7] nginx con contrasena"
if [ ! -f /etc/nginx/.kawsay-htpasswd ]; then
  PASS="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)"
  printf 'kawsay:%s\n' "$(openssl passwd -apr1 "$PASS")" > /etc/nginx/.kawsay-htpasswd
  chmod 640 /etc/nginx/.kawsay-htpasswd; chgrp www-data /etc/nginx/.kawsay-htpasswd
  echo "=============================================="
  echo " Usuario: kawsay   Contrasena: $PASS"
  echo " (guardala: no se vuelve a mostrar)"
  echo "=============================================="
fi
sed "s/__DOMINIO__/$DOMINIO/" "$DEST/deploy/nginx/kawsay.conf" > /etc/nginx/sites-available/kawsay
ln -sf /etc/nginx/sites-available/kawsay /etc/nginx/sites-enabled/kawsay
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

sleep 3
echo "Comprobacion:"
curl -s -o /dev/null -w " demo directa  : HTTP %{http_code}\n" -H "Host: 127.0.0.1:4180" http://127.0.0.1:4180/ || true
systemctl --no-pager --lines=0 status kawsay-demo kawsay-monitor | grep -E "Active|●" || true
echo "Listo. Abre http://${DOMINIO/_/IP-DEL-VPS}/ (usuario kawsay). Para HTTPS: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMINIO"
