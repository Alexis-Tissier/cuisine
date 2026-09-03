#!/usr/bin/env bash
set -euo pipefail

TARGET="oracle-server"
REMOTE_DIR="~/cuisine-deploy"
DOMAIN="cuisine.alexis-tissier.fr"
PORT="8092"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ $1 est nécessaire sur ton PC."; exit 1; }
}
need ssh
need tar
need curl

echo "🍳 Déploiement de Cuisine vers $TARGET"
echo "   Domaine : https://$DOMAIN"
echo

ssh -o ConnectTimeout=10 "$TARGET" 'echo "✅ SSH OK — $(hostname) — $(whoami)"'

echo
echo "📦 Envoi des fichiers…"
tar \
  --exclude='.venv' \
  --exclude='data' \
  --exclude='.cuisine-server.*' \
  -C "$DIR" -czf - . \
  | ssh "$TARGET" "rm -rf $REMOTE_DIR && mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"

echo
echo "⚙️  Installation de l'application et du service systemd…"
ssh -t "$TARGET" "cd $REMOTE_DIR && chmod +x install-server.sh && CUISINE_PORT=$PORT CUISINE_APP_DIR=/opt/cuisine CUISINE_DATA_DIR=/var/lib/cuisine ./install-server.sh"

echo
echo "🌐 Configuration Caddy pour $DOMAIN…"
ssh -t "$TARGET" "DOMAIN='$DOMAIN' PORT='$PORT' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

CADDYFILE=/etc/caddy/Caddyfile
BEGIN='# BEGIN CUISINE APP'
END='# END CUISINE APP'

command -v caddy >/dev/null 2>&1 || { echo '❌ Caddy introuvable sur le serveur.'; exit 1; }
[[ -f "$CADDYFILE" ]] || { echo "❌ $CADDYFILE introuvable."; exit 1; }

TMP="$(mktemp)"
sudo awk -v begin="$BEGIN" -v end="$END" '
  $0 == begin {skip=1; next}
  $0 == end {skip=0; next}
  !skip {print}
' "$CADDYFILE" > "$TMP"

cat >> "$TMP" <<CADDY_BLOCK

$BEGIN
$DOMAIN {
    encode zstd gzip
    reverse_proxy 127.0.0.1:$PORT
}
$END
CADDY_BLOCK

sudo cp "$CADDYFILE" "${CADDYFILE}.bak-cuisine-$(date +%Y%m%d-%H%M%S)"
sudo cp "$TMP" "$CADDYFILE"
rm -f "$TMP"

sudo caddy validate --config "$CADDYFILE"
sudo systemctl reload caddy

echo
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo
sudo systemctl is-active --quiet cuisine && echo '✅ cuisine.service actif'
sudo systemctl is-active --quiet caddy && echo '✅ caddy.service actif'
REMOTE_SCRIPT

echo
echo "🔎 Vérification HTTPS publique…"
TMP_HEALTH="$(mktemp)"
trap 'rm -f "$TMP_HEALTH"' EXIT
for _ in {1..12}; do
  if curl -fsS --max-time 5 "https://$DOMAIN/api/health" >"$TMP_HEALTH" 2>/dev/null; then
    cat "$TMP_HEALTH"; echo
    echo
    echo "✅ Cuisine est en ligne : https://$DOMAIN"
    exit 0
  fi
  sleep 2
done

echo "⚠️  Le service est installé mais la vérification HTTPS n'a pas encore répondu."
echo "   Vérifie que le DNS de $DOMAIN pointe bien vers ton Oracle, puis relance :"
echo "   curl -I https://$DOMAIN"
