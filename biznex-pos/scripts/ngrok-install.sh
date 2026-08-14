#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Biznex — ngrok tunnel setup (access the store server from anywhere)
#
# The owner app connects to the store over your LAN or Tailscale by default.
# Running an ngrok tunnel adds a public https address that works from any
# network (Wi-Fi, mobile data), so live updates reach your phone everywhere.
#
# Usage:
#   bash scripts/ngrok-install.sh <your-ngrok-authtoken> [static-domain]
#
#   <authtoken>     From https://dashboard.ngrok.com/signup → "Your Authtoken"
#                   (starts with "2" or "3", ~49 characters).
#   [static-domain] Optional. Your free static domain from
#                   https://dashboard.ngrok.com/domains (e.g.
#                   your-store-name.ngrok-free.dev). If omitted, the script
#                   starts the tunnel and automatically pins whatever domain
#                   ngrok assigns — so the address NEVER changes on restart.
#
# Free-plan note: random ngrok addresses change on every restart. Pinning the
# static domain (free on the ngrok dashboard) keeps the address permanent.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "Usage: bash scripts/ngrok-install.sh <ngrok-authtoken> [static-domain]"
  echo "Get one free at https://dashboard.ngrok.com/signup"
  exit 1
fi
DOMAIN="${2:-}"

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64)  NG="ngrok-v3-stable-linux-arm64.tgz" ;;
  armv7l|armv6l)  NG="ngrok-v3-stable-linux-arm.tgz" ;;
  x86_64|amd64)   NG="ngrok-v3-stable-linux-amd64.tgz" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# 1. Install the ngrok binary if missing
if ! command -v ngrok >/dev/null 2>&1; then
  echo "→ Installing ngrok ($ARCH)…"
  # The classic CDN (equinox) is the reliable source; s3 mirror as fallback.
  if ! curl -sSL "https://bin.equinox.io/c/bNyj1mQVY4c/$NG" -o /tmp/ngrok.tgz; then
    curl -sSL "https://ngrok-agent.s3.amazonaws.com/$NG" -o /tmp/ngrok.tgz
  fi
  sudo tar xzf /tmp/ngrok.tgz -C /usr/local/bin
  rm -f /tmp/ngrok.tgz
  echo "  ✓ ngrok installed: $(ngrok version)"
else
  echo "→ ngrok already installed: $(ngrok version)"
fi

# 2. Save the authtoken
echo "→ Saving authtoken…"
ngrok config add-authtoken "$TOKEN" >/dev/null 2>&1 || ngrok authtoken "$TOKEN"

# 3. systemd service — keeps the tunnel alive across reboots
echo "→ Installing systemd service (biznex-ngrok)…"

# One throwaway tunnel start lets ngrok hand out the account's static domain
# (or a random one) so we can pin it and make the address permanent.
if [ -z "$DOMAIN" ]; then
  echo "  → Detecting your permanent ngrok domain…"
  (timeout 25 ngrok http 3000 --log=stdout --log-level=error >/tmp/ngrok-detect.log 2>&1 &) 
  sleep 8
  DOMAIN="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(next((t['public_url'] for t in d.get('tunnels',[]) if t.get('public_url','').startswith('https')), '').replace('https://',''))
except Exception:
  print('')")"
  pkill -f "ngrok http 3000" 2>/dev/null || true
  if [ -z "$DOMAIN" ]; then
    echo "  ⚠ Could not auto-detect the domain — starting with a random address."
    echo "  Pin a free static domain at https://dashboard.ngrok.com/domains and re-run with it:"
    echo "  bash scripts/ngrok-install.sh $TOKEN your-store-name.ngrok-free.dev"
  else
    echo "  ✓ Permanent domain: $DOMAIN"
  fi
fi

URL_FLAG=""
if [ -n "$DOMAIN" ]; then
  URL_FLAG="--url https://$DOMAIN"
fi

sudo tee /etc/systemd/system/biznex-ngrok.service >/dev/null <<EOF
[Unit]
Description=Biznex ngrok tunnel — remote access to the store server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/ngrok http 3000 $URL_FLAG --log=stdout --log-level=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now biznex-ngrok
echo "  ✓ tunnel service started (auto-starts on boot)"

# 4. Show the public URL
sleep 6
URL="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(next((t['public_url'] for t in d.get('tunnels',[]) if t.get('public_url','').startswith('https')), ''))
except Exception:
  print('')")"

echo ""
echo "──────────────────────────────────────────────────────────────────"
if [ -n "$URL" ]; then
  echo "  🎉 ngrok tunnel is LIVE — your store is reachable from anywhere:"
  echo ""
  echo "      $URL"
  echo ""
  echo "  This address now appears on the store's Settings page under"
  echo "  'Pair the owner app' → Remote (ngrok). Scan that QR with the"
  echo "  phone app and you're connected from any network — live updates"
  echo "  (sales, orders, stock) flow through the tunnel in real time."
else
  echo "  The service is running but I couldn't read the URL yet."
  echo "  Check it with:  curl -s http://127.0.0.1:4040/api/tunnels"
  echo "  Or:             systemctl status biznex-ngrok"
fi
echo "──────────────────────────────────────────────────────────────────"
