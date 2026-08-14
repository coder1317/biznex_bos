import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_URL = 'biznex_server_url';
const KEY_TOKEN = 'biznex_token';
const KEY_USER = 'biznex_user';
const KEY_REFRESH = 'biznex_refresh_token';

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

/** The permanent ngrok tunnel — reachable from any network, used as a failover. */
export const NGROK_URL = 'https://backspace-rice-surfacing.ngrok-free.dev';

const KEY_SERVERS = 'biznex_servers';

/** Known server addresses — the original IP and ngrok tunnel are always listed. */
export async function getKnownServers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SERVERS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return [
      ORIGINAL_SERVER,
      ...list.filter((u) => u !== ORIGINAL_SERVER && u !== NGROK_URL),
      NGROK_URL,
    ];
  } catch {
    return [ORIGINAL_SERVER, NGROK_URL];
  }
}

export async function rememberServer(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) return;
  const list = await getKnownServers();
  const next = [ORIGINAL_SERVER, ...list.filter((u) => u !== ORIGINAL_SERVER && u !== NGROK_URL && u !== clean), clean, NGROK_URL];
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
  push(NGROK_URL);
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
    const server = await discoverServer();
    if (!server) return null;
    await setServerUrl(server);
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

// ── Failover health monitor ──────────────────────────────────────────────────

let healthTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically re-check the store while the live socket is down. If another
 * candidate (e.g. the ngrok tunnel) answers when the current server doesn't,
 * switch to it automatically so the app stays connected from anywhere.
 */
export function startHealthMonitor(): void {
  stopHealthMonitor();
  healthTimer = setInterval(async () => {
    if (getConnState() === 'online') return; // live socket is up — nothing to do
    try {
      const current = await getServerUrl();
      const server = await discoverServer();
      if (server && server !== current) {
        await setServerUrl(server);
        restartRealtime();
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
