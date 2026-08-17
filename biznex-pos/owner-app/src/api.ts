import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_URL = 'biznex_server_url';
const KEY_TOKEN = 'biznex_token';
const KEY_USER = 'biznex_user';
const KEY_REFRESH = 'biznex_refresh_token';
const KEY_NGROK = 'biznex_ngrok_url';

export interface User {
  id: number;
  name: string;
  username: string;
  role: 'owner' | 'admin' | 'manager' | 'cashier';
  isActive: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** The original/default store server. Always kept in the known-servers list. */
export const ORIGINAL_SERVER = 'http://192.168.1.100:3000';

/** Fallback ngrok tunnel (used only until the server tells us the live one). */
export const NGROK_URL = 'https://backspace-rice-surfacing.ngrok-free.dev';

const KEY_SERVERS = 'biznex_servers';

/**
 * The current ngrok tunnel URL, learned from the server (see refreshPublicUrl).
 * The hardcoded NGROK_URL above is only the fallback — ngrok can assign a new
 * URL on restart, and the app heals itself by asking the store for its live
 * public URL on every successful connection.
 */
export async function getNgrokUrl(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY_NGROK)) || NGROK_URL;
  } catch {
    return NGROK_URL;
  }
}

export async function saveNgrokUrl(url: string): Promise<void> {
  const clean = (url || '').trim().replace(/\/+$/, '');
  if (!clean) return;
  const prev = await getNgrokUrl();
  if (clean === prev) return;
  await AsyncStorage.setItem(KEY_NGROK, clean);
  // Drop the outdated tunnel URL from the known list before adding the new one,
  // so a changed ngrok address doesn't linger as a dead candidate.
  try {
    const raw = await AsyncStorage.getItem(KEY_SERVERS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(
      KEY_SERVERS,
      JSON.stringify(list.filter((u) => u !== prev && u !== clean))
    );
  } catch {
    /* keep whatever list we have */
  }
  await rememberServer(clean);
}

/**
 * Ask the store for its current public ngrok URL and remember it. Safe to call
 * with any reachable base (LAN or tunnel) — if the tunnel changed, the next
 * connect learns the new address and the app keeps working from anywhere.
 */
export async function refreshPublicUrl(base: string): Promise<void> {
  try {
    const clean = (base || '').trim().replace(/\/+$/, '');
    if (!clean) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${clean}/api/device/public-url`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    clearTimeout(timer);
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.url === 'string' && data.url) await saveNgrokUrl(data.url);
  } catch {
    /* unreachable right now — try again on the next successful connection */
  }
}

/** Known server addresses — the original IP and ngrok tunnel are always listed. */
export async function getKnownServers(): Promise<string[]> {
  try {
    const ngrok = await getNgrokUrl();
    const raw = await AsyncStorage.getItem(KEY_SERVERS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return [
      ORIGINAL_SERVER,
      ...list.filter((u) => u !== ORIGINAL_SERVER && u !== ngrok),
      ngrok,
    ];
  } catch {
    return [ORIGINAL_SERVER, await getNgrokUrl()];
  }
}

export async function rememberServer(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) return;
  const ngrok = await getNgrokUrl();
  const list = await getKnownServers();
  const next = [ORIGINAL_SERVER, ...list.filter((u) => u !== ORIGINAL_SERVER && u !== ngrok && u !== clean), clean, ngrok];
  await AsyncStorage.setItem(KEY_SERVERS, JSON.stringify(next));
}

export async function getServerUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(KEY_URL);
  return (stored || ORIGINAL_SERVER).replace(/\/+$/, '');
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(KEY_URL, clean);
  if (clean) await rememberServer(clean);
  restartRealtime();
}

/**
 * Parse a scanned pairing payload into a server URL, or null if it isn't one.
 * Accepts the QR payload we print on the store screen (`http://ip:port`),
 * a bare `ip:port`, or a future-proof `biznex://pair?server=…` link.
 */
export function parsePairPayload(text: string): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let url = raw;
  if (/^biznex:\/\/pair\?/i.test(raw)) {
    const m = raw.match(/[?&]server=([^&]+)/i);
    if (!m) return null;
    url = decodeURIComponent(m[1]);
  }
  const withScheme = url.match(/^(https?:\/\/[^/]+)/i);
  if (withScheme) return withScheme[1].replace(/\/+$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(url)) return `http://${url}`;
  return null;
}

/** Quick reachability check against the server's health endpoint. */
export async function testConnection(url: string, timeoutMs = 5000): Promise<boolean> {
  const base = url.trim().replace(/\/+$/, '');
  if (!base) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Candidate store addresses in priority order: the saved server first, then the
 * original LAN IP, the ngrok tunnel, and any other known servers. No duplicates.
 */
export async function getServerCandidates(): Promise<string[]> {
  const [saved, known] = await Promise.all([getServerUrl(), getKnownServers()]);
  const out: string[] = [];
  const push = (u: string) => {
    const c = (u || '').trim().replace(/\/+$/, '');
    if (c && !out.includes(c)) out.push(c);
  };
  push(saved);
  push(ORIGINAL_SERVER);
  push(await getNgrokUrl());
  known.forEach(push);
  return out;
}

/**
 * Probe every candidate in parallel and return the first reachable store,
 * or null if none respond. Used at launch and by the failover monitor.
 */
export async function discoverServer(): Promise<string | null> {
  const candidates = await getServerCandidates();
  if (candidates.length === 0) return null;
  const results = await Promise.all(candidates.map((u) => testConnection(u, 3000)));
  const idx = results.findIndex(Boolean);
  return idx >= 0 ? candidates[idx] : null;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_TOKEN);
}

export async function getStoredUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_USER);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && typeof u === 'object' && u.id ? u : null;
  } catch {
    return null; // corrupt/partial write — treat as no session rather than crash
  }
}

export async function saveSession(token: string, user: User, refreshToken?: string): Promise<void> {
  await AsyncStorage.setItem(KEY_TOKEN, token);
  await AsyncStorage.setItem(KEY_USER, JSON.stringify(user));
  if (refreshToken) await AsyncStorage.setItem(KEY_REFRESH, refreshToken);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY_TOKEN);
  await AsyncStorage.removeItem(KEY_USER);
  await AsyncStorage.removeItem(KEY_REFRESH);
}

/**
 * Try to reach the store automatically and restore the last signed-in session.
 * Returns the user + chosen server, or null when the store is unreachable or
 * there's no saved session (caller falls back to the login screen). Never
 * throws — every failure mode degrades to "show the login screen".
 */
export async function autoConnect(): Promise<{ user: User; server: string } | null> {
  try {
    let server = await discoverServer();
    // Nothing known answers — the store may have moved Wi-Fi and picked up a
    // new IP on the same subnet. Scan for it once before giving up to login.
    if (!server) {
      const last = await getServerUrl();
      if (lanIpPrefix(last) && !subnetScanRunning) {
        subnetScanRunning = true;
        try {
          server = await scanSubnet(last);
        } finally {
          subnetScanRunning = false;
        }
      }
    }
    if (!server) return null;
    await setServerUrl(server);
    refreshPublicUrl(server); // learn any changed tunnel address immediately
    const refresh = await AsyncStorage.getItem(KEY_REFRESH);
    if (!refresh) return null;
    try {
      const d = await api<{ token: string; refreshToken: string; user: User }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: refresh },
      });
      await saveSession(d.token, d.user, d.refreshToken);
      return { user: d.user, server };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/** Core request helper. Throws ApiError on non-2xx. */
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const base = await getServerUrl();
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${base}/api${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Tells ngrok to skip its browser-warning splash page. Without it, ngrok
        // answers browser-like requests with an HTML page that has no CORS
        // headers, which the app would report as a CORS/network failure even
        // though the store server is fine.
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // fetch only rejects on network-level failures (server down, wrong address,
    // blocked connection) — give the user something actionable.
    throw new ApiError(
      `Can't reach the store at ${base}. Check the address in Settings and that your phone and store are on the same network.`,
      0
    );
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export async function login(serverUrl: string, username: string, password: string) {
  await setServerUrl(serverUrl);
  const d = await api<{ token: string; refreshToken: string; user: User }>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  await saveSession(d.token, d.user, d.refreshToken);
  // Learn the store's current public tunnel URL so remote access keeps working
  // even if ngrok assigned a new address since the last visit.
  refreshPublicUrl(serverUrl);
  return d.user;
}

// ── Realtime ────────────────────────────────────────────────────────────────

export interface RealtimeEvent {
  type: string;
  payload: unknown;
  at: string;
}

export type ConnState = 'connecting' | 'online' | 'offline';

let connState: ConnState = 'offline';
const connListeners = new Set<(s: ConnState) => void>();

/** Current live-connection status (online / connecting / offline). */
export function getConnState(): ConnState {
  return connState;
}

/** Subscribe to live-connection status changes. Returns an unsubscribe fn. */
export function subscribeConn(cb: (s: ConnState) => void): () => void {
  connListeners.add(cb);
  cb(connState);
  return () => {
    connListeners.delete(cb);
  };
}

function setConnState(s: ConnState): void {
  if (s === connState) return;
  connState = s;
  connListeners.forEach((cb) => cb(s));
}

const eventHandlers = new Set<(e: RealtimeEvent) => void>();
let socket: WebSocket | null = null;
let started = false;
let retryMs = 1500;

function wsConnect(): void {
  if (!started || socket) return;
  setConnState('connecting');
  getServerUrl().then((base) => {
    const wsUrl = base.replace(/^http/, 'ws') + '/ws';
    let s: WebSocket;
    try {
      s = new WebSocket(wsUrl);
    } catch {
      scheduleRetry();
      return;
    }
    socket = s;
    s.onopen = () => {
      retryMs = 1500;
      setConnState('online');
    };
    s.onmessage = (e) => {
      try {
        const ev = JSON.parse(String(e.data)) as RealtimeEvent;
        eventHandlers.forEach((h) => h(ev));
      } catch {
        /* ignore malformed frames */
      }
    };
    s.onclose = () => {
      socket = null;
      scheduleRetry();
    };
    s.onerror = () => {
      try {
        s.close();
      } catch {
        /* noop */
      }
    };
  });
}

function scheduleRetry(): void {
  if (!started) return;
  setConnState('offline');
  setTimeout(wsConnect, retryMs);
  retryMs = Math.min(retryMs * 2, 30000);
}

/**
 * Start the live WebSocket to the Pi. Idempotent — the socket stays up until
 * `stopRealtime()` (e.g. sign-out) and automatically reconnects with backoff,
 * so the app always stays attached to the saved server address.
 */
export function startRealtime(): void {
  started = true;
  retryMs = 1500;
  wsConnect();
}

export function stopRealtime(): void {
  started = false;
  try {
    socket?.close();
  } catch {
    /* noop */
  }
  socket = null;
  setConnState('offline');
}

/** Re-point the socket at a new server address (called after the IP changes). */
export function restartRealtime(): void {
  try {
    socket?.close();
  } catch {
    /* noop */
  }
  socket = null;
  if (started) wsConnect();
}

// ── Subnet auto-discovery ────────────────────────────────────────────────────
// When the store's Wi-Fi changes, the Pi gets a new IP — usually still on the
// same subnet (e.g. 192.168.1.x → 192.168.1.y). If every known address is dead,
// probe the /24 subnet of the last-known LAN server for anything answering
// /health as a Biznex store, so the app reconnects without a manual re-scan.

const SCAN_CONCURRENCY = 20;
const SCAN_TIMEOUT = 1500;
const SCAN_COOLDOWN = 90_000; // never scan more often than this
let lastSubnetScan = 0;
let subnetScanRunning = false;

/** "192.168.1" from "http://192.168.1.100:3000" (or null if not a LAN IP). */
function lanIpPrefix(url: string): string | null {
  const m = String(url || '').match(/^https?:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d+(?::\d+)?/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

/** True when the host answers /health as a Biznex store (not just any server). */
async function isBiznexStore(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT);
    const res = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.service === 'biznex-pos';
  } catch {
    return false;
  }
}

/**
 * Probe every host on the last-known server's /24 subnet (skipping the old IP)
 * for a live Biznex store. Concurrency-limited so the phone doesn't hammer the
 * network. Returns the first store found, or null.
 */
async function scanSubnet(lastServer: string): Promise<string | null> {
  const prefix = lanIpPrefix(lastServer);
  if (!prefix) return null;
  const port = (lastServer.match(/:\d+/) ? lastServer.match(/:\d+/)?.[0].slice(1) : '') || '3000';
  const oldIp = (lastServer.match(/https?:\/\/([\d.]+)/) || [])[1];
  const hosts: string[] = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${prefix}.${i}`;
    if (ip === oldIp) continue;
    hosts.push(`http://${ip}:${port}`);
  }
  let next = 0;
  const workers = Array.from({ length: SCAN_CONCURRENCY }, async () => {
    while (next < hosts.length) {
      const url = hosts[next++];
      if (await isBiznexStore(url)) return url;
    }
    return null;
  });
  const found = (await Promise.all(workers)).find(Boolean);
  return found ?? null;
}

// ── Failover health monitor ──────────────────────────────────────────────────

let healthTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically re-check the store while the live socket is down. If another
 * candidate (e.g. the ngrok tunnel) answers when the current server doesn't,
 * switch to it automatically. If nothing known answers, scan the last-known
 * server's subnet — the Pi may have a brand-new IP after a Wi-Fi change.
 */
export function startHealthMonitor(): void {
  stopHealthMonitor();
  healthTimer = setInterval(async () => {
    try {
      const current = await getServerUrl();
      if (getConnState() === 'online') {
        // Socket is up — keep the public tunnel URL fresh so a changed ngrok
        // address is learned automatically the moment it happens.
        await refreshPublicUrl(current);
        return;
      }
      // 1. Probe known candidates (saved, original IP, ngrok, remembered).
      const server = await discoverServer();
      if (server && server !== current) {
        await setServerUrl(server);
        restartRealtime();
        return;
      }
      // 2. Store may have moved Wi-Fi → new IP on the same subnet. Scan it
      //    (rate-limited, never while another scan is already running).
      const now = Date.now();
      if (lanIpPrefix(current) && now - lastSubnetScan > SCAN_COOLDOWN && !subnetScanRunning) {
        subnetScanRunning = true;
        lastSubnetScan = now;
        try {
          const found = await scanSubnet(current);
          if (found && found !== current) {
            await setServerUrl(found);
            await rememberServer(found);
            restartRealtime();
          }
        } finally {
          subnetScanRunning = false;
        }
      }
    } catch {
      /* keep the socket's own retry loop running */
    }
  }, 15000);
}

export function stopHealthMonitor(): void {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

/**
 * Register a listener for live events from the Pi. Starting the socket is
 * implicit — the first subscriber brings it up, and it stays connected even
 * when a screen unmounts.
 */
export function subscribeRealtime(cb: (e: RealtimeEvent) => void): () => void {
  eventHandlers.add(cb);
  startRealtime();
  return () => {
    eventHandlers.delete(cb);
  };
}

export const inr = (n: number | null | undefined, currency = '₹') =>
  `${currency}${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Startup diagnostics ──────────────────────────────────────────────────────
// Keeps the last startup error so that if the app ever fails to boot on a
// device we can see why (surfaced on the login screen).

const KEY_LAST_ERROR = 'biznex_last_error';

export async function recordStartupError(message: string): Promise<void> {
  try {
    const prev = await AsyncStorage.getItem(KEY_LAST_ERROR);
    const list: string[] = prev ? (JSON.parse(prev) as string[]).slice(0, 9) : [];
    const entry = `${new Date().toISOString()} ${message}`;
    await AsyncStorage.setItem(KEY_LAST_ERROR, JSON.stringify([entry, ...list]));
  } catch {
    /* best-effort */
  }
}

export async function getStartupErrors(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_LAST_ERROR);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
