#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 utilisateur@serveur [dossier-distant]"
  echo "Exemple: $0 azureuser@1.2.3.4 ~/cuisine-deploy"
  exit 1
fi

TARGET="$1"
REMOTE_DIR="${2:-~/cuisine-deploy}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v rsync >/dev/null || { echo "rsync est nécessaire."; exit 1; }

echo "Envoi de Cuisine vers $TARGET:$REMOTE_DIR"
ssh "$TARGET" "mkdir -p $REMOTE_DIR"
rsync -az --delete \
  --exclude '.venv' \
  --exclude 'data' \
  --exclude '.cuisine-server.*' \
  "$DIR/" "$TARGET:$REMOTE_DIR/"

echo
echo "Installation distante..."
ssh -t "$TARGET" "cd $REMOTE_DIR && chmod +x install-server.sh && ./install-server.sh"

echo
echo "Cuisine est installée. Il reste à raccorder ton domaine dans Caddy."
