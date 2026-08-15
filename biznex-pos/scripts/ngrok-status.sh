#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Biznex — ngrok status
#
# Prints the store's current public ngrok address (if a tunnel is running).
# The owner app also learns this address automatically (see /api/device/
# public-url), so a changed URL never needs manual re-pairing — this script
# is just for the store admin's peace of mind.
#
# Usage:  bash scripts/ngrok-status.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

URL="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(next((t['public_url'] for t in d.get('tunnels',[]) if t.get('public_url','').startswith('https')), ''))
except Exception:
  print('')" || true)"

if [ -n "$URL" ]; then
  echo "✓ Tunnel is LIVE: $URL"
  echo "  (This address is auto-learned by the owner app — no re-pairing needed.)"
else
  echo "✗ No ngrok tunnel running."
  echo "  Start one with:  bash scripts/ngrok-install.sh <authtoken> [static-domain]"
fi
