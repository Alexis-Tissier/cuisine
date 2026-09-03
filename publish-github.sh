#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
REPO="Alexis-Tissier/cuisine"

if ! command -v git >/dev/null 2>&1; then
  echo "❌ git n'est pas installé."
  exit 1
fi

if [[ ! -d .git ]]; then
  git init -b main
  git add .
  git commit -m "Initial release: Cuisine Premium V3.2"
fi

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    if gh repo view "$REPO" >/dev/null 2>&1; then
      git remote remove origin 2>/dev/null || true
      git remote add origin "git@github.com:$REPO.git"
      git push -u origin main
    else
      gh repo create "$REPO" --private --source=. --remote=origin --push --description "Application personnelle de recettes, courses et garde-manger"
    fi
    echo "✅ Repo GitHub : https://github.com/$REPO"
    exit 0
  fi
fi

echo "Le projet Git local est prêt."
echo "Pour publier automatiquement sur GitHub :"
echo "  sudo dnf install gh"
echo "  gh auth login"
echo "  ./publish-github.sh"
