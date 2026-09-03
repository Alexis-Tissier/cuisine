#!/usr/bin/env bash
set -euo pipefail
TARGET="oracle-server"
REMOTE_DIR="~/cuisine-update"
APP_DIR="/opt/cuisine"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🍳 Mise à jour Cuisine V3.1 sur $TARGET"
ssh -o ConnectTimeout=10 "$TARGET" 'echo "✅ SSH OK — $(hostname)"'

echo "📦 Envoi des fichiers…"
tar --exclude='.git' --exclude='.venv' --exclude='data' --exclude='.cuisine-server.*' -C "$DIR" -czf - .   | ssh "$TARGET" "rm -rf $REMOTE_DIR && mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"

echo "🔄 Mise à jour de /opt/cuisine sans toucher à /var/lib/cuisine…"
ssh -t "$TARGET" "bash -s" <<'REMOTE'
set -euo pipefail
sudo rsync -a --delete   --exclude='.venv'   --exclude='data'   "$HOME/cuisine-update/" /opt/cuisine/
sudo chown -R "$(whoami):$(whoami)" /opt/cuisine
if [[ -f /opt/cuisine/requirements.txt ]]; then
  /opt/cuisine/.venv/bin/pip install -q -r /opt/cuisine/requirements.txt
fi
sudo systemctl restart cuisine.service
sleep 1
curl -fsS http://127.0.0.1:8092/api/health && echo
sudo systemctl is-active --quiet cuisine && echo '✅ cuisine.service actif'
REMOTE

echo "🌐 Vérification publique…"
curl -fsS --max-time 8 https://cuisine.alexis-tissier.fr/api/health && echo
echo "✅ V3.1 déployée : https://cuisine.alexis-tissier.fr"
