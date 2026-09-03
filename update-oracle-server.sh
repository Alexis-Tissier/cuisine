#!/usr/bin/env bash
set -euo pipefail
TARGET="${CUISINE_SERVER:-oracle-server}"
REMOTE_DIR="~/cuisine-update"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🍳 Mise à jour Cuisine V3.2 Authentik-native sur $TARGET"
ssh -o ConnectTimeout=10 "$TARGET" 'echo "✅ SSH OK — $(hostname)"'

echo "📦 Envoi des fichiers…"
tar --exclude='.git' --exclude='.venv' --exclude='data' --exclude='.cuisine-server.*' -C "$DIR" -czf - . \
  | ssh "$TARGET" "rm -rf $REMOTE_DIR && mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"

echo "🔄 Mise à jour de /opt/cuisine sans toucher à /var/lib/cuisine…"
ssh -t "$TARGET" "bash -s" <<'REMOTE'
set -euo pipefail
sudo rsync -a --delete \
  --exclude='.venv' \
  --exclude='data' \
  "$HOME/cuisine-update/" /opt/cuisine/
sudo chown -R "$(whoami):$(whoami)" /opt/cuisine

if [[ -f /opt/cuisine/requirements.txt ]]; then
  /opt/cuisine/.venv/bin/pip install -q -r /opt/cuisine/requirements.txt
fi

# En production, le backend refuse toute API sans identité transmise par
# Authentik. Caddy reste l'unique point d'entrée public.
sudo mkdir -p /etc/systemd/system/cuisine.service.d
sudo tee /etc/systemd/system/cuisine.service.d/auth.conf >/dev/null <<'EOF'
[Service]
Environment=CUISINE_REQUIRE_AUTH=1
EOF

sudo systemctl daemon-reload
sudo systemctl restart cuisine.service
sleep 1

health="$(curl -fsS http://127.0.0.1:8092/api/health)"
echo "$health"
echo "$health" | grep -q '"version":"3.2"'
echo "$health" | grep -q '"auth_required":true'

status="$(curl -sS -o /tmp/cuisine-me-check -w '%{http_code}' http://127.0.0.1:8092/api/me)"
if [[ "$status" != "401" ]]; then
  echo "❌ Sécurité inattendue : /api/me sans Authentik répond HTTP $status"
  cat /tmp/cuisine-me-check || true
  exit 1
fi

echo '✅ API V3.2 : identité Authentik obligatoire'
sudo systemctl is-active --quiet cuisine.service && echo '✅ cuisine.service actif'
REMOTE

echo "🔐 Vérification de l'outpost Authentik public…"
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 https://cuisine.alexis-tissier.fr/outpost.goauthentik.io/ping)"
if [[ "$code" != "204" ]]; then
  echo "❌ Ping Authentik inattendu : HTTP $code"
  exit 1
fi

echo "✅ Outpost Authentik : HTTP 204"
echo "✅ V3.2 déployée : https://cuisine.alexis-tissier.fr"
echo "ℹ️  Déconnecte/reconnecte Authentik une fois si la page était déjà ouverte."
