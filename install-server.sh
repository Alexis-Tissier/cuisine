#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CUISINE_APP_DIR:-/opt/cuisine}"
DATA_DIR="${CUISINE_DATA_DIR:-/var/lib/cuisine}"
PORT="${CUISINE_PORT:-8092}"
SERVICE_USER="${CUISINE_USER:-$USER}"

echo "Installation de Cuisine dans $APP_DIR"

sudo mkdir -p "$APP_DIR" "$DATA_DIR"
sudo rsync -a --delete \
  --exclude '.venv' \
  --exclude 'data' \
  --exclude '.cuisine-server.*' \
  ./ "$APP_DIR"/

sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR" "$DATA_DIR"

# Ubuntu/Debian n'installe pas toujours le module venv avec Python.
# On vérifie avant de créer l'environnement et on installe automatiquement
# le paquet manquant si nécessaire.
if ! python3 - <<'PYVENV' >/dev/null 2>&1
import ensurepip, venv
PYVENV
then
  echo "📦 Installation automatique de python3-venv…"
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
fi

# Une tentative précédente peut avoir laissé un .venv incomplet.
rm -rf "$APP_DIR/.venv"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --upgrade pip
"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/requirements.txt"

sudo tee /etc/systemd/system/cuisine.service >/dev/null <<SERVICE
[Unit]
Description=Cuisine web app
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
Environment=CUISINE_DATA_DIR=$DATA_DIR
ExecStart=$APP_DIR/.venv/bin/uvicorn server:app --host 127.0.0.1 --port $PORT
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable --now cuisine.service

echo
echo "Cuisine est lancée sur http://127.0.0.1:$PORT"
echo "État :"
sudo systemctl --no-pager --full status cuisine.service | sed -n '1,12p'
echo
echo "Étape suivante : reverse_proxy Caddy vers 127.0.0.1:$PORT"
