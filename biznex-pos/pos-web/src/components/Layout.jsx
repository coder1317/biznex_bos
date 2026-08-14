import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

// Minimum role required to see each nav item (owner > admin > manager > cashier).
const NAV = [
  { to: '/', label: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', end: true, role: 'cashier' },
  { to: '/pos', label: 'POS Terminal', icon: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4V6h16v12zM6 10h4v2H6v-2zm0 4h4v2H6v-2zm6-4h6v2h-6v-2zm0 4h6v2h-6v-2z', role: 'cashier' },
  { to: '/orders', label: 'Orders', icon: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z', role: 'cashier' },
  { to: '/inventory', label: 'Inventory', icon: 'M20 7l-8-4-8 4v10l8 4 8-4V7zM12 5.2l5.4 2.7L12 10.6 6.6 7.9 12 5.2zM6 9.6l5 2.5v5.9l-5-2.5V9.6zm8 8.4v-5.9l5-2.5v5.9l-5 2.5z', role: 'manager' },
  { to: '/staff', label: 'Staff', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', role: 'admin' },
  { to: '/discounts', label: 'Discounts', icon: 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z', role: 'manager' },
  { to: '/complaints', label: 'Complaints', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', role: 'manager' },
  { to: '/reports', label: 'Reports', icon: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z', role: 'manager' },
  { to: '/settings', label: 'Settings', icon: 'M19.14 12.94a7.07 7.07 0 0 0 .06-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.05 7.05 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.34 9.72c-.12.2-.08.46.12.64l2.03 1.58c-.04.62-.06 1.26-.06 1.88 0 .62.02 1.26.06 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.39.3.61.22l2.39-.96c.49.38 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32c.12-.22.07-.48-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z', role: 'admin' },
];

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Light badges for the deep-violet sidebar
  const roleBadge = { owner: 'bg-white/25 text-white', admin: 'bg-purple-400/40 text-white', manager: 'bg-cyan-400/30 text-white', cashier: 'bg-white/10 text-white/80' };
const ROLE_LEVEL = { owner: 4, admin: 3, manager: 2, cashier: 1 };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-ink-light border-r border-white/10 flex flex-col">
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/10">
          <div className="w-7 h-7 rounded-lg bg-white/95 text-accent-dark flex items-center justify-center font-bold text-sm">B</div>
          <div>
            <div className="text-sm font-bold text-white leading-none">Biznex</div>
            <div className="text-[10px] text-white/60 mt-0.5">Store POS</div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {NAV.filter((item) => {
            const min = ROLE_LEVEL[item.role] ?? 0;
            return (ROLE_LEVEL[user?.role] ?? 0) >= min;
          }).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white font-bold text-xs uppercase">
              {user?.name?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white truncate">{user?.name}</div>
              <span className={`badge mt-0.5 capitalize ${roleBadge[user?.role] || ''}`}>{user?.role}</span>
            </div>
            <button onClick={logout} title="Sign out" className="text-white/55 hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4V5z" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-ink/80 backdrop-blur border-b border-ink-border flex items-center justify-between px-5">
          <div className="flex items-center gap-2 text-[12px] text-mist-faint">
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-good animate-pulse' : 'bg-warn'}`} />
            {online ? 'Connected to server' : 'Offline'}
          </div>
          <div className="flex items-center gap-4">
            <div className="font-mono text-[13px] text-mist-dim">
              {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              <span className="mx-1.5 text-mist-faint">·</span>
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            {(ROLE_LEVEL[user?.role] ?? 0) >= 3 && (
              <button onClick={() => navigate('/settings')} className="text-mist-dim hover:text-mist transition-colors" title="Settings">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM19.4 13a7.6 7.6 0 0 0 .07-1 7.6 7.6 0 0 0-.07-1l2.11-1.63a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 13.97 2h-3.94a.5.5 0 0 0-.5.42l-.38 2.65c-.6.25-1.17.58-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L4.53 11a7.6 7.6 0 0 0-.07 1c0 .34.02.67.07 1l-2.11 1.63a.5.5 0 0 0-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.09.73 1.69.98l.38 2.65c.04.24.25.42.5.42h3.94c.25 0 .46-.18.5-.42l.38-2.65c.6-.25 1.17-.58 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64L19.4 13z" /></svg>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
