#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="Alexis-Tissier/cuisine"

echo "=== Cuisine Premium V3.3 ==="
echo "1. Déploiement Authentik-native sur Oracle"
echo "2. Mise à jour du repo GitHub si gh est connecté"
echo

"$DIR/update-oracle-server.sh"

echo
if ! command -v gh >/dev/null 2>&1; then
  echo "ℹ️  GitHub CLI absent : le serveur est à jour, mais GitHub n'a pas été poussé."
  echo "   Installe-le avec : sudo dnf install -y gh"
  exit 0
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "ℹ️  gh n'est pas connecté : le serveur est à jour, mais GitHub n'a pas été poussé."
  echo "   Lance : gh auth login"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "🐙 Mise à jour de $REPO…"
gh repo clone "$REPO" "$TMP/repo" -- --quiet
rsync -a --delete \
  --exclude='.git' \
  --exclude='.venv' \
  --exclude='data' \
  --exclude='.cuisine-server.*' \
  "$DIR/" "$TMP/repo/"

cd "$TMP/repo"
git add -A
if git diff --cached --quiet; then
  echo "✅ GitHub est déjà à jour."
else
  git commit -m "Release Cuisine Premium V3.3 — tbsp tsp pinch"
  git push origin main
  echo "✅ GitHub mis à jour : https://github.com/$REPO"
fi

echo
echo "✅ Cuisine V3.3 terminée."
