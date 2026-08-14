#!/usr/bin/env bash
#
# Biznex BOS — Store Hub deployment (ARM64 Ubuntu)
#
# What it does:
#   1. Installs Node.js 22 LTS (if missing)
#   2. Installs Tailscale (if missing) — enables your phone to reach the Pi
#      from ANY network. You still need to open https://login.tailscale.com
#      once to approve the device.
#   3. Installs server + web dependencies and builds the POS web app
#   4. Generates a secure JWT secret
#   5. Installs a systemd service so Biznex starts at boot
#
# Usage:  bash scripts/deploy-hub.sh
# Run as your normal user (sudo is prompted when needed).

set -euo pipefail

INSTALL_DIR="/opt/biznex-pos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       Biznex BOS — Store Hub deployer      ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Node.js 22 ─────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  echo "  • Installing Node.js 22 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential python3
else
  echo "  ✓ Node $(node -v) already installed"
fi

# ── 2. Tailscale (any-network access from your phone) ─────────────────────────
if ! command -v tailscale >/dev/null 2>&1; then
  echo "  • Installing Tailscale…"
  curl -fsSL https://tailscale.com/install.sh | sh
  sudo tailscale up --hostname=biznex-store
  echo ""
  echo "  ⚠ Open https://login.tailscale.com once and approve this device,"
  echo "    then install the Tailscale app on your phone and log into the same account."
else
  echo "  ✓ Tailscale already installed ($(tailscale status 2>/dev/null | head -1 | awk '{print $1}' || echo 'not logged in'))"
  sudo tailscale up --hostname=biznex-store || true
fi

# ── 3. Copy app to /opt ───────────────────────────────────────────────────────
if [ "$REPO_DIR" != "$INSTALL_DIR" ]; then
  echo "  • Installing app to $INSTALL_DIR…"
  sudo mkdir -p "$INSTALL_DIR"
  sudo rsync -a --delete --exclude node_modules --exclude data --exclude dist "$REPO_DIR/" "$INSTALL_DIR/"
fi

# ── 4. Dependencies + build ───────────────────────────────────────────────────
echo "  • Installing server dependencies…"
cd "$INSTALL_DIR/server"
npm install --omit=dev --no-audit --no-fund
npm install-scripts approve better-sqlite3 >/dev/null 2>&1 || true
npm rebuild better-sqlite3 >/dev/null 2>&1 || true

echo "  • Building POS web app…"
cd "$INSTALL_DIR/pos-web"
npm install --no-audit --no-fund
npm run build

# ── 5. .env with a secure secret ──────────────────────────────────────────────
cd "$INSTALL_DIR/server"
if [ ! -f .env ]; then
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  cp .env.example .env
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
  echo "  ✓ Generated secure JWT secret"
fi

# ── 6. systemd service ────────────────────────────────────────────────────────
echo "  • Installing systemd service…"
sudo cp "$INSTALL_DIR/scripts/biznex-pos.service" /etc/systemd/system/biznex-pos.service
sudo systemctl daemon-reload
sudo systemctl enable biznex-pos
sudo systemctl restart biznex-pos || true
sleep 2

# ── 7. Done ───────────────────────────────────────────────────────────────────
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
TAIL="$(tailscale ip -4 2>/dev/null | head -1 || echo 'not ready')"

echo ""
echo "  ┌──────────────────────────────────────────────────────────┐"
echo "  │                   ✅ Biznex is running                    │"
echo "  └──────────────────────────────────────────────────────────┘"
echo ""
echo "  POS terminal (in store):  http://$IP:3000"
[ -n "$TAIL" ] && [ "$TAIL" != "not ready" ] && echo "  From your phone (anywhere): http://$TAIL:3000"
echo ""
echo "  Owner app server address:  http://$IP:3000   (or the Tailscale address above)"
echo ""
echo "  Default logins (CHANGE THESE in Settings → Change password):"
echo "    admin    / admin123    (owner)"
echo "    manager  / manager123"
echo "    cashier  / cashier123"
echo ""
echo "  Service: sudo systemctl status biznex-pos"
echo "  Logs:    sudo journalctl -u biznex-pos -f"
echo ""
