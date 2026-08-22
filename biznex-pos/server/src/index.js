import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { db } from './db.js';
import { authRouter } from './auth.js';
import { productsRouter } from './routes/products.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { usersRouter } from './routes/users.js';
import { discountsRouter } from './routes/discounts.js';
import { complaintsRouter } from './routes/complaints.js';
import { insightsRouter } from './routes/insights.js';
import { settingsRouter } from './routes/settings.js';
import { deviceRouter } from './routes/device.js';
import { syncRouter } from './routes/sync.js';
import { createRealtimeHub } from './realtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
app.disable('x-powered-by');
// Trust X-Forwarded-* only from loopback — that's where ngrok connects from
// (it runs on the same machine and forwards to localhost:3000). Without this,
// express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request
// that arrives through the tunnel, which breaks the API for the owner app.
// Direct LAN clients are not loopback, so their forwarded headers stay ignored.
app.set('trust proxy', 'loopback');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed'));
  },
  credentials: true,
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true });
app.use('/api/auth', authLimiter);

// Rate-limit write-heavy endpoints to prevent abuse if the server is exposed.
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true });
app.use('/api/orders', writeLimiter);
app.use('/api/products', writeLimiter);
app.use('/api/inventory', writeLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'biznex-pos', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter); // includes /api/products/categories
app.use('/api/inventory', inventoryRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/discounts', discountsRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/settings', settingsRouter); // GET/PUT /api/settings
app.use('/api/device', deviceRouter);     // GET /api/device/addresses (QR pairing)
app.use('/api', insightsRouter);          // GET /api/dashboard, /sales-range, /reports/*

// ─────────────────────────────────────────────────────────────────────────────
// Static POS web app (production)
// ─────────────────────────────────────────────────────────────────────────────

const publicDir = config.publicDir || path.resolve(__dirname, '..', '..', 'pos-web', 'dist');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api|\/ws|\/health).*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  console.log(`  ✓ Serving POS web app from ${publicDir}`);
} else {
  console.log(`  • POS web app not found at ${publicDir} — API only. Build pos-web or set PUBLIC_DIR.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  if (err?.message === 'Origin not allowed') return res.status(403).json({ error: 'Origin not allowed' });
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(app);
const hub = createRealtimeHub(server);

// Expose the hub to route handlers for live events
app.locals.hub = hub;

server.listen(config.port, config.host, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │          Biznex POS — Store Server           │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log(`  • API + POS UI : http://localhost:${config.port}`);
  console.log(`  • Health       : http://localhost:${config.port}/health`);
  console.log(`  • Realtime WS  : ws://localhost:${config.port}/ws`);
  console.log('');
  if (config.isDev) {
    console.log('  Default logins (dev only):');
    console.log('    admin  / admin123    (owner)');
    console.log('    manager / manager123 (manager)');
    console.log('    cashier / cashier123 (cashier)');
    console.log('');
  }
  if (config.isDev) {
    console.log('  IMPORTANT: change the default passwords on first login.');
  }
  console.log('  Find your Pi IP with: hostname -I');
  console.log('');
});

// Unhandled errors — log and keep running (don't crash silently)
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n${sig} received, shutting down…`);
    db.close();
    process.exit(0);
  });
}
