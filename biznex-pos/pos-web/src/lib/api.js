// Thin API client. The token is kept in localStorage (see auth.js).
export function getToken() {
  return localStorage.getItem('biznex_token');
}

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = `/api${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    if (qs.toString()) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const money = (n, currency = '₹') =>
  `${currency}${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Live updates: reconnect with backoff, call handlers by event type. */
export function connectRealtime(handlers) {
  let socket;
  let closed = false;
  let retry = 1000;

  const connect = () => {
    if (closed) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}/ws`);

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handlers.onEvent?.(msg);
      } catch { /* ignore malformed */ }
    };
    socket.onopen = () => { retry = 1000; handlers.onOpen?.(); };
    socket.onclose = () => {
      if (closed) return;
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 30000);
      handlers.onClose?.();
    };
  };
  connect();

  return () => {
    closed = true;
    socket?.close();
  };
}
