import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Spinner, useToast } from '../components/ui';

export default function Settings() {
  const { user, can, logout } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [lastChecked, setLastChecked] = useState(null);
  const [ipChanged, setIpChanged] = useState(false);
  const selectedRef = useRef(0);

  useEffect(() => {
    api('/settings').then((d) => setSettings(d.settings)).catch(() => {});
  }, []);

  // Pairing addresses — polled continuously so the QR always reflects the Pi's
  // CURRENT address. When the store's Wi-Fi changes and the Pi gets a new IP,
  // the QR regenerates by itself within a few seconds (no reload, no manual
  // refresh). Keeps the user's selected entry by label where possible.
  useEffect(() => {
    let cancelled = false;
    let lastKey = '';
    const poll = async () => {
      try {
        const d = await api('/device/addresses');
        if (cancelled || !d.addresses?.length) return;
        const key = d.addresses.map((a) => a.url).join('|');
        if (key === lastKey) {
          setLastChecked(new Date());
          return;
        }
        const prev = addressesRef.current;
        const prevChosen = prev[selectedRef.current];
        lastKey = key;
        setAddresses(d.addresses);
        // Keep the selection by label (e.g. LAN / Tailscale / Remote) so the
        // QR doesn't jump to a different address after a network change.
        const idx = prevChosen ? d.addresses.findIndex((a) => a.label === prevChosen.label) : -1;
        setSelected(idx >= 0 ? idx : 0);
        setIpChanged(true);
        setLastChecked(new Date());
        setTimeout(() => setIpChanged(false), 4000);
      } catch {
        /* server unreachable — keep showing the last-known QR */
      }
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Mirror the current selection into a ref so the polling loop can read it
  // without re-subscribing, and keep the addresses snapshot handy for diffs.
  const addressesRef = useRef(addresses);
  useEffect(() => { addressesRef.current = addresses; }, [addresses]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Regenerate the QR whenever the selected address changes.
  useEffect(() => {
    const url = addresses[selected]?.url;
    if (!url) { setQrDataUrl(''); return; }
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#020617', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [addresses, selected]);

  if (!settings) return <Spinner text="Loading settings…" />;

  const save = async () => {
    try {
      await api('/settings', { method: 'PUT', body: saved });
      setSettings({ ...settings, ...saved });
      setSaved(null);
      toast('Settings saved');
    } catch (e) { toast(e.message, 'error'); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/password', { method: 'PUT', body: pw });
      toast('Password changed');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err) { toast(err.message, 'error'); }
  };

  const set = (k) => (e) => setSaved({ ...(saved || settings), [k]: e.target.value });

  const inputs = [
    { key: 'shop_name', label: 'Shop name', type: 'text' },
    { key: 'shop_address', label: 'Address', type: 'text' },
    { key: 'shop_phone', label: 'Phone', type: 'text' },
    { key: 'gstin', label: 'GSTIN', type: 'text' },
    { key: 'receipt_footer', label: 'Receipt footer', type: 'text' },
    { key: 'currency', label: 'Currency symbol', type: 'text' },
    { key: 'default_tax_rate', label: 'Default tax rate (%)', type: 'number' },
    { key: 'low_stock_threshold', label: 'Low stock threshold', type: 'number' },
  ];

  return (
    <div className="max-w-2xl space-y-5 animate-fadeUp">
      <div>
        <h1 className="text-lg font-bold text-mist">Settings</h1>
        <p className="text-xs text-mist-faint mt-0.5">Store information, receipt and tax configuration</p>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-mist">Store details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {inputs.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" type={f.type} value={(saved || settings)[f.key] ?? ''} onChange={set(f.key)} />
            </div>
          ))}
        </div>
        {can('admin') && (
          <div className="flex gap-2 pt-1">
            <button className="btn-primary" onClick={save}>Save settings</button>
            {saved && <button className="btn-ghost" onClick={() => setSaved(null)}>Discard</button>}
          </div>
        )}
      </div>

      {can('manager') ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-mist mb-1">Pair the owner app</h2>
          <p className="text-xs text-mist-faint mb-4">
            Open <span className="text-mist">Biznex Owner</span> on your phone → tap{' '}
            <span className="text-mist">Scan QR</span> → point the camera at this code. The address
            fills in automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 items-center">
            <div className="bg-white rounded-xl p-3 shrink-0 shadow-lg relative">
              {qrDataUrl ? (
                <img src={qrDataUrl} width={200} height={200} alt="Pairing QR code" className="rounded-lg" />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-xs text-mist-faint bg-white rounded-lg">Loading…</div>
              )}
              {ipChanged && (
                <div className="absolute inset-0 rounded-lg bg-accent/10 border-2 border-accent flex items-center justify-center text-center px-2">
                  <span className="text-[11px] font-bold text-accent animate-fadeUp">IP changed — QR updated</span>
                </div>
              )}
            </div>
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ipChanged ? 'bg-accent' : 'bg-green-400'}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${ipChanged ? 'bg-accent' : 'bg-green-500'}`} />
                </span>
                <span className="text-[11px] font-semibold text-mist-dim">
                  Auto-refresh on · {lastChecked
                    ? `checked ${Math.max(0, Math.round((Date.now() - lastChecked.getTime()) / 1000))}s ago`
                    : 'checking…'}
                </span>
              </div>
              <div>
                <label className="label">Address to pair</label>
                {addresses.length > 1 ? (
                  <select className="input" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
                    {addresses.map((a, i) => (
                      <option key={a.url} value={i} className="bg-ink">{a.label} — {a.url}</option>
                    ))}
                  </select>
                ) : (
                  <div className="font-mono text-[13px] text-mist bg-ink-lighter px-3 py-2 rounded-lg break-all">
                    {addresses[0]?.url || 'Detecting…'}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-mist-faint">
                <span className="px-2 py-1 rounded bg-ink-lighter">Same Wi-Fi: pick <b className="text-mist">LAN</b></span>
                <span className="px-2 py-1 rounded bg-ink-lighter">From anywhere: pick <b className="text-mist">Tailscale</b></span>
              </div>
              <p className="text-[11px] text-mist-faint">
                This page: <span className="font-mono text-mist">{window.location.host}</span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-mist mb-3">Connection</h2>
          <div className="space-y-2 text-[13px] text-mist-dim">
            <div className="flex justify-between"><span>This device</span><span className="font-mono text-mist">{window.location.host}</span></div>
            <div className="flex justify-between"><span>Server</span><span className="font-mono text-mist">{window.location.protocol}//{window.location.host}</span></div>
            <p className="text-[11px] text-mist-faint pt-1">Ask the store owner to scan the pairing QR code from Settings.</p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-mist mb-3">Change password</h2>
        <form className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" onSubmit={changePassword}>
          <div><label className="label">Current password</label><input className="input" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
          <div><label className="label">New password</label><input className="input" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={6} /></div>
          <button className="btn-ghost" type="submit" disabled={!pw.currentPassword || !pw.newPassword}>Update</button>
        </form>
        <p className="text-[11px] text-mist-faint mt-3">Signed in as <span className="text-mist">{user?.name}</span> ({user?.role}).</p>
      </div>

      {can('admin') && (
        <div className="card p-5 border-bad/30">
          <h2 className="text-sm font-semibold text-bad mb-1">Danger zone</h2>
          <p className="text-xs text-mist-faint mb-3">Sign out of this terminal.</p>
          <button className="btn-danger" onClick={logout}>Sign out</button>
        </div>
      )}
    </div>
  );
}
