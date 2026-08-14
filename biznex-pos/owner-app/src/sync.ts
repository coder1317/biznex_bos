import { api, subscribeRealtime, subscribeConn, ConnState } from './api';
import { getCache, getSyncedAt, setCache } from './store';

/**
 * Background sync engine.
 *
 * Screens never fetch on their own anymore — they read the local store
 * (instant, works offline) and this engine keeps that store fresh by pulling
 * the latest stats through the tunnel. It syncs:
 *
 *   • on app start (after sign-in)          — stale keys refreshed
 *   • on every realtime event               — affected datasets, debounced
 *   • when the connection comes back online — forced refresh
 *   • periodically (every 60s)              — only keys past their TTL
 *
 * Everything is best-effort: a failed fetch never throws, so the app always
 * shows the last-known data and just keeps trying in the background.
 */

interface Dataset {
  key: string;
  path: string;
  ttl: number; // ms before a cached value is considered stale
}

const DATASETS: Dataset[] = [
  { key: 'dashboard', path: '/dashboard', ttl: 45_000 },
  { key: 'sales-range', path: '/sales-range?days=7', ttl: 60_000 },
  { key: 'orders', path: '/orders?limit=50', ttl: 90_000 },
  { key: 'products', path: '/products', ttl: 120_000 },
  { key: 'valuation', path: '/reports/inventory-valuation', ttl: 120_000 },
  { key: 'users', path: '/users', ttl: 180_000 },
  { key: 'complaints', path: '/complaints', ttl: 90_000 },
  { key: 'settings', path: '/settings', ttl: 180_000 },
];

const DATASET_BY_KEY = new Map(DATASETS.map((d) => [d.key, d]));

// Which datasets a realtime event invalidates (makes stale → re-synced).
const EVENT_KEYS: Record<string, string[]> = {
  'order:created': ['dashboard', 'sales-range', 'orders'],
  'order:updated': ['dashboard', 'sales-range', 'orders'],
  'product:updated': ['products', 'valuation', 'dashboard'],
  'inventory:updated': ['products', 'valuation', 'dashboard'],
  'complaint:created': ['complaints'],
  'complaint:updated': ['complaints'],
  'staff:clocked-in': ['users'],
  'staff:clocked-out': ['users'],
  'settings:updated': ['settings'],
};

let started = false;
let syncing = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let lastConn: ConnState = 'offline';

/** Is the cached value for this dataset fresh enough to skip a fetch? */
function isFresh(key: string): boolean {
  const ds = DATASET_BY_KEY.get(key);
  if (!ds) return true;
  const at = getSyncedAt(key);
  if (at == null) return false;
  return Date.now() - at < ds.ttl;
}

/** Fetch one dataset and write it to the store. Never throws. */
async function syncOne(ds: Dataset): Promise<void> {
  try {
    const data = await api<any>(ds.path);
    if (data !== null && data !== undefined) await setCache(ds.key, data);
  } catch {
    /* offline / error — keep showing last-known data */
  }
}

/** Sync the given keys (all of them if none given). `force` ignores freshness. */
export async function syncKeys(keys?: string[], force = false): Promise<void> {
  if (syncing) return;
  const wanted = keys && keys.length > 0 ? keys.map((k) => DATASET_BY_KEY.get(k)!).filter(Boolean) : DATASETS;
  const due = wanted.filter((d) => force || !isFresh(d.key));
  if (due.length === 0) return;
  syncing = true;
  try {
    await Promise.all(due.map((d) => syncOne(d)));
  } finally {
    syncing = false;
  }
}

/** Sync every dataset, ignoring freshness (used on reconnect / pull-to-refresh). */
export function syncAll(force = false): Promise<void> {
  return syncKeys(undefined, force);
}

/**
 * Coalesce rapid realtime events into one sync pass shortly after. These are
 * forced (ignore TTL): a fresh-but-just-changed dataset must be re-pulled so
 * the stats on screen actually tick up.
 */
function scheduleRealtimeSync(keys: string[]): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncKeys(keys, true);
  }, 1200);
}

/**
 * Start the sync engine: realtime + connection listeners + periodic refresh.
 * Idempotent; call once after sign-in.
 */
export function startSync(): void {
  if (started) return;
  started = true;
  lastConn = 'offline';

  subscribeRealtime((e) => {
    const keys = EVENT_KEYS[e.type];
    if (keys) scheduleRealtimeSync(keys);
  });

  subscribeConn((c) => {
    // Transitioning to online (or starting online) → pull fresh stats now.
    if (c === 'online' && lastConn !== 'online') syncAll(true);
    lastConn = c;
  });

  // Initial background pass — stale keys only (fresh ones from a recent
  // session are reused, so the app opens instantly with last-known data).
  syncAll(false);

  // Keep everything reasonably fresh while the app is open.
  periodicTimer = setInterval(() => syncAll(false), 60_000);
}

/** Stop the engine (sign-out). Safe to call more than once. */
export function stopSync(): void {
  started = false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

// Expose dataset metadata for the "last updated" UI in Settings.
export function getDatasetMeta(key: string): { path: string; ttl: number } | null {
  const ds = DATASET_BY_KEY.get(key);
  return ds ? { path: ds.path, ttl: ds.ttl } : null;
}

export function isCacheFresh(key: string): boolean {
  return isFresh(key);
}

/** Convenience used by pull-to-refresh on screens. */
export function refreshDataset(key: string): Promise<void> {
  return syncKeys([key], true);
}

export { getCache };
