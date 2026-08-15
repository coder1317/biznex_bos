# Biznex BOS — Store Hub + Owner App

A complete, self-hosted **business operating system** for Indian retail — a combined
system of hardware and software:

- **One Biznex Store Hub** (a compact in-store appliance) runs the whole store — POS
  terminal, sales, inventory, receipts, reports. Works fully offline; the Hub is the
  source of truth.
- **One Android app (Biznex Owner)** on your phone, live-synced with the Hub over
  **any Wi-Fi or cellular network** (via Tailscale or ngrok), so you can watch the
  store from anywhere.
- **A marketing website** for the product (see `website/`).

```
┌───────────────────┐        ┌──────────────────────┐
│  Biznex Owner     │◄──────►│   Biznex Store Hub   │
│  (phone app)      │  TLS   │   compact in-store   │
│  (any network)    │ Tailscale/ngrok │   appliance (ARM64) │
└───────────────────┘        │   Node 22 + SQLite   │
                             │   serves POS web UI  │
                             └──────────────────────┘
```

## What's in this repo

| Folder | What it is |
|---|---|
| `server/` | The Hub server — Express + SQLite API, auth (JWT), realtime WebSocket, serves the POS UI on port 3000 |
| `pos-web/` | The in-store POS web app (React + Vite + Tailwind) — touch-friendly checkout, inventory, staff, discounts, complaints, reports, settings |
| `owner-app/` | The **owner portal** Android app (React Native + Expo) — dashboard, orders, stock, staff, complaints, settings |
| `website/` | The marketing website (React + Vite + Tailwind) |
| `scripts/` | `deploy-hub.sh` (one-shot Store Hub deployment), `build-all.sh`, systemd unit |

## Part 1 — Deploy the Biznex Store Hub

Requirements: an ARM64 Ubuntu appliance — our reference hardware is a Pi 4/5-class
board running **Ubuntu Server / Desktop 22.04+** (64-bit); any ARM64 Ubuntu machine
works too.

```bash
# On the Hub — from this repo folder
bash scripts/deploy-hub.sh
```

The script:

1. Installs Node.js 22 LTS and builds all dependencies
2. Installs **Tailscale** so your phone can reach the Hub from any network
3. Generates a secure `JWT_SECRET`
4. Installs a **systemd service** (`biznex-pos`) that starts the server at boot
5. Prints the store address and default logins

**First-time Tailscale step (5 minutes):**
1. On the Hub, the script runs `tailscale up` — open `https://login.tailscale.com`,
   log in, and approve the new device (it shows up as `biznex-store`).
2. Install the **Tailscale app** on your phone (Play Store) and log in with the same account.
3. Note the Hub's Tailscale IP (`tailscale ip -4` on the Hub) — that's the address
   your owner app will use from anywhere.

Then open `http://<hub-address>:3000` in a browser on the shop computer (or the
Hub's own browser in kiosk mode) → sign in with `admin / admin123` → **change the
passwords** in Settings.

### Remote access from anywhere (ngrok)

Tailscale works great, but if you'd rather not install an app on your phone,
**ngrok** gives you a plain public `https://` address that works from any Wi-Fi
or mobile network. **Live updates (sales, orders, stock) flow through the tunnel
in real time** — the app's WebSocket works over it (verified end-to-end: an
order placed through the public URL fires the `order:created` event to the
phone immediately).

```bash
# On the Hub — from this repo folder (free authtoken at dashboard.ngrok.com/signup)
bash scripts/ngrok-install.sh <your-ngrok-authtoken>
```

The script installs ngrok, saves your authtoken, installs a `biznex-ngrok`
systemd service that survives reboots, and **auto-pins your permanent domain**
(free static domain from https://dashboard.ngrok.com/domains) so the public
address never changes between restarts. Pass it explicitly if you like:

```bash
bash scripts/ngrok-install.sh <authtoken> your-store-name.ngrok-free.dev
```

Once it's up, the store's Settings → **Pair the owner app** automatically shows
the address under **Remote (ngrok)** — scan that QR and your phone is connected
from any network. No ngrok account? Tailscale above already gives you
anywhere-access with zero setup cost.

**Two things are already handled for you in the code:**

- The owner app sends `ngrok-skip-browser-warning` on every request. Without
  it, ngrok answers browser-like requests with its warning splash page (which
  has no CORS headers), which the app would misreport as a network failure.
  The header makes the app work through the tunnel on any network.
- The server sets `trust proxy` for loopback connections only, so
  express-rate-limit accepts ngrok's `X-Forwarded-For` header without letting
  LAN clients spoof it. (Without this, the rate limiter throws
  `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and every tunnelled request fails.)

### Local development (without a Hub)

```bash
# Terminal 1 — API server
cd server && npm install && npm run dev        # http://localhost:3000

# Terminal 2 — POS UI with hot reload (proxies to :3000)
cd pos-web && npm install && npm run dev       # http://localhost:5173

# Or, to have the server serve the built UI:
cd pos-web && npm run build
```

## Part 2 — Build the owner app (Android APK)

The app is React Native (Expo SDK 52). A prebuilt, **signed release APK is
included at `dist/biznex-owner.apk`** (34 MB, arm64 + 32-bit arm) — copy it to
your phone and tap it to install (enable "Install unknown apps" for your
browser/file manager). No Expo Go, no store, nothing else needed.

The app ships with the **Biznex brand icon** (legacy + adaptive Android
launcher icons) and a **logo splash** — icon sources live in `assets/` and are
wired through `app.json` (`icon`, `adaptiveIcon.foregroundImage`).

> **Why release and not debug?** Debug APKs don't embed the JavaScript bundle —
> they expect a Metro dev server, so installed standalone they open to a white
> screen. Release builds bundle the JS (Hermes bytecode) into the APK and run
> fully offline.

To build it yourself on any Ubuntu machine (no Android Studio needed, no EAS):

```bash
# 1. Prerequisites: JDK 17 + Android SDK (command-line tools, platform 35, build-tools 35)
#    e.g. install Android Studio, or the cmdline-tools + sdkmanager route

cd owner-app
npm install          # runs a postinstall patch automatically (see below)

# 2. Generate the native Android project
npx expo prebuild --platform android

# 2b. Restore release signing + ABI config (prebuild wipes custom build.gradle
#     edits — the signing block, keystore and arm-only ABIs live in
#     .tooling/backup/ and are re-applied with:)
cp .tooling/backup/release.keystore android/app/keystores/
# …then re-add the `release` signingConfig block + `ndk.abiFilters` to
# android/app/build.gradle (see .tooling/backup/build.gradle.custom for the exact block)

# 3. Build the signed release APK (first run downloads Gradle + deps, ~10 min)
cd android
export ANDROID_HOME=/path/to/android-sdk
export JAVA_HOME=/path/to/jdk-17
./gradlew assembleRelease

# APK output:
#   android/app/build/outputs/apk/release/app-release.apk
```

The release build is wired to sign with `app/keystores/release.keystore`
(alias `biznex`, password `biznex123` — **change these before shipping**; the
folder is gitignored). Keep that keystore safe — it's what lets you update the
same app on users' phones without reinstalling.

### Why the version pins + postinstall patch?

Two things are pinned in `owner-app/package.json` so local builds work:

1. **Expo SDK 52 versions** — `@expo/vector-icons` is pinned to `~14.0.4` and
   `expo-font` to `~13.0.4`. Without this, npm can resolve vector-icons 14.1+,
   which drags in `expo-font@57` (SDK 54-era) and breaks the native build with
   a confusing `expo-module-gradle-plugin not found` error.
2. **`scripts/patch-expo-publishing.mjs`** (runs on `npm install`) — patches
   expo-modules-core's gradle plugin with the upstream `components.release`
   guard, fixing `Could not get unknown property 'release' for SoftwareComponent
   container` on Gradle 8.10 + AGP 8.6.

### Using the app — offline-first sync (stats update through the tunnel)

The app is a **viewer that syncs, not loads**: it keeps a copy of your store
stats on the phone and updates them in the background through the tunnel —
like a normal app, not a remote desktop. The dashboard matches the owner
portal design: greeting + live connection pill, KPI cards (revenue today,
transactions, avg ticket, month total, low stock, active staff), a 7-day
revenue chart, and the payment split.

**How syncing works:**

1. **Local store** — everything the app shows (today's stats, 7-day revenue,
   orders, products & stock, staff, complaints) is stored on your phone
   (`AsyncStorage`). Screens render **instantly** from that store — even
   before the tunnel is contacted, and even with no network at all.
2. **Background sync engine** — while you're signed in, the app pulls fresh
   stats through the tunnel: right after sign-in, every time a live event
   arrives (new order, stock change, complaint — via the WebSocket, debounced
   ～1s), whenever the connection comes back online, and every 60s for stale
   data. Each screen shows when it last synced ("synced 2m ago").
3. **Tunnel is for updates only** — the ngrok tunnel is never needed to open
   the app or see data. It's used to refresh the stored stats. Open the app
   on mobile data with the store's Wi-Fi off: you see the last-synced numbers
   immediately, with an **Offline** pill, and they update the moment a
   connection is available.
4. **Live events still tick** — a sale at the counter bumps the revenue on
   your phone within a couple of seconds: the WebSocket event invalidates the
   cached stats and the engine re-pulls them through the tunnel.
5. **Auto-connect + strong connection** — the app probes every known address
   (saved server, original LAN IP, ngrok tunnel, others) and attaches to the
   first that answers; session is restored via refresh token so login only
   happens once. A failover monitor switches to the next reachable address if
   the current one drops.
6. **Offline, made obvious** — a red banner + Offline pill when the Hub is
   unreachable; the app keeps showing the last-known data and re-syncs on its
   own when the connection returns.
7. **Original IP is never lost** — `http://192.168.1.100:3000` stays as the
   **Original** entry and the ngrok tunnel as **Remote** in Settings → *Known
   addresses*. Settings also shows a **Data & sync** panel (last-synced time
   per dataset + **Sync now** button).

First-time setup (only needed once):

1. Open **Biznex Owner**. It automatically finds the store (ngrok tunnel or
   LAN) and fills in the address.
2. Log in with the owner account (`admin / admin123` initially — change it).
3. From then on the app **skips login** and shows last-synced data instantly;
   stats update in the background whenever the tunnel is reachable.

## Part 3 — The website

```bash
cd website && npm install && npm run dev      # local preview
npm run build                                  # static site in website/dist
```

Deploy `website/dist` to any static host (Netlify, Vercel, GitHub Pages, or the Hub itself).

## API overview

All routes are under `/api`, auth via `Authorization: Bearer <jwt>`:

- `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me` · `PUT /auth/password`
- `GET/POST /products` · `GET/POST/PUT/DELETE /products/:id` · `/products/categories`
- `POST /inventory/adjust` · `GET /inventory/movements` · `GET /inventory/low-stock`
- `POST /orders` (atomic: validates stock, applies discounts, deducts, logs movements)
- `GET /orders` · `GET /orders/:id` · `GET /orders/:id/bill` · `PUT /orders/:id/status`
- `GET /users` · `POST /users` · `PUT/DELETE /users/:id` · `/users/shifts`
- `GET/POST /discounts` · `GET/POST /complaints` · `GET/PUT /settings`
- `GET /dashboard` · `GET /sales-range?days=N` · `GET /reports/*`
- `GET /sync/state` · `GET /sync/snapshot`  ← what the owner app uses for incremental sync
- `WS /ws` — live events: `order:created`, `inventory:updated`, `complaint:created`, …

## Roles & permissions

Every action is enforced **server-side** (JWT role checks) **and** hidden in the UI:

| Action | Cashier | Manager | Admin/Owner |
|---|---|---|---|
| Take orders (POS), view dashboard & orders | ✅ | ✅ | ✅ |
| Create / edit products, adjust stock | — | ✅ | ✅ |
| Discounts, complaints, reports | — | ✅ | ✅ |
| Staff management (users) | — | — | ✅ |
| Settings, pairing QR, store config | — | — | ✅ |
| Delete products / discounts (hard delete) | — | — | ✅ |

- **POS web (Hub):** nav items, buttons and routes are filtered by role — a cashier
  who types `/staff` in the URL gets redirected to the POS terminal.
- **Owner app (phone):** tabs are filtered by role too (cashiers see Home/Orders
  only). The server rejects anything a role isn't allowed to do regardless.
- Roles: `owner` > `admin` > `manager` > `cashier`.

## Security notes

- **Change default passwords** on first login (Settings → Change password).
- Set a real `JWT_SECRET` in `server/.env` (the installer does this automatically).
- The Hub binds to `0.0.0.0` — the store network and Tailscale can reach it. Don't
  expose port 3000 directly to the public internet; Tailscale or ngrok is the safe path.
- Receipts, inventory movements and refunds are all audit-logged in `stock_movements`.

## Default accounts

| Role | Username | Password |
|---|---|---|
| Owner | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |
