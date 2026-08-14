# Biznex POS — Pi + Phone Edition

A complete, self-hosted **point of sale for Indian retail**, built around a
Raspberry Pi in the store and an Android owner app on your phone.

- **One Raspberry Pi (Ubuntu)** runs the whole store — POS terminal, sales,
  inventory, receipts, reports. Works fully offline; the Pi is the source of truth.
- **One Android app (owner portal)** on your phone, live-synced with the Pi over
  **any Wi-Fi or cellular network** (via Tailscale or ngrok), so you can watch the
  store from anywhere.
- **Offline-first by design** — the phone app stores the latest stats locally and
  uses the tunnel only to refresh them in the background, exactly like a normal app.
- **A marketing website** in a Bauhaus-inspired design system.

```
┌───────────────────┐        ┌──────────────────────┐
│  Owner app (APK)  │◄──────►│   Raspberry Pi 4/5   │
│  on your phone    │  TLS   │   Ubuntu 22.04+      │
│  (any network)    │ Tailscale │   Node 22 + SQLite   │
└───────────────────┘        │   serves POS web UI  │
                             └──────────────────────┘
```

## What's in this repo

| Folder | What it is |
|---|---|
| `biznex-pos/server/` | The Pi server — Express + SQLite API, auth (JWT), realtime WebSocket, serves the POS UI on port 3000 |
| `biznex-pos/pos-web/` | The in-store POS web app (React + Vite + Tailwind) — touch-friendly checkout, inventory, staff, discounts, complaints, reports, settings |
| `biznex-pos/owner-app/` | The **owner portal** Android app (React Native + Expo) — dashboard, orders, stock, staff, complaints, settings |
| `biznex-pos/website/` | The marketing website (React + Vite + Tailwind) |
| `biznex-pos/scripts/` | `pi-install.sh` (one-shot Pi setup), `ngrok-install.sh` (remote tunnel), `build-all.sh`, systemd units |

## Quick start

**On the Raspberry Pi** (Ubuntu 22.04+, one command):

```bash
cd biznex-pos
bash scripts/pi-install.sh
```

Then open `http://<pi-ip>:3000` and sign in with the owner account
(`admin / admin123` — **change it** in Settings).

**Remote access from anywhere** (live updates through a public tunnel):

```bash
bash scripts/ngrok-install.sh <your-ngrok-authtoken>
```

**On your phone:** the signed release APK is at `biznex-pos/dist/biznex-owner.apk`.
It opens straight into a live dashboard, restores your session automatically, and
shows last-synced stats instantly — even offline.

**Local development / build instructions:** see [biznex-pos/README.md](biznex-pos/README.md)
for the full guide (Pi install, APK build, offline-first sync model, API overview).

## Roles & permissions

Enforced **server-side** (JWT role checks) and hidden in the UI:

| Action | Cashier | Manager | Admin/Owner |
|---|---|---|---|
| Take orders (POS), view dashboard & orders | ✅ | ✅ | ✅ |
| Create / edit products, adjust stock | — | ✅ | ✅ |
| Discounts, complaints, reports | — | ✅ | ✅ |
| Staff management (users) | — | — | ✅ |
| Settings, pairing QR, store config | — | — | ✅ |

## Default accounts

| Role | Username | Password |
|---|---|---|
| Owner | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |

## Security notes

- **Change default passwords** on first login (Settings → Change password).
- Set a real `JWT_SECRET` in `server/.env` (the Pi installer does this automatically).
- Don't expose port 3000 directly to the public internet — Tailscale or ngrok is the safe path.
- Receipts, inventory movements and refunds are audit-logged in `stock_movements`.
