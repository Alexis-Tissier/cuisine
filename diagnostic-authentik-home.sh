#!/usr/bin/env bash
set -euo pipefail
TARGET="oracle-server"

echo "=== CADDY / AUTHENTIK ==="
ssh "$TARGET" 'sudo grep -n -E "authentik|outpost|forward_auth|alexis-home|home\.|dashboard|cuisine" /etc/caddy/Caddyfile 2>/dev/null || true'

echo
echo "=== SERVICES AUTHENTIK / HOME ==="
ssh "$TARGET" 'systemctl list-units --type=service --all | grep -Ei "authentik|alexis-home|dashboard|cuisine" || true'

echo
echo "=== /opt/alexis-home ==="
ssh "$TARGET" 'find /opt/alexis-home -maxdepth 2 -type f 2>/dev/null | sort | head -n 80 || true'

echo
echo "=== HOME REFERENCES / PERMISSIONS ==="
ssh "$TARGET" 'grep -RniE "authentik|apps|services|tiles|cards|greg|tiphaine|admin|dashboard" /opt/alexis-home/app /opt/alexis-home 2>/dev/null | head -n 180 || true'
