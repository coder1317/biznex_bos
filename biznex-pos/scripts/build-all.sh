#!/usr/bin/env bash
# Build the POS web app and marketing website from a development machine.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Building POS web app =="
cd "$ROOT/pos-web"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build

echo "== Building website =="
cd "$ROOT/website"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build

echo ""
echo "✅ Done."
echo "   POS web  → pos-web/dist  (served automatically by the server on port 3000)"
echo "   Website  → website/dist  (deploy anywhere, e.g. Netlify/Vercel)"
