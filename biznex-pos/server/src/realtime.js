import { WebSocketServer } from 'ws';

/**
 * Lightweight realtime hub. Any client (POS web, owner app) can subscribe;
 * events are broadcast to every connected client.
 *
 * Event shape: { type: "order:created", payload: {...}, at: "2026-08-14T..." }
 */

let hub = null;

export function createRealtimeHub(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });

    socket.send(JSON.stringify({ type: 'hello', payload: { serverTime: new Date().toISOString() }, at: new Date().toISOString() }));
  });

  // Heartbeat: drop dead connections every 30s
  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(interval));

  hub = {
    broadcast(type, payload) {
      const msg = JSON.stringify({ type, payload, at: new Date().toISOString() });
      for (const socket of wss.clients) {
        if (socket.readyState === socket.OPEN) socket.send(msg);
      }
    },
  };
  return hub;
}

/** Broadcast an event to all connected clients (safe no-op before server starts). */
export function broadcast(type, payload) {
  hub?.broadcast(type, payload);
}
