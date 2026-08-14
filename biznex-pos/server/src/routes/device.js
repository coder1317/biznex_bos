import { Router } from 'express';
import os from 'node:os';
import { requireAuth, requireAtLeast } from '../auth.js';
import { config } from '../config.js';

function isPrivate(ip) {
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  return m ? Number(m[1]) >= 16 && Number(m[1]) <= 31 : false;
}

const VPN_IFACE = /tailscale|wg\d*|zerotier|tun/i;

/**
 * Enumerate IPv4 addresses the owner's phone can reach. LAN interfaces first
 * (private ranges preferred), then VPN interfaces (Tailscale, WireGuard…).
 */
export function detectDeviceAddresses(port) {
  const lan = [];
  const vpn = [];
  for (const [iface, addrs] of Object.entries(os.networkInterfaces() ?? {})) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const entry = { ip: a.address, iface };
      if (VPN_IFACE.test(iface)) vpn.push(entry);
      else lan.push(entry);
    }
  }
  const byPreference = (a, b) =>
    Number(isPrivate(b.ip)) - Number(isPrivate(a.ip)) || a.iface.localeCompare(b.iface);
  const urls = [...lan.sort(byPreference), ...vpn.sort(byPreference)].map((e) => ({
    label: VPN_IFACE.test(e.iface) ? 'Tailscale' : 'LAN',
    url: `http://${e.ip}:${port}`,
  }));
  const seen = new Set();
  return urls.filter((u) => (seen.has(u.url) ? false : (seen.add(u.url), true)));
}

export const deviceRouter = Router();
deviceRouter.use(requireAuth);

/**
 * If an ngrok tunnel is running, ngrok exposes a local API (127.0.0.1:4040)
 * listing the public https URL. We surface it so the pairing QR code can show
 * the "reachable from anywhere" address automatically.
 */
async function getNgrokPublicUrl() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const tunnel = (data.tunnels ?? []).find(
      (t) => typeof t.public_url === 'string' && t.public_url.startsWith('https')
    );
    return tunnel?.public_url || null;
  } catch {
    return null; // no ngrok running — fine
  }
}

/**
 * GET /api/device/addresses — the addresses this Pi can be reached at, for the
 * phone-pairing QR code. If the UI was opened via an IP-based host (e.g. the
 * Tailscale IP), that address is surfaced first. When an ngrok tunnel is up,
 * its public https URL is appended as "Remote (ngrok)".
 */
deviceRouter.get('/addresses', requireAtLeast('manager'), async (_req, res) => {
  const addresses = detectDeviceAddresses(config.port);
  const host = String(_req.headers.host ?? '');
  const hostIp = host.split(':')[0];
  const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostIp);
  if (isIpHost && hostIp !== '127.0.0.1' && hostIp !== 'localhost') {
    const already = addresses.some((a) => a.url === `http://${host}`);
    if (!already) addresses.unshift({ label: 'Current view', url: `http://${host}` });
  }
  const ngrokUrl = await getNgrokPublicUrl();
  if (ngrokUrl) addresses.push({ label: 'Remote (ngrok)', url: ngrokUrl });
  res.json({ addresses });
});
