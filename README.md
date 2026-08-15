# Biznex BOS

**The business operating system for modern retail.**

Biznex is a combined system of **hardware and software** that runs your entire
storefront — billing, inventory, staff, reports — and keeps you connected to
every store from your phone, on any network, even when the internet is down.

```
┌────────────────────┐        secure sync       ┌─────────────────────┐
│    Biznex Owner    │◄────────────────────────►│  Biznex Store Hub   │
│  (mobile app, any  │   TLS + realtime events  │  (in-store device)  │
│   network)         │                          │  runs your store    │
└────────────────────┘                          └─────────────────────┘
```

## One system — hardware + software

| Component | What it is |
|---|---|
| **Biznex Store Hub** | The compact in-store device that runs the entire storefront — billing, inventory, receipts, reports. Purpose-built, low-power, and fully operational with **no internet connection**. |
| **Biznex POS** | Touch-first storefront software on the Hub: checkout, discounts, stock, staff shifts, complaints, reports, settings. |
| **Biznex Owner** | The mobile app for store owners and managers: live dashboard, orders, stock, staff, complaints — **realtime-synced from any network**. |
| **Biznex Sync** | The secure sync layer connecting Store Hubs to owner devices over the internet — live events, background sync, offline-first delivery. |
| **Biznex Website** | The product site — maintained in its own repository (see below). |

## Why Biznex

- **Offline-first.** The store never stops because the internet did. The Hub
  runs the whole storefront locally, and the Owner app keeps the latest numbers
  on your phone — syncing in the background whenever a connection is available.
- **Realtime visibility.** Every sale at the counter ticks up on your phone
  within seconds — no matter which network you're on.
- **Role-based access.** Owner, manager, and cashier each see exactly what they
  need — enforced on the device, not just hidden in the UI.
- **Multi-store ready.** One system, every store — the same Hub + Owner setup
  scales across locations, with a single view for owners.
- **Your data stays in your store.** Self-hosted by design; no third-party
  cloud sits between you and your data.

## Getting started

Deploying a Biznex unit is a one-command setup:

```bash
cd biznex-pos
bash scripts/deploy-hub.sh       # deploys the Store Hub (installs the platform,
                                  # builds the POS, configures the sync layer)
```

Then open `http://<hub-address>:3000` and sign in with the owner account
(`admin / admin123` — **change it** in Settings).

**Connect your phone:**

```bash
bash scripts/ngrok-install.sh <authtoken>   # secure remote access for owners
```

Install the **Biznex Owner** app (the signed release APK is at
`biznex-pos/dist/biznex-owner.apk`). It finds your store automatically, restores
your session, and shows last-synced stats instantly — even offline.

**Full deployment & development guide:** [biznex-pos/README.md](biznex-pos/README.md)

## Roles & permissions

Enforced on the Hub (server-side JWT checks) and hidden in the UI:

| Action | Cashier | Manager | Owner |
|---|---|---|---|
| Take orders (POS), view dashboard & orders | ✅ | ✅ | ✅ |
| Create / edit products, adjust stock | — | ✅ | ✅ |
| Discounts, complaints, reports | — | ✅ | ✅ |
| Staff management (users) | — | — | ✅ |
| Settings, pairing QR, store config | — | — | ✅ |

## Demo credentials

| Role | Username | Password |
|---|---|---|
| Owner | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |

## Security & privacy

- **Change default passwords** on first login (Settings → Change password).
- Owner devices reach the Hub only through **encrypted tunnels** (Tailscale or
  ngrok) — the Hub is never exposed directly to the public internet.
- Role checks are enforced server-side; receipts, inventory movements and
  refunds are audit-logged.

## Developer notes

- **Store Hub platform** — a compact ARM64 Ubuntu appliance running Node.js 22
  + SQLite (Express API, JWT auth, realtime WebSocket). The deployment
  installer (`scripts/deploy-hub.sh`) handles the full setup.
- **Owner app** — React Native (Expo SDK 52), offline-first local store with a
  background sync engine.
- **POS web app** — React + Vite + Tailwind, touch-first for store counters.
- **Website** — React + Vite + Tailwind, Bauhaus-inspired design system. Hosted in its own repository (`biznex-website`) with Netlify auto-deploy.
